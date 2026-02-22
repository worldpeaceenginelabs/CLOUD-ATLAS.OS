<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { Listing, ListingVertical } from '../types';
  import { VERTICALS, LISTING_CATEGORIES, type ListingVerticalConfig } from './verticals';
  import { getCategoryName } from './categoryUtils';
  import { ensureProtocol } from '../utils/urlUtils';
  import { takeDownListing } from './listingActions';

  export let listing: Listing;
  export let vertical: ListingVertical;
  export let myPk: string;
  export let onClose: () => void;
  export let onTakenDown: ((listingId: string) => void) | undefined = undefined;

  $: cfg = VERTICALS[vertical] as ListingVerticalConfig;
  $: categories = LISTING_CATEGORIES[vertical] ?? [];
  $: serviceTag = cfg.listingTag;
  $: accentColor = cfg.color;
  $: accentBg = `color-mix(in srgb, ${cfg.color} 15%, transparent)`;
  $: accentBtnBg = `color-mix(in srgb, ${cfg.color} 20%, transparent)`;
  $: accentBtnBorder = `color-mix(in srgb, ${cfg.color} 35%, transparent)`;

  let isTakingDown = false;

  $: isOwner = listing.pubkey === myPk;
  $: categoryName = getCategoryName(categories, listing.category);
  $: modeLabel =
    listing.mode === 'in-person' ? 'In-Person' :
    listing.mode === 'online' ? 'Online' : 'In-Person & Online';
  $: formattedDate = cfg.hasEventDate && listing.eventDate
    ? new Date(listing.eventDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  function openContact() {
    window.open(ensureProtocol(listing.contact), '_blank', 'noopener');
  }

  async function takeDown() {
    isTakingDown = true;
    try {
      await takeDownListing(listing, serviceTag, onTakenDown, onClose);
    } catch {
      isTakingDown = false;
    }
  }
</script>

<div class="gig-detail-overlay" on:click|self={onClose} on:keydown={undefined} role="presentation">
  <div class="gig-detail-card" transition:fly={{ y: 40, duration: 250 }}>
    <div class="gig-detail-header">
      <div class="gig-detail-badge" style="background: {accentBg}; color: {accentColor}">{categoryName}</div>
      <button class="gig-detail-close" on:click={onClose}>&times;</button>
    </div>

    {#if listing.title}
      <h3 class="detail-title">{listing.title}</h3>
    {/if}

    <div class="gig-detail-mode">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        {#if listing.mode === 'online'}
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        {:else}
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        {/if}
      </svg>
      <span>{modeLabel}</span>
      {#if formattedDate}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 8px">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>{formattedDate}</span>
      {/if}
    </div>

    <p class="gig-detail-desc">{listing.description}</p>

    <div class="gig-detail-actions">
      <button class="action-btn-primary" style="background: {accentBtnBg}; color: {accentColor}; border: 1px solid {accentBtnBorder}" on:click={openContact}>
        {cfg.contactButtonLabel}
      </button>

      {#if isOwner}
        <button class="gig-action-btn-danger" on:click={takeDown} disabled={isTakingDown}>
          {isTakingDown ? 'Taking down...' : cfg.takeDownLabel}
        </button>
      {/if}
    </div>

    <span class="gig-detail-hint">Published {new Date(listing.timestamp).toLocaleDateString()}</span>
  </div>
</div>

<style>
  .detail-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: white;
    line-height: 1.3;
  }

  .action-btn-primary {
    width: 100%;
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .action-btn-primary:hover:not(:disabled) { filter: brightness(1.3); }
  .action-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
