<script lang="ts">
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

<!-- Wrench toggle button (bottom-right) -->
<div class="map-layers-container">
  <button class="layers-toggle" on:click={toggle} title="Map Layers">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  </button>

  {#if isOpen}
    <div class="layers-menu">
      <div class="menu-title">Map Layers</div>

      <button
        class="layer-row"
        class:active={helpoutsOn}
        on:click={toggleHelpouts}
      >
        <span class="layer-dot" style="background: #00BCD4"></span>
        <span class="layer-name">Helpouts</span>
        {#if helpoutLoading}
          <span class="layer-spinner"></span>
        {:else}
          <span class="layer-check">{helpoutsOn ? '✓' : ''}</span>
        {/if}
      </button>

      <button
        class="layer-row"
        class:active={socialOn}
        on:click={toggleSocial}
      >
        <span class="layer-dot" style="background: #FF4081"></span>
        <span class="layer-name">Spontaneous Contacts</span>
        {#if socialLoading}
          <span class="layer-spinner"></span>
        {:else}
          <span class="layer-check">{socialOn ? '✓' : ''}</span>
        {/if}
      </button>

      {#if layerError}
        <div class="layer-error">{layerError}</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .map-layers-container {
    position: absolute;
    bottom: 20px;
    right: 10px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }

  .layers-toggle {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    color: rgba(255, 255, 255, 0.8);
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

  .layers-menu {
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    backdrop-filter: blur(12px);
    padding: 8px;
    min-width: 160px;
  }

  .menu-title {
    font-size: 0.7rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 4px 8px 6px;
  }

  .layer-row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px;
    background: none;
    border: 1px solid transparent;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.82rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
  }

  .layer-row:hover {
    background: rgba(255, 255, 255, 0.06);
    color: white;
  }

  .layer-row.active {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .layer-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .layer-name {
    flex: 1;
  }

  .layer-check {
    font-size: 0.85rem;
    color: rgba(74, 222, 128, 1);
    width: 16px;
    text-align: center;
  }

  .layer-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .layer-error {
    padding: 4px 8px;
    font-size: 0.7rem;
    color: rgba(252, 165, 165, 0.9);
  }
</style>
