<script lang="ts">
  import { slide } from 'svelte/transition';
  import { logger } from '../utils/logger';

  import { openModals } from '../utils/modalManager';
  import { activeMapLayers, enable3DTileset } from '../store';
  import { modalService } from '../utils/modalService';
  import { LISTING_VERTICALS, VERTICALS, type ListingVerticalConfig } from '../gig/verticals';
  import { verticalIconSvg } from '../gig/verticalIcons';
  import type { ListingVertical } from '../types';
  import { modelEditorService } from '../utils/modelEditorService';
  import { openExternal } from '../utils/openExternal';
  import {
    layerLoading,
    layerError,
    ionKeyInput,
    ionKeySaved,
    toggleLayer as bootstrapToggleLayer,
    saveIonKey,
    clearIonKey,
  } from '../services/listingLayersBootstrap';
  import { onEnter } from '../utils/keyboard';

  // ─── Component state (UI only) ─────────────────────────────
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
  }

  function handleItemClick(item: string) {
    logger.debug('Clicked item: ' + item, { component: 'LayersMenu', operation: 'handleItemClick' });
    switch (item) {
      case 'model':
        modelEditorService.handleAddModel();
        modalService.hideLayersMenu();
        break;
      case 'omnipedia':
        modalService.showOmnipedia();
        break;
    }
  }

  function toggleAbout() {
    if ($openModals.some((m) => m.id === 'about')) modalService.hideAbout();
    else modalService.showAbout();
  }

  function openLiveEdit() {
    void openExternal('https://stackblitz.com/github/worldpeaceenginelabs/CLOUD-ATLAS-OS/tree/main?file=src/DAPPS/HomeScreen.svelte:L294');
  }

  function handleTilesCardClick() {
    if ($ionKeySaved) {
      enable3DTileset.set(!$enable3DTileset);
    } else {
      ionKeyExpanded = !ionKeyExpanded;
    }
  }

  function onToggleLayer(verticalId: ListingVertical) {
    bootstrapToggleLayer(verticalId);
  }

  function onSaveIonKey() {
    saveIonKey($ionKeyInput);
  }

  function onClearIonKey() {
    clearIonKey();
  }

  // ─── Layer groups for menu display ─────────────────────────

  type LayerGroupHeader = 'Social' | 'Gig Economy' | 'Swarm Governance';

  interface LayerGroup {
    header: LayerGroupHeader;
    items: ListingVertical[];
  }

  const layerGroups: LayerGroup[] = (() => {
    const groups: Record<LayerGroupHeader, ListingVertical[]> = {
      Social: [],
      'Gig Economy': [],
      'Swarm Governance': [],
    };
    for (const verticalId of LISTING_VERTICALS) {
      const cfg = VERTICALS[verticalId] as ListingVerticalConfig;
      const header: LayerGroupHeader = cfg.layerGroup ?? 'Swarm Governance';
      groups[header].push(verticalId);
    }
    return Object.entries(groups)
      .map(([header, items]) => ({ header: header as LayerGroupHeader, items }))
      .filter((group) => group.items.length > 0);
  })();
</script>

<div class="layermenu-container">
  <div class="layermenu-inner" transition:slide={{ duration: 500, axis: 'y' }}>
    <div class="dropdown-menu">
      <div class="section-label">Layers</div>

      <div class="sub-header">Map</div>

      <div
        class="dropdown-item"
        role="button"
        tabindex="0"
        on:click={handleTilesCardClick}
        on:keydown={(e) => onEnter(e, handleTilesCardClick)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3L2 8l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 16l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="item-text">3D Tiles</span>
        {#if tiles3dOn}
          <span class="layer-badge">ON</span>
        {:else if !$ionKeySaved}
          <span class="layer-hint">Add API key</span>
        {/if}
        {#if $ionKeySaved}
          <button class="tiles3d-edit" on:click|stopPropagation={() => (ionKeyExpanded = !ionKeyExpanded)} aria-label="Edit Ion key">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        {/if}
      </div>

      {#if ionKeyExpanded}
        <div class="ion-panel-inline" transition:slide={{ duration: 200 }}>
          <p class="ion-hint">
            Get a free key at
            <a href="https://ion.cesium.com" rel="noopener" on:click|preventDefault={() => openExternal('https://ion.cesium.com')}>
              ion.cesium.com
            </a>
            to unlock Google Photorealistic 3D Tiles.
          </p>
          <div class="ion-key-row">
            {#if showIonKey}
              <input
                class="ion-key-input"
                type="text"
                placeholder="Paste Ion access token"
                bind:value={$ionKeyInput}
                on:keydown={(e) => onEnter(e, onSaveIonKey)}
              />
            {:else}
              <input
                class="ion-key-input"
                type="password"
                placeholder="Paste Ion access token"
                bind:value={$ionKeyInput}
                on:keydown={(e) => onEnter(e, onSaveIonKey)}
              />
            {/if}
            <button class="ion-key-eye" on:click={() => (showIonKey = !showIonKey)} title={showIonKey ? 'Hide' : 'Show'}>
              {#if showIonKey}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              {:else}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              {/if}
            </button>
          </div>
          <div class="ion-key-actions">
            <button class="ion-key-btn save" on:click={onSaveIonKey} disabled={!$ionKeyInput.trim()}>Save</button>
            {#if $ionKeySaved}
              <button class="ion-key-btn clear" on:click={onClearIonKey}>Reset</button>
            {/if}
            <button class="ion-key-btn clear" on:click={() => (ionKeyExpanded = false)}>Cancel</button>
          </div>
        </div>
      {/if}

      <div class="sub-header">Holodeck</div>

      <div
        class="dropdown-item"
        role="button"
        tabindex="0"
        on:click={() => handleItemClick('model')}
        on:keydown={(e) => onEnter(e, () => handleItemClick('model'))}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M3.27 6.96L12 12.01l8.73-5.05" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M12 22.08V12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>
        <span class="item-text">Holodeck Editor</span>
        <button
          class="info-icon"
          on:click={(e) => handleInfoClick('model', e)}
          on:keydown={(e) => onEnter(e, () => handleInfoClick('model', e))}
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
        on:keydown={(e) => onEnter(e, () => handleItemClick('omnipedia'))}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span class="item-text">Omnipedia</span>
        <span class="coming-soon-badge">COMING SOON</span>
      </div>

      {#each layerGroups as group}
        <div class="sub-header">{group.header}</div>
        {#each group.items as verticalId}
          {@const isOn = $activeMapLayers.has(verticalId)}
          {@const isLoading = $layerLoading[verticalId] ?? false}
          {@const vertical = VERTICALS[verticalId]}
          {@const color = vertical.color}
          <div
            class="dropdown-item"
            role="button"
            tabindex="0"
            on:click={() => onToggleLayer(verticalId)}
            on:keydown={(e) => onEnter(e, () => onToggleLayer(verticalId))}
          >
            {#if isLoading}
              <span class="layer-spinner"></span>
            {:else}
              <span class="layer-icon" style="color: {color}">
                {@html verticalIconSvg(verticalId, 16)}
              </span>
            {/if}
            <span class="item-text">{vertical.name}</span>
            {#if isOn}
              <span class="layer-badge">ON</span>
            {/if}
          </div>
        {/each}
      {/each}

      {#if $layerError}
        <div class="layer-error">{$layerError}</div>
      {/if}
    </div>

    <div class="utility-menu">
      <div
        class="dropdown-item"
        role="button"
        tabindex="0"
        on:click={toggleAbout}
        on:keydown={(e) => onEnter(e, toggleAbout)}
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
        on:keydown={(e) => onEnter(e, openLiveEdit)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="item-text">Live Edit</span>
      </div>

      <div class="utility-links">
        <a href="https://worldpeaceenginelabs.org/" rel="noopener" on:click|preventDefault={() => openExternal('https://worldpeaceenginelabs.org/')}>
          <img class="bottomicon" style="background-color: white;" src="./icons/tree-icon.gif" alt="" title="World Peace Engine Labs" height="30" width="30">
        </a>
        <a href="https://github.com/worldpeaceenginelabs/CLOUD-ATLAS-OS" rel="noopener" on:click|preventDefault={() => openExternal('https://github.com/worldpeaceenginelabs/CLOUD-ATLAS-OS')}>
          <img class="bottomicon" src="github-icon.svg" alt="" title="GitHub" height="30" width="30">
        </a>
        <a href="https://github.com/worldpeaceenginelabs/CLOUD-ATLAS.OS/discussions" rel="noopener" on:click|preventDefault={() => openExternal('https://github.com/worldpeaceenginelabs/CLOUD-ATLAS.OS/discussions')}>
          <img class="bottomicon" src="chat-icon.svg" alt="" title="Developer Chat on GitHub" height="30" width="30">
        </a>
        <a href="https://twitter.com/cloudatlasos" rel="noopener" on:click|preventDefault={() => openExternal('https://twitter.com/cloudatlasos')}>
          <img class="bottomicon" src="x-icon.svg" alt="" title="X" height="30" width="30">
        </a>
        <a href="https://www.youtube.com/@cloudatlasos" rel="noopener" on:click|preventDefault={() => openExternal('https://www.youtube.com/@cloudatlasos')}>
          <img class="bottomicon" src="youtube-icon.svg" alt="" title="Youtube" height="30" width="30">
        </a>
        <a
          href="https://bitcoinblockexplorers.com/address/bc1qwwdmn33g90y3vwutpj6r6q6kwrdqp00x2mfrzp"
          rel="noopener"
          on:click|preventDefault={() => openExternal('https://bitcoinblockexplorers.com/address/bc1qwwdmn33g90y3vwutpj6r6q6kwrdqp00x2mfrzp')}
        >
          <img class="bottomicon" src="./icons/bitcoin.png" alt="" title="Donate Bitcoin" height="30" width="30">
        </a>
      </div>
    </div>
  </div>
</div>

<style>
  .layermenu-container {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 60;
  }

  .layermenu-inner {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .dropdown-menu,
  .utility-menu {
    background: rgba(255, 255, 255, 0.1);
    -webkit-backdrop-filter: blur(10px);
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
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    color: white;
    transform: scale(1.1);
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
    to {
      transform: rotate(360deg);
    }
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

  @media (max-width: 768px) {
    .dropdown-menu {
      min-width: 220px;
    }

    .dropdown-item {
      padding: 10px 12px;
      font-size: 13px;
    }
  }
</style>
