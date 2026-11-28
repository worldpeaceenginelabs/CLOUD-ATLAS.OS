<script lang="ts">
  // src/listing/ListingResultList.svelte
  //
  // Presentational-only list of the active LISTING search — the same list
  // for the on-site (map) search and the online search. Reads the
  // Orchestrator's own projection (`view`, i.e. $appStore.listingView passed
  // straight through) and never touches the Store, Nostr or any workflow
  // itself: same "dumb component, Store flows down, events flow up"
  // contract as live/LiveOverlay.svelte.
  //
  // Events (Orchestrator wires them in Orchestrator.svelte):
  //   open   { id }      — a listing row was clicked
  //   gap    { lo, hi }  — "Load missing listings" of one gap
  //   widen / narrow     — map search: switch between the two areas
  //   close              — ✕
  //
  // The only thing computed here is how the times read: "Updated 2 min ago"
  // is re-rendered on a timer from the fetch time it is given.

  import { createEventDispatcher, onDestroy } from 'svelte';
  import type { ListingViewState } from '../orchestrator/appStore';
  import { INTERACTION_MODE_LABELS } from '../hexmenu/domains';
  import { formatExpiry } from '../shared/formatExpiry';
  import CloseButton from '../shared/CloseButton.svelte';

  export let view: ListingViewState;

  const dispatch = createEventDispatcher();

  let now = Date.now();
  const ticker = setInterval(() => (now = Date.now()), 15_000);

  onDestroy(() => clearInterval(ticker));

  function ago(at: number, nowMs: number): string {
    const secs = Math.max(0, Math.floor((nowMs - at) / 1000));

    if (secs < 60) return 'just now';

    const minutes = Math.floor(secs / 60);
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ago`;

    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }

  function when(unixSecs: number): string {
    return new Date(unixSecs * 1000).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  $: hasListings = view.rows.some((r) => r.type === 'listing');
</script>

<div class="list" role="region" aria-label="Search results">
  <CloseButton position="absolute" top="12px" right="12px" onClose={() => dispatch('close')} />

  <div class="head">
    <span class="area">{view.areaLabel}</span>

    {#if view.updatedAt !== null}
      <span class="updated">Updated {ago(view.updatedAt, now)}</span>
    {/if}
  </div>

  <div class="rows">
    {#each view.rows as row (row.type === 'listing' ? row.id : row.key)}
      {#if row.type === 'listing'}
        <button class="row" on:click={() => dispatch('open', { id: row.id })}>
          <span class="title">{row.title}</span>
          <span class="meta">{row.category} · expires {formatExpiry(row.expiresAt)}</span>
          <span class="badge">{INTERACTION_MODE_LABELS[row.interactionMode]}</span>
        </button>
      {:else}
        <div class="gap">
          <span>
            Listings published between {when(row.lo)} and {when(row.hi)} may be missing.
          </span>
          <button class="action" on:click={() => dispatch('gap', { lo: row.lo, hi: row.hi })}>
            Load missing listings
          </button>
        </div>
      {/if}
    {/each}

    {#if !hasListings && view.rows.length === 0 && view.complete === true}
      <p class="empty">No results.</p>
    {/if}
  </div>

  {#if view.canWiden}
    <button class="action area-switch" on:click={() => dispatch('widen')}>Search wider area</button>
  {/if}

  {#if view.canNarrow}
    <button class="action area-switch" on:click={() => dispatch('narrow')}>Back to nearby</button>
  {/if}
</div>

<style>
  /*
   * Placement: the half of the screen that belongs to the HexMenu — the left
   * half in landscape, the top half in portrait (the globe window takes the
   * other half, see App.svelte). Edge distances are the corner buttons' own
   * (--edge-gap, defined on .workspace in App.svelte, safe-area insets added
   * on top/bottom exactly like there), so the list lines up with them on
   * every device.
   *
   * Stacking: HexMenu (<= 15) < this list < EntityDetails. In split view the
   * details live inside .globe-window (z 20), so the list sits just below it
   * (18). In fullscreen App.svelte lifts the list above the globe and lets
   * the details paint above it (--result-list-z).
   */
  .list {
    --gap: var(--edge-gap, 10px);
    --btn: 40px; /* corner-btn size in App.svelte */

    position: fixed;
    top: calc(var(--gap) + env(safe-area-inset-top, 0px));
    left: var(--gap);
    z-index: var(--result-list-z, 18);
    width: calc(50vw - 2 * var(--gap));
    /* leaves room at the bottom for the About button (bottom left) */
    max-height: calc(
      100dvh - (var(--gap) + env(safe-area-inset-top, 0px)) -
        (2 * var(--gap) + var(--btn) + env(safe-area-inset-bottom, 0px))
    );
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    padding: 2.6em 0.9em 0.9em;
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: var(--glass-border);
    border-radius: var(--glass-radius);
    color: #fff;
    font: 0.85em -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  /* Portrait: top half of the screen, full width — but stopping left of the
     MissionTV button (top right): gap + button + gap from the right edge. */
  @media (orientation: portrait) {
    .list {
      width: auto;
      right: calc(2 * var(--gap) + var(--btn));
      max-height: calc(50dvh - (var(--gap) + env(safe-area-inset-top, 0px)) - var(--gap));
    }
  }

  .head {
    position: absolute;
    top: 0.9em;
    left: 0.9em;
    right: 3em;
    display: flex;
    flex-direction: column;
  }

  .area {
    font-weight: 600;
  }

  .updated {
    font-size: 0.85em;
    opacity: 0.75;
  }

  .rows {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.4em;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }

  .row {
    display: grid;
    gap: 0.15em;
    text-align: left;
    padding: 0.55em 0.7em;
    color: inherit;
    font: inherit;
    cursor: pointer;
    background: var(--glass-bg-inset);
    border: var(--glass-border);
    border-radius: 10px;
  }

  .row:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .title {
    font-weight: 600;
  }

  .meta {
    font-size: 0.85em;
    opacity: 0.8;
  }

  .badge {
    justify-self: start;
    margin-top: 0.2em;
    padding: 0.1em 0.55em;
    font-size: 0.78em;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.25);
  }

  .gap {
    display: grid;
    gap: 0.4em;
    padding: 0.55em 0.7em;
    font-size: 0.85em;
    border: 1px dashed rgba(255, 255, 255, 0.55);
    border-radius: 10px;
  }

  .action {
    justify-self: start;
    padding: 0.35em 0.9em;
    color: #fff;
    font: inherit;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.25);
    border: var(--glass-border);
    border-radius: 999px;
  }

  .action:hover {
    background: rgba(255, 255, 255, 0.4);
  }

  .area-switch {
    align-self: center;
  }

  .empty {
    margin: 0.5em 0;
    text-align: center;
    opacity: 0.8;
  }
</style>
