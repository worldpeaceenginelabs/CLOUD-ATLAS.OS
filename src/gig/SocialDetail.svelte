<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { Listing } from '../types';
  import { SOCIAL_CATEGORIES } from './verticals';
  import { getCategoryName } from './categoryUtils';
  import { ensureProtocol } from '../utils/urlUtils';
  import { takeDownListing } from './listingActions';

  export let listing: Listing;
  export let myPk: string;
  export let onClose: () => void;
  export let onTakenDown: ((listingId: string) => void) | undefined = undefined;

  let isTakingDown = false;

  $: isOwner = listing.pubkey === myPk;
  $: categoryName = getCategoryName(SOCIAL_CATEGORIES, listing.category);
  $: modeLabel =
    listing.mode === 'in-person' ? 'In-Person' :
    listing.mode === 'online' ? 'Online' : 'In-Person & Online';
  $: formattedDate = listing.eventDate
    ? new Date(listing.eventDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  function openContact() {
    window.open(ensureProtocol(listing.contact), '_blank', 'noopener');
  }

  async function takeDown() {
    isTakingDown = true;
    try {
      await takeDownListing(listing, 'listing-social', onTakenDown, onClose);
    } catch {
      isTakingDown = false;
    }
  }
</script>

<div class="social-detail-overlay" on:click|self={onClose} on:keydown={undefined} role="presentation">
  <div class="social-detail" transition:fly={{ y: 40, duration: 250 }}>

    <!-- Header -->
    <div class="detail-header">
      <div class="detail-badge">
        {categoryName}
      </div>
      <button class="close-btn" on:click={onClose}>&times;</button>
    </div>

    <!-- Title -->
    {#if listing.title}
      <h3 class="detail-title">{listing.title}</h3>
    {/if}

    <!-- Mode & Date -->
    <div class="detail-meta">
      <div class="meta-item">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          {#if listing.mode === 'online'}
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          {:else}
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          {/if}
        </svg>
        <span>{modeLabel}</span>
      </div>
      {#if formattedDate}
        <div class="meta-item">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span>{formattedDate}</span>
        </div>
      {/if}
    </div>

    <!-- Description -->
    <p class="detail-desc">{listing.description}</p>

    <!-- Actions -->
    <div class="detail-actions">
      <button class="action-btn primary" on:click={openContact}>
        Contact Host
      </button>

      {#if isOwner}
        <button
          class="action-btn danger"
          on:click={takeDown}
          disabled={isTakingDown}
        >
          {isTakingDown ? 'Taking down...' : 'Take Down Event'}
        </button>
      {/if}
    </div>

    <span class="detail-hint">
      Published {new Date(listing.timestamp).toLocaleDateString()}
    </span>
  </div>
</div>

<style>
  .social-detail-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.3);
  }

  .social-detail {
    width: 100%;
    max-width: 380px;
    background: rgba(15, 15, 25, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    backdrop-filter: blur(16px);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 40px;
  }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .detail-badge {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.78rem;
    font-weight: 600;
    background: rgba(255, 64, 129, 0.15);
    color: #FF4081;
  }

  .close-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.4rem;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    transition: color 0.15s;
  }

  .close-btn:hover {
    color: white;
  }

  .detail-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: white;
    line-height: 1.3;
  }

  .detail-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .detail-desc {
    margin: 0;
    font-size: 0.88rem;
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.5;
  }

  .detail-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  .action-btn {
    width: 100%;
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.primary {
    background: rgba(255, 64, 129, 0.2);
    color: #FF4081;
    border: 1px solid rgba(255, 64, 129, 0.35);
  }

  .action-btn.primary:hover:not(:disabled) {
    background: rgba(255, 64, 129, 0.3);
  }

  .action-btn.danger {
    background: rgba(239, 68, 68, 0.12);
    color: rgba(239, 68, 68, 0.85);
    border: 1px solid rgba(239, 68, 68, 0.25);
  }

  .action-btn.danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
  }

  .detail-hint {
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.3);
    text-align: center;
  }
</style>
