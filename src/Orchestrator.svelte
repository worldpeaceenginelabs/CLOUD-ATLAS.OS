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
  // Exactly one workflow (a LIVE search/offer, a LISTING search/offer, a
  // Mission publish, or a "Load More") may run at a time. A new `submit`
  // or `missionSubmit` value while one is already active is ignored — the
  // only way to stop a running workflow is the Abort control this
  // component renders itself, right below the rest of its workflow-status
  // UI (relay connection, in-flight/sync state, errors, the current LIVE
  // match, "Load More" for LISTING search). `$appStore.inFlight` reflects
  // exactly this "a workflow is active" state for any other consumer that
  // needs it. `missionSubmit` drives its workflow through the same
  // beginWorkflow/endWorkflow/activeWorkflowToken mechanism as `submit` —
  // it is not a bounded operation of its own, just another workflow kind
  // funneled through the existing infrastructure.
  //
  // Two more props follow the exact same prop-down + reactive-statement
  // pattern as `submit`, each its own small isolated operation rather than
  // a bounded workflow (neither runs *through* beginWorkflow/endWorkflow):
  // `deleteRequest` (owner deletion, bubbled up from cesium/EntityDetails.svelte
  // via its parent) and `openDeepLink` (deep-link resolution: fetches one
  // specific replaceable resource by author + d-tag if it isn't already
  // known — App.svelte sets this from the current URL). `deleteRequest` is
  // however *refused* while a workflow is active (a delete racing an
  // in-flight publish of the same entity could leave the store showing
  // something already deleted); `openDeepLink` is a pure read and stays
  // ungated.
  // -----------------------------------------------------------------------

  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
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
  import { encode, cells3x3, cells5x5, cellsInParent } from './orchestrator/geohash';
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
    type DeepLink,
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
  import LiveOverlay from './live/LiveOverlay.svelte';

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

  /** A mission stays visible this long after its last publish; editing/saving it republishes and renews the clock. */
  const MISSION_TTL_DAYS = 30;
  const MISSION_QUERY_TIMEOUT_MS = 20_000;

  /** Mission sync pages are requested newest-first and walk backwards through `until`. A relay may answer with fewer events than this (its own cap) — the sync keeps going until a page brings nothing new. */
  const MISSION_SYNC_PAGE_LIMIT = 500;
  /** Resuming from the stored cursor re-reads this much history, to absorb relay clock skew and late propagation. */
  const MISSION_SYNC_OVERLAP_SECS = 3600;
  /** Delay before an incomplete sync run (no relay answered) is tried again. */
  const MISSION_SYNC_RETRY_MS = 30_000;
  const MISSION_SYNC_CURSOR_KEY = 'cloudatlas.missionSyncCursor';

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
   * Submit/Save). Same prop-down pattern as `submit` — and, unlike
   * `deleteRequest`/`openDeepLink` below, a full workflow in the same sense
   * as a LIVE or LISTING submit: publishMission() runs through
   * beginWorkflow/endWorkflow/activeWorkflowToken and is refused while
   * another workflow is active, same as handleSubmit(). Fed from two
   * places — HexMenu's own "new mission" modal, and
   * cesium/EntityLayer.svelte's "existing mission" card — both funnel into
   * this one prop, same as any other Svelte event forwarding in this app.
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
   * A deep link (author + d-tag + domain) to fetch and bring into the Store
   * if it isn't already known — the network-side half of opening a deep
   * link (cesium/EntityLayer.svelte does the Store-side half: selecting it
   * once present, across both listings and missions). The URL's domain
   * segment decides the kind (`mission` → MISSION_KIND, any other domain →
   * LISTING_KIND); the fetched event then goes through the normal
   * processEvent() pipeline — not a second discovery mechanism.
   */
  export let openDeepLink: DeepLink | null = null;

  // Deep links are resolved explicitly from onMount after the Nostr client
  // exists. There is deliberately no reactive `openDeepLink` fetch here:
  // App.svelte may provide the prop before `client` has been initialized,
  // and a reactive statement depending only on openDeepLink would then
  // never rerun when client becomes available.

  // ─── Single active workflow (§1/§2 of the second review) ────────────
  //
  // Exactly one user-initiated workflow (a LIVE search/offer, a LISTING
  // search/offer, a Mission publish, or a "Load More") may run at a time.
  // `activeWorkflowToken` identifies whichever one is currently running —
  // every async workflow step captures it locally and checks it's still
  // current after each `await`, before touching the Store, so a stale
  // result from an already-aborted workflow can never land late. Not a
  // generation counter: since only one workflow can ever be active, a
  // single mutable reference is enough — the same identity-check pattern
  // LIVE's own `liveSession` guards already used.
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
    // lastError is reset here too (a patch can still set a fresh one): otherwise
    // a "still busy" notice from rejectWhileBusy() would outlive the workflow
    // that caused it.
    appStore.update((s) => ({ ...s, inFlight: false, lastError: null, ...patch }));
  }

  /**
   * A user action (submit, mission publish, delete) arrived while another
   * workflow is active. It is still refused — exactly one workflow at a time —
   * but visibly now: a bare console.warn left the UI believing the action had
   * gone through (EntityDetails closes/leaves edit mode optimistically).
   * Deliberately NOT setError(): that calls endWorkflow() and would end the
   * workflow that is legitimately running.
   */
  function rejectWhileBusy(what: string) {
    console.warn(`[Orchestrator] Ignoring ${what} — a workflow is already active. Use Abort first.`);
    appStore.update((s) => ({
      ...s,
      lastError: 'Still syncing — try again when it has finished (or abort it).',
    }));
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
      lastError: null,
      listingSearch: null,
    }));
  }

  // ─── Nostr client lifecycle ─────────────────────────────────────────

  let client: NostrClient | null = null;
  let connectedRelays = 0;
  const listingExpiryTracker = createExpiryTracker();
  const missionExpiryTracker = createExpiryTracker();

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
    /**
     * Driver (provider) side only — Rider (requester) sessions never
     * populate these, so a requester's own toLiveRecord() always exposes
     * offer: null and can never leak driver-only candidate/offer state
     * into the rider's UI.
     *
     * Discovered riders are presented one at a time for an explicit
     * Accept/Reject decision (see acceptLiveOffer/rejectLiveOffer) —
     * never auto-accepted. `candidateQueue` holds riders discovered while
     * another one is already being decided on or already accepted-and-
     * awaiting-confirmation; `currentOffer` is the one currently up for
     * decision.
     */
    candidateQueue: { pubkey: string; requestId: string; content: any }[];
    currentOffer: { pubkey: string; requestId: string; content: any } | null;
    /** True right after Accept is clicked, until we learn whether we won the race against any other driver who also accepted the same rider. */
    awaitingConfirmation: boolean;
    heartbeatTimer?: ReturnType<typeof setTimeout>;
    expandTimer?: ReturnType<typeof setInterval>;
    finalGraceTimer?: ReturnType<typeof setTimeout>;
  }

  let liveSession: LiveSessionInternal | null = null;

  // ─── LISTING search state — tracks the active search scope for "Load More" ──

  interface ListingSearchState {
    model: string;
    categoryFilter: string[];
    geohash5: string;
    geohash4: string;
    precision: 5 | 4;
    liveSub?: SubscriptionHandle;
  }

  let listingSearch: ListingSearchState | null = null;

  // ─── Background tombstone watcher (§4) — runs for the component's whole lifetime ──

  // One watcher per kind: a listing tombstone only has to be found for as long
  // as a listing can live (ABSOLUTE_MAX_VALIDITY_DAYS), a mission tombstone for
  // as long as a mission can (MISSION_TTL_DAYS) — see tombstoneExpirationTag().
  let listingTombstoneSub: SubscriptionHandle | null = null;
  let missionTombstoneSub: SubscriptionHandle | null = null;

  // ─── Mission sync — paginated catch-up plus a standing live subscription ──

  let missionLiveSub: SubscriptionHandle | null = null;
  let missionSyncRetryTimer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;

  // ─── Generic event processing — kind-agnostic dispatch (persist → store) ──
  //
  // Every place in this file that receives a raw Nostr event — discovery
  // queries, live subscriptions, our own publish-echoes, deletion/tombstone
  // confirmations, deep-link fetches — hands it to processEvent() instead
  // of deciding for itself whether it's a LISTING or a MISSION. The switch
  // on `event.kind` lives in exactly one place, right below; nowhere else
  // in the orchestrator branches on kind or calls processListingEvent()/
  // processMissionEvent() directly.
  //
  // Both domain processors share one non-negotiable contract, regardless
  // of entity type: **event fully processed → persistence awaited to
  // completion → only then is the store updated.** There is no path where
  // a store write happens before its persistence has resolved — see
  // processListingEvent() and processMissionEvent() below for the two
  // (entity-specific) implementations of that same contract.

  interface ProcessEventOptions {
    persist: boolean;
    /** LISTING-only: batches store writes across a whole discovery page instead of writing per-event — see flushListingBuffer(). Ignored by processMissionEvent(), which has no batched caller. */
    buffer?: Map<string, ListingRecord | null>;
  }

  /**
   * Returns the event's NIP-40 `expiration` if it is acceptable on
   * receipt, otherwise null (→ the caller discards the event). Required:
   * no tag, a malformed tag, or an expiration more than `maxDays` from now
   * is rejected. An expiration in the past is still returned — the caller
   * treats that as "expired" and removes the record.
   */
  function acceptableExpiration(event: NostrEvent, maxDays: number): number | null {
    const tag = event.tags?.find((t) => t[0] === 'expiration')?.[1];
    if (!tag || !/^\d+$/.test(tag)) return null;

    const expiresAt = getExpiration(event);
    if (expiresAt === undefined) return null;

    if (expiresAt > Math.floor(Date.now() / 1000) + maxDays * 86400) return null;

    return expiresAt;
  }

  /**
   * Newest version seen per logical id (`${author}:${dTag}`), for listings and
   * missions alike. Relays can hand back an older version of a replaceable
   * event after a newer one (a lagging relay in a query result, the order
   * inside one result, a replay after reconnect) — without this check the
   * older version would overwrite the newer one in the store *and* in
   * IndexedDB, and a deleted entity could reappear. Also covers a tombstone
   * arriving before a stale copy of the entity it deleted.
   *
   * `created_at` has one-second resolution, so a tie is decided explicitly:
   * a tombstone beats a live version of the same second.
   *
   * Kept independent of the store on purpose: a new listing search empties
   * the store, but must not make the guard forget a tombstone. Seeded from
   * the local cache at startup (see onMount).
   */
  const latestEventAt = new Map<string, { at: number; deleted: boolean }>();

  function isStaleEvent(id: string, event: NostrEvent, deleted: boolean): boolean {
    const seen = latestEventAt.get(id);

    if (seen) {
      if (event.created_at < seen.at) return true;
      if (event.created_at === seen.at && seen.deleted && !deleted) return true;
    }

    latestEventAt.set(id, { at: event.created_at, deleted });
    return false;
  }

  /** Lower bound for the `created_at` of our next event for this id: strictly newer than the newest version we know, so edit/delete in the same second stay ordered on every relay. */
  function nextCreatedAt(id: string): number | undefined {
    const seen = latestEventAt.get(id);
    return seen ? seen.at + 1 : undefined;
  }

  /** A tombstone only has to outlive the longest-lived copy of the entity it retires. */
  function tombstoneExpirationTag(lifetimeDays: number): string[] {
    return ['expiration', String(Math.floor(Date.now() / 1000) + lifetimeDays * 86400)];
  }

  async function processEvent(
    event: NostrEvent,
    opts: ProcessEventOptions = { persist: true },
  ) {
    switch (event.kind) {
      case LISTING_KIND:
        return processListingEvent(event, opts);

      case MISSION_KIND:
        return processMissionEvent(event, opts);

      default:
        return;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Payload contract (§1)
  // ═══════════════════════════════════════════════════════════════════

  /** Publish a tombstone for one of the caller's own listings and wait for it to come back through the normal receive path (§3.2/§4), same as any other listing mutation. `id` is the `${author}:${dTag}` logical id shown in the store. */
  async function deleteOwnListing(id: string) {
    if (!client) return;

    if (activeWorkflowToken) {
      rejectWhileBusy('delete request');
      return;
    }

    const dTag = id.slice(id.indexOf(':') + 1);
    const marker = client.publishDeletionMarker(
      dTag,
      [tombstoneExpirationTag(ABSOLUTE_MAX_VALIDITY_DAYS)],
      LISTING_KIND,
      nextCreatedAt(id),
    );

    const own = await client.query(
      { kinds: [LISTING_KIND], ids: [marker.id] },
      { timeoutMs: LISTING_QUERY_TIMEOUT_MS, retries: 1 },
    );

    for (const event of own.events) {
      await processEvent(event, { persist: true });
    }
  }

  /** Same as deleteOwnListing, for a Mission's replaceable identity/kind instead of a listing's. */
  async function deleteOwnMission(id: string) {
    if (!client) return;

    if (activeWorkflowToken) {
      rejectWhileBusy('delete request');
      return;
    }

    const dTag = id.slice(id.indexOf(':') + 1);
    const marker = client.publishDeletionMarker(
      dTag,
      [tombstoneExpirationTag(MISSION_TTL_DAYS)],
      MISSION_KIND,
      nextCreatedAt(id),
    );

    const own = await client.query(
      { kinds: [MISSION_KIND], ids: [marker.id] },
      { timeoutMs: MISSION_QUERY_TIMEOUT_MS, retries: 1 },
    );

    for (const event of own.events) {
      await processEvent(event, { persist: true });
    }
  }

  /**
   * Fetches the current version of one replaceable resource (author +
   * d-tag) and feeds it through the normal receive pipeline. The kind is
   * derived from the deep link's domain segment.
   */
  async function fetchEntityByDeepLink(link: DeepLink) {
    if (!client) return;

    const isMission = link.domain === 'mission';

    const result = await client.query(
      {
        kinds: [isMission ? MISSION_KIND : LISTING_KIND],
        authors: [link.author],
        '#d': [link.dTag],
        limit: 1,
      },
      {
        timeoutMs: isMission ? MISSION_QUERY_TIMEOUT_MS : LISTING_QUERY_TIMEOUT_MS,
        retries: 1,
      },
    );

    for (const event of result.events) {
      await processEvent(event, { persist: true });
    }
  }

  async function handleSubmit(payload: HexMenuPayload, action: 'offer' | 'search') {
    if (!client) {
      setError('Not connected yet — try again in a moment.');
      return;
    }

    if (activeWorkflowToken) {
      rejectWhileBusy('submit');
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

  function isCoordinate(
    value: unknown,
  ): value is { latitude: number; longitude: number } {
    return (
      !!value &&
      typeof (value as any).latitude === 'number' &&
      typeof (value as any).longitude === 'number'
    );
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

    const rawLocation = content.location as LocationValue | undefined;

    // A route (pickup + drop-off) is a single unit — the geohash below
    // is derived from `from` alone (discovery only needs a starting
    // point to bucket by), but that must never stand in for `to`: the
    // full route is what gets published (publishLiveClaim spreads
    // `session.content`, `location` included, into the event body
    // verbatim) and what the driver's UI/globe rendering needs later.
    // Fail here rather than silently publishing (or letting a driver
    // accept) a ride with a missing drop-off.
    if (
      rawLocation?.geometry === 'route' &&
      (!isCoordinate(rawLocation.from) || !isCoordinate(rawLocation.to))
    ) {
      setError('LIVE ride requests require a complete pickup and drop-off.');
      return;
    }

    const location = extractStartCoordinate(rawLocation);

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
      candidateQueue: [],
      currentOffer: null,
      awaitingConfirmation: false,
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
    startLiveExpansionTimer(session);

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

    // The one moment this matters: the very first counterpart either
    // side ever sees. From here on seenCounterpartAuthors only grows, so
    // this can only be true once per session — restarting the timer here
    // (not just branching inside a timer that's been running since
    // session start) is what makes "wait the full no-match cadence"
    // actually count from the moment there's something to wait on.
    const isFirstSighting = session.seenCounterpartAuthors.size === 0;
    session.seenCounterpartAuthors.add(event.pubkey);
    if (isFirstSighting) {
      restartLiveExpansionTimer(session, LIVE_EXPAND_NOMATCH_INTERVAL_MS);
    }

    // Rider side: this function DOES get called for driver claims too —
    // the rider's own discoverySub is subscribed to offer-<model> events
    // (see startLiveDiscovery's counterTag), that's exactly how
    // seenCounterpartAuthors (above) gets populated for a rider: raw
    // "how many drivers are out there" presence, used only by the
    // expansion timers. It never goes further than that — never inspects
    // an individual driver claim's identity/content, never learns who
    // specifically has (or hasn't) looked at its request. A rider only
    // ever finds out about an actual match via startLiveDmListener's
    // "accept" DM, handled separately.
    if (session.role === 'requester') {
      return;
    }

    // ── Driver (provider) side ──────────────────────────────────────
    if (body?.status === 'matched') {
      // A rider we'd discovered (queued, currently offered, or already
      // accepted-and-awaiting-confirmation) has republished as matched.
      if (body?.winnerPubkey === client?.pubkey) {
        // We won the race for this rider.
        session.peerPubkey = event.pubkey;
        endLiveSession(session, 'matched');
      } else {
        // Some other driver won it first — an internal matching outcome,
        // never surfaced to the rider. Drop it from our queue/offer (if
        // present) and move on to the next candidate, if any.
        dropLiveCandidate(session, event.pubkey);
      }
      return;
    }

    // A rider's active request always carries status:'searching' (see
    // publishLiveClaim — it publishes session.status verbatim, and
    // 'searching' is the only non-terminal value LiveSessionInternal.status
    // has). Anything else here is a terminal republish we don't otherwise
    // recognize — ignore it rather than treat it as a fresh candidate.
    if (body?.status && body.status !== 'searching') return;

    // Ignore duplicate re-announcements of a rider we already know about
    // (e.g. their own heartbeat republish) — not a new candidate.
    if (session.currentOffer?.pubkey === event.pubkey) return;
    if (session.candidateQueue.some((c) => c.pubkey === event.pubkey)) return;

    const requestId = dTagOf(event);
    if (!requestId) return;

    const candidateLocation = body?.location as LocationValue | undefined;
    if (
      candidateLocation?.geometry === 'route' &&
      (!isCoordinate(candidateLocation.from) || !isCoordinate(candidateLocation.to))
    ) {
      // Malformed/incomplete route — never present this as an offer.
      return;
    }

    const candidate = { pubkey: event.pubkey, requestId, content: body };

    if (session.currentOffer || session.awaitingConfirmation) {
      // Already deciding on (or awaiting confirmation for) another
      // rider — this one waits its turn, FCFS.
      session.candidateQueue.push(candidate);
      return;
    }

    session.currentOffer = candidate;
    syncLiveStore(session);
  }

  /** Removes a rider from the driver's queue/current offer once it's known to be no longer viable (either because another driver won it, or — future-proofing — any other reason a candidate stops being valid). If it was the one currently up for decision, the next queued candidate (if any) takes its place. Purely local bookkeeping — never sends anything to the rider. */
  function dropLiveCandidate(session: LiveSessionInternal, pubkey: string) {
    session.candidateQueue = session.candidateQueue.filter((c) => c.pubkey !== pubkey);

    if (session.currentOffer?.pubkey === pubkey) {
      session.currentOffer = null;
      session.awaitingConfirmation = false;
      advanceLiveQueue(session);
    }
  }

  /** Driver clicks Accept on the currently offered rider — sends the same "accept" DM the old auto-accept path used to send to everyone, but now only for the one candidate a human actually chose. */
  function acceptLiveOffer() {
    const session = liveSession;

    if (
      !session ||
      session.role !== 'provider' ||
      !session.currentOffer ||
      session.awaitingConfirmation
    ) {
      return;
    }

    const offer = session.currentOffer;
    session.awaitingConfirmation = true;
    syncLiveStore(session);

    client?.sendEncrypted(
      offer.pubkey,
      JSON.stringify({
        type: 'accept',
        requestId: offer.requestId,
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

  /** Driver clicks Decline on the currently offered rider — a purely local matching step (§ spec: never an event shown to the rider). Immediately presents the next queued rider, if any. */
  function rejectLiveOffer() {
    const session = liveSession;

    if (
      !session ||
      session.role !== 'provider' ||
      !session.currentOffer ||
      session.awaitingConfirmation
    ) {
      return;
    }

    session.currentOffer = null;
    advanceLiveQueue(session);
  }

  function advanceLiveQueue(session: LiveSessionInternal) {
    session.currentOffer = session.candidateQueue.shift() ?? null;
    syncLiveStore(session);
  }

  /** Pushes the current session state into the Store — the one place toLiveRecord() is actually applied, so every driver/rider-facing update (new offer, queue advance, confirmation flag) goes through the same projection. */
  function syncLiveStore(session: LiveSessionInternal) {
    if (liveSession !== session) return;

    appStore.update((s) => ({
      ...s,
      live: toLiveRecord(session),
    }));
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

  /**
   * Starts (or restarts) the expansion timer at the given cadence,
   * replacing whatever was ticking before. This — not just branching on
   * seenCounterpartAuthors.size inside a fixed-period timer — is what
   * makes the "how long to wait before widening" period actually start
   * counting from the moment that matters, rather than from session
   * start. Called once at session start (empty cadence) and exactly once
   * more, from handleLiveCandidate, the instant the first counterpart is
   * seen (no-match cadence) — see the isFirstSighting check there.
   */
  function restartLiveExpansionTimer(
    session: LiveSessionInternal,
    intervalMs: number,
  ) {
    if (session.expandTimer) {
      clearInterval(session.expandTimer);
    }

    session.expandTimer = setInterval(() => {
      if (liveSession !== session || session.status !== 'searching') return;
      tickExpansion(session);
    }, intervalMs);
  }

  function startLiveExpansionTimer(session: LiveSessionInternal) {
    restartLiveExpansionTimer(session, LIVE_EXPAND_EMPTY_INTERVAL_MS);
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
          ? cells5x5(session.geohash)
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
      if (session.expandTimer) {
        clearInterval(session.expandTimer);
      }

      session.expandTimer = undefined;

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

    if (session.expandTimer) {
      clearInterval(session.expandTimer);
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

    // The queue and the "awaiting a decision" flag stop mattering once
    // the session is over either way. currentOffer is different: on a
    // won match, it *is* the matched ride (pickup/drop, category,
    // description) — the driver's matched UI reads it from there, so it
    // must survive past this point. Only expired/cancelled sessions
    // clear it too (there's no ride to show).
    session.candidateQueue = [];
    session.awaitingConfirmation = false;
    if (finalStatus !== 'matched') {
      session.currentOffer = null;
    }

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

  /**
   * Dismisses a session that has already reached a terminal status
   * (matched or expired) — the "Done" button on the matched/expired UI.
   * Different from cancelActiveLiveSession: that one stops a session
   * that's still running (searching); this one just clears one that's
   * already finished, since endLiveSession() itself never nulls out
   * `liveSession`/`live` — a finished session stays visible until the
   * person dismisses it. No-op while a session is still 'searching', so
   * it can never be used to cut a running one short.
   */
  function clearLiveSession() {
    if (!liveSession || liveSession.status === 'searching') return;

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
      // Driver-only, and only ever non-null on a provider session (a
      // requester's session never touches currentOffer) — this can never
      // surface as rider-facing UI state, by construction rather than by
      // convention at the call site.
      offer:
        session.role === 'provider' && session.currentOffer
          ? {
              requestId: session.currentOffer.requestId,
              content: session.currentOffer.content,
            }
          : null,
      awaitingConfirmation:
        session.role === 'provider' ? session.awaitingConfirmation : false,
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

  /**
   * Stable string form of a JSON value: object keys sorted recursively and
   * strings trimmed, so two payloads with the same attributes compare equal
   * regardless of key order or stray whitespace.
   */
  function canonicalize(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;

    if (typeof value === 'string') return JSON.stringify(value.trim());

    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;

      return `{${Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`)
        .join(',')}}`;
    }

    return JSON.stringify(value) ?? 'null';
  }

  /**
   * Is there already a live listing of ours with these exact attributes?
   *
   * HexMenu deliberately keeps its selections after submit, so the same
   * offer can be sent again and again — every send would otherwise become
   * its own listing (fresh dTag each time). Only *completed* publishes can
   * match here: a second submit while the first is still running never gets
   * this far (single-workflow lock), and a finished one has been persisted
   * before endWorkflow() (persist → store contract).
   *
   * Looks at IndexedDB as well as the store: searchListings() wipes
   * `$appStore.listings`, but persistence keeps our own records. Deleted
   * (tombstoned) and expired listings don't count, so re-offering after a
   * delete works. The anypay options are not on ListingRecord and therefore
   * not part of the comparison.
   */
  async function findOwnDuplicateListing(
    domain: string,
    model: string,
    content: Record<string, any>,
  ): Promise<ListingRecord | null> {
    if (!client) return null;

    const own = client.pubkey;
    const now = Math.floor(Date.now() / 1000);
    const fingerprint = canonicalize(content);

    let persisted: ListingRecord[] = [];

    try {
      persisted = await loadAllListings();
    } catch {
      // Persistence unreadable — fall back to what's in the store rather than blocking the offer.
    }

    const candidates = [...Object.values(get(appStore).listings), ...persisted];

    return (
      candidates.find(
        (r) =>
          r.author === own &&
          r.expiresAt > now &&
          r.domain === domain &&
          r.model === model &&
          canonicalize(r.content) === fingerprint,
      ) ?? null
    );
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

    const categoryIds = categoryIdsOf(content);

    if (categoryIds.length === 0) {
      setError('A category is required.');
      return;
    }

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

    // Same offer already published and synced? Then don't publish it again.
    const duplicate = await findOwnDuplicateListing(domain, model, content);

    if (activeWorkflowToken !== token) return;

    if (duplicate) {
      setError('You already published this offer.');
      return;
    }

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

    // Category tags let the relay filter a search down to the chosen
    // categories; the category itself stays part of the JSON content.
    tags.push(...categoryIds.map((id) => ['c', id]));

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
      await processEvent(event, {
        persist: true,
        buffer,
      });
    }

    if (activeWorkflowToken !== token) return;

    flushListingBuffer(buffer);
    endWorkflow();
  }

  /** The category ids a listing/search payload carries — `categoryIds` (multi-select models) or the single `categoryId`. Empty if it carries none. */
  function categoryIdsOf(content: Record<string, any>): string[] {
    if (Array.isArray(content.categoryIds) && content.categoryIds.length) {
      return content.categoryIds.filter(
        (id: unknown): id is string => typeof id === 'string' && id.length > 0,
      );
    }

    if (typeof content.categoryId === 'string' && content.categoryId) {
      return [content.categoryId];
    }

    return [];
  }

  /** The relay-side filter of a listing search: model, geohash cell and chosen categories. The same filter drives the one-shot query and the live subscription. */
  function listingSearchFilter(
    model: string,
    geohash: string,
    categoryIds: string[],
  ): NostrFilter {
    return buildFilter({
      kinds: [LISTING_KIND],
      tags: {
        t: [`listing-${model}`],
        g: [geohash],
        c: categoryIds,
      },
    });
  }

  async function runListingQuery(
    filter: NostrFilter,
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
      await processEvent(event, {
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

    if (!location) {
      setError('Listing search requires a location.');
      return;
    }

    const categoryFilter = categoryIdsOf(content);

    if (categoryFilter.length === 0) {
      setError('A category is required.');
      return;
    }

    // The previous search's live subscription belongs to the previous
    // category/cell — it must not keep feeding the store.
    listingSearch?.liveSub?.close();
    listingSearch = null;

    appStore.update((s) => ({
      ...s,
      listings: {},
      listingSearch: null,
    }));

    const geohash5 = encode(
      location.latitude,
      location.longitude,
      LISTING_SEARCH_PRECISION_INITIAL,
    );

    const nextSearch: ListingSearchState = {
      model,
      categoryFilter,
      geohash5,
      geohash4: geohash5.slice(0, 4),
      precision: 5,
    };

    const filter = listingSearchFilter(model, geohash5, categoryFilter);

    const buffer = await runListingQuery(filter);

    if (activeWorkflowToken !== token) return;

    flushListingBuffer(buffer);

    const liveSub = client.subscribe(
      `listing-live-${geohash5}`,
      filter,
      (event) => {
        processEvent(event, {
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
        canLoadMore: true,
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
      listingSearch.precision !== 5
    ) {
      return;
    }

    const token = beginWorkflow();

    const scope: ListingSearchState = {
      ...listingSearch,
      precision: 4,
    };

    const filter = listingSearchFilter(
      scope.model,
      scope.geohash4,
      scope.categoryFilter,
    );

    const buffer = await runListingQuery(filter);

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
        processEvent(event, {
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
   * just-published listing fetched back, or the tombstone watcher). Only
   * ever called from processEvent() — the `LISTING_KIND` case of its
   * switch — never directly. Persistence is always awaited to completion
   * before the store (or buffer) is touched; see the persist → store
   * contract above processEvent().
   */
  async function processListingEvent(
    event: NostrEvent,
    opts: ProcessEventOptions,
  ) {
    if (isDeletionEvent(event)) {
      const target = getDeletionTarget(event);

      if (!target) return;

      const id =
        `${target.author}:${target.dTag}`;

      if (isStaleEvent(id, event, true)) return;

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

    if (isStaleEvent(id, event, false)) return;

    // This exact version is already in the store: nothing to persist or update.
    if (get(appStore).listings[id]?.eventId === event.id) return;

    const expiresAt =
      acceptableExpiration(
        event,
        ABSOLUTE_MAX_VALIDITY_DAYS,
      );

    if (expiresAt === null) return;

    const now =
      Math.floor(Date.now() / 1000);

    if (expiresAt <= now) {
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
      createdAt: event.created_at,
      expiresAt,
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

    listingExpiryTracker.set(
      id,
      expiresAt,
      async () => {
        try {
          await deleteListingPersisted(id);
          removeListingFromStore(id);
        } catch {
          // Store nicht verändern, wenn die Persistenzlöschung fehlgeschlagen ist.
        }
      },
    );
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

  function startTombstoneWatchers() {
    if (!client) return;

    const now = Math.floor(Date.now() / 1000);

    // Tombstones carry an expiration (see tombstoneExpirationTag), so a
    // tombstone that matters is never older than the entity's maximum
    // lifetime. `since` stays fixed: on a relay reconnect the stored
    // subscription is replayed with it and delivers whatever was missed.
    listingTombstoneSub = client.subscribe(
      'tombstones-listing',
      buildFilter({
        kinds: [LISTING_KIND],
        tags: { t: [DELETION_TAG_VALUE] },
        since: now - ABSOLUTE_MAX_VALIDITY_DAYS * 86400,
      }),
      (event) => {
        processEvent(event, { persist: true });
      },
    );

    missionTombstoneSub = client.subscribe(
      'tombstones-mission',
      buildFilter({
        kinds: [MISSION_KIND],
        tags: { t: [DELETION_TAG_VALUE] },
        since: now - MISSION_TTL_DAYS * 86400,
      }),
      (event) => {
        processEvent(event, { persist: true });
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
    if (!client) {
      setError('Not connected yet — try again in a moment.');
      return;
    }

    if (activeWorkflowToken) {
      rejectWhileBusy('missionSubmit');
      return;
    }

    const token = beginWorkflow();

    const dTag =
      payload.dTag ??
      `mission-${crypto.randomUUID()}`;

    const tags: string[][] = [
      ['t', 'mission'],
      [
        'expiration',
        String(
          Math.floor(Date.now() / 1000) +
            MISSION_TTL_DAYS * 86400,
        ),
      ],
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
        minCreatedAt: nextCreatedAt(`${client.pubkey}:${dTag}`),
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

    if (activeWorkflowToken !== token) return;

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

    if (activeWorkflowToken !== token) return;

    for (const event of own.events) {
      await processEvent(event, { persist: true });
    }

    endWorkflow();
  }

  /**
   * The single receive-path pipeline for every mission-kind event,
   * regardless of source (mission sync, the live subscription, our own
   * just-published mission fetched back, or the tombstone watcher). Only ever called from
   * processEvent() — the `MISSION_KIND` case of its switch — never
   * directly. Same persist → store contract as processListingEvent():
   * persistence is always awaited to completion before the store is
   * touched. `opts.buffer` doesn't apply here — nothing calls
   * processMissionEvent() with a batch to flush — so it's accepted for
   * signature parity with processListingEvent() but otherwise ignored.
   */
  async function processMissionEvent(
    event: NostrEvent,
    opts: ProcessEventOptions,
  ) {
    if (isDeletionEvent(event)) {
      const target =
        getDeletionTarget(event);

      if (!target) return;

      const id =
        `${target.author}:${target.dTag}`;

      if (isStaleEvent(id, event, true)) return;

      missionExpiryTracker.clear(id);

      if (opts.persist) {
        await deleteMissionPersisted(id);
      }

      removeMissionFromStore(id);

      return;
    }

    const dTag = dTagOf(event);
    if (!dTag) return;

    const id =
      `${event.pubkey}:${dTag}`;

    if (isStaleEvent(id, event, false)) return;

    // This exact version is already in the store: nothing to persist or update.
    if (get(appStore).missions[id]?.eventId === event.id) return;

    // Must come after the stale check: an old, already-expired version
    // handed back by a lagging relay must not remove a freshly renewed one.
    // A mission without a valid `expiration` tag (or one beyond
    // MISSION_TTL_DAYS from now) is discarded — no fallback.
    const expiresAt =
      acceptableExpiration(
        event,
        MISSION_TTL_DAYS,
      );

    if (expiresAt === null) return;

    if (expiresAt <= Math.floor(Date.now() / 1000)) {
      missionExpiryTracker.clear(id);

      if (opts.persist) {
        await deleteMissionPersisted(id);
      }

      removeMissionFromStore(id);

      return;
    }

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
      createdAt: event.created_at,
      expiresAt,
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

    if (opts.persist) {
      await saveMission(record);
    }

    upsertMissionInStore(record);

    missionExpiryTracker.set(id, expiresAt, async () => {
      try {
        await deleteMissionPersisted(id);
        removeMissionFromStore(id);
      } catch {
        // Store nicht verändern, wenn die Persistenzlöschung fehlgeschlagen ist.
      }
    });
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

  function readMissionSyncCursor(): number | null {
    try {
      const raw = localStorage.getItem(MISSION_SYNC_CURSOR_KEY);
      return raw && /^\d+$/.test(raw) ? Number(raw) : null;
    } catch {
      return null;
    }
  }

  function writeMissionSyncCursor(unixSecs: number) {
    try {
      localStorage.setItem(MISSION_SYNC_CURSOR_KEY, String(unixSecs));
    } catch {}
  }

  /**
   * Pulls every mission published since `since`, newest first, page by
   * page: each page asks for the events up to `until` (the oldest
   * `created_at` of the previous page) and the walk ends when a page brings
   * no event that hasn't been seen already. That end condition does not
   * depend on how many events a relay is willing to return per request, so a
   * relay-side cap can never silently cut the result short.
   *
   * Returns false if no relay answered, so the caller doesn't treat the run
   * as complete.
   */
  async function syncMissions(since: number): Promise<boolean> {
    if (!client) return false;

    const collected = new Set<string>();
    let until: number | undefined;

    for (;;) {
      const result = await client.query(
        buildFilter({
          kinds: [MISSION_KIND],
          tags: { t: ['mission'] },
          since,
          until,
          limit: MISSION_SYNC_PAGE_LIMIT,
        }),
        {
          timeoutMs: MISSION_QUERY_TIMEOUT_MS,
          retries: 1,
        },
      );

      if (result.status === 'failed') return false;

      const fresh = result.events.filter((e) => !collected.has(e.id));

      if (fresh.length === 0) return true;

      for (const event of fresh) {
        collected.add(event.id);
        await processEvent(event, { persist: true });
      }

      until = result.events.reduce(
        (oldest, e) => Math.min(oldest, e.created_at),
        Infinity,
      );
    }
  }

  /**
   * One sync run: first start → everything of the last MISSION_TTL_DAYS;
   * later starts → only what is new since the stored cursor (minus a safety
   * overlap). The cursor only advances after a run that reached the relays.
   */
  async function runMissionSync() {
    if (!client || destroyed) return;

    const startedAt = Math.floor(Date.now() / 1000);
    const windowStart = startedAt - MISSION_TTL_DAYS * 86400;
    const cursor = readMissionSyncCursor();

    const since =
      cursor === null
        ? windowStart
        : Math.max(windowStart, cursor - MISSION_SYNC_OVERLAP_SECS);

    const complete = await syncMissions(since);

    if (destroyed) return;

    if (complete) {
      writeMissionSyncCursor(startedAt);
    } else {
      missionSyncRetryTimer = setTimeout(runMissionSync, MISSION_SYNC_RETRY_MS);
    }
  }

  /**
   * The live subscription goes up *before* the catch-up starts, so nothing
   * published while the sync runs can slip through. Its `since` stays fixed:
   * after a relay reconnect the client replays the subscription and the
   * relay delivers everything missed in between — no polling needed.
   */
  function startMissionSync() {
    if (!client) return;

    missionLiveSub = client.subscribe(
      'missions-live',
      buildFilter({
        kinds: [MISSION_KIND],
        tags: { t: ['mission'] },
        since: Math.floor(Date.now() / 1000),
      }),
      (event) => {
        processEvent(event, { persist: true });
      },
    );

    runMissionSync();
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
    // This avoids the startup race where openDeepLink is already populated
    // while client is still null.
    if (openDeepLink) {
      fetchEntityByDeepLink(openDeepLink);
    }

    const cached =
      await loadAllListings();

    const now =
      Math.floor(Date.now() / 1000);

    const hydrated:
      Record<string, ListingRecord> = {};

    for (const record of cached) {
      // `createdAt` and `expiresAt` are required: a cached listing without
      // them (or already expired) is dropped from the cache and the store.
      if (
        typeof record.createdAt !== 'number' ||
        record.expiresAt <= now
      ) {
        deleteListingPersisted(
          record.id,
        ).catch(() => {});
        continue;
      }

      latestEventAt.set(record.id, {
        at: record.createdAt,
        deleted: false,
      });

      hydrated[record.id] = record;

      listingExpiryTracker.set(
        record.id,
        record.expiresAt,
        async () => {
          try {
            await deleteListingPersisted(
              record.id,
            );
            removeListingFromStore(
              record.id,
            );
          } catch {
            // Store nicht verändern, wenn die Persistenzlöschung fehlgeschlagen ist.
          }
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
        // `createdAt` and `expiresAt` are required: a cached mission
        // without them (or already expired) is dropped from cache and store.
        if (
          typeof mission.createdAt !== 'number' ||
          typeof mission.expiresAt !== 'number' ||
          mission.expiresAt <= now
        ) {
          deleteMissionPersisted(
            mission.id,
          ).catch(() => {});
          continue;
        }

        latestEventAt.set(mission.id, {
          at: mission.createdAt,
          deleted: false,
        });

        missionExpiryTracker.set(
          mission.id,
          mission.expiresAt,
          async () => {
            try {
              await deleteMissionPersisted(
                mission.id,
              );
              removeMissionFromStore(
                mission.id,
              );
            } catch {
              // Store nicht verändern, wenn die Persistenzlöschung fehlgeschlagen ist.
            }
          },
        );

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

    startMissionSync();

    startTombstoneWatchers();
  });

  onDestroy(() => {
    cancelActiveLiveSession();

    listingSearch?.liveSub?.close();

    listingTombstoneSub?.close();

    missionTombstoneSub?.close();

    missionLiveSub?.close();

    destroyed = true;

    if (missionSyncRetryTimer) {
      clearTimeout(missionSyncRetryTimer);
    }

    listingExpiryTracker.clearAll();

    missionExpiryTracker.clearAll();

    client?.disconnect();
  });

  // ═══════════════════════════════════════════════════════════════════
  // Workflow-status UI
  // ═══════════════════════════════════════════════════════════════════

  $: statusVisible =
    connectedRelays === 0 ||
    $appStore.inFlight ||
    !!$appStore.lastError ||
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

<!--
  Independent of the pill above (visible purely by $appStore.live's own
  presence, not tied to inFlight/statusVisible — a matched/expired LIVE
  session has already ended its workflow, inFlight is back to false, but
  the session itself stays on screen until the person dismisses it).
-->
{#if $appStore.live}
  <LiveOverlay
    record={$appStore.live}
    on:accept={acceptLiveOffer}
    on:reject={rejectLiveOffer}
    on:cancel={abortActiveWorkflow}
    on:done={clearLiveSession}
  />
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
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: var(--glass-border);
    border-radius: 999px;
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
