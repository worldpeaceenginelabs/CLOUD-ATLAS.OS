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
  //
  // Owner-only actions (Delete, Marketing): still no direct Nostr
  // communication here. Delete just dispatches an event upward — the
  // actual tombstone publish stays entirely in Orchestrator's existing
  // flow (see EntityLayer.svelte, which forwards this event, and
  // App.svelte, which turns it into Orchestrator's `deleteRequest` prop).
  // Marketing is pure UI composition (a link built from two plain fields
  // already on the record), so it opens locally with no event needed.
  // -----------------------------------------------------------------------
  import { createEventDispatcher } from 'svelte';
  import type { LiveRecord, ListingRecord } from '../orchestrator/appStore';
  import Marketing from '../shared/Marketing.svelte';
  import CloseButton from '../shared/CloseButton.svelte';

  export let record: LiveRecord | ListingRecord | null = null;
  /** This client's own pubkey (from `$appStore.ownPubkey`) — compared against a listing's `author` to decide whether to show the owner-only actions below. */
  export let ownPubkey: string | null = null;

  const dispatch = createEventDispatcher();

  $: isOwner = !!record && !!ownPubkey && record.kind === 'listing' && record.author === ownPubkey;

  let showMarketing = false;

  function close() {
    dispatch('close');
  }

  function requestDelete() {
    if (!record) return;
    dispatch('delete', record);
    close(); // optimistic — the record disappears from the map once the tombstone round-trips; no reason to keep showing it now
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  // ─── Pure formatting helpers — presentation only, no interpretation ───

  /** `some_id` / `some-id` -> `some id`. IDs in this app use either separator depending on where they come from. */
  function humanize(s: string): string {
    return s.replace(/[_-]/g, ' ');
  }

  function titleOf(r: LiveRecord | ListingRecord): string {
    const content = r.content as Record<string, unknown>;
    if (typeof content?.title === 'string' && content.title) return content.title;
    return humanize(r.model);
  }

  function categoryOf(r: LiveRecord | ListingRecord): string | null {
    const content = r.content as Record<string, unknown>;
    if (typeof content?.categoryId === 'string') return humanize(content.categoryId);
    if (Array.isArray(content?.categoryIds) && content.categoryIds.length) {
      return (content.categoryIds as string[]).map(humanize).join(', ');
    }
    return null;
  }

  function fieldOf(r: LiveRecord | ListingRecord, key: string): string | null {
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
      <CloseButton onClose={close} position="relative" top="0" right="0" />
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

    {#if isOwner}
      <div class="owner-actions">
        <button class="owner-btn marketing" on:click={() => (showMarketing = true)}>Marketing</button>
        <button class="owner-btn delete" on:click={requestDelete}>Delete</button>
      </div>
    {/if}
  </div>
{/if}

{#if showMarketing && record?.kind === 'listing'}
  <Marketing domain={record.domain} eventId={record.eventId} on:close={() => (showMarketing = false)} />
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

  .owner-actions {
    display: flex;
    gap: 0.6em;
    margin-top: 1.1em;
    padding-top: 1em;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .owner-btn {
    flex: 1;
    padding: 0.45em 0;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.85em;
    cursor: pointer;
  }

  .owner-btn.marketing {
    background: linear-gradient(90deg, #335bf4, #2ae9c9);
    border: none;
    color: #0b0b0d;
  }
  .owner-btn.marketing:hover,
  .owner-btn.marketing:focus-visible {
    filter: brightness(1.08);
  }

  .owner-btn.delete {
    background: transparent;
    border: 1px solid #ff6b6b;
    color: #ff6b6b;
  }
  .owner-btn.delete:hover,
  .owner-btn.delete:focus-visible {
    background: rgba(255, 107, 107, 0.12);
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

  /* Mobile/narrow viewports: center the panel instead of anchoring it to
     the right edge, and keep it within the viewport either way. The
     entrance animation gets its own mobile variant too, since it
     otherwise re-applies the desktop transform (translateY only, no
     horizontal centering) and would jump on first appearance. */
  @media (max-width: 700px) {
    .panel {
      left: 50%;
      right: auto;
      transform: translate(-50%, -50%);
      width: min(360px, calc(100vw - 2em));
      max-height: calc(100vh - 2em);
    }
  }
  @media (max-width: 700px) and (prefers-reduced-motion: no-preference) {
    .panel {
      animation: slide-in-mobile 0.18s ease-out;
    }
  }
  @keyframes slide-in-mobile {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
</style>
