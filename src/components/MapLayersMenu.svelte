<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import CloseButton from './CloseButton.svelte';
  import { activeMapLayers, userLiveLocation, helpoutLayerRefresh, socialLayerRefresh } from '../store';
  import { encode as geohashEncode } from '../utils/geohash';
  import { ListingLayerService } from '../services/listingLayerService';
  import { getSharedNostr } from '../services/nostrPool';
  import type { Listing } from '../types';

  /** Called when helpout listings change (add / remove from map). */
  export let onHelpoutsChanged: (listings: Listing[]) => void;
  /** Called when social listings change (add / remove from map). */
  export let onSocialChanged: (listings: Listing[]) => void;

  let isOpen = false;
  let layerError = '';

  // ─── Per-layer state ──────────────────────────────────────
  let helpoutService: ListingLayerService | null = null;
  let helpoutCache: Listing[] = [];
  let helpoutCachedAt = 0;
  let helpoutLoading = false;

  let socialService: ListingLayerService | null = null;
  let socialCache: Listing[] = [];
  let socialCachedAt = 0;
  let socialLoading = false;

  const CACHE_TTL_MS = 30 * 60 * 1000;

  function toggle() {
    isOpen = !isOpen;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) toggle();
  }

  // ─── Shared helpers ───────────────────────────────────────

  async function ensureLayerService(tag: string): Promise<ListingLayerService | null> {
    try {
      const nostr = await getSharedNostr();
      return new ListingLayerService(nostr, tag);
    } catch {
      layerError = 'Storage unavailable';
      return null;
    }
  }

  // ─── Helpouts layer ───────────────────────────────────────

  async function fetchHelpouts(forceRefresh = false) {
    const loc = $userLiveLocation;
    if (!loc || !helpoutService) return;

    helpoutLoading = true;
    const cell = geohashEncode(loc.latitude, loc.longitude, 4);
    const listings = await helpoutService.fetchListings(cell, forceRefresh);

    helpoutCache = listings.filter(l => l.location);
    helpoutCachedAt = Date.now();
    onHelpoutsChanged(helpoutCache);
    helpoutLoading = false;
  }

  async function toggleHelpouts() {
    layerError = '';
    const layers = $activeMapLayers;
    const wasOn = layers.has('helpouts');

    if (wasOn) {
      layers.delete('helpouts');
      activeMapLayers.set(new Set(layers));
      onHelpoutsChanged([]);
      return;
    }

    layers.add('helpouts');
    activeMapLayers.set(new Set(layers));

    if (helpoutCache.length > 0 && (Date.now() - helpoutCachedAt) < CACHE_TTL_MS) {
      onHelpoutsChanged(helpoutCache);
    }

    if (!helpoutService) {
      helpoutService = await ensureLayerService('listing-helpouts');
      if (!helpoutService) {
        layers.delete('helpouts');
        activeMapLayers.set(new Set(layers));
        return;
      }
    }

    await fetchHelpouts();
  }

  let lastHelpoutRefresh = $helpoutLayerRefresh;
  $: if ($helpoutLayerRefresh !== lastHelpoutRefresh) {
    lastHelpoutRefresh = $helpoutLayerRefresh;
    if ($activeMapLayers.has('helpouts') && helpoutService) {
      fetchHelpouts(true);
    }
  }

  // ─── Social layer ─────────────────────────────────────────

  async function fetchSocial(forceRefresh = false) {
    const loc = $userLiveLocation;
    if (!loc || !socialService) return;

    socialLoading = true;
    const cell = geohashEncode(loc.latitude, loc.longitude, 4);
    const listings = await socialService.fetchListings(cell, forceRefresh);

    socialCache = listings.filter(l => l.location);
    socialCachedAt = Date.now();
    onSocialChanged(socialCache);
    socialLoading = false;
  }

  async function toggleSocial() {
    layerError = '';
    const layers = $activeMapLayers;
    const wasOn = layers.has('social');

    if (wasOn) {
      layers.delete('social');
      activeMapLayers.set(new Set(layers));
      onSocialChanged([]);
      return;
    }

    layers.add('social');
    activeMapLayers.set(new Set(layers));

    if (socialCache.length > 0 && (Date.now() - socialCachedAt) < CACHE_TTL_MS) {
      onSocialChanged(socialCache);
    }

    if (!socialService) {
      socialService = await ensureLayerService('listing-social');
      if (!socialService) {
        layers.delete('social');
        activeMapLayers.set(new Set(layers));
        return;
      }
    }

    await fetchSocial();
  }

  let lastSocialRefresh = $socialLayerRefresh;
  $: if ($socialLayerRefresh !== lastSocialRefresh) {
    lastSocialRefresh = $socialLayerRefresh;
    if ($activeMapLayers.has('social') && socialService) {
      fetchSocial(true);
    }
  }

  // ─── Reactive helpers ─────────────────────────────────────
  $: helpoutsOn = $activeMapLayers.has('helpouts');
  $: socialOn = $activeMapLayers.has('social');
</script>

<svelte:window on:keydown={onKeydown} />

<!-- Toggle button (bottom-right, always visible) -->
<button class="layers-toggle" on:click={toggle} title="Map Layers">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
    <polyline points="2 17 12 22 22 17"/>
    <polyline points="2 12 12 17 22 12"/>
  </svg>
</button>

<!-- Bottom sheet overlay -->
{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="sheet-backdrop" on:click={toggle} transition:fade={{ duration: 200 }}></div>

  <div class="sheet" transition:fly={{ y: 600, duration: 300 }}>
    <!-- Drag handle -->
    <div class="sheet-handle-bar"><div class="sheet-handle"></div></div>

    <div class="sheet-header">
      <span class="sheet-title">Map Layers</span>
      <CloseButton onClose={toggle} position="relative" top="0" right="0" />
    </div>

    <div class="sheet-body">
      <button
        class="layer-card"
        class:active={helpoutsOn}
        on:click={toggleHelpouts}
      >
        <div class="layer-icon" style="background: #00BCD4">
          {#if helpoutLoading}
            <span class="layer-spinner"></span>
          {:else}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          {/if}
        </div>
        <span class="layer-label">Helpouts</span>
        {#if helpoutsOn}
          <span class="layer-badge">ON</span>
        {/if}
      </button>

      <button
        class="layer-card"
        class:active={socialOn}
        on:click={toggleSocial}
      >
        <div class="layer-icon" style="background: #FF4081">
          {#if socialLoading}
            <span class="layer-spinner"></span>
          {:else}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          {/if}
        </div>
        <span class="layer-label">Spontaneous Contacts</span>
        {#if socialOn}
          <span class="layer-badge">ON</span>
        {/if}
      </button>
    </div>

    {#if layerError}
      <div class="layer-error">{layerError}</div>
    {/if}
  </div>
{/if}

<style>
  /* ─── Toggle button (bottom-right of map) ─── */
  .layers-toggle {
    position: absolute;
    bottom: 20px;
    right: 10px;
    z-index: 1000;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.2);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    color: rgba(255, 255, 255, 0.8);
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .layers-toggle:hover {
    background: rgba(0, 0, 0, 0.85);
    color: white;
    border-color: rgba(255, 255, 255, 0.35);
  }

  /* ─── Backdrop ─── */
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 1999;
  }

  /* ─── Bottom sheet ─── */
  .sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 75vh;
    z-index: 2000;
    background: rgba(18, 18, 22, 0.97);
    -webkit-backdrop-filter: blur(24px);
    backdrop-filter: blur(24px);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px 20px 0 0;
    padding: 0 20px 32px;
    overflow-y: auto;
    box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.5);
  }

  .sheet-handle-bar {
    display: flex;
    justify-content: center;
    padding: 10px 0 4px;
  }

  .sheet-handle {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.2);
  }

  .sheet-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0 16px;
  }

  .sheet-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    letter-spacing: 0.2px;
  }

  /* ─── Layer cards grid ─── */
  .sheet-body {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }

  .layer-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 24px 12px 18px;
    border-radius: 16px;
    border: 2px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
    font-size: inherit;
  }

  .layer-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.85);
  }

  .layer-card.active {
    border-color: rgba(79, 195, 247, 0.5);
    background: rgba(79, 195, 247, 0.08);
    color: white;
  }

  .layer-icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .layer-label {
    font-size: 0.82rem;
    font-weight: 500;
    text-align: center;
    line-height: 1.3;
  }

  .layer-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(74, 222, 128, 0.2);
    color: rgba(74, 222, 128, 1);
  }

  .layer-spinner {
    width: 18px;
    height: 18px;
    border: 2.5px solid rgba(255, 255, 255, 0.25);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .layer-error {
    padding: 12px 4px 0;
    font-size: 0.78rem;
    color: rgba(252, 165, 165, 0.9);
    text-align: center;
  }
</style>
