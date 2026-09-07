<script lang="ts">
  // EntityDetails.svelte
  // -----------------------------------------------------------------------
  // A deliberately "dumb" display component (see orchestrator-prompt.md's
  // UI boundary: "All UI components are intentionally dumb"). It takes a
  // record — whatever Orchestrator.svelte looked up in the Store for the
  // entity the person just clicked on the Cesium globe — and renders it.
  // No Nostr, no discovery, no store access, no business logic: it doesn't
  // know or care whether `record` came from a LIVE match or a LISTING, or
  // what a geohash, a dTag, or "expiration" mean at the protocol level.
  // It only knows how to format the plain fields it's handed.
  //
  // Named "EntityDetails" rather than "Details" to avoid colliding with
  // the existing hexmenu/Details.svelte (the listing-creation form modal)
  // — this is an unrelated, read-only "show what I clicked on" panel.
  // -----------------------------------------------------------------------
  import { createEventDispatcher } from 'svelte';
  import type { EntityRecord } from '../orchestrator/appStore';

  export let record: EntityRecord | null = null;

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  // ─── Pure formatting helpers — presentation only, no interpretation ───

  /** `some_id` / `some-id` -> `some id`. IDs in this app use either separator depending on where they come from. */
  function humanize(s: string): string {
    return s.replace(/[_-]/g, ' ');
  }

  function titleOf(r: EntityRecord): string {
    const content = r.content as Record<string, unknown>;
    if (typeof content?.title === 'string' && content.title) return content.title;
    return humanize(r.model);
  }

  function categoryOf(r: EntityRecord): string | null {
    const content = r.content as Record<string, unknown>;
    if (typeof content?.categoryId === 'string') return humanize(content.categoryId);
    if (Array.isArray(content?.categoryIds) && content.categoryIds.length) {
      return (content.categoryIds as string[]).map(humanize).join(', ');
    }
    return null;
  }

  function fieldOf(r: EntityRecord, key: string): string | null {
    const content = r.content as Record<string, unknown>;
    const value = content?.[key];
    return typeof value === 'string' && value ? value : null;
  }

  function formatCoords(loc: { latitude: number; longitude: number } | null): string | null {
    if (!loc) return null;
    return `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
  }

  function formatTimestamp(unixSecs: number): string {
    return new Date(unixSecs * 1000).toLocaleString();
  }

  function shortPubkey(pk: string): string {
    return `${pk.slice(0, 8)}…${pk.slice(-8)}`;
  }

  const STATUS_LABEL: Record<string, string> = {
    searching: 'Searching',
    matched: 'Matched',
    expired: 'Expired',
    cancelled: 'Cancelled',
  };
</script>

<svelte:window on:keydown={onKeydown} />

{#if record}
  <div class="backdrop" on:click={close} />
  <div class="panel" role="dialog" aria-modal="true">
    <div class="panel-header">
      <span class="kind-badge" class:live={record.kind === 'live'}>
        {record.kind === 'live' ? 'LIVE' : 'LISTING'}
      </span>
      <button class="close-btn" on:click={close} aria-label="Close">✕</button>
    </div>

    <h2 class="title">{titleOf(record)}</h2>
    <div class="model">{record.model.replace(/_/g, ' ')}</div>

    {#if record.kind === 'live'}
      <div class="status-row">
        <span class="status-dot" class:matched={record.status === 'matched'} class:expired={record.status === 'expired' || record.status === 'cancelled'} />
        <span>{STATUS_LABEL[record.status] ?? record.status}</span>
        <span class="role">({record.role})</span>
      </div>
      {#if record.peerPubkey}
        <div class="field">
          <span class="label">Peer</span>
          <span class="value mono">{shortPubkey(record.peerPubkey)}</span>
        </div>
      {/if}
    {:else}
      <div class="field">
        <span class="label">Expires</span>
        <span class="value">{formatTimestamp(record.expiresAt)}</span>
      </div>
    {/if}

    {#if categoryOf(record)}
      <div class="field">
        <span class="label">Category</span>
        <span class="value">{categoryOf(record)}</span>
      </div>
    {/if}

    {#if fieldOf(record, 'description')}
      <p class="description">{fieldOf(record, 'description')}</p>
    {/if}

    {#if fieldOf(record, 'contact')}
      <div class="field">
        <span class="label">Contact</span>
        <span class="value">{fieldOf(record, 'contact')}</span>
      </div>
    {/if}

    {#if fieldOf(record, 'interactionMode')}
      <div class="field">
        <span class="label">Format</span>
        <span class="value">{humanize(fieldOf(record, 'interactionMode') ?? '')}</span>
      </div>
    {/if}

    {#if formatCoords(record.location)}
      <div class="field">
        <span class="label">Location</span>
        <span class="value mono">{formatCoords(record.location)}</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgba(0, 0, 0, 0.35);
  }

  .panel {
    position: fixed;
    top: 50%;
    right: 2em;
    transform: translateY(-50%);
    z-index: 41;
    width: min(360px, calc(100vw - 4em));
    max-height: min(600px, calc(100vh - 4em));
    overflow-y: auto;
    padding: 1.5em;
    border-radius: 14px;
    background: #16171a;
    border-left: 3px solid;
    border-image: linear-gradient(180deg, #335bf4, #2ae9c9) 1;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75em;
  }

  .kind-badge {
    font-size: 0.7em;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 0.25em 0.6em;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: #8fb0ff;
  }
  .kind-badge.live {
    color: #2ae9c9;
  }

  .close-btn {
    background: none;
    border: none;
    color: #aaa;
    font-size: 1.1em;
    cursor: pointer;
    line-height: 1;
    padding: 0.25em;
  }
  .close-btn:hover,
  .close-btn:focus-visible {
    color: #fff;
  }
  .close-btn:focus-visible {
    outline: 2px solid #2ae9c9;
    outline-offset: 2px;
    border-radius: 4px;
  }

  .title {
    margin: 0 0 0.15em;
    font-size: 1.2em;
    font-weight: 700;
    text-transform: capitalize;
  }

  .model {
    margin: 0 0 1em;
    font-size: 0.8em;
    color: #8a8f98;
    text-transform: capitalize;
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 0.5em;
    margin-bottom: 0.9em;
    font-size: 0.9em;
  }

  .status-dot {
    width: 0.6em;
    height: 0.6em;
    border-radius: 50%;
    background: #ff6b6b;
    flex-shrink: 0;
  }
  .status-dot.matched {
    background: #57e389;
  }
  .status-dot.expired {
    background: #555;
  }

  .role {
    color: #8a8f98;
    text-transform: capitalize;
  }

  .field {
    display: flex;
    justify-content: space-between;
    gap: 1em;
    padding: 0.5em 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.88em;
  }

  .label {
    color: #8a8f98;
    flex-shrink: 0;
  }

  .value {
    text-align: right;
    text-transform: capitalize;
  }

  .value.mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    text-transform: none;
  }

  .description {
    margin: 0.9em 0 0;
    padding-top: 0.9em;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 0.88em;
    line-height: 1.5;
    color: #dcdcdc;
  }

  @media (prefers-reduced-motion: no-preference) {
    .panel {
      animation: slide-in 0.18s ease-out;
    }
  }
  @keyframes slide-in {
    from {
      opacity: 0;
      transform: translateY(-50%) translateX(12px);
    }
    to {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }
  }
</style>
