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
import type { InteractionMode } from '../hexmenu/domains';

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
  /**
   * Driver (provider) side only — the one rider currently offered for an
   * explicit Accept/Reject decision, or null when there's none pending.
   * Always null on a rider's (requester's) own record: Orchestrator's
   * toLiveRecord() only ever populates this for a provider session, so a
   * rider's UI structurally never sees another rider's candidate/offer
   * data, no matter what it reads off this record.
   */
  offer: { requestId: string; content: Record<string, unknown> } | null;
  /** Driver side only — true right after Accept was clicked, while waiting to learn whether this driver won the race against any other driver who also accepted the same rider. Always false on a rider's own record. */
  awaitingConfirmation: boolean;
}

/** Parsed web deep link: `/<domain>/<author-pubkey-hex>/<dTag>`. `domain` is a Cloud Atlas domain id, or `mission` for a Mission. Addresses the replaceable resource (author + d-tag), not one event version. */
export interface DeepLink {
  domain: string;
  author: string;
  dTag: string;
}

/** A single LISTING record, as far as the rest of the app needs to see it. */
export interface ListingRecord {
  kind: 'listing';
  /** `${author}:${dTag}` — the record's logical (application-level) identity. */
  id: string;
  /** The actual Nostr event id of the current version of this listing — used to detect that a newer version arrived (edit conflict detection), never for application-level identity/dedup or links (that's `id`/`dTag`, which stays stable across republishes; `eventId` changes on every update). */
  eventId: string;
  author: string;
  dTag: string;
  domain: string;
  model: string;
  /** Unix seconds. The event's `created_at` — seeds the stale-event guard from the local cache after a reload. */
  createdAt: number;
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

/** A single Mission, as far as the rest of the app needs to see it. Logically separate from LIVE/LISTING (its own Store slice, its own Nostr kind). Expires like a listing, just on a much longer clock (MISSION_TTL_DAYS); every republish (create or edit-save) renews it. */
export interface MissionRecord {
  kind: 'mission';
  /** `${author}:${dTag}` — the record's logical (application-level) identity, same convention as ListingRecord. */
  id: string;
  /** The actual Nostr event id of the current version — same convention as ListingRecord.eventId. */
  eventId: string;
  author: string;
  dTag: string;
  location: MissionLocation;
  /** Unix seconds. The event's `created_at` — seeds the stale-event guard from the local cache after a reload. */
  createdAt: number;
  /** Unix seconds. From the event's NIP-40 `expiration` tag. Required: events without a valid tag (or one beyond MISSION_TTL_DAYS from now) are discarded on receipt. */
  expiresAt: number;
  content: {
    title: string;
    description: string;
    lanes: MissionLanes;
  };
}

export type EntityRecord = LiveRecord | ListingRecord | MissionRecord;

/** One row of the search result list, prepared by the Orchestrator so the list component only has to draw it. */
export type ListingViewRow =
  | {
      type: 'listing';
      /** The record's logical id (`${author}:${dTag}`). */
      id: string;
      title: string;
      /** Display name(s) of the listing's category/categories. */
      category: string;
      /** Unix seconds. */
      expiresAt: number;
      interactionMode: InteractionMode;
    }
  | {
      /** A stretch of time nobody has loaded completely: listings published in [lo, hi] (unix seconds) may exist. */
      type: 'gap';
      key: string;
      lo: number;
      hi: number;
    };

/** What the search result list shows — the Orchestrator's one projection of the active LISTING search (null = no list open). */
export interface ListingViewState {
  mode: 'map' | 'online';
  /** Heading: where the list looks, e.g. 'Nearby · ~5 km'. */
  areaLabel: string;
  /** Epoch ms of the newest successful relay fetch of this search, or null before the first one. */
  updatedAt: number | null;
  /** True once the newest page of the area was answered completely by enough relays (MIN_COMPLETE_RELAYS in Orchestrator); null while the area is not loaded yet in this search. */
  complete: boolean | null;
  rows: ListingViewRow[];
  /** Map search only: the area can be widened (this one is loaded all the way down). */
  canWiden: boolean;
  /** Map search only: the list is on the wider area and can go back to nearby. */
  canNarrow: boolean;
}

/** Ask the details panel to show a record: after a publish, or from a list row. */
export interface OpenRequest {
  record: ListingRecord | MissionRecord;
  /** Fly the camera to the record's location first (ignored if it has none). */
  fly: boolean;
  /** The record is not part of the drawn set: draw a marker for it that disappears together with the panel. */
  temporary: boolean;
  /** Distinguishes a repeated request for the same record. */
  nonce: number;
}

export interface AppState {
  /** True while a discovery/synchronization cycle for the most recent payload is still running (orchestrator-prompt.md §7). */
  inFlight: boolean;
  /** The current LIVE session's public view, if any (LIVE has no persisted history — one at a time, see §11). */
  live: LiveRecord | null;
  /** The LISTING records drawn on the map: the caller's own plus the results of the active map search, keyed by `${author}:${dTag}`. Everything ever received lives in the local cache (IndexedDB), not here. */
  listings: Record<string, ListingRecord>;
  /** All known Missions, keyed by `${author}:${dTag}` — logically separate from live/listings (orchestrator-prompt-mission.md §9), a different Store slice entirely, not commingled with either. */
  missions: Record<string, MissionRecord>;
  /** The active LISTING search as the result list shows it. Null when no list is open. */
  listingView: ListingViewState | null;
  /** The newest request to show a record in the details panel (see OpenRequest). Null = nothing requested, or the list that requested it was closed. */
  openRequest: OpenRequest | null;
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
  listingView: null,
  openRequest: null,
  lastError: null,
  ownPubkey: null,
};

export const appStore: Store<AppState> = createStore(initialState);
