<script lang="ts">
  import { onDestroy } from 'svelte';
  import { autocomplete, reverse, formatShortAddress, type NominatimResult } from '../services/nominatimService';
  import { flyToLocation } from '../store';
  import GlassmorphismButton from './GlassmorphismButton.svelte';

  export let lat: string = '';
  export let lon: string = '';
  export let label: string = 'Location';
  export let isPickingOnMap: boolean = false;
  export let onPickOnMap: () => void;
  export let onLocationSelected: (lat: string, lon: string, displayName?: string) => void;
  export let onClear: (() => void) | undefined = undefined;
  export let required: boolean = false;
  export let placeholder: string = 'Search an address or place...';

  let searchQuery = '';
  let suggestions: NominatimResult[] = [];
  let isLoading = false;
  let showDropdown = false;
  let displayName = '';
  let reverseLoading = false;
  let selectedIndex = -1;
  let inputEl: HTMLInputElement;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Reverse geocode whenever lat/lon changes (from map pick or address select)
  let lastReversedKey = '';
  $: if (lat && lon) {
    const key = `${lat}:${lon}`;
    if (key !== lastReversedKey) {
      lastReversedKey = key;
      if (!displayName) {
        reverseGeocode(parseFloat(lat), parseFloat(lon));
      }
    }
  } else {
    displayName = '';
    lastReversedKey = '';
  }

  async function reverseGeocode(latitude: number, longitude: number) {
    reverseLoading = true;
    try {
      const result = await reverse(latitude, longitude);
      if (result) {
        displayName = formatShortAddress(result);
      }
    } catch {
      displayName = '';
    } finally {
      reverseLoading = false;
    }
  }

  function handleInput() {
    selectedIndex = -1;
    if (debounceTimer) clearTimeout(debounceTimer);

    if (searchQuery.trim().length < 2) {
      suggestions = [];
      showDropdown = false;
      return;
    }

    isLoading = true;
    showDropdown = true;

    debounceTimer = setTimeout(async () => {
      try {
        suggestions = await autocomplete(searchQuery);
      } catch {
        suggestions = [];
      } finally {
        isLoading = false;
      }
    }, 400);
  }

  function selectSuggestion(result: NominatimResult) {
    const name = formatShortAddress(result);
    displayName = name;
    searchQuery = '';
    suggestions = [];
    showDropdown = false;
    selectedIndex = -1;
    lastReversedKey = `${result.lat}:${result.lon}`;
    onLocationSelected(result.lat, result.lon, name);

    flyToLocation.set({
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      showDropdown = false;
      selectedIndex = -1;
    }
  }

  function handleFocus() {
    if (suggestions.length > 0) {
      showDropdown = true;
    }
  }

  function handleBlur() {
    // Delay so click on suggestion fires before dropdown hides
    setTimeout(() => {
      showDropdown = false;
      selectedIndex = -1;
    }, 200);
  }

  function handleClear() {
    lat = '';
    lon = '';
    displayName = '';
    searchQuery = '';
    suggestions = [];
    showDropdown = false;
    lastReversedKey = '';
    if (onClear) onClear();
  }

  function handlePickAgain() {
    displayName = '';
    lastReversedKey = '';
    onPickOnMap();
  }

  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });
</script>

<div class="location-picker">
  <span class="field-label">
    {label}
    {#if required}<span class="required">*</span>{/if}
  </span>

  <!-- Search input -->
  <div class="search-wrapper">
    <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
    <input
      bind:this={inputEl}
      class="search-input"
      type="text"
      {placeholder}
      bind:value={searchQuery}
      on:input={handleInput}
      on:keydown={handleKeydown}
      on:focus={handleFocus}
      on:blur={handleBlur}
      autocomplete="off"
    />
    {#if isLoading}
      <div class="search-spinner"></div>
    {/if}
  </div>

  <!-- Autocomplete dropdown -->
  {#if showDropdown && suggestions.length > 0}
    <ul class="suggestions-list">
      {#each suggestions as suggestion, i}
        <li>
          <button
            class="suggestion-item"
            class:highlighted={i === selectedIndex}
            on:mousedown|preventDefault={() => selectSuggestion(suggestion)}
          >
            <svg class="suggestion-pin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span class="suggestion-text">{formatShortAddress(suggestion)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else if showDropdown && searchQuery.trim().length >= 2 && !isLoading}
    <div class="no-results">No results found</div>
  {/if}

  <!-- Divider -->
  <div class="divider">
    <span class="divider-line"></span>
    <span class="divider-text">or</span>
    <span class="divider-line"></span>
  </div>

  <!-- Map pick button -->
  <GlassmorphismButton variant="secondary" size="small" onClick={isPickingOnMap ? undefined : onPickOnMap}>
    <span class="map-btn-content">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
      {isPickingOnMap ? 'Click on the map...' : 'Pick Location on Map'}
    </span>
  </GlassmorphismButton>

  <!-- Selected location display -->
  {#if lat && lon}
    <div class="selected-location">
      <div class="selected-header">
        <span class="selected-label">Selected</span>
        <div class="selected-actions">
          <button class="action-link" on:click={handlePickAgain}>Pick again</button>
          <span class="action-sep">·</span>
          <button class="action-link" on:click={handleClear}>Clear</button>
        </div>
      </div>
      <p class="coords-display">
        {parseFloat(lat).toFixed(5)}, {parseFloat(lon).toFixed(5)}
      </p>
      {#if reverseLoading}
        <span class="address-loading">Looking up address...</span>
      {:else if displayName}
        <p class="address-display">{displayName}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .location-picker {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    position: relative;
  }

  .field-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
  }

  .required {
    color: rgba(239, 68, 68, 0.8);
    margin-left: 2px;
  }

  /* Search input */
  .search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 10px;
    color: rgba(255, 255, 255, 0.35);
    pointer-events: none;
    flex-shrink: 0;
  }

  .search-input {
    width: 100%;
    padding: 8px 32px 8px 30px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    font-size: 0.82rem;
    color: white;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }

  .search-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .search-input:focus {
    border-color: rgba(255, 255, 255, 0.35);
  }

  .search-spinner {
    position: absolute;
    right: 10px;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.15);
    border-top-color: rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Suggestions dropdown */
  .suggestions-list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    background: rgba(30, 30, 40, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    max-height: 180px;
    overflow-y: auto;
    z-index: 10;
  }

  .suggestion-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.78rem;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
    line-height: 1.35;
  }

  .suggestion-item:hover,
  .suggestion-item.highlighted {
    background: rgba(255, 255, 255, 0.1);
  }

  .suggestion-pin {
    flex-shrink: 0;
    margin-top: 1px;
    color: rgba(255, 255, 255, 0.4);
  }

  .suggestion-text {
    flex: 1;
    word-break: break-word;
  }

  .no-results {
    padding: 10px;
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.35);
    text-align: center;
    background: rgba(30, 30, 40, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
  }

  /* Divider */
  .divider {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0.15rem 0;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
  }

  .divider-text {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.3);
    text-transform: lowercase;
  }

  /* Map button content */
  .map-btn-content {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Selected location */
  .selected-location {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-top: 0.15rem;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
  }

  .selected-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .selected-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.45);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .selected-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .action-link {
    background: none;
    border: none;
    color: rgba(66, 133, 244, 0.8);
    font-size: 0.72rem;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    font-family: inherit;
  }

  .action-link:hover {
    color: rgba(66, 133, 244, 1);
  }

  .action-sep {
    color: rgba(255, 255, 255, 0.2);
    font-size: 0.72rem;
  }

  .coords-display {
    margin: 0;
    font-size: 0.82rem;
    color: rgba(74, 222, 128, 1);
    font-family: monospace;
  }

  .address-display {
    margin: 0;
    font-size: 0.76rem;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.35;
  }

  .address-loading {
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.3);
    font-style: italic;
  }
</style>
