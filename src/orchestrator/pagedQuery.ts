/**
 * pagedQuery.ts — The one page-by-page walk through a single relay's
 * events, newest first, shared by every caller that needs "everything this
 * relay has" or "the next N events": the mission sync, the listing search
 * pages and the tombstone checks. Pure: it knows nothing about Nostr
 * connections, the Store or the Orchestrator — the caller hands in a
 * function that asks ONE relay one filter.
 *
 * Why `until` and not "ask for the next page by offset": relays only
 * sort by `created_at`, newest first. Each page asks for the events up to
 * the oldest `created_at` of the previous one.
 */

import type { NostrEvent, NostrFilter } from '../nostr';

/** One relay's answer to one filter. `complete` is true only if the relay finished with EOSE. */
export interface RelayPage {
  events: NostrEvent[];
  complete: boolean;
}

/** Asks one specific relay one filter. */
export type RelayPageQuery = (filter: NostrFilter) => Promise<RelayPage>;

export interface PageRunOptions {
  /** Lower bound (unix seconds, inclusive) of the walk. */
  since: number;
  /** Upper bound (unix seconds, inclusive) of the FIRST page; later pages walk below the oldest event seen. Omit for "up to now". */
  until?: number;
  /** Events requested per page. A relay may answer with fewer (its own cap); that never ends the walk. */
  limit: number;
  /** How many pages at most. Infinity = walk until nothing new comes back. */
  maxPages: number;
  /**
   * If the last page allowed comes back SHORT (fewer new events than
   * `limit`), ask for one more: a short page is usually all the relay has,
   * but only an empty answer proves it (a relay may cap what it returns per
   * request below `limit`). Costs one small request instead of a second
   * click by the person.
   */
  confirmShortPages?: boolean;
  /** Checked before every page; true ends the run as incomplete (workflow aborted). */
  shouldStop?: () => boolean;
  /** Called with each page's new (not yet seen in this run) events, before the next page is requested. */
  onEvents?: (events: NostrEvent[]) => Promise<void> | void;
}

export interface PageRun {
  /** Every distinct event this run received, in arrival order. */
  events: NostrEvent[];
  /** True only if every page request was answered completely (EOSE) and the run was not stopped. */
  complete: boolean;
  /** True if a page brought nothing new: the relay has nothing older in the window. Meaningful only when `complete`. */
  exhausted: boolean;
  /** `created_at` of the oldest event received, or null if there was none. */
  oldest: number | null;
}

export async function runRelayPages(
  query: RelayPageQuery,
  base: NostrFilter,
  options: PageRunOptions,
): Promise<PageRun> {
  const seen = new Set<string>();
  const events: NostrEvent[] = [];
  let until = options.until;
  let oldest: number | null = null;
  let exhausted = false;

  let allowed = options.maxPages;
  let confirmed = false;

  for (let page = 0; page < allowed; page++) {
    if (options.shouldStop?.()) {
      return { events, complete: false, exhausted: false, oldest };
    }

    const answer = await query({
      ...base,
      since: options.since,
      until,
      limit: options.limit,
    });

    const fresh = answer.events.filter((e) => !seen.has(e.id));

    for (const event of fresh) {
      seen.add(event.id);
      events.push(event);
      oldest = oldest === null ? event.created_at : Math.min(oldest, event.created_at);
    }

    if (fresh.length > 0) {
      await options.onEvents?.(fresh);
    }

    if (!answer.complete) {
      return { events, complete: false, exhausted: false, oldest };
    }

    if (fresh.length === 0) {
      exhausted = true;
      break;
    }

    if (
      options.confirmShortPages &&
      !confirmed &&
      page + 1 === allowed &&
      fresh.length < options.limit
    ) {
      allowed++;
      confirmed = true;
    }

    until = answer.events.reduce((o, e) => Math.min(o, e.created_at), Infinity);
  }

  return { events, complete: true, exhausted, oldest };
}
