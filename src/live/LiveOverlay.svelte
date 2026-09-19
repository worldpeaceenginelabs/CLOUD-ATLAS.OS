<script lang="ts">
  // src/live/LiveOverlay.svelte
  //
  // Presentational-only Rider/Driver UI for the currently active LIVE
  // session (today: ridehailing — the app's only LIVE model). Reads
  // Orchestrator's own public projection of the session (`record`,
  // i.e. $appStore.live passed straight through) and renders one of the
  // Rider or Driver states from it — it never touches the Store itself
  // and knows nothing about Nostr, workflows, or matching. Same "dumb
  // component, Store flows down, events flow up" contract as
  // cesium/EntityLayer.svelte.
  //
  // Rider and Driver never share a rendered branch here by construction,
  // not by convention: record.role picks one of the two top-level
  // branches below, and the driver-only fields it reads inside that
  // branch (record.offer, record.awaitingConfirmation) are — per
  // Orchestrator's toLiveRecord() — always null/false on a rider's own
  // record. There is no path by which another rider's or driver's
  // candidate/offer info could render under the wrong branch.
  //
  // All state changes are dispatched as events, never called directly:
  // 'accept' / 'reject' (driver decision on the current offer), 'cancel'
  // (stop a still-running session — Rider's "Cancel Request" / Driver's
  // "Stop Offering", both just a clearer label on the same abort
  // Orchestrator already exposes), 'done' (dismiss a session that has
  // already reached a terminal status). Orchestrator wires these to
  // acceptLiveOffer/rejectLiveOffer/abortActiveWorkflow/
  // clearLiveSession — this file owns none of that logic.

  import { slide } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import { DOMAINS, detailsFor, type ModelConfig, type LocationValue } from '../hexmenu/domains';
  import type { LiveRecord } from '../orchestrator/appStore';

  export let record: LiveRecord;

  const dispatch = createEventDispatcher();

  function findModel(modelId: string): ModelConfig | null {
    for (const domain of DOMAINS) {
      const found = domain.models.find((m) => m.id === modelId);
      if (found) return found;
    }
    return null;
  }

  $: model = findModel(record.model);

  // A rider's request always follows the 'search' Details schema — used
  // to interpret both the rider's own content (rider branch) and an
  // offered/matched candidate's content (driver branch: it's the same
  // rider-authored payload either way, just read from a different place
  // on the record).
  $: requestSchema = model ? detailsFor(model, 'search') : null;

  function categoryLabel(categoryId: unknown): string | null {
    if (typeof categoryId !== 'string' || !requestSchema?.category) return null;
    return requestSchema.category.options.find((o) => o.id === categoryId)?.name ?? categoryId;
  }

  function asRoute(location: unknown) {
    const loc = location as LocationValue | null | undefined;
    return loc && loc.geometry === 'route' ? loc : null;
  }

  function fmt(coord: { latitude: number; longitude: number }): string {
    return `${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`;
  }

  // Rider: its own request's route. Driver: the offered/matched
  // candidate's route (record.offer is only ever the rider's own
  // published content, read out for display — see toLiveRecord).
  $: ownRoute = asRoute(record.content?.location);
  $: offerRoute = asRoute(record.offer?.content?.location);
</script>

<div class="live-overlay" transition:slide={{ duration: 250 }}>
  {#if record.role === 'requester'}
    <!-- ═══ RIDER ═══════════════════════════════════════════════════ -->
    {#if record.status === 'searching'}
      <h3 class="title">Waiting for Driver</h3>
      <div class="status-indicator">
        <div class="pulse-dot" />
        <span>Looking for a driver nearby…</span>
      </div>
      {#if ownRoute}
        <p class="hint">{fmt(ownRoute.from)} → {fmt(ownRoute.to)}</p>
      {/if}
      <button class="btn danger" on:click={() => dispatch('cancel')}>
        Cancel Request
      </button>
    {:else if record.status === 'matched'}
      <h3 class="title">Driver Accepted!</h3>
      <p class="message">A driver has accepted your ride — connected directly, peer-to-peer.</p>
      {#if ownRoute}
        <div class="route">
          <div class="stop"><span class="label">Pickup</span><span class="coords">{fmt(ownRoute.from)}</span></div>
          <div class="stop"><span class="label">Drop</span><span class="coords">{fmt(ownRoute.to)}</span></div>
        </div>
      {/if}
      <div class="safety">
        <p class="warning">
          ⚠️ For your safety, keep a Dashcam-style recording app running for the whole ride and confirm each other's ID before you start.
        </p>
        <p class="warning">⚠️ If you feel threatened at any point, call the police immediately.</p>
      </div>
      <button class="btn primary" on:click={() => dispatch('done')}>Done</button>
    {:else if record.status === 'expired'}
      <h3 class="title">No Driver Found</h3>
      <p class="message">Nobody accepted your ride in time.</p>
      <button class="btn primary" on:click={() => dispatch('done')}>Done</button>
    {/if}
  {:else}
    <!-- ═══ DRIVER ══════════════════════════════════════════════════ -->
    {#if record.status === 'searching' && !record.offer}
      <h3 class="title">Offering Rides</h3>
      <div class="status-indicator">
        <div class="pulse-dot provider" />
        <span>Listening for riders in your area…</span>
      </div>
      <button class="btn danger" on:click={() => dispatch('cancel')}>
        Stop Offering
      </button>
    {:else if record.status === 'searching' && record.offer && record.awaitingConfirmation}
      <h3 class="title">Offering Rides</h3>
      <div class="status-indicator">
        <div class="pulse-dot" />
        <span>Confirming with rider…</span>
      </div>
    {:else if record.status === 'searching' && record.offer}
      <div class="match-card">
        <h4>New Ride Request</h4>
        {#if categoryLabel(record.offer.content?.categoryId)}
          <p class="detail"><span class="label">Carrying</span> {categoryLabel(record.offer.content?.categoryId)}</p>
        {/if}
        {#if typeof record.offer.content?.description === 'string' && record.offer.content.description}
          <p class="detail"><span class="label">Note</span> {record.offer.content.description}</p>
        {/if}
        {#if offerRoute}
          <p class="detail"><span class="label">Pickup</span> {fmt(offerRoute.from)}</p>
          <p class="detail"><span class="label">Drop</span> {fmt(offerRoute.to)}</p>
        {/if}
        <div class="actions">
          <button class="btn danger" on:click={() => dispatch('reject')}>Decline</button>
          <button class="btn primary" on:click={() => dispatch('accept')}>Accept</button>
        </div>
      </div>
    {:else if record.status === 'matched'}
      <h3 class="title">Rider Matched!</h3>
      <p class="message">Connected directly, peer-to-peer.</p>
      {#if categoryLabel(record.offer?.content?.categoryId)}
        <p class="detail"><span class="label">Carrying</span> {categoryLabel(record.offer?.content?.categoryId)}</p>
      {/if}
      {#if offerRoute}
        <div class="route">
          <div class="stop"><span class="label">Pickup</span><span class="coords">{fmt(offerRoute.from)}</span></div>
          <div class="stop"><span class="label">Drop</span><span class="coords">{fmt(offerRoute.to)}</span></div>
        </div>
      {/if}
      <div class="safety">
        <p class="warning">
          ⚠️ For your safety, keep a Dashcam-style recording app running for the whole ride and confirm each other's ID before you start.
        </p>
        <p class="warning">⚠️ If you feel threatened at any point, call the police immediately.</p>
      </div>
      <button class="btn primary" on:click={() => dispatch('done')}>Done</button>
    {:else if record.status === 'expired'}
      <h3 class="title">No Riders Found</h3>
      <button class="btn primary" on:click={() => dispatch('done')}>Done</button>
    {/if}
  {/if}
</div>

<style>
  .live-overlay {
    position: fixed;
    left: 50%;
    bottom: 5.5em;
    transform: translateX(-50%);
    z-index: 30;
    width: min(22em, calc(100vw - 2em));
    padding: 1.1em 1.3em;
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: var(--glass-border);
    border-radius: var(--glass-radius);
    color: #fff;
    font: 0.85em -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  @media (max-width: 700px) {
    .live-overlay {
      top: 5px;
      bottom: auto;
      left: 5px;
      transform: none;

      width: calc(100vw - 10px);
      max-width: none;
      box-sizing: border-box;
    }
  }

  .title {
    margin: 0 0 0.6em;
    font-size: 1.1em;
  }

  .message,
  .hint {
    margin: 0 0 0.8em;
    color: rgba(255, 255, 255, 0.75);
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.6em;
    margin-bottom: 1em;
  }

  .pulse-dot {
    width: 0.7em;
    height: 0.7em;
    border-radius: 50%;
    background: #8fb0ff;
    animation: pulse 1.4s ease-in-out infinite;
  }

  .pulse-dot.provider {
    background: #2ae9c9;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.7); }
  }

  .match-card {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 0.8em;
    padding: 0.9em 1em;
  }

  .match-card h4 {
    margin: 0 0 0.6em;
  }

  .detail {
    margin: 0 0 0.4em;
  }

  .label {
    color: rgba(255, 255, 255, 0.55);
    margin-right: 0.4em;
  }

  .route {
    display: flex;
    flex-direction: column;
    gap: 0.6em;
    margin-bottom: 1em;
  }

  .stop {
    display: flex;
    justify-content: space-between;
    gap: 1em;
  }

  .coords {
    font-variant-numeric: tabular-nums;
    color: rgba(255, 255, 255, 0.8);
  }

  .safety {
    background: rgba(255, 107, 107, 0.08);
    border: 1px solid rgba(255, 107, 107, 0.25);
    border-radius: 0.7em;
    padding: 0.7em 0.9em;
    margin-bottom: 1em;
  }

  .warning {
    margin: 0 0 0.4em;
    font-size: 0.9em;
    color: #ffb3b3;
  }

  .warning:last-child {
    margin-bottom: 0;
  }

  .actions {
    display: flex;
    gap: 0.7em;
    margin-top: 0.9em;
  }

  .btn {
    flex: 1;
    border: none;
    border-radius: 999px;
    padding: 0.55em 1em;
    font-weight: 600;
    font-size: 1em;
    cursor: pointer;
  }

  .btn.primary {
    background: linear-gradient(90deg, #335bf4, #2ae9c9);
    color: #0b0b0d;
  }

  .btn.danger {
    background: transparent;
    border: 1px solid #ff6b6b;
    color: #ff6b6b;
  }

  .btn.primary:hover,
  .btn.primary:focus-visible,
  .btn.danger:hover,
  .btn.danger:focus-visible {
    filter: brightness(1.08);
  }
</style>
