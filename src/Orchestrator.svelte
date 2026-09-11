<script lang="ts">
  // Orchestrator.svelte
  // -----------------------------------------------------------------------
  // The intelligent orchestration layer described in orchestrator-prompt.md:
  // it sits between the UI selection component (HexMenu.svelte), the
  // generic Nostr infrastructure (nostr.ts), the generic reactive store
  // (store.ts, via Orchestrator/appStore.ts), and the local persistence
  // layer for LISTING (idb.ts, via Orchestrator/listingPersistence.ts).
  //
  // It does NOT talk to Cesium at all. Cesium-side entity rendering and
  // click handling (marker sync, entity picking, showing EntityDetails)
  // live in cesium/EntityLayer.svelte, which reads the same Store this
  // component writes — orchestrator-prompt.md §9/§10: Cesium reads the
  // Store, it is never told about or driven by this component directly.
  //
  // ─── Integration contract ─────────────────────────────────────────────
  // Mounted once, persistently, alongside HexMenu/Cesium — it owns a
  // standing relay connection, the tombstone watcher, and whatever LIVE
  // heartbeat/expansion is currently in progress, none of which should be
  // torn down between individual user actions. New work arrives purely
  // through a prop, not an imperative method call: the parent tracks the
  // current pending intent as local reactive state and passes it straight
  // through — plain prop-down + a reactive statement, no event bus, no
  // wrapper/controller layer.
  //
  // Exactly one workflow (a LIVE search/offer, a LISTING search/offer, or
  // a "Load More") may run at a time. A new `submit` value while one is
  // already active is ignored — the only way to stop a running workflow
  // is the Abort control this component renders itself, right below the
  // rest of its workflow-status UI (relay connection, in-flight/sync
  // state, errors, the current LIVE match, "Load More" for LISTING
  // search). `$appStore.inFlight` reflects exactly this "a workflow is
  // active" state for any other consumer that needs it.
  //
  // Two more props follow the exact same prop-down + reactive-statement
  // pattern as `submit`, each its own small isolated operation rather than
  // a bounded workflow (neither is gated by the single-workflow lock):
  // `deleteRequest` (owner deletion, bubbled up from cesium/EntityDetails.svelte
  // via its parent) and `openEventId` (deep-link resolution: fetches one
  // specific event by id if it isn't already known — App.svelte sets this
  // from the current URL).
  // -----------------------------------------------------------------------

  import { onMount, onDestroy } from 'svelte';
  import {
    NostrClient,
    getExpiration,
    isDeletionEvent,
    getDeletionTarget,
    DELETION_TAG_VALUE,
    DEFAULT_ENCRYPTED_KIND,
    buildFilter,
    createExpiryTracker,
    type NostrEvent,
    type NostrFilter,
    type SubscriptionHandle,
  } from './nostr';
  import { encode, cells3x3, cells4x4, cellsInParent } from './orchestrator/geohash';
  import {
    getModelPolicy,
    ABSOLUTE_MAX_VALIDITY_DAYS,
    type ListingModelPolicy,
  } from './orchestrator/listingPolicy';
  import { getKeypair } from './orchestrator/keyManager';
  import {
    appStore,
    type AppState,
    type LiveRecord,
    type ListingRecord,
    type MissionRecord,
    type MissionLocation,
    type MissionLanes,
  } from './orchestrator/appStore';
  import {
    saveListing,
    deleteListing as deleteListingPersisted,
    loadAllListings,
  } from './orchestrator/listingPersistence';
  import {
    saveMission,
    deleteMission as deleteMissionPersisted,
    loadAllMissions,
  } from './orchestrator/missionPersistence';
  import type { LocationValue } from './hexmenu/domains';

  // ─── Tuning constants (orchestrator's own policy, not infrastructure) ──

  /** Distinct replaceable-event kinds so LIVE claims, LISTINGs and Missions never share a NIP-33 identity space. */
  const LIVE_KIND = 30079;
  const LISTING_KIND = 30078;
  const MISSION_KIND = 30080;

  const LIVE_G6_PRECISION = 6;
  /** Short claim lifetime — renewed by heartbeat well before it elapses. */
  const LIVE_TTL_SECS = 75;
  /** Heartbeat fires this many seconds before the current claim would expire. */
  const LIVE_HEARTBEAT_LEAD_SECS = 20;
  const LIVE_EXPAND_EMPTY_INTERVAL_MS = 15_000;
  const LIVE_EXPAND_NOMATCH_INTERVAL_MS = 20_000;
  /** 0=start cell, 1=3×3, 2=4×4, 3=parent-prefix block — see orchestrator-prompt.md §2.4. */
  const LIVE_MAX_EXPAND_LEVEL = 3;

  const LISTING_SEARCH_PRECISION_INITIAL = 5;
  const LISTING_QUERY_TIMEOUT_MS = 15_000;

  /** Mission discovery is global/unbounded (no geohash, no limit — see the mission spec §11) and just re-runs on this interval; no scheduler needed for something this simple. */
  const MISSION_DISCOVERY_INTERVAL_MS = 30 * 60 * 1000;
  const MISSION_QUERY_TIMEOUT_MS = 20_000;

  // ═══════════════════════════════════════════════════════════════════
  // Entry point (§1) — plain prop, no exported imperative methods
  // ═══════════════════════════════════════════════════════════════════

  interface HexMenuPayload {
    tags: string[][];
    content: string;
  }

  export let submit: { payload: HexMenuPayload; action: 'offer' | 'search' } | null = null;

  $: if (submit) handleSubmit(submit.payload, submit.action);

  /**
   * Owner-initiated deletion of one of the caller's own listings or
   * missions (see cesium/EntityDetails.svelte's and missions/
   * SwarmGovernance.svelte's Delete buttons). Same prop-down pattern as
   * `submit` — no exported imperative method, no bind:this. `id` is the
   * `${author}:${dTag}` logical id shown in the store; `kind` picks which
   * of the two (otherwise identical) tombstone flows applies.
   */
  export let deleteRequest: { id: string; kind: 'listing' | 'mission' } | null = null;

  $: if (deleteRequest) {
    if (deleteRequest.kind === 'mission') deleteOwnMission(deleteRequest.id);
    else deleteOwnListing(deleteRequest.id);
  }

  /**
   * A newly created or edited mission (see missions/SwarmGovernance.svelte's
   * Submit/Save). Same prop-down pattern as `submit`. Fed from two places —
   * HexMenu's own "new mission" modal, and cesium/EntityLayer.svelte's
   * "existing mission" card — both funnel into this one prop, same as any
   * other Svelte event forwarding in this app.
   */
  export let missionSubmit: {
    dTag?: string;
    title: string;
    description: string;
    location: MissionLocation;
    lanes: MissionLanes;
  } | null = null;

  $: if (missionSubmit) publishMission(missionSubmit);

  /**
   * A specific Nostr event id to fetch and bring into the Store if it
   * isn't already known — the network-side half of opening a deep link
   * (cesium/EntityLayer.svelte does the Store-side half: selecting it
   * once present, across both listings and missions). Reuses the exact
   * same fetch-by-id + processListingEvent/processMissionEvent pipeline
   * already used for our own publish-echoes and for delete confirmations
   * — not a second discovery mechanism. The event's own `kind` (not the
   * deep link's URL domain) decides which of the two it is.
   */
  export let openEventId: string | null = null;

  // Deep links are resolved explicitly from onMount after the Nostr client
  // exists. There is deliberately no reactive `openEventId` fetch here:
  // App.svelte may provide the prop before `client` has been initialized,
  // and a reactive statement depending only on openEventId would then
  // never rerun when client becomes available.

  // ─── Single active workflow (§1/§2 of the second review) ────────────
  //
  // Exactly one user-initiated workflow (a LIVE search/offer, a LISTING
  // search/offer, or a "Load More") may run at a time. `activeWorkflowToken`
  // identifies whichever one is currently running — every async workflow
  // step captures it locally and checks it's still current after each
  // `await`, before touching the Store, so a stale result from an already
  // -aborted workflow can never land late. Not a generation counter: since
  // only one workflow can ever be active, a single mutable reference is
  // enough — the same identity-check pattern LIVE's own `liveSession`
  // guards already used.
  //
  // `$appStore.inFlight` doubles as "a workflow is active" for the UI
  // (nothing else ever sets it) — see the workflow-status template below,
  // which renders the actual Abort control.

  let activeWorkflowToken: symbol | null = null;

  function beginWorkflow(): symbol {
    const token = Symbol('workflow');
    activeWorkflowToken = token;
    appStore.update((s) => ({ ...s, inFlight: true, lastError: null }));
    return token;
  }

  /** The one and only place inFlight goes back to false — clears the workflow token first, so any already-in-flight await's guard check fails from this point on. */
  function endWorkflow(patch: Partial<AppState> = {}) {
    activeWorkflowToken = null;
    appStore.update((s) => ({ ...s, inFlight: false, ...patch }));
  }

  /**
   * Stops whatever workflow is currently running. Network requests already
   * in flight (nostr.ts exposes no cancellation — see its query()/publish
   * primitives) are left to resolve naturally; every workflow function
   * checks activeWorkflowToken right after its own await and discards its
   * result once it no longer matches, so nothing an aborted workflow was
   * doing can still reach the Store after this runs.
   */
  function abortActiveWorkflow() {
    if (!activeWorkflowToken) return;

    activeWorkflowToken = null;

    if (liveSession) {
      cancelActiveLiveSession();
    }

    if (listingSearch) {
      listingSearch.liveSub?.close();
      listingSearch = null;
    }

    appStore.update((s) => ({
      ...s,
      inFlight: false,
      listingSearch: null,
    }));
  }

  // ─── Nostr client lifecycle ─────────────────────────────────────────

  let client: NostrClient | null = null;
  let connectedRelays = 0;
  const listingExpiryTracker = createExpiryTracker();

  // ─── LIVE session state — at most one active at a time (§11) ───────

  interface LiveSessionInternal {
    role: 'requester' | 'provider';
    model: string;
    dTag: string;
    content: Record<string, any>;
    location: { latitude: number; longitude: number };
    geohash: string;
    expandLevel: 0 | 1 | 2 | 3;
    expiresAt: number;
    status: 'searching' | 'matched' | 'expired' | 'cancelled';
    peerPubkey?: string;
    discoverySub?: SubscriptionHandle;
    dmSub?: SubscriptionHandle;
    /** Logical dedup of discovered counterpart claims, keyed by author pubkey. */
    seenCounterpartAuthors: Set<string>;
    /** Provider only: requester pubkeys we've already sent an "accept" DM to. */
    repliedTo: Set<string>;
    heartbeatTimer?: ReturnType<typeof setTimeout>;
    expandEmptyTimer?: ReturnType<typeof setInterval>;
    expandNoMatchTimer?: ReturnType<typeof setInterval>;
    finalGraceTimer?: ReturnType<typeof setTimeout>;
  }

  let liveSession: LiveSessionInternal | null = null;

  // ─── LISTING search state — tracks the active search scope for "Load More" ──

  interface ListingSearchState {
    model: string;
    categoryFilter: string[] | null;
    geohash5: string;
    geohash4: string;
    precision: 5 | 4;
    liveSub?: SubscriptionHandle;
  }

  let listingSearch: ListingSearchState | null = null;

  // ─── Background tombstone watcher (§4) — runs for the component's whole lifetime ──

  let tombstoneSub: SubscriptionHandle | null = null;
  let tombstoneCursor = Math.floor(Date.now() / 1000);

  let missionDiscoveryTimer: ReturnType<typeof setInterval> | undefined;

  // ═══════════════════════════════════════════════════════════════════
  // Payload contract (§1)
  // ═══════════════════════════════════════════════════════════════════

  /** Publish a tombstone for one of the caller's own listings and wait for it to come back through the normal receive path (§3.2/§4), same as any other listing mutation. `id` is the `${author}:${dTag}` logical id shown in the store. */
  async function deleteOwnListing(id: string) {
    if (!client) return;

    const dTag = id.slice(id.indexOf(':') + 1);
    const marker = client.publishDeletionMarker(dTag, [], LISTING_KIND);

    const own = await client.query(
      { kinds: [LISTING_KIND], ids: [marker.id] },
      { timeoutMs: LISTING_QUERY_TIMEOUT_MS, retries: 1 },
    );

    for (const event of own.events) {
      await processListingEvent(event, { persist: true });
    }
  }

  /** Same as deleteOwnListing, for a Mission's replaceable identity/kind instead of a listing's. */
  async function deleteOwnMission(id: string) {
    if (!client) return;

    const dTag = id.slice(id.indexOf(':') + 1);
    const marker = client.publishDeletionMarker(dTag, [], MISSION_KIND);

    const own = await client.query(
      { kinds: [MISSION_KIND], ids: [marker.id] },
      { timeoutMs: MISSION_QUERY_TIMEOUT_MS, retries: 1 },
    );

    for (const event of own.events) {
      processMissionEvent(event);
    }
  }

  /**
   * Fetches one specific event by its actual Nostr event id — a listing
   * or a mission, whichever it turns out to be — and feeds it through the
   * matching normal receive pipeline.
   */
  async function fetchEntityByEventId(eventId: string) {
    if (!client) return;

    const result = await client.query(
      { kinds: [LISTING_KIND, MISSION_KIND], ids: [eventId] },
      { timeoutMs: LISTING_QUERY_TIMEOUT_MS, retries: 1 },
    );

    for (const event of result.events) {
      if (event.kind === MISSION_KIND) {
        processMissionEvent(event);
      } else {
        await processListingEvent(event, { persist: true });
      }
    }
  }

  async function handleSubmit(payload: HexMenuPayload, action: 'offer' | 'search') {
    if (!client) {
      setError('Not connected yet — try again in a moment.');
      return;
    }

    if (activeWorkflowToken) {
      console.warn('[Orchestrator] Ignoring submit — a workflow is already active. Use Abort first.');
      return;
    }

    const domain = tagValue(payload.tags, 'domain');
    const model = tagValue(payload.tags, 'model');
    const anypay = payload.tags.filter((t) => t[0] === 'anypay').map((t) => t[1]);

    if (!domain) {
      setError('Payload is missing domain.');
      return;
    }

    let content: Record<string, any>;

    try {
      content = JSON.parse(payload.content);
    } catch {
      setError('Payload content is not valid JSON.');
      return;
    }

    const policy = getModelPolicy(model, domain);

    if (!policy) {
      setError(
        model
          ? `No operating-mode policy known for model "${model}".`
          : `Domain "${domain}" requires a model.`,
      );
      return;
    }

    const effectiveModel = model ?? domain;
    const token = beginWorkflow();

    if (policy.mode === 'LIVE') {
      const role = action === 'offer' ? 'provider' : 'requester';
      await startLiveSession(role, effectiveModel, content);
    } else if (policy.mode === 'LISTING' && action === 'offer') {
      await publishListing(domain, effectiveModel, anypay, content, policy, token);
    } else {
      await searchListings(effectiveModel, content, policy, token);
    }
  }

  function tagValue(tags: string[][], key: string): string | undefined {
    return tags.find((t) => t[0] === key)?.[1];
  }

  function setError(message: string) {
    console.warn(`[Orchestrator] ${message}`);
    endWorkflow({ lastError: message });
  }

  function extractStartCoordinate(
    location: LocationValue | null | undefined,
  ): { latitude: number; longitude: number } | null {
    if (!location) return null;
    if (location.geometry === 'point') return location.point;
    if (location.geometry === 'route') return location.from;
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // LIVE mode (§2)
  // ═══════════════════════════════════════════════════════════════════

  async function startLiveSession(
    role: 'requester' | 'provider',
    model: string,
    content: Record<string, any>,
  ) {
    if (!client) return;

    const location = extractStartCoordinate(
      content.location as LocationValue | undefined,
    );

    if (!location) {
      setError('LIVE requires a location.');
      return;
    }

    const geohash = encode(
      location.latitude,
      location.longitude,
      LIVE_G6_PRECISION,
    );

    const dTag = `live-${role}-${crypto.randomUUID()}`;

    const session: LiveSessionInternal = {
      role,
      model,
      dTag,
      content,
      location,
      geohash,
      expandLevel: 0,
      expiresAt: 0,
      status: 'searching',
      seenCounterpartAuthors: new Set(),
      repliedTo: new Set(),
    };

    liveSession = session;

    appStore.update((s) => ({
      ...s,
      live: toLiveRecord(session),
    }));

    const published = await publishLiveClaim(session);

    if (liveSession !== session) return;

    if (!published) {
      endLiveSession(session, 'expired');
      return;
    }

    scheduleLiveHeartbeat(session);
    startLiveDiscovery(session);
    startLiveExpansionTimers(session);

    if (role === 'requester') {
      startLiveDmListener(session);
    }
  }

  async function publishLiveClaim(
    session: LiveSessionInternal,
  ): Promise<boolean> {
    if (!client) return false;

    const expiresAt =
      Math.floor(Date.now() / 1000) + LIVE_TTL_SECS;

    const counterKind =
      session.role === 'requester' ? 'need' : 'offer';

    const body = JSON.stringify({
      ...session.content,
      status: session.status,
      winnerPubkey: session.peerPubkey ?? null,
    });

    const result = await client.publishReplaceableWithVerify({
      dTag: session.dTag,
      kind: LIVE_KIND,
      tags: [
        ['t', `${counterKind}-${session.model}`],
        ['g', session.geohash],
        ['expiration', String(expiresAt)],
      ],
      content: body,
      verifyFilter: {
        kinds: [LIVE_KIND],
        authors: [client.pubkey],
        '#d': [session.dTag],
      },
      query: {
        timeoutMs: 8000,
        retries: 1,
      },
    });

    if (result.status === 'failed') return false;

    session.expiresAt = expiresAt;
    return true;
  }

  function scheduleLiveHeartbeat(session: LiveSessionInternal) {
    const nowSecs = Math.floor(Date.now() / 1000);

    const delayMs = Math.max(
      1000,
      (session.expiresAt - LIVE_HEARTBEAT_LEAD_SECS - nowSecs) * 1000,
    );

    session.heartbeatTimer = setTimeout(async () => {
      if (
        liveSession !== session ||
        session.status !== 'searching'
      ) {
        return;
      }

      const ok = await publishLiveClaim(session);

      if (liveSession !== session) return;

      if (!ok) {
        endLiveSession(session, 'expired');
        return;
      }

      scheduleLiveHeartbeat(session);
    }, delayMs);
  }

  function startLiveDiscovery(session: LiveSessionInternal) {
    if (!client) return;

    const counterTag =
      `${session.role === 'requester' ? 'offer' : 'need'}-${session.model}`;

    const filter = buildFilter({
      kinds: [LIVE_KIND],
      tags: {
        t: [counterTag],
        g: [session.geohash],
      },
    });

    session.discoverySub = client.subscribe(
      `live-disc-${session.dTag}`,
      filter,
      (event) => handleLiveCandidate(session, event),
    );
  }

  function dTagOf(event: NostrEvent): string | undefined {
    return event.tags.find((t) => t[0] === 'd')?.[1];
  }

  function handleLiveCandidate(
    session: LiveSessionInternal,
    event: NostrEvent,
  ) {
    if (
      liveSession !== session ||
      session.status !== 'searching'
    ) {
      return;
    }

    if (isDeletionEvent(event)) return;

    let body: any;

    try {
      body = JSON.parse(event.content);
    } catch {
      return;
    }

    session.seenCounterpartAuthors.add(event.pubkey);

    if (session.role === 'requester') {
      return;
    }

    if (body?.status === 'taken') {
      if (body?.winnerPubkey === client?.pubkey) {
        session.peerPubkey = event.pubkey;
        endLiveSession(session, 'matched');
      }
      return;
    }

    if (body?.status && body.status !== 'open') return;

    if (session.repliedTo.has(event.pubkey)) return;

    session.repliedTo.add(event.pubkey);

    const requestId = dTagOf(event);
    if (!requestId) return;

    client?.sendEncrypted(
      event.pubkey,
      JSON.stringify({
        type: 'accept',
        requestId,
      }),
      [
        [
          'expiration',
          String(
            Math.floor(Date.now() / 1000) + LIVE_TTL_SECS,
          ),
        ],
      ],
    );
  }

  function startLiveDmListener(session: LiveSessionInternal) {
    if (!client) return;

    const since = Math.floor(Date.now() / 1000);

    const filter = buildFilter({
      kinds: [DEFAULT_ENCRYPTED_KIND],
      tags: { p: [client.pubkey] },
      since,
    });

    session.dmSub = client.subscribeEncrypted(
      filter,
      (fromPubkey, plaintext) => {
        if (
          liveSession !== session ||
          session.status !== 'searching'
        ) {
          return;
        }

        let msg: any;

        try {
          msg = JSON.parse(plaintext);
        } catch {
          return;
        }

        if (
          msg?.type !== 'accept' ||
          msg?.requestId !== session.dTag
        ) {
          return;
        }

        session.peerPubkey = fromPubkey;
        confirmLiveMatch(session);
      },
      `live-dm-${session.dTag}`,
    );
  }

  async function confirmLiveMatch(session: LiveSessionInternal) {
    session.status = 'matched';

    clearLiveTimers(session);
    session.discoverySub?.close();
    session.dmSub?.close();

    await publishLiveClaim(session);

    if (liveSession === session) {
      endWorkflow({
        live: toLiveRecord(session),
      });
    }
  }

  function startLiveExpansionTimers(session: LiveSessionInternal) {
    session.expandEmptyTimer = setInterval(() => {
      if (
        liveSession !== session ||
        session.status !== 'searching'
      ) {
        return;
      }

      if (session.seenCounterpartAuthors.size === 0) {
        tickExpansion(session);
      }
    }, LIVE_EXPAND_EMPTY_INTERVAL_MS);

    session.expandNoMatchTimer = setInterval(() => {
      if (
        liveSession !== session ||
        session.status !== 'searching'
      ) {
        return;
      }

      if (session.seenCounterpartAuthors.size > 0) {
        tickExpansion(session);
      }
    }, LIVE_EXPAND_NOMATCH_INTERVAL_MS);
  }

  function tickExpansion(session: LiveSessionInternal) {
    if (session.expandLevel >= LIVE_MAX_EXPAND_LEVEL) return;
    expandLiveScope(session);
  }

  function expandLiveScope(session: LiveSessionInternal) {
    session.expandLevel =
      (session.expandLevel + 1) as 1 | 2 | 3;

    const cells =
      session.expandLevel === 1
        ? cells3x3(session.geohash)
        : session.expandLevel === 2
          ? cells4x4(session.geohash)
          : cellsInParent(session.geohash);

    const counterTag =
      `${session.role === 'requester' ? 'offer' : 'need'}-${session.model}`;

    session.discoverySub?.update(
      buildFilter({
        kinds: [LIVE_KIND],
        tags: {
          t: [counterTag],
          g: cells,
        },
      }),
    );

    if (session.expandLevel >= LIVE_MAX_EXPAND_LEVEL) {
      if (session.expandEmptyTimer) {
        clearInterval(session.expandEmptyTimer);
      }

      if (session.expandNoMatchTimer) {
        clearInterval(session.expandNoMatchTimer);
      }

      session.expandEmptyTimer = undefined;
      session.expandNoMatchTimer = undefined;

      session.finalGraceTimer = setTimeout(() => {
        if (
          liveSession === session &&
          session.status === 'searching'
        ) {
          endLiveSession(session, 'expired');
        }
      }, LIVE_EXPAND_NOMATCH_INTERVAL_MS);
    }
  }

  function clearLiveTimers(session: LiveSessionInternal) {
    if (session.heartbeatTimer) {
      clearTimeout(session.heartbeatTimer);
    }

    if (session.expandEmptyTimer) {
      clearInterval(session.expandEmptyTimer);
    }

    if (session.expandNoMatchTimer) {
      clearInterval(session.expandNoMatchTimer);
    }

    if (session.finalGraceTimer) {
      clearTimeout(session.finalGraceTimer);
    }
  }

  function endLiveSession(
    session: LiveSessionInternal,
    finalStatus: 'matched' | 'expired' | 'cancelled',
  ) {
    if (liveSession !== session) return;

    session.status = finalStatus;

    clearLiveTimers(session);
    session.discoverySub?.close();
    session.dmSub?.close();

    endWorkflow({
      live: toLiveRecord(session),
    });
  }

  function cancelActiveLiveSession() {
    if (!liveSession) return;

    const session = liveSession;

    clearLiveTimers(session);
    session.discoverySub?.close();
    session.dmSub?.close();

    liveSession = null;

    appStore.update((s) => ({
      ...s,
      live: null,
    }));
  }

  function toLiveRecord(
    session: LiveSessionInternal,
  ): LiveRecord {
    return {
      kind: 'live',
      id: session.dTag,
      role: session.role,
      model: session.model,
      status: session.status,
      peerPubkey: session.peerPubkey,
      location: session.location,
      content: session.content,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // LISTING mode (§3)
  // ═══════════════════════════════════════════════════════════════════

  function parseTimestamp(raw: unknown): number | null {
    if (raw == null || raw === '') return null;

    if (typeof raw === 'number') {
      return raw > 1e12
        ? Math.floor(raw / 1000)
        : Math.floor(raw);
    }

    if (typeof raw === 'string') {
      const ms = Date.parse(raw);
      return Number.isNaN(ms)
        ? null
        : Math.floor(ms / 1000);
    }

    return null;
  }

  async function publishListing(
    domain: string,
    model: string,
    anypay: string[],
    content: Record<string, any>,
    policy: ListingModelPolicy,
    token: symbol,
  ) {
    if (!client) return;

    const now = Math.floor(Date.now() / 1000);

    let expiresAt: number;

    if (policy.referenceField) {
      const refTs = parseTimestamp(
        content[policy.referenceField],
      );

      if (refTs != null) {
        const maxLeadSecs = policy.maxLeadDays * 86400;

        if (refTs <= now) {
          setError('That date is already in the past.');
          return;
        }

        if (refTs - now > maxLeadSecs) {
          setError(
            `This can only be published up to ${policy.maxLeadDays} day(s) in advance.`,
          );
          return;
        }

        expiresAt = refTs;
      } else {
        expiresAt =
          now + policy.maxLeadDays * 86400;
      }
    } else {
      expiresAt =
        now + policy.maxLeadDays * 86400;
    }

    expiresAt = Math.min(
      expiresAt,
      now + ABSOLUTE_MAX_VALIDITY_DAYS * 86400,
    );

    const location = extractStartCoordinate(
      content.location as LocationValue | undefined,
    );

    const interactionMode =
      content.interactionMode as string | undefined;

    const shouldTag =
      !!location && interactionMode !== 'online';

    const tags: string[][] = [
      ['t', `listing-${model}`],
      ['domain', domain],
      ['model', model],
      ['expiration', String(expiresAt)],
      ...anypay.map((id) => ['anypay', id]),
    ];

    if (shouldTag && location) {
      const g5 = encode(
        location.latitude,
        location.longitude,
        LISTING_SEARCH_PRECISION_INITIAL,
      );

      tags.push(
        ['g', g5],
        ['g', g5.slice(0, 4)],
      );
    }

    const dTag =
      `listing-${crypto.randomUUID()}`;

    const result =
      await client.publishReplaceableWithVerify({
        dTag,
        kind: LISTING_KIND,
        tags,
        content: JSON.stringify(content),
        verifyFilter: {
          kinds: [LISTING_KIND],
          authors: [client.pubkey],
          '#d': [dTag],
        },
        query: {
          timeoutMs: LISTING_QUERY_TIMEOUT_MS,
          retries: 1,
        },
      });

    if (activeWorkflowToken !== token) return;

    if (result.status === 'failed') {
      setError(
        'Failed to publish — no relay confirmed it.',
      );
      return;
    }

    const own = await client.query(
      {
        kinds: [LISTING_KIND],
        authors: [client.pubkey],
        '#d': [dTag],
      },
      {
        timeoutMs: LISTING_QUERY_TIMEOUT_MS,
        retries: 1,
      },
    );

    if (activeWorkflowToken !== token) return;

    const buffer =
      new Map<string, ListingRecord | null>();

    for (const event of own.events) {
      await processListingEvent(event, {
        persist: true,
        buffer,
      });
    }

    if (activeWorkflowToken !== token) return;

    flushListingBuffer(buffer);
    endWorkflow();
  }

  function normalizeCategoryFilter(
    content: Record<string, any>,
  ): string[] | null {
    if (
      Array.isArray(content.categoryIds) &&
      content.categoryIds.length
    ) {
      return content.categoryIds;
    }

    if (
      typeof content.categoryId === 'string' &&
      content.categoryId
    ) {
      return [content.categoryId];
    }

    return null;
  }

  function eventMatchesCategory(
    event: NostrEvent,
    wanted: string[],
  ): boolean {
    try {
      const content = JSON.parse(event.content);

      const ids: string[] = content.categoryId
        ? [content.categoryId]
        : content.categoryIds ?? [];

      return ids.some((id: string) =>
        wanted.includes(id),
      );
    } catch {
      return false;
    }
  }

  async function runListingQuery(
    filter: NostrFilter,
    categoryFilter: string[] | null,
  ): Promise<Map<string, ListingRecord | null>> {
    const buffer =
      new Map<string, ListingRecord | null>();

    if (!client) return buffer;

    const result = await client.query(
      filter,
      {
        timeoutMs: LISTING_QUERY_TIMEOUT_MS,
        retries: 1,
      },
    );

    for (const event of result.events) {
      if (
        categoryFilter &&
        !eventMatchesCategory(
          event,
          categoryFilter,
        )
      ) {
        continue;
      }

      await processListingEvent(event, {
        persist: true,
        buffer,
      });
    }

    return buffer;
  }

  async function searchListings(
    model: string,
    content: Record<string, any>,
    _policy: ListingModelPolicy,
    token: symbol,
  ) {
    if (!client) return;

    const location =
      extractStartCoordinate(
        content.location as LocationValue | undefined,
      );

    const categoryFilter =
      normalizeCategoryFilter(content);

    appStore.update((s) => ({
      ...s,
      listings: {},
      listingSearch: null,
    }));

    if (!location) {
      const nextSearch: ListingSearchState = {
        model,
        categoryFilter,
        geohash5: '',
        geohash4: '',
        precision: 5,
      };

      const buffer = await runListingQuery(
        buildFilter({
          kinds: [LISTING_KIND],
          tags: {
            t: [`listing-${model}`],
          },
        }),
        categoryFilter,
      );

      if (activeWorkflowToken !== token) return;

      flushListingBuffer(buffer);

      listingSearch = nextSearch;

      endWorkflow();
      return;
    }

    const geohash5 = encode(
      location.latitude,
      location.longitude,
      LISTING_SEARCH_PRECISION_INITIAL,
    );

    const geohash4 = geohash5.slice(0, 4);

    const nextSearch: ListingSearchState = {
      model,
      categoryFilter,
      geohash5,
      geohash4,
      precision: 5,
    };

    const filter = buildFilter({
      kinds: [LISTING_KIND],
      tags: {
        t: [`listing-${model}`],
        g: [geohash5],
      },
    });

    const buffer =
      await runListingQuery(
        filter,
        categoryFilter,
      );

    if (activeWorkflowToken !== token) return;

    flushListingBuffer(buffer);

    const liveSub = client.subscribe(
      `listing-live-${geohash5}`,
      filter,
      (event) => {
        processListingEvent(event, {
          persist: true,
        });
      },
    );

    listingSearch = {
      ...nextSearch,
      liveSub,
    };

    endWorkflow({
      listingSearch: {
        model: nextSearch.model,
        canLoadMore: !!nextSearch.geohash4,
      },
    });
  }

  /**
   * Fetch the next, coarser page of the current LISTING search.
   *
   * Important abort rule:
   * the current search remains at precision 5 until the bounded query has
   * completed and the workflow token has been verified. Therefore an Abort
   * during the query cannot leave `listingSearch` falsely marked as
   * precision 4.
   */
  async function loadMoreListings() {
    if (
      !client ||
      activeWorkflowToken ||
      !listingSearch ||
      listingSearch.precision !== 5 ||
      !listingSearch.geohash4
    ) {
      return;
    }

    const token = beginWorkflow();

    const scope: ListingSearchState = {
      ...listingSearch,
      precision: 4,
    };

    const filter = buildFilter({
      kinds: [LISTING_KIND],
      tags: {
        t: [`listing-${scope.model}`],
        g: [scope.geohash4],
      },
    });

    const buffer =
      await runListingQuery(
        filter,
        scope.categoryFilter,
      );

    // Abort happened while the bounded query was in flight.
    // Do not flush anything and do not modify the existing search scope.
    if (activeWorkflowToken !== token) return;

    flushListingBuffer(buffer);

    // Only after the bounded batch has completed successfully does the
    // old precision-5 subscription get replaced by the precision-4 one.
    listingSearch?.liveSub?.close();

    const liveSub = client.subscribe(
      `listing-live-${scope.geohash4}`,
      filter,
      (event) => {
        processListingEvent(event, {
          persist: true,
        });
      },
    );

    listingSearch = {
      ...scope,
      liveSub,
    };

    endWorkflow({
      listingSearch: {
        model: scope.model,
        canLoadMore: false,
      },
    });
  }

  /**
   * The single receive-path pipeline for every listing-kind event,
   * regardless of source (discovery query, live subscription, our own
   * just-published listing fetched back, or the tombstone watcher).
   */
  async function processListingEvent(
    event: NostrEvent,
    opts: {
      persist: boolean;
      buffer?: Map<string, ListingRecord | null>;
    },
  ) {
    if (isDeletionEvent(event)) {
      const target = getDeletionTarget(event);

      if (!target) return;

      const id =
        `${target.author}:${target.dTag}`;

      listingExpiryTracker.clear(id);

      if (opts.persist) {
        await deleteListingPersisted(id);
      }

      if (opts.buffer) {
        opts.buffer.set(id, null);
      } else {
        removeListingFromStore(id);
      }

      return;
    }

    const dTag = dTagOf(event);
    if (!dTag) return;

    const id =
      `${event.pubkey}:${dTag}`;

    const expiresAt =
      getExpiration(event);

    const now =
      Math.floor(Date.now() / 1000);

    if (
      expiresAt != null &&
      expiresAt <= now
    ) {
      listingExpiryTracker.clear(id);

      if (opts.persist) {
        await deleteListingPersisted(id);
      }

      if (opts.buffer) {
        opts.buffer.set(id, null);
      } else {
        removeListingFromStore(id);
      }

      return;
    }

    let content: Record<string, any>;

    try {
      content = JSON.parse(event.content);
    } catch {
      return;
    }

    const record: ListingRecord = {
      kind: 'listing',
      id,
      eventId: event.id,
      author: event.pubkey,
      dTag,
      domain:
        event.tags.find(
          (t) => t[0] === 'domain',
        )?.[1] ?? '',
      model:
        event.tags.find(
          (t) => t[0] === 'model',
        )?.[1] ?? '',
      expiresAt:
        expiresAt ??
        now +
          ABSOLUTE_MAX_VALIDITY_DAYS *
            86400,
      location:
        extractStartCoordinate(
          content.location as
            | LocationValue
            | undefined,
        ),
      content,
    };

    if (opts.persist) {
      await saveListing(record);
    }

    if (opts.buffer) {
      opts.buffer.set(
        id,
        record,
      );
    } else {
      upsertListingInStore(record);
    }

    if (expiresAt != null) {
      listingExpiryTracker.set(
        id,
        expiresAt,
        () => {
          removeListingFromStore(id);
          deleteListingPersisted(id).catch(
            () => {},
          );
        },
      );
    }
  }

  function upsertListingInStore(
    record: ListingRecord,
  ) {
    appStore.update((s) => ({
      ...s,
      listings: {
        ...s.listings,
        [record.id]: record,
      },
    }));
  }

  function removeListingFromStore(
    id: string,
  ) {
    appStore.update((s) => {
      if (!(id in s.listings)) {
        return s;
      }

      const listings = {
        ...s.listings,
      };

      delete listings[id];

      return {
        ...s,
        listings,
      };
    });
  }

  function flushListingBuffer(
    buffer: Map<string, ListingRecord | null>,
  ) {
    if (buffer.size === 0) return;

    appStore.update((s) => {
      const listings = {
        ...s.listings,
      };

      for (const [id, record] of buffer) {
        if (record) {
          listings[id] = record;
        } else {
          delete listings[id];
        }
      }

      return {
        ...s,
        listings,
      };
    });
  }

  function startTombstoneWatcher() {
    if (!client) return;

    tombstoneSub = client.subscribe(
      'tombstones',
      buildFilter({
        kinds: [
          LISTING_KIND,
          MISSION_KIND,
        ],
        tags: {
          t: [DELETION_TAG_VALUE],
        },
        since: tombstoneCursor,
      }),
      (event) => {
        tombstoneCursor = Math.max(
          tombstoneCursor,
          event.created_at,
        );

        if (event.kind === MISSION_KIND) {
          processMissionEvent(event);
        } else {
          processListingEvent(event, {
            persist: true,
          });
        }
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // Mission mode
  // ═══════════════════════════════════════════════════════════════════

  async function publishMission(payload: {
    dTag?: string;
    title: string;
    description: string;
    location: MissionLocation;
    lanes: MissionLanes;
  }) {
    if (!client) return;

    const dTag =
      payload.dTag ??
      `mission-${crypto.randomUUID()}`;

    const tags: string[][] = [
      ['t', 'mission'],
    ];

    if (
      payload.location.kind === 'point'
    ) {
      tags.push([
        'g',
        encode(
          payload.location.latitude,
          payload.location.longitude,
          LIVE_G6_PRECISION,
        ),
      ]);
    }

    const content = JSON.stringify({
      title: payload.title,
      description: payload.description,
      lanes: payload.lanes,
      location: payload.location,
    });

    const result =
      await client.publishReplaceableWithVerify({
        dTag,
        kind: MISSION_KIND,
        tags,
        content,
        verifyFilter: {
          kinds: [MISSION_KIND],
          authors: [client.pubkey],
          '#d': [dTag],
        },
        query: {
          timeoutMs: MISSION_QUERY_TIMEOUT_MS,
          retries: 1,
        },
      });

    if (result.status === 'failed') {
      setError(
        'Failed to publish mission — no relay confirmed it.',
      );
      return;
    }

    const own = await client.query(
      {
        kinds: [MISSION_KIND],
        authors: [client.pubkey],
        '#d': [dTag],
      },
      {
        timeoutMs: MISSION_QUERY_TIMEOUT_MS,
        retries: 1,
      },
    );

    for (const event of own.events) {
      processMissionEvent(event);
    }
  }

  function processMissionEvent(
    event: NostrEvent,
  ) {
    if (isDeletionEvent(event)) {
      const target =
        getDeletionTarget(event);

      if (!target) return;

      const id =
        `${target.author}:${target.dTag}`;

      removeMissionFromStore(id);
      deleteMissionPersisted(id).catch(
        () => {},
      );

      return;
    }

    const dTag = dTagOf(event);
    if (!dTag) return;

    const id =
      `${event.pubkey}:${dTag}`;

    let parsed: any;

    try {
      parsed = JSON.parse(event.content);
    } catch {
      return;
    }

    const location =
      parsed?.location;

    if (
      !location ||
      (location.kind !== 'point' &&
        location.kind !== 'area')
    ) {
      return;
    }

    const record: MissionRecord = {
      kind: 'mission',
      id,
      eventId: event.id,
      author: event.pubkey,
      dTag,
      location,
      content: {
        title:
          typeof parsed.title === 'string'
            ? parsed.title
            : '',
        description:
          typeof parsed.description === 'string'
            ? parsed.description
            : '',
        lanes: {
          brainstorming:
            parsed.lanes?.brainstorming ?? '',
          meetanddo:
            parsed.lanes?.meetanddo ?? '',
          petition:
            parsed.lanes?.petition ?? '',
          crowdfunding:
            parsed.lanes?.crowdfunding ?? '',
        },
      },
    };

    upsertMissionInStore(record);
    saveMission(record);
  }

  function upsertMissionInStore(
    record: MissionRecord,
  ) {
    appStore.update((s) => ({
      ...s,
      missions: {
        ...s.missions,
        [record.id]: record,
      },
    }));
  }

  function removeMissionFromStore(
    id: string,
  ) {
    appStore.update((s) => {
      if (!(id in s.missions)) {
        return s;
      }

      const missions = {
        ...s.missions,
      };

      delete missions[id];

      return {
        ...s,
        missions,
      };
    });
  }

  async function discoverMissions() {
    if (!client) return;

    const result = await client.query(
      { kinds: [MISSION_KIND] },
      {
        timeoutMs: MISSION_QUERY_TIMEOUT_MS,
        retries: 1,
      },
    );

    for (const event of result.events) {
      processMissionEvent(event);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Lifecycle (§11)
  // ═══════════════════════════════════════════════════════════════════

  onMount(async () => {
    const { sk } = await getKeypair();

    client = new NostrClient(sk, {
      onLog: (level, message) =>
        (level === 'warn'
          ? console.warn
          : console.log)(
          `[nostr] ${message}`,
        ),
    });

    appStore.update((s) => ({
      ...s,
      ownPubkey: client!.pubkey,
    }));

    client.onRelayCountChange(
      (connected) => {
        connectedRelays = connected;
      },
    );

    client.connect();

    // Resolve an App.svelte deep link only after the Nostr client exists.
    // This avoids the startup race where openEventId is already populated
    // while client is still null.
    if (openEventId) {
      fetchEntityByEventId(openEventId);
    }

    const cached =
      await loadAllListings();

    const now =
      Math.floor(Date.now() / 1000);

    const hydrated:
      Record<string, ListingRecord> = {};

    for (const record of cached) {
      if (record.expiresAt <= now) {
        deleteListingPersisted(
          record.id,
        ).catch(() => {});
        continue;
      }

      hydrated[record.id] = record;

      listingExpiryTracker.set(
        record.id,
        record.expiresAt,
        () => {
          removeListingFromStore(
            record.id,
          );

          deleteListingPersisted(
            record.id,
          ).catch(() => {});
        },
      );
    }

    if (
      Object.keys(hydrated).length > 0
    ) {
      appStore.update((s) => ({
        ...s,
        listings: {
          ...s.listings,
          ...hydrated,
        },
      }));
    }

    const cachedMissions =
      await loadAllMissions();

    if (cachedMissions.length > 0) {
      const hydratedMissions:
        Record<string, MissionRecord> = {};

      for (const mission of cachedMissions) {
        hydratedMissions[mission.id] =
          mission;
      }

      appStore.update((s) => ({
        ...s,
        missions: {
          ...s.missions,
          ...hydratedMissions,
        },
      }));
    }

    discoverMissions();

    missionDiscoveryTimer =
      setInterval(
        discoverMissions,
        MISSION_DISCOVERY_INTERVAL_MS,
      );

    startTombstoneWatcher();
  });

  onDestroy(() => {
    cancelActiveLiveSession();

    listingSearch?.liveSub?.close();

    tombstoneSub?.close();

    listingExpiryTracker.clearAll();

    if (missionDiscoveryTimer) {
      clearInterval(
        missionDiscoveryTimer,
      );
    }

    client?.disconnect();
  });

  // ═══════════════════════════════════════════════════════════════════
  // Workflow-status UI
  // ═══════════════════════════════════════════════════════════════════

  $: statusVisible =
    connectedRelays === 0 ||
    $appStore.inFlight ||
    !!$appStore.lastError ||
    !!$appStore.live ||
    !!$appStore.listingSearch?.canLoadMore;
</script>

{#if statusVisible}
  <div class="orchestrator-status">
    {#if connectedRelays === 0}
      <span class="row warn">
        Connecting…
      </span>
    {:else}
      <span class="row">
        {connectedRelays}
        relay{connectedRelays === 1 ? '' : 's'}
        connected
      </span>
    {/if}

    {#if $appStore.inFlight}
      <span class="row busy">
        Synchronizing…
      </span>

      <button
        class="abort"
        on:click={abortActiveWorkflow}
      >
        Abort
      </button>
    {/if}

    {#if $appStore.lastError}
      <span class="row error">
        {$appStore.lastError}
      </span>
    {/if}

    {#if $appStore.live}
      <span class="row live">
        LIVE · {$appStore.live.status}{$appStore.live.peerPubkey ? ' · matched' : ''}
      </span>
    {/if}

    {#if $appStore.listingSearch?.canLoadMore && !$appStore.inFlight}
      <button
        class="load-more"
        on:click={loadMoreListings}
      >
        Load More
      </button>
    {/if}
  </div>
{/if}

<style>
  .orchestrator-status {
    position: fixed;
    left: 50%;
    bottom: 1.5em;
    transform: translateX(-50%);
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 0.75em;
    padding: 0.5em 1em;
    border-radius: 999px;
    background: rgba(22, 23, 26, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #fff;
    font: 0.8em -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .row {
    white-space: nowrap;
  }

  .row.warn {
    color: #ffcc66;
  }

  .row.busy {
    color: #2ae9c9;
  }

  .row.error {
    color: #ff6b6b;
  }

  .row.live {
    color: #8fb0ff;
  }

  .load-more {
    background: linear-gradient(90deg, #335bf4, #2ae9c9);
    border: none;
    color: #0b0b0d;
    font-weight: 600;
    padding: 0.35em 0.9em;
    border-radius: 999px;
    cursor: pointer;
    font-size: 1em;
  }

  .load-more:hover,
  .load-more:focus-visible {
    filter: brightness(1.08);
  }

  .abort {
    background: transparent;
    border: 1px solid #ff6b6b;
    color: #ff6b6b;
    font-weight: 600;
    padding: 0.3em 0.85em;
    border-radius: 999px;
    cursor: pointer;
    font-size: 1em;
  }

  .abort:hover,
  .abort:focus-visible {
    background: rgba(255, 107, 107, 0.12);
  }
</style>
