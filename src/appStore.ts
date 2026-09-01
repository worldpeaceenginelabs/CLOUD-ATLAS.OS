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

import { createStore, type Store } from './store';

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
  author: string;
  dTag: string;
  domain: string;
  model: string;
  expiresAt: number;
  location: { latitude: number; longitude: number } | null;
  /** Parsed detail content as published (title, category, description, contact, interactionMode, ...). */
  content: Record<string, unknown>;
}

export type EntityRecord = LiveRecord | ListingRecord;

export interface AppState {
  /** True while a discovery/synchronization cycle for the most recent payload is still running (orchestrator-prompt.md §7). */
  inFlight: boolean;
  /** The current LIVE session's public view, if any (LIVE has no persisted history — one at a time, see §11). */
  live: LiveRecord | null;
  /** All known, non-expired LISTING records, keyed by `${author}:${dTag}`. */
  listings: Record<string, ListingRecord>;
  /** Last user-facing validation/operational error, if any (e.g. a lead-time violation on publish). Cleared on the next successful operation. */
  lastError: string | null;
}

const initialState: AppState = {
  inFlight: false,
  live: null,
  listings: {},
  lastError: null,
};

export const appStore: Store<AppState> = createStore(initialState);
