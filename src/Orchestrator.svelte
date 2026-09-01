<script lang="ts">
    // Orchestrator.svelte
    // -----------------------------------------------------------------------
    // The intelligent orchestration layer described in orchestrator-prompt.md:
    // it sits between the UI selection component (HexMenu.svelte), the
    // generic Nostr infrastructure (nostr.ts), the generic reactive store
    // (store.ts, via appStore.ts), the local persistence layer for LISTING
    // (idb.ts, via listingPersistence.ts), and the Cesium rendering/mapping
    // integration layer (cesium/api.ts). It is the only place in the app
    // that knows LIVE vs LISTING, FCFS, geohash discovery policy, listing
    // lifecycle, or deletion semantics — see orchestrator-prompt.md §11 for
    // the exact knowledge boundary this file must stay inside.
    //
    // ─── Integration contract (what a parent must wire up) ───────────────
    // This component has no template of its own beyond the EntityDetails
    // popup — mount it once, anywhere in the tree, alongside HexMenu and
    // Cesium. Because Svelte only lets a direct parent listen to a child's
    // dispatched events, the parent that mounts <HexMenu> must forward its
    // two submit events to this component's exported handlers:
    //
    //
    // Everything else (relay connection, keypair, Cesium marker sync, entity
    // picking, IDB hydration, the tombstone watcher) is self-contained and
    // starts automatically on mount. Cesium.svelte just needs to be mounted
    // somewhere too — marker placement/picking retries quietly until it is.
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
    import { encode, cells3x3, cells4x4, cellsInParent } from './geohash';
    import {
      getModelPolicy,
      ABSOLUTE_MAX_VALIDITY_DAYS,
      type ListingModelPolicy,
    } from './listingPolicy';
    import { getKeypair } from './keyManager';
    import {
      appStore,
      type AppState,
      type LiveRecord,
      type ListingRecord,
      type EntityRecord,
    } from './appStore';
    import {
      saveListing,
      deleteListing as deleteListingPersisted,
      loadAllListings,
    } from './listingPersistence';
    import * as Cesium from 'cesium';
    import { entity, pick } from './cesium/api';
    import type { EntityOptions, PickedEntity } from './cesium/api';
    import type { LocationValue } from './hexmenu/domains';
    import EntityDetails from './EntityDetails.svelte';
  
    // ─── Tuning constants (orchestrator's own policy, not infrastructure) ──
  
    /** Distinct replaceable-event kinds so LIVE claims and LISTINGs never share a NIP-33 identity space. */
    const LIVE_KIND = 30079;
    const LISTING_KIND = 30078;
  
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
  
    // ─── Nostr client lifecycle ─────────────────────────────────────────
  
    let client: NostrClient | null = null;
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
  
    // ─── Cesium marker sync + entity picking (§9/§10) ───────────────────
    //
    // Uses cesium/api.ts's generic `entity` capability (not `marker`), even
    // though it's the lower-level of the two: `marker.place()`'s returned
    // handle exposes only remove() with no id, so a placed pin can never be
    // correlated back to a click. `entity.add(id, options)` lets us address
    // every pin by our own record id — required for entity-click → Store
    // lookup to work at all. This is the one place in the component that
    // needs a plain `import * as Cesium from 'cesium'` (for Cartesian3/Color
    // construction), because entity.ts's EntityOptions type is intentionally
    // just Cesium's own Entity.ConstructorOptions — it's the sanctioned
    // "arbitrary entity" escape hatch cesium/api.ts documents, not a
    // shortcut around it.
  
    const activeMarkerIds = new Set<string>(); // record ids currently rendered as Cesium entities
    let selectedRecord: EntityRecord | null = null;
  
    // ═══════════════════════════════════════════════════════════════════
    // Payload contract (§1) — entry points wired from the parent (see
    // integration contract above).
    // ═══════════════════════════════════════════════════════════════════
  
    interface HexMenuPayload {
      tags: string[][];
      content: string;
    }
  
    export async function handleOfferSubmit(event: CustomEvent<HexMenuPayload>) {
      await handleSubmit(event.detail, 'offer');
    }
  
    export async function handleSearchSubmit(event: CustomEvent<HexMenuPayload>) {
      await handleSubmit(event.detail, 'search');
    }
  
    /** Fetch the next, coarser page of the current LISTING search (§3.4's user-triggered "Load More"). No-op if there's no active search or it's already at the coarsest supported precision. */
    export async function loadMoreListings() {
      if (!client || !listingSearch || listingSearch.precision !== 5 || !listingSearch.geohash4) return;
      listingSearch.precision = 4;
  
      appStore.update((s) => ({ ...s, inFlight: true }));
      const filter = buildFilter({
        kinds: [LISTING_KIND],
        tags: { t: [`listing-${listingSearch.model}`], g: [listingSearch.geohash4] },
      });
      await runListingQuery(filter, listingSearch.categoryFilter);
  
      listingSearch.liveSub?.close();
      listingSearch.liveSub = client.subscribe(`listing-live-${listingSearch.geohash4}`, filter, (event) => {
        processListingEvent(event, { persist: true });
      });
      appStore.update((s) => ({ ...s, inFlight: false }));
    }
  
    /** Publish a tombstone for one of the caller's own listings and wait for it to come back through the normal receive path (§3.2/§4), same as any other listing mutation. `id` is the `${author}:${dTag}` logical id shown in the store. */
    export async function deleteOwnListing(id: string) {
      if (!client) return;
      const dTag = id.slice(id.indexOf(':') + 1);
      const marker = client.publishDeletionMarker(dTag, [], LISTING_KIND);
      const own = await client.query(
        { kinds: [LISTING_KIND], ids: [marker.id] },
        { timeoutMs: LISTING_QUERY_TIMEOUT_MS, retries: 1 },
      );
      for (const event of own.events) await processListingEvent(event, { persist: true });
    }
  
    async function handleSubmit(payload: HexMenuPayload, action: 'offer' | 'search') {
      if (!client) {
        setError('Not connected yet — try again in a moment.');
        return;
      }
  
      // §11: a new payload must fully cancel whatever operation was running before starting the next one.
      cancelActiveOperation();
  
      const domain = tagValue(payload.tags, 'domain');
      const model = tagValue(payload.tags, 'model');
      const anypay = payload.tags.filter((t) => t[0] === 'anypay').map((t) => t[1]);
      if (!domain || !model) {
        setError('Payload is missing domain/model.');
        return;
      }
  
      let content: Record<string, any>;
      try {
        content = JSON.parse(payload.content);
      } catch {
        setError('Payload content is not valid JSON.');
        return;
      }
  
      const policy = getModelPolicy(model);
      if (!policy) {
        setError(`No operating-mode policy known for model "${model}".`);
        return;
      }
  
      if (policy.mode === 'LIVE') {
        await startLiveSession(action === 'offer' ? 'provider' : 'requester', model, content);
      } else if (action === 'offer') {
        await publishListing(domain, model, anypay, content, policy);
      } else {
        await searchListings(model, content, policy);
      }
    }
  
    function cancelActiveOperation() {
      cancelActiveLiveSession();
      listingSearch?.liveSub?.close();
    }
  
    function tagValue(tags: string[][], key: string): string | undefined {
      return tags.find((t) => t[0] === key)?.[1];
    }
  
    function setError(message: string) {
      console.warn(`[Orchestrator] ${message}`);
      appStore.update((s) => ({ ...s, inFlight: false, lastError: message }));
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
      const location = extractStartCoordinate(content.location as LocationValue | undefined);
      if (!location) {
        setError('LIVE requires a location.');
        return;
      }
  
      const geohash = encode(location.latitude, location.longitude, LIVE_G6_PRECISION);
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
      appStore.update((s) => ({ ...s, inFlight: true, live: toLiveRecord(session) }));
  
      const published = await publishLiveClaim(session);
      if (liveSession !== session) return; // superseded by a newer payload while we were awaiting
      if (!published) {
        endLiveSession(session, 'expired');
        return;
      }
  
      scheduleLiveHeartbeat(session);
      startLiveDiscovery(session);
      startLiveExpansionTimers(session);
      if (role === 'requester') startLiveDmListener(session);
    }
  
    /** Publishes (or re-publishes, for the heartbeat) this session's own claim event. Returns whether at least one relay confirmed it. */
    async function publishLiveClaim(session: LiveSessionInternal): Promise<boolean> {
      if (!client) return false;
      const expiresAt = Math.floor(Date.now() / 1000) + LIVE_TTL_SECS;
      const counterKind = session.role === 'requester' ? 'need' : 'offer';
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
        verifyFilter: { kinds: [LIVE_KIND], authors: [client.pubkey], '#d': [session.dTag] },
        query: { timeoutMs: 8000, retries: 1 },
      });
  
      if (result.status === 'failed') return false;
      session.expiresAt = expiresAt;
      return true;
    }
  
    function scheduleLiveHeartbeat(session: LiveSessionInternal) {
      const nowSecs = Math.floor(Date.now() / 1000);
      const delayMs = Math.max(1000, (session.expiresAt - LIVE_HEARTBEAT_LEAD_SECS - nowSecs) * 1000);
      session.heartbeatTimer = setTimeout(async () => {
        if (liveSession !== session || session.status !== 'searching') return;
        const ok = await publishLiveClaim(session);
        if (liveSession !== session) return;
        if (!ok) {
          // §2.2: no relay confirmed the renewal — treat our own session as locally expired.
          endLiveSession(session, 'expired');
          return;
        }
        scheduleLiveHeartbeat(session);
      }, delayMs);
    }
  
    function startLiveDiscovery(session: LiveSessionInternal) {
      if (!client) return;
      const counterTag = `${session.role === 'requester' ? 'offer' : 'need'}-${session.model}`;
      const filter = buildFilter({ kinds: [LIVE_KIND], tags: { t: [counterTag], g: [session.geohash] } });
      session.discoverySub = client.subscribe(`live-disc-${session.dTag}`, filter, (event) =>
        handleLiveCandidate(session, event),
      );
    }
  
    function dTagOf(event: NostrEvent): string | undefined {
      return event.tags.find((t) => t[0] === 'd')?.[1];
    }
  
    function handleLiveCandidate(session: LiveSessionInternal, event: NostrEvent) {
      if (liveSession !== session || session.status !== 'searching') return;
      if (isDeletionEvent(event)) return; // LIVE claims expire naturally; tombstones aren't part of this protocol.
  
      let body: any;
      try {
        body = JSON.parse(event.content);
      } catch {
        return;
      }
  
      session.seenCounterpartAuthors.add(event.pubkey);
  
      if (session.role === 'requester') {
        // Matching for the requester happens via the encrypted "accept" DM
        // (startLiveDmListener), not off this discovery stream directly —
        // this only feeds the empty/no-match expansion triggers above.
        return;
      }
  
      // Provider: `event` is a 'need-<model>' request from a requester.
      if (body?.status === 'taken') {
        if (body?.winnerPubkey === client?.pubkey) {
          session.peerPubkey = event.pubkey;
          endLiveSession(session, 'matched');
        }
        return;
      }
      if (body?.status && body.status !== 'open') return; // cancelled/expired from the requester's own perspective
  
      if (session.repliedTo.has(event.pubkey)) return; // one "accept" per distinct requester
      session.repliedTo.add(event.pubkey);
  
      const requestId = dTagOf(event);
      if (!requestId) return;
      client?.sendEncrypted(
        event.pubkey,
        JSON.stringify({ type: 'accept', requestId }),
        [['expiration', String(Math.floor(Date.now() / 1000) + LIVE_TTL_SECS)]],
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
          if (liveSession !== session || session.status !== 'searching') return; // FCFS lock — first accept only
          let msg: any;
          try {
            msg = JSON.parse(plaintext);
          } catch {
            return;
          }
          if (msg?.type !== 'accept' || msg?.requestId !== session.dTag) return;
  
          session.peerPubkey = fromPubkey;
          confirmLiveMatch(session);
        },
        `live-dm-${session.dTag}`,
      );
    }
  
    async function confirmLiveMatch(session: LiveSessionInternal) {
      session.status = 'matched'; // synchronous FCFS lock before the async publish below
      clearLiveTimers(session);
      session.discoverySub?.close();
      session.dmSub?.close();
      await publishLiveClaim(session); // republish so the peer (and any losing candidates) observe the "taken" state
      if (liveSession === session) {
        appStore.update((s) => ({ ...s, inFlight: false, live: toLiveRecord(session) }));
      }
    }
  
    function startLiveExpansionTimers(session: LiveSessionInternal) {
      session.expandEmptyTimer = setInterval(() => {
        if (liveSession !== session || session.status !== 'searching') return;
        if (session.seenCounterpartAuthors.size === 0) tickExpansion(session);
      }, LIVE_EXPAND_EMPTY_INTERVAL_MS);
  
      session.expandNoMatchTimer = setInterval(() => {
        if (liveSession !== session || session.status !== 'searching') return;
        if (session.seenCounterpartAuthors.size > 0) tickExpansion(session);
      }, LIVE_EXPAND_NOMATCH_INTERVAL_MS);
    }
  
    function tickExpansion(session: LiveSessionInternal) {
      if (session.expandLevel >= LIVE_MAX_EXPAND_LEVEL) return; // final grace timer (below) owns the end condition now
      expandLiveScope(session);
    }
  
    function expandLiveScope(session: LiveSessionInternal) {
      session.expandLevel = (session.expandLevel + 1) as 1 | 2 | 3;
      const cells =
        session.expandLevel === 1 ? cells3x3(session.geohash) :
        session.expandLevel === 2 ? cells4x4(session.geohash) :
        cellsInParent(session.geohash);
  
      const counterTag = `${session.role === 'requester' ? 'offer' : 'need'}-${session.model}`;
      session.discoverySub?.update(buildFilter({ kinds: [LIVE_KIND], tags: { t: [counterTag], g: cells } }));
  
      if (session.expandLevel >= LIVE_MAX_EXPAND_LEVEL) {
        if (session.expandEmptyTimer) clearInterval(session.expandEmptyTimer);
        if (session.expandNoMatchTimer) clearInterval(session.expandNoMatchTimer);
        session.expandEmptyTimer = undefined;
        session.expandNoMatchTimer = undefined;
        // One final window at the widest supported scope before giving up entirely (§2.5: "endet ergebnislos").
        session.finalGraceTimer = setTimeout(() => {
          if (liveSession === session && session.status === 'searching') endLiveSession(session, 'expired');
        }, LIVE_EXPAND_NOMATCH_INTERVAL_MS);
      }
    }
  
    function clearLiveTimers(session: LiveSessionInternal) {
      if (session.heartbeatTimer) clearTimeout(session.heartbeatTimer);
      if (session.expandEmptyTimer) clearInterval(session.expandEmptyTimer);
      if (session.expandNoMatchTimer) clearInterval(session.expandNoMatchTimer);
      if (session.finalGraceTimer) clearTimeout(session.finalGraceTimer);
    }
  
    function endLiveSession(session: LiveSessionInternal, finalStatus: 'matched' | 'expired' | 'cancelled') {
      if (liveSession !== session) return;
      session.status = finalStatus;
      clearLiveTimers(session);
      session.discoverySub?.close();
      session.dmSub?.close();
      appStore.update((s) => ({ ...s, inFlight: false, live: toLiveRecord(session) }));
    }
  
    function cancelActiveLiveSession() {
      if (!liveSession) return;
      const session = liveSession;
      clearLiveTimers(session);
      session.discoverySub?.close();
      session.dmSub?.close();
      liveSession = null;
      appStore.update((s) => ({ ...s, live: null }));
    }
  
    function toLiveRecord(session: LiveSessionInternal): LiveRecord {
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
      if (typeof raw === 'number') return raw > 1e12 ? Math.floor(raw / 1000) : Math.floor(raw);
      if (typeof raw === 'string') {
        const ms = Date.parse(raw);
        return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
      }
      return null;
    }
  
    async function publishListing(
      domain: string,
      model: string,
      anypay: string[],
      content: Record<string, any>,
      policy: ListingModelPolicy,
    ) {
      if (!client) return;
      const now = Math.floor(Date.now() / 1000);
  
      // §3.1 — lead time is a publish-time gate; expiration is the reference
      // timestamp itself, never "reference minus lead time".
      let expiresAt: number;
      if (policy.referenceField) {
        const refTs = parseTimestamp(content[policy.referenceField]);
        if (refTs != null) {
          const maxLeadSecs = policy.maxLeadDays * 86400;
          if (refTs <= now) {
            setError('That date is already in the past.');
            return;
          }
          if (refTs - now > maxLeadSecs) {
            setError(`This can only be published up to ${policy.maxLeadDays} day(s) in advance.`);
            return;
          }
          expiresAt = refTs;
        } else {
          expiresAt = now + policy.maxLeadDays * 86400; // reference field present in schema but not filled in — fall back
        }
      } else {
        expiresAt = now + policy.maxLeadDays * 86400;
      }
      expiresAt = Math.min(expiresAt, now + ABSOLUTE_MAX_VALIDITY_DAYS * 86400);
  
      const location = extractStartCoordinate(content.location as LocationValue | undefined);
      const interactionMode = content.interactionMode as string | undefined;
      // §3.2/§3.4 (corrected): geohash tag exists purely because a location
      // exists — "online" listings simply have none relevant to tag; this is
      // never a discovery filter decision.
      const shouldTag = !!location && interactionMode !== 'online';
  
      const tags: string[][] = [
        ['t', `listing-${model}`],
        ['domain', domain],
        ['model', model],
        ['expiration', String(expiresAt)],
        ...anypay.map((id) => ['anypay', id]),
      ];
      if (shouldTag && location) {
        const g5 = encode(location.latitude, location.longitude, LISTING_SEARCH_PRECISION_INITIAL);
        tags.push(['g', g5], ['g', g5.slice(0, 4)]);
      }
  
      const dTag = `listing-${crypto.randomUUID()}`;
      appStore.update((s) => ({ ...s, inFlight: true }));
  
      const result = await client.publishReplaceableWithVerify({
        dTag,
        kind: LISTING_KIND,
        tags,
        content: JSON.stringify(content),
        verifyFilter: { kinds: [LISTING_KIND], authors: [client.pubkey], '#d': [dTag] },
        query: { timeoutMs: LISTING_QUERY_TIMEOUT_MS, retries: 1 },
      });
  
      if (result.status === 'failed') {
        setError('Failed to publish — no relay confirmed it.');
        return;
      }
  
      // §3.2 "kein Sonderweg": even our own listing only enters the store
      // once it has round-tripped through the identical receive path used
      // for discovered listings — never written directly off the publish result.
      const own = await client.query(
        { kinds: [LISTING_KIND], authors: [client.pubkey], '#d': [dTag] },
        { timeoutMs: LISTING_QUERY_TIMEOUT_MS, retries: 1 },
      );
      for (const event of own.events) await processListingEvent(event, { persist: true });
      appStore.update((s) => ({ ...s, inFlight: false }));
    }
  
    function normalizeCategoryFilter(content: Record<string, any>): string[] | null {
      if (Array.isArray(content.categoryIds) && content.categoryIds.length) return content.categoryIds;
      if (typeof content.categoryId === 'string' && content.categoryId) return [content.categoryId];
      return null;
    }
  
    function eventMatchesCategory(event: NostrEvent, wanted: string[]): boolean {
      try {
        const content = JSON.parse(event.content);
        const ids: string[] = content.categoryId ? [content.categoryId] : content.categoryIds ?? [];
        return ids.some((id: string) => wanted.includes(id));
      } catch {
        return false;
      }
    }
  
    async function runListingQuery(filter: NostrFilter, categoryFilter: string[] | null) {
      if (!client) return;
      const result = await client.query(filter, { timeoutMs: LISTING_QUERY_TIMEOUT_MS, retries: 1 });
      for (const event of result.events) {
        if (categoryFilter && !eventMatchesCategory(event, categoryFilter)) continue;
        await processListingEvent(event, { persist: true });
      }
    }
  
    async function searchListings(model: string, content: Record<string, any>, _policy: ListingModelPolicy) {
      if (!client) return;
      const location = extractStartCoordinate(content.location as LocationValue | undefined);
      const categoryFilter = normalizeCategoryFilter(content);
  
      // A new search payload is a new Vorgang (§11) — its result set starts fresh.
      appStore.update((s) => ({ ...s, listings: {}, inFlight: true }));
  
      if (!location) {
        // No location relevant to this search — content/type/category-driven only (§3.4).
        listingSearch = { model, categoryFilter, geohash5: '', geohash4: '', precision: 5 };
        await runListingQuery(buildFilter({ kinds: [LISTING_KIND], tags: { t: [`listing-${model}`] } }), categoryFilter);
        appStore.update((s) => ({ ...s, inFlight: false }));
        return;
      }
  
      const geohash5 = encode(location.latitude, location.longitude, LISTING_SEARCH_PRECISION_INITIAL);
      const geohash4 = geohash5.slice(0, 4);
      listingSearch = { model, categoryFilter, geohash5, geohash4, precision: 5 };
  
      const filter = buildFilter({ kinds: [LISTING_KIND], tags: { t: [`listing-${model}`], g: [geohash5] } });
      await runListingQuery(filter, categoryFilter);
  
      // Ongoing live updates after the initial cycle completes (§7).
      listingSearch.liveSub = client.subscribe(`listing-live-${geohash5}`, filter, (event) => {
        processListingEvent(event, { persist: true });
      });
      appStore.update((s) => ({ ...s, inFlight: false }));
    }
  
    /**
     * The single receive-path pipeline for every listing-kind event,
     * regardless of source (discovery query, live subscription, our own
     * just-published listing fetched back, or the tombstone watcher) — see
     * orchestrator-prompt.md §6. Verify/dedup against relay origin is
     * already handled inside nostr.ts; this only interprets, applies
     * create/update/delete semantics, and projects into store + (for
     * LISTING) the persistence layer.
     */
    async function processListingEvent(event: NostrEvent, opts: { persist: boolean }) {
      if (isDeletionEvent(event)) {
        const target = getDeletionTarget(event);
        if (!target) return;
        const id = `${target.author}:${target.dTag}`;
        removeListingFromStore(id);
        listingExpiryTracker.clear(id);
        if (opts.persist) await deleteListingPersisted(id);
        return;
      }
  
      const dTag = dTagOf(event);
      if (!dTag) return;
      const id = `${event.pubkey}:${dTag}`;
  
      const expiresAt = getExpiration(event);
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt != null && expiresAt <= now) {
        removeListingFromStore(id);
        listingExpiryTracker.clear(id);
        if (opts.persist) await deleteListingPersisted(id);
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
        author: event.pubkey,
        dTag,
        domain: event.tags.find((t) => t[0] === 'domain')?.[1] ?? '',
        model: event.tags.find((t) => t[0] === 'model')?.[1] ?? '',
        expiresAt: expiresAt ?? now + ABSOLUTE_MAX_VALIDITY_DAYS * 86400,
        location: extractStartCoordinate(content.location as LocationValue | undefined),
        content,
      };
  
      upsertListingInStore(record);
      if (opts.persist) await saveListing(record);
  
      if (expiresAt != null) {
        listingExpiryTracker.set(id, expiresAt, () => {
          removeListingFromStore(id);
          deleteListingPersisted(id).catch(() => {});
        });
      }
    }
  
    function upsertListingInStore(record: ListingRecord) {
      appStore.update((s) => ({ ...s, listings: { ...s.listings, [record.id]: record } }));
    }
  
    function removeListingFromStore(id: string) {
      appStore.update((s) => {
        if (!(id in s.listings)) return s;
        const listings = { ...s.listings };
        delete listings[id];
        return { ...s, listings };
      });
    }
  
    function startTombstoneWatcher() {
      if (!client) return;
      tombstoneSub = client.subscribe(
        'tombstones',
        buildFilter({ kinds: [LISTING_KIND], tags: { t: [DELETION_TAG_VALUE] }, since: tombstoneCursor }),
        (event) => {
          tombstoneCursor = Math.max(tombstoneCursor, event.created_at);
          processListingEvent(event, { persist: true });
        },
      );
    }
  
    // ═══════════════════════════════════════════════════════════════════
    // Cesium integration (§9/§10) — marker sync + entity-click → EntityDetails
    // ═══════════════════════════════════════════════════════════════════
  
    function colorFor(record: EntityRecord): string {
      if (record.kind === 'live') return record.status === 'matched' ? '#57e389' : '#2ae9c9';
      return '#335bf4';
    }
  
    function entityOptionsFor(record: EntityRecord): EntityOptions {
      const loc = record.location!;
      return {
        position: Cesium.Cartesian3.fromDegrees(loc.longitude, loc.latitude),
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString(colorFor(record)),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      };
    }
  
    function syncMarkers(state: AppState) {
      const wanted = new Map<string, EntityRecord>();
      if (state.live?.location) wanted.set(state.live.id, state.live);
      for (const listing of Object.values(state.listings)) {
        if (listing.location) wanted.set(listing.id, listing);
      }
  
      for (const id of activeMarkerIds) {
        if (wanted.has(id)) continue;
        entity.remove(id);
        activeMarkerIds.delete(id);
      }
  
      for (const [id, record] of wanted) {
        if (activeMarkerIds.has(id) || !record.location) continue;
        try {
          entity.add(id, entityOptionsFor(record));
          activeMarkerIds.add(id);
        } catch {
          // Cesium viewer not mounted yet — retried on the next store change.
        }
      }
    }
  
    $: syncMarkers($appStore);
  
    function enableEntityPicking() {
      try {
        pick.entity.enable((picked: PickedEntity) => {
          // entity.add(id, ...) sets Cesium's own Entity.id to our record id
          // directly, so a PickedEntity wrapping that entity should expose
          // the same id — no separate lookup table needed.
          const recordId = (picked as unknown as { id?: string })?.id;
          if (!recordId) return;
          const state = appStore.get();
          selectedRecord = state.live?.id === recordId ? state.live : state.listings[recordId] ?? null;
        });
      } catch {
        // Cesium viewer not mounted yet — try again shortly.
        setTimeout(enableEntityPicking, 500);
      }
    }
  
    // ═══════════════════════════════════════════════════════════════════
    // Lifecycle (§11)
    // ═══════════════════════════════════════════════════════════════════
  
    onMount(async () => {
      const { sk } = await getKeypair();
      client = new NostrClient(sk, {
        onLog: (level, message) => (level === 'warn' ? console.warn : console.log)(`[nostr] ${message}`),
      });
      client.connect();
  
      // Hydrate from local cache immediately — not a discovery cycle, no inFlight (§3.5/§8).
      const cached = await loadAllListings();
      const now = Math.floor(Date.now() / 1000);
      for (const record of cached) {
        if (record.expiresAt <= now) {
          deleteListingPersisted(record.id).catch(() => {});
          continue;
        }
        upsertListingInStore(record);
        listingExpiryTracker.set(record.id, record.expiresAt, () => {
          removeListingFromStore(record.id);
          deleteListingPersisted(record.id).catch(() => {});
        });
      }
  
      startTombstoneWatcher();
      enableEntityPicking();
    });
  
    onDestroy(() => {
      cancelActiveLiveSession();
      listingSearch?.liveSub?.close();
      tombstoneSub?.close();
      listingExpiryTracker.clearAll();
      pick.entity.disable();
      for (const id of activeMarkerIds) entity.remove(id);
      activeMarkerIds.clear();
      client?.disconnect();
    });
  </script>
  
  {#if selectedRecord}
    <EntityDetails record={selectedRecord} on:close={() => (selectedRecord = null)} />
  {/if}