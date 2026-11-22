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
 *
 * Why whole seconds: a page boundary can fall inside one second, and the
 * next page (`until` inclusive) cannot get past it if that second alone
 * holds a page's worth of events. So whenever the walk stops at a second,
 * or gets stuck in one, `drainSecond` first delivers that second completely.
 * Everything a run reports as delivered is therefore delivered in whole
 * seconds. This assumes a relay answers at least `limit` events per request.
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
  /**
   * Upper bound of the limit `drainSecond` asks for when one second holds
   * more events than a page. If the second is still not delivered whole
   * at that size, the run ends as incomplete instead of vouching for it.
   * Default: `limit * 64`.
   */
  maxSecondLimit?: number;
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
  const maxSecondLimit = options.maxSecondLimit ?? options.limit * 64;
  let until = options.until;
  let oldest: number | null = null;
  let exhausted = false;

  let allowed = options.maxPages;
  let confirmed = false;

  /** Records the answer's new events and hands them to the caller. */
  const take = async (batch: NostrEvent[]): Promise<NostrEvent[]> => {
    const fresh = batch.filter((e) => !seen.has(e.id));

    for (const event of fresh) {
      seen.add(event.id);
      events.push(event);
      oldest = oldest === null ? event.created_at : Math.min(oldest, event.created_at);
    }

    if (fresh.length > 0) {
      await options.onEvents?.(fresh);
    }

    return fresh;
  };

  const finish = (complete: boolean): PageRun => ({
    events,
    complete,
    exhausted: complete && exhausted,
    oldest,
  });

  /**
   * Delivers ALL events of one second: a page cannot split a second, so ask
   * for exactly that second with a growing limit until the answer is shorter
   * than the limit asked for. False if that cannot be shown (a relay did not
   * answer fully, the run was stopped, or `maxSecondLimit` was reached).
   */
  const drainSecond = async (second: number): Promise<boolean> => {
    let size = options.limit;

    while (size < maxSecondLimit) {
      if (options.shouldStop?.()) return false;

      size = Math.min(size * 2, maxSecondLimit);

      const answer = await query({ ...base, since: second, until: second, limit: size });

      await take(answer.events);

      if (!answer.complete) return false;
      if (answer.events.length < size) return true;
    }

    return false;
  };

  for (let page = 0; page < allowed; page++) {
    if (options.shouldStop?.()) return finish(false);

    const answer = await query({
      ...base,
      since: options.since,
      until,
      limit: options.limit,
    });

    const fresh = await take(answer.events);

    if (!answer.complete) return finish(false);

    if (fresh.length === 0) {
      if (answer.events.length < options.limit || until === undefined) {
        exhausted = true;
        break;
      }

      // A full page of events we already have: one second holds at least
      // `limit` events and the walk cannot get past it. Take the whole second.
      if (!(await drainSecond(until))) return finish(false);

      until -= 1;

      if (until < options.since) {
        exhausted = true;
        break;
      }

      continue;
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

  // Stopped by the page limit: make the oldest second whole, so that
  // "delivered down to `oldest`" is true for every second it names.
  if (!exhausted && oldest !== null && !(await drainSecond(oldest))) {
    return finish(false);
  }

  return finish(true);
}
