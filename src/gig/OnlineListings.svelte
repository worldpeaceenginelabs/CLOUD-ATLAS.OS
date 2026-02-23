<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly, slide } from 'svelte/transition';
  import { activeMapLayers, onlinePanelOpen } from '../store';
  import { getSharedNostr } from '../services/nostrPool';
  import { OnlineListingService, type OnlinePage } from '../services/onlineListingService';
  import { VERTICALS, LISTING_CATEGORIES, type ListingVerticalConfig } from './verticals';
  import { getCategoryName } from './categoryUtils';
  import type { Listing, ListingVertical } from '../types';
  import ListingDetail from './ListingDetail.svelte';

  type OnlineVertical = 'helpouts' | 'social';
  const ONLINE_VERTICALS: OnlineVertical[] = ['helpouts', 'social'];

  let activeTab: OnlineVertical = 'helpouts';
  let selectedCategory: string = '';
  let listings: Listing[] = [];
  let loading = false;
  let exhausted = false;
  let paginationCursor: number | null = null;

  let cooldownRemaining = 0;
  let cooldownTimer: ReturnType<typeof setInterval> | null = null;
  const COOLDOWN_SECS = 60;

  let services: Partial<Record<OnlineVertical, OnlineListingService>> = {};
  let myPk = '';

  let selectedListing: Listing | null = null;

  $: availableTabs = ONLINE_VERTICALS.filter(v => $activeMapLayers.has(v));
  $: if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
    activeTab = availableTabs[0];
  }
  $: cfg = VERTICALS[activeTab] as ListingVerticalConfig;
  $: categories = LISTING_CATEGORIES[activeTab] ?? [];

  function getListingCfg(v: OnlineVertical): ListingVerticalConfig {
    return VERTICALS[v] as ListingVerticalConfig;
  }

  onMount(async () => {
    try {
      const nostr = await getSharedNostr();
      myPk = nostr.pubkey;
      for (const v of ONLINE_VERTICALS) {
        const vcfg = VERTICALS[v] as ListingVerticalConfig;
        services[v] = new OnlineListingService(nostr, vcfg.listingTag);
      }
      await loadPage(false);
    } catch { /* nostr unavailable */ }
  });

  onDestroy(() => {
    if (cooldownTimer) clearInterval(cooldownTimer);
  });

  async function loadPage(paginate: boolean) {
    const svc = services[activeTab];
    if (!svc || loading) return;

    loading = true;
    const page: OnlinePage = await svc.fetchPage(
      selectedCategory || undefined,
      paginate ? (paginationCursor ?? undefined) : undefined,
    );

    if (paginate) {
      listings = [...listings, ...page.listings];
    } else {
      listings = page.listings;
    }

    paginationCursor = page.oldestTimestamp;
    exhausted = page.exhausted;
    loading = false;

    if (paginate) startCooldown();
  }

  function switchTab(v: OnlineVertical) {
    if (v === activeTab) return;
    activeTab = v;
    selectedCategory = '';
    resetAndLoad();
  }

  function selectCategory(catId: string) {
    selectedCategory = selectedCategory === catId ? '' : catId;
    resetAndLoad();
  }

  function resetAndLoad() {
    listings = [];
    paginationCursor = null;
    exhausted = false;
    clearCooldown();
    loadPage(false);
  }

  function loadMore() {
    if (cooldownRemaining > 0 || exhausted || loading) return;
    loadPage(true);
  }

  function startCooldown() {
    cooldownRemaining = COOLDOWN_SECS;
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      cooldownRemaining--;
      if (cooldownRemaining <= 0) {
        clearCooldown();
      }
    }, 1000);
  }

  function clearCooldown() {
    cooldownRemaining = 0;
    if (cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  }

  function close() {
    onlinePanelOpen.set(false);
  }

  function timeAgo(timestamp: string): string {
    const diff = Date.now() - new Date(timestamp).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function handleListingTakenDown(listingId: string) {
    listings = listings.filter(l => l.id !== listingId);
    selectedListing = null;
  }
</script>

<div class="online-overlay" on:click|self={close} on:keydown={undefined} role="presentation"
     transition:fly={{ y: 60, duration: 300 }}>
  <div class="online-panel">
    <div class="online-header">
      <h2 class="online-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        Online Listings
      </h2>
      <button class="online-close" on:click={close}>&times;</button>
    </div>

    {#if availableTabs.length > 1}
      <div class="online-tabs">
        {#each availableTabs as v}
          <button
            class="online-tab"
            class:active={activeTab === v}
            style:--tab-color={getListingCfg(v).color}
            on:click={() => switchTab(v)}
          >{getListingCfg(v).name}</button>
        {/each}
      </div>
    {/if}

    {#if categories.length > 0}
      <div class="online-categories">
        {#each categories as cat}
          <button
            class="online-cat-chip"
            class:selected={selectedCategory === cat.id}
            style:--cat-color={cfg.color}
            on:click={() => selectCategory(cat.id)}
            title={cat.description}
          >{cat.name}</button>
        {/each}
      </div>
    {/if}

    <div class="online-list">
      {#if loading && listings.length === 0}
        <div class="online-empty">
          <div class="online-spinner"></div>
          <span>Loading...</span>
        </div>
      {:else if listings.length === 0}
        <div class="online-empty">
          <span>No online listings found{selectedCategory ? ' in this category' : ''}.</span>
        </div>
      {:else}
        {#each listings as listing (listing.id)}
          <button
            class="online-card"
            on:click={() => selectedListing = listing}
            transition:slide={{ duration: 200 }}
          >
            <div class="card-top">
              {#if getCategoryName(categories, listing.category)}
                <span class="card-badge" style="background: color-mix(in srgb, {cfg.color} 15%, transparent); color: {cfg.color}">
                  {getCategoryName(categories, listing.category)}
                </span>
              {/if}
              <span class="card-time">{timeAgo(listing.timestamp)}</span>
            </div>
            {#if listing.title}
              <h4 class="card-title">{listing.title}</h4>
            {/if}
            <p class="card-desc">{listing.description}</p>
            <div class="card-footer">
              <span class="card-mode">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  {#if listing.mode === 'online'}
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  {:else}
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                    <circle cx="19" cy="19" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="none"/>
                  {/if}
                </svg>
                {listing.mode === 'online' ? 'Online' : 'Online & In-Person'}
              </span>
              {#if listing.eventDate}
                <span class="card-date">
                  {new Date(listing.eventDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              {/if}
            </div>
          </button>
        {/each}

        {#if !exhausted}
          <div class="online-loadmore">
            <button
              class="loadmore-btn"
              disabled={cooldownRemaining > 0 || loading}
              on:click={loadMore}
            >
              {#if loading}
                Loading...
              {:else if cooldownRemaining > 0}
                Load more ({cooldownRemaining}s)
              {:else}
                Load more
              {/if}
            </button>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

{#if selectedListing}
  <ListingDetail
    listing={selectedListing}
    vertical={activeTab}
    myPk={myPk}
    onClose={() => selectedListing = null}
    onTakenDown={handleListingTakenDown}
  />
{/if}

<style>
  .online-overlay {
    position: fixed;
    inset: 0;
    z-index: 1500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.4);
  }

  .online-panel {
    width: 100%;
    max-width: 480px;
    max-height: 85vh;
    background: rgba(15, 15, 25, 0.94);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 18px;
    backdrop-filter: blur(20px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .online-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .online-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: white;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .online-close {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    transition: color 0.15s;
  }
  .online-close:hover { color: white; }

  .online-tabs {
    display: flex;
    gap: 4px;
    padding: 10px 20px 0;
  }

  .online-tab {
    flex: 1;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .online-tab:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
  }
  .online-tab.active {
    background: color-mix(in srgb, var(--tab-color) 18%, transparent);
    border-color: color-mix(in srgb, var(--tab-color) 40%, transparent);
    color: var(--tab-color);
  }

  .online-categories {
    display: flex;
    gap: 6px;
    padding: 10px 20px;
    overflow-x: auto;
    flex-shrink: 0;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
  }

  .online-cat-chip {
    white-space: nowrap;
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .online-cat-chip:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
  }
  .online-cat-chip.selected {
    background: color-mix(in srgb, var(--cat-color) 18%, transparent);
    border-color: color-mix(in srgb, var(--cat-color) 40%, transparent);
    color: var(--cat-color);
    font-weight: 600;
  }

  .online-list {
    flex: 1;
    overflow-y: auto;
    padding: 10px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
  }

  .online-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px 20px;
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.88rem;
  }

  .online-spinner {
    width: 24px;
    height: 24px;
    border: 2.5px solid rgba(255, 255, 255, 0.15);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .online-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    color: inherit;
    width: 100%;
  }
  .online-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .card-badge {
    padding: 3px 10px;
    border-radius: 16px;
    font-size: 0.68rem;
    font-weight: 600;
  }

  .card-time {
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }

  .card-title {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 700;
    color: white;
    line-height: 1.3;
  }

  .card-desc {
    margin: 0;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.65);
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 2px;
  }

  .card-mode {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.4);
  }

  .card-date {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.4);
  }

  .online-loadmore {
    display: flex;
    justify-content: center;
    padding: 8px 0 4px;
  }

  .loadmore-btn {
    padding: 10px 28px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    font-variant-numeric: tabular-nums;
  }
  .loadmore-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  .loadmore-btn:disabled {
    opacity: 0.45;
    cursor: default;
  }

  @media (min-width: 768px) {
    .online-list {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .online-loadmore,
    .online-empty {
      grid-column: 1 / -1;
    }
  }

  @media (min-width: 1024px) {
    .online-panel {
      max-width: 640px;
    }
  }

  @media (min-width: 1440px) {
    .online-panel {
      max-width: 780px;
    }
  }

  @media (max-width: 768px) {
    .online-overlay {
      padding: 0;
      align-items: flex-end;
    }
    .online-panel {
      max-width: 100%;
      max-height: 92vh;
      border-radius: 18px 18px 0 0;
    }
  }
</style>
