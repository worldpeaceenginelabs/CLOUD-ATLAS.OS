/**
 * appStore.ts — The app's one Store instance (store.ts's generic
 * `createStore`) plus the shape it holds.
 *
 * This is the RAM projection described throughout orchestrator-prompt.md:
 * Orchestrator.svelte is the only writer; the Cesium rendering layer (and
 * any future non-spatial listing UI) is a reader only. Kept in its own
 * file, rather than instantiated inside Orchestrator.svelte's component
 * script, so any consumer can import the same singleton without needing
 * a reference to the Orchestrator component instance — store.ts itself
 * stays framework/app-agnostic; this file is the one place that decides
 * what `T` is for this app (exactly what store.ts's own docstring asks
 * the "higher-level orchestration code" to do).
 */

import { createStore, type Store } from '../store';

/** A single LIVE match/claim record, as far as the rest of the app needs to see it. */
export interface LiveRecord {
  kind: 'live';
  /** Stable id for this session's own claim/request — also used as the Cesium entity id when it has a location. */
  id: string;
  role: 'requester' | 'provider';
  model: string;
  status: 'searching' | 'matched' | 'expired' | 'cancelled';
  /** Present once matched. */
  peerPubkey?: string;
  location: { latitude: number; longitude: number } | null;
  content: Record<string, unknown>;
}

/** A single LISTING record, as far as the rest of the app needs to see it. */
export interface ListingRecord {
  kind: 'listing';
  /** `${author}:${dTag}` — the record's logical (application-level) identity. */
  id: string;
  /** The actual Nostr event id of the current version of this listing — used for shareable links (Marketing), never for application-level identity/dedup (that's `id`/`dTag`, which stays stable across republishes; `eventId` changes on every update). */
  eventId: string;
  author: string;
  dTag: string;
  domain: string;
  model: string;
  expiresAt: number;
  location: { latitude: number; longitude: number } | null;
  /** Parsed detail content as published (title, category, description, contact, interactionMode, ...). */
  content: Record<string, unknown>;
}

/**
 * A mission's location — Point or Area only (never Route; see
 * orchestrator-prompt-mission.md §2). `area` reuses cesium/pickArea.ts's
 * own BoundingBox shape verbatim (west/south/east/north) rather than
 * inventing a new geometry.
 */
export type MissionLocation =
  | { kind: 'point'; latitude: number; longitude: number }
  | { kind: 'area'; west: number; south: number; east: number; north: number };

/** A mission's four lanes, each an optional URL except Brainstorming, which is required. Empty string = not set. Field names match missions/SwarmGovernance.svelte's existing LaneId contract verbatim (including "meetanddo", not "meetAndDo"). */
export interface MissionLanes {
  brainstorming: string;
  meetanddo: string;
  petition: string;
  crowdfunding: string;
}

/** A single Mission, as far as the rest of the app needs to see it. Logically separate from LIVE/LISTING (its own Store slice, its own Nostr kind) — never expires, unlike a listing. */
export interface MissionRecord {
  kind: 'mission';
  /** `${author}:${dTag}` — the record's logical (application-level) identity, same convention as ListingRecord. */
  id: string;
  /** The actual Nostr event id of the current version — used for shareable links (Marketing), same convention as ListingRecord.eventId. */
  eventId: string;
  author: string;
  dTag: string;
  location: MissionLocation;
  content: {
    title: string;
    description: string;
    lanes: MissionLanes;
  };
}

export type EntityRecord = LiveRecord | ListingRecord | MissionRecord;

export interface AppState {
  /** True while a discovery/synchronization cycle for the most recent payload is still running (orchestrator-prompt.md §7). */
  inFlight: boolean;
  /** The current LIVE session's public view, if any (LIVE has no persisted history — one at a time, see §11). */
  live: LiveRecord | null;
  /** All known, non-expired LISTING records, keyed by `${author}:${dTag}`. */
  listings: Record<string, ListingRecord>;
  /** All known Missions, keyed by `${author}:${dTag}` — logically separate from live/listings (orchestrator-prompt-mission.md §9), a different Store slice entirely, not commingled with either. */
  missions: Record<string, MissionRecord>;
  /** The active LISTING search's model and whether a coarser "Load More" page is available (orchestrator-prompt.md §3.4). Null when no search is active. */
  listingSearch: { model: string; canLoadMore: boolean } | null;
  /** Last user-facing validation/operational error, if any (e.g. a lead-time violation on publish). Cleared on the next successful operation. */
  lastError: string | null;
  /** This client's own public key, once known (set once, right after the Nostr client is created) — lets any reader determine "am I the author of this record" without talking to Nostr itself. */
  ownPubkey: string | null;
}

const initialState: AppState = {
  inFlight: false,
  live: null,
  listings: {},
  missions: {},
  listingSearch: null,
  lastError: null,
  ownPubkey: null,
};

export const appStore: Store<AppState> = createStore(initialState);
