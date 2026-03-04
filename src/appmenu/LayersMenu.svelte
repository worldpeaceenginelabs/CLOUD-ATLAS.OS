<script lang="ts">
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { logger } from '../utils/logger';

  import {
    coordinates, isVisible,
    activeMapLayers, userLiveLocation, layerRefresh, layerListings,
    enable3DTileset, userIonAccessToken,
  } from '../store';
  import { modalService } from '../utils/modalService';
  import { encode as geohashEncode } from '../utils/geohash';
  import { ListingLayerService } from '../services/listingLayerService';
  import { getSharedNostr } from '../services/nostrPool';
  import { idb } from '../idb';
  import { LISTING_VERTICALS, VERTICALS, SWARM_GOVERNANCE_VERTICALS, type ListingVerticalConfig } from '../gig/verticals';

  function isGlobalVertical(v: ListingVertical): boolean {
    return (VERTICALS[v] as ListingVerticalConfig).fetchStrategy === 'global';
  }
  import { verticalIconSvg } from '../gig/verticalIcons';
  import type { Listing, ListingVertical } from '../types';
  import { SwarmGovernanceListingService } from '../services/swarmGovernanceListingService';

  export let onAddModel: (() => void) | undefined = undefined;

  // ─── Component state ──────────────────────────────────────
  let hoveredItem = '';
  let showInfoPanel = false;
  let infoPanelContent = '';

  $: hasCoordinates = $coordinates.latitude !== '' && $coordinates.longitude !== '';

  // ─── Generic layer state ──────────────────────────────────
  const layerServices: Record<string, ListingLayerService | null> = {};
  const layerCaches: Record<string, { listings: Listing[]; cachedAt: number }> = {};
  const layerLoadingState: Record<string, boolean> = {};

  let layerLoading: Record<string, boolean> = {};

  const CACHE_TTL_MS = 30 * 60 * 1000;
  const GLOBAL_FEED_INTERVAL_MS = 30 * 60 * 1000;
  let layerError = '';
  let globalFeedTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let persistListingLayersTimer: ReturnType<typeof setTimeout> | null = null;
  let mounted = true;
  let globalFeedFetchInFlight = false;

  // Ion API key state
  let ionKeyInput = '';
  let ionKeySaved = false;
  let showIonKey = false;
  let ionKeyExpanded = false;

  $: tiles3dOn = $enable3DTileset;

  // ─── Menu actions ─────────────────────────────────────────

  function handleInfoClick(item: string, event: Event) {
    event.stopPropagation();
    switch (item) {
      case 'model':
        modalService.showSimulation();
        return;
    }
    if (showInfoPanel && hoveredItem === item) {
      showInfoPanel = false;
      hoveredItem = '';
      return;
    }
    hoveredItem = item;
    showInfoPanel = true;
  }

  function handleItemClick(item: string) {
    logger.debug('Clicked item: ' + item, { component: 'LayersMenu', operation: 'handleItemClick' });
    showInfoPanel = false;
    hoveredItem = '';
    switch (item) {
      case 'model':
        if (onAddModel) onAddModel();
        break;
      case 'omnipedia':
        modalService.showOmnipedia();
        break;
    }
  }

  function toggleAbout() {
    isVisible.update(v => !v);
  }

  function openLiveEdit() {
    const newWindow = window.open(
      'https://stackblitz.com/github/worldpeaceenginelabs/CLOUD-ATLAS-OS/tree/main?file=src/DAPPS/HomeScreen.svelte:L294',
      '_blank',
      `width=${window.screen.width},height=${window.screen.height}`
    );
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      alert('The popup was blocked. Please disable your popup blocker for this site to continue.');
    }
  }

  // ─── Generic layer logic ──────────────────────────────────

  async function ensureLayerService(tag: string): Promise<ListingLayerService | null> {
    try {
      const nostr = await getSharedNostr();
      return new ListingLayerService(nostr, tag);
    } catch {
      layerError = 'Storage unavailable';
      return null;
    }
  }

  async function fetchLayer(verticalId: ListingVertical, forceRefresh = false) {
    if (isGlobalVertical(verticalId)) return;
    const cfg = VERTICALS[verticalId] as ListingVerticalConfig;
    const loc = $userLiveLocation;
    if (!loc) return;

    if (!layerServices[verticalId]) {
      layerServices[verticalId] = await ensureLayerService(cfg.listingTag);
      if (!layerServices[verticalId]) return;
    }

    layerLoadingState[verticalId] = true;
    layerLoading = { ...layerLoading, [verticalId]: true };

    const cell = geohashEncode(loc.latitude, loc.longitude, 4);
    const listings = await layerServices[verticalId]!.fetchListings(cell, forceRefresh);
    const filtered = listings.filter(l => l.location);

    layerCaches[verticalId] = { listings: filtered, cachedAt: Date.now() };
    layerListings.update(all => ({ ...all, [verticalId]: filtered }));

    layerLoadingState[verticalId] = false;
    layerLoading = { ...layerLoading, [verticalId]: false };
  }

  async function toggleLayer(verticalId: ListingVertical) {
    layerError = '';
    const layers = new Set($activeMapLayers);
    const wasOn = layers.has(verticalId);

    if (wasOn) {
      layers.delete(verticalId);
      activeMapLayers.set(layers);
      layerListings.update(all => ({ ...all, [verticalId]: [] }));
      schedulePersistListingLayers();
      return;
    }

    layers.add(verticalId);
    activeMapLayers.set(layers);
    schedulePersistListingLayers();

    if (isGlobalVertical(verticalId)) {
      runGlobalFeedFetch();
      return;
    }

    const cache = layerCaches[verticalId];
    if (cache && cache.listings.length > 0 && (Date.now() - cache.cachedAt) < CACHE_TTL_MS) {
      layerListings.update(all => ({ ...all, [verticalId]: cache.listings }));
    }
    await fetchLayer(verticalId);
  }

  async function persistListingLayers() {
    const on = LISTING_VERTICALS.filter(v => $activeMapLayers.has(v));
    try {
      await idb.openDB();
      await idb.saveSetting('activeListingLayers', JSON.stringify(on));
    } catch { /* non-critical */ }
  }

  function schedulePersistListingLayers() {
    if (persistListingLayersTimer) clearTimeout(persistListingLayersTimer);
    persistListingLayersTimer = setTimeout(() => {
      persistListingLayersTimer = null;
      persistListingLayers();
    }, 250);
  }

  async function loadListingLayers() {
    try {
      await idb.openDB();
      const raw = await idb.loadSetting('activeListingLayers');
      const on = raw ? (JSON.parse(raw) as ListingVertical[]) : [...SWARM_GOVERNANCE_VERTICALS];
      const layers = new Set($activeMapLayers);
      for (const v of LISTING_VERTICALS) {
        if (on.includes(v)) layers.add(v);
        else layers.delete(v);
      }
      activeMapLayers.set(layers);
    } catch { /* use defaults */ }
  }

  async function runGlobalFeedFetch() {
    if (globalFeedFetchInFlight) return;
    globalFeedFetchInFlight = true;
    try {
      const nostr = await getSharedNostr();
      const svc = new SwarmGovernanceListingService(nostr);
      const active = SWARM_GOVERNANCE_VERTICALS.filter(v => $activeMapLayers.has(v));
      if (active.length === 0) {
        layerListings.update(all => {
          const next = { ...all };
          for (const v of SWARM_GOVERNANCE_VERTICALS) next[v] = [];
          return next;
        });
      } else {
        const listings = await svc.run(active);
        const withLocation = listings.filter(l => l.location);
        layerListings.update(all => {
          const next = { ...all };
          for (const v of SWARM_GOVERNANCE_VERTICALS) {
            next[v] = withLocation.filter(l => l.vertical === v);
          }
          return next;
        });
      }
    } catch { /* nostr unavailable or run failed */ }
    finally {
      globalFeedFetchInFlight = false;
      if (mounted) globalFeedTimeoutId = setTimeout(runGlobalFeedFetch, GLOBAL_FEED_INTERVAL_MS);
    }
  }

  let lastRefreshSnapshot: Record<string, number> = {};
  $: {
    const current = $layerRefresh;
    let needGlobalFetch = false;
    for (const v of LISTING_VERTICALS) {
      const cur = current[v] ?? 0;
      const last = lastRefreshSnapshot[v] ?? 0;
      if (cur !== last && $activeMapLayers.has(v)) {
        if (isGlobalVertical(v)) needGlobalFetch = true;
        else if (layerServices[v]) fetchLayer(v, true);
      }
    }
    if (needGlobalFetch) runGlobalFeedFetch();
    lastRefreshSnapshot = { ...current };
  }

  // ─── Layer groups for menu display ─────────────────────────

  interface LayerGroup {
    header: string;
    items: { id: ListingVertical; label: string }[];
  }

  const layerGroups: LayerGroup[] = [
    { header: 'Social', items: [
      { id: 'social', label: 'Spontaneous Contacts' },
    ]},
    { header: 'Gig Economy', items: [
      { id: 'helpouts', label: 'Helpouts' },
    ]},
    { header: 'Swarm Governance', items: [
      { id: 'brainstorming', label: 'Brainstorming' },
      { id: 'meetanddo', label: 'MeetandDo' },
      { id: 'petition', label: 'Petition' },
      { id: 'crowdfunding', label: 'Crowdfunding' },
    ]},
  ];

  // ─── Ion key persistence ──────────────────────────────────

  async function loadIonKey() {
    try {
      await idb.openDB();
      const stored = await idb.loadSetting('ionAccessToken');
      if (stored) {
        ionKeyInput = stored;
        userIonAccessToken.set(stored);
        ionKeySaved = true;
      }
    } catch {}
  }

  async function saveIonKey() {
    const trimmed = ionKeyInput.trim();
    if (!trimmed) return;
    try {
      await idb.openDB();
      await idb.saveSetting('ionAccessToken', trimmed);
      userIonAccessToken.set(trimmed);
      ionKeySaved = true;
    } catch {
      layerError = 'Failed to save API key';
    }
  }

  async function clearIonKey() {
    ionKeyInput = '';
    ionKeySaved = false;
    showIonKey = false;
    enable3DTileset.set(false);
    try {
      await idb.openDB();
      await idb.saveSetting('ionAccessToken', '');
      userIonAccessToken.set('');
    } catch {}
  }

  function handleTilesCardClick() {
    if (ionKeySaved) {
      enable3DTileset.set(!$enable3DTileset);
    } else {
      ionKeyExpanded = !ionKeyExpanded;
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────

  onMount(() => {
    loadIonKey();
    loadListingLayers().then(() => runGlobalFeedFetch());
    return () => {
      mounted = false;
      if (globalFeedTimeoutId != null) clearTimeout(globalFeedTimeoutId);
      if (persistListingLayersTimer != null) clearTimeout(persistListingLayersTimer);
    };
  });
</script>

<div class="layermenu-container">
  <div class="layermenu-inner" transition:slide={{ duration: 500, axis: 'y' }}>

        <!-- ═══ LAYERS ═══════════════════════════════════════ -->
        <div class="dropdown-menu">
        <div class="section-label">Layers</div>

        <!-- Map sub-header -->
        <div class="sub-header">Map</div>

        <!-- 3D Tiles -->
        <div 
          class="dropdown-item"
          role="button"
          tabindex="0"
          on:click={handleTilesCardClick}
          on:keydown={(e) => e.key === 'Enter' && handleTilesCardClick()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3L2 8l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 16l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="item-text">3D Tiles</span>
          {#if tiles3dOn}
            <span class="layer-badge">ON</span>
          {:else if !ionKeySaved}
            <span class="layer-hint">Add API key</span>
          {/if}
          {#if ionKeySaved}
            <button class="tiles3d-edit" on:click|stopPropagation={() => ionKeyExpanded = !ionKeyExpanded} aria-label="Edit Ion key">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          {/if}
        </div>

        <!-- Ion key panel (expands directly below 3D Tiles) -->
        {#if ionKeyExpanded}
          <div class="ion-panel-inline" transition:slide={{ duration: 200 }}>
            <p class="ion-hint">
              Get a free key at <a href="https://ion.cesium.com" target="_blank" rel="noopener">ion.cesium.com</a> to unlock Google Photorealistic 3D Tiles.
            </p>
            <div class="ion-key-row">
              {#if showIonKey}
                <input
                  class="ion-key-input"
                  type="text"
                  placeholder="Paste Ion access token"
                  bind:value={ionKeyInput}
                  on:keydown={(e) => e.key === 'Enter' && saveIonKey()}
                />
              {:else}
                <input
                  class="ion-key-input"
                  type="password"
                  placeholder="Paste Ion access token"
                  bind:value={ionKeyInput}
                  on:keydown={(e) => e.key === 'Enter' && saveIonKey()}
                />
              {/if}
              <button class="ion-key-eye" on:click={() => showIonKey = !showIonKey} title={showIonKey ? 'Hide' : 'Show'}>
                {#if showIonKey}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                {:else}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                {/if}
              </button>
            </div>
            <div class="ion-key-actions">
              <button class="ion-key-btn save" on:click={saveIonKey} disabled={!ionKeyInput.trim()}>Save</button>
              {#if ionKeySaved}
                <button class="ion-key-btn clear" on:click={clearIonKey}>Reset</button>
              {/if}
              <button class="ion-key-btn clear" on:click={() => ionKeyExpanded = false}>Cancel</button>
            </div>
          </div>
        {/if}

        <!-- Holodeck sub-header -->
        <div class="sub-header">Holodeck</div>

        <!-- Add Model -->
        <div 
          class="dropdown-item" 
          role="button"
          tabindex="0"
          on:click={() => handleItemClick('model')}
          on:keydown={(e) => e.key === 'Enter' && handleItemClick('model')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M3.27 6.96L12 12.01l8.73-5.05" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M12 22.08V12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          </svg>
          <span class="item-text">Holodeck Editor</span>
          <button 
            class="info-icon" 
            class:active={showInfoPanel && hoveredItem === 'model'}
            on:click={(e) => handleInfoClick('model', e)}
            on:keydown={(e) => e.key === 'Enter' && handleInfoClick('model', e)}
            tabindex="0"
            aria-label="Show info for Model"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div 
          class="dropdown-item"
          role="button"
          tabindex="0"
          on:click={() => handleItemClick('omnipedia')}
          on:keydown={(e) => e.key === 'Enter' && handleItemClick('omnipedia')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span class="item-text">Omnipedia</span>
          <span class="coming-soon-badge">COMING SOON</span>
        </div>

        <!-- Listing layer groups -->
        {#each layerGroups as group}
          <div class="sub-header">{group.header}</div>
          {#each group.items as layerItem}
            {@const isOn = $activeMapLayers.has(layerItem.id)}
            {@const isLoading = layerLoading[layerItem.id] ?? false}
            {@const color = VERTICALS[layerItem.id].color}
            <div 
              class="dropdown-item"
              role="button"
              tabindex="0"
              on:click={() => toggleLayer(layerItem.id)}
              on:keydown={(e) => e.key === 'Enter' && toggleLayer(layerItem.id)}
            >
              {#if isLoading}
                <span class="layer-spinner"></span>
              {:else}
                <span class="layer-icon" style="color: {color}">
                  {@html verticalIconSvg(layerItem.id, 16)}
                </span>
              {/if}
              <span class="item-text">{layerItem.label}</span>
              {#if isOn}
                <span class="layer-badge">ON</span>
              {/if}
            </div>
          {/each}
        {/each}

        {#if layerError}
          <div class="layer-error">{layerError}</div>
        {/if}
        </div>

        <!-- Bottom section: Utility -->
        <div class="utility-menu">
          <div 
            class="dropdown-item"
            role="button"
            tabindex="0"
            on:click={toggleAbout}
            on:keydown={(e) => e.key === 'Enter' && toggleAbout()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span class="item-text">About</span>
          </div>

          <div 
            class="dropdown-item"
            role="button"
            tabindex="0"
            on:click={openLiveEdit}
            on:keydown={(e) => e.key === 'Enter' && openLiveEdit()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="item-text">Live Edit</span>
          </div>

          <div class="utility-links">
            <a href="https://worldpeaceenginelabs.org/" target="_blank" rel="noopener">
              <img class="bottomicon" style="background-color: white;" src="./icons/tree-icon.gif" alt="" title="World Peace Engine Labs" height="30" width="30">
            </a>
            <a href="https://github.com/worldpeaceenginelabs/CLOUD-ATLAS-OS" target="_blank" rel="noopener">
              <img class="bottomicon" src="github-icon.svg" alt="" title="GitHub" height="30" width="30">
            </a>
            <a href="pear://keet/nfohh3zteag1bcakp8qntdaoiz3mpt9zq6x13wb1spguxuyc8k4ugyiibz9oytfjaz693afxajydenrw7tntfs48zicfd3bkpjhfi1imqdpaiio6xbjw7bjpcgrqerto1ejqwrwus8eocka1boxydb5is4sm1yederk6cuy1wixs96b37niw8sxuobfcr" target="_blank" rel="noopener">
              <img class="bottomicon" src="chat-icon.svg" alt="" title="Developer Chat on Keet" height="30" width="30">
            </a>
            <a href="https://twitter.com/cloudatlasos" target="_blank" rel="noopener">
              <img class="bottomicon" src="x-icon.svg" alt="" title="X" height="30" width="30">
            </a>
            <a href="https://www.youtube.com/@cloudatlasos" target="_blank" rel="noopener">
              <img class="bottomicon" src="youtube-icon.svg" alt="" title="Youtube" height="30" width="30">
            </a>
            <a href="https://bitcoinblockexplorers.com/address/bc1qwwdmn33g90y3vwutpj6r6q6kwrdqp00x2mfrzp" target="_blank" rel="noopener">
              <img class="bottomicon" src="./icons/bitcoin.png" alt="" title="Donate Bitcoin" height="30" width="30">
            </a>
          </div>
        </div>
      </div>
    </div>

  {#if showInfoPanel && infoPanelContent}
    <div class="info-panel slide-in">
      <div class="info-content">
        {infoPanelContent}
      </div>
    </div>
  {/if}


<style>
  .layermenu-container {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 60;
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    /* Ensure smooth, native touch scrolling on mobile devices */
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
  }

  .layermenu-inner {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .dropdown-menu {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    min-width: 250px;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
  }

  .dropdown-item:last-child {
    border-bottom: none;
  }

  .dropdown-item:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateX(-4px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
  }

  .dropdown-item svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .item-text {
    flex: 1;
    text-align: left;
    font-size: 0.85rem;
  }

  .info-icon {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .info-icon:hover {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    color: white;
    transform: scale(1.1);
  }

  .info-icon.active {
    background: rgba(255, 255, 255, 0.2);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
    color: white;
    transform: scale(1.05);
  }

  .info-icon:focus {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
  }

  .info-icon svg {
    width: 16px;
    height: 16px;
  }

  .section-label {
    padding: 6px 14px 6px;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.35);
  }

  .sub-header {
    padding: 4px 14px 1px;
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.25);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .sub-header:first-of-type {
    border-top: none;
  }

  /* ── Layer badges & status ── */
  .layer-badge {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(74, 222, 128, 0.2);
    color: rgba(74, 222, 128, 1);
    flex-shrink: 0;
  }

  .layer-hint {
    font-size: 0.62rem;
    color: rgba(124, 77, 255, 0.7);
    flex-shrink: 0;
  }

  .coming-soon-badge {
    font-size: 0.55rem;
    font-weight: 700;
    letter-spacing: 1px;
    padding: 2px 5px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.5);
    flex-shrink: 0;
  }

  .layer-spinner {
    width: 18px;
    height: 18px;
    border: 2.5px solid rgba(255, 255, 255, 0.25);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .layer-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .layer-error {
    padding: 8px 16px;
    font-size: 0.78rem;
    color: rgba(252, 165, 165, 0.9);
    text-align: center;
  }

  .tiles3d-edit {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    padding: 2px;
    transition: color 0.2s;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .tiles3d-edit:hover {
    color: rgba(255, 255, 255, 0.7);
  }

  /* ── Ion key panel (inline, inside dropdown-menu) ── */
  .ion-panel-inline {
    padding: 10px 16px 14px;
    border-top: 1px solid rgba(124, 77, 255, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .ion-hint {
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.45);
    margin: 0 0 10px;
    line-height: 1.4;
  }

  .ion-hint a {
    color: rgba(124, 77, 255, 0.9);
    text-decoration: none;
  }

  .ion-hint a:hover {
    text-decoration: underline;
  }

  .ion-key-row {
    display: flex;
    gap: 6px;
  }

  .ion-key-input {
    flex: 1;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.85);
    font-size: 0.78rem;
    font-family: monospace;
    outline: none;
    transition: border-color 0.2s;
  }

  .ion-key-input:focus {
    border-color: rgba(79, 195, 247, 0.5);
  }

  .ion-key-input::placeholder {
    color: rgba(255, 255, 255, 0.25);
    font-family: inherit;
  }

  .ion-key-eye {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s;
    padding: 0;
  }

  .ion-key-eye:hover {
    color: rgba(255, 255, 255, 0.8);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .ion-key-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .ion-key-btn {
    padding: 6px 14px;
    border-radius: 8px;
    border: none;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .ion-key-btn.save {
    background: rgba(79, 195, 247, 0.15);
    color: rgba(79, 195, 247, 1);
  }

  .ion-key-btn.save:hover:not(:disabled) {
    background: rgba(79, 195, 247, 0.25);
  }

  .ion-key-btn.save:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .ion-key-btn.clear {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.5);
  }

  .ion-key-btn.clear:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
  }

  .utility-menu {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    overflow: hidden;
    min-width: 250px;
  }

  .utility-links {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 4px;
    padding: 6px 10px 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .utility-links a {
    display: inline-flex;
  }

  .utility-links .bottomicon {
    width: 22px;
    height: 22px;
    padding: 2px;
    border-radius: 8px;
    box-shadow: 0 3px 5px rgba(0, 0, 0, 0.15);
    transition: transform 0.15s ease, background 0.15s ease;
  }

  .utility-links .bottomicon:hover {
    transform: translateY(-1px) scale(1.05);
    background: rgba(255, 215, 0, 0.2);
  }

  .info-panel {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 70;
    max-width: 300px;
    min-width: 250px;
    opacity: 0;
    transition: all 0.3s ease;
  }

  .info-panel.slide-in {
    transform: translate(-50%, -50%);
    opacity: 1;
  }

  .info-content {
    padding: 16px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.5;
  }

  @media (max-width: 768px) {
    .info-panel {
      max-width: 250px;
      min-width: 200px;
    }

    .info-content {
      font-size: 13px;
      padding: 12px;
    }

    .dropdown-menu {
      min-width: 220px;
    }

    .dropdown-item {
      padding: 10px 12px;
      font-size: 13px;
    }
  }
</style>
