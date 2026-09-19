<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { globe, type RoutePreview } from '../cesium/api';
  import { autocomplete, reverse, formatShortAddress, type NominatimResult } from '../services/nominatimService';
  import CloseButton from '../shared/CloseButton.svelte';

  /** Local to this component — not shared with or imported from cesium/api.ts. */
  type LocalCoords = { longitude: number; latitude: number };
  /** Local to this component — not shared with or imported from cesium/api.ts. */
  type LocalBox = { west: number; south: number; east: number; north: number };

  /**
   * A `transform` on ANY ancestor (e.g. a modal wrapper's own
   * centering transform) creates a new CSS containing block for
   * `position: fixed` descendants — this component's `left`/`top`
   * percentages would then resolve against that ancestor's box instead
   * of the viewport, wherever it happens to be mounted. Moving this
   * component's actual DOM node to document.body sidesteps that
   * entirely, regardless of which parent renders <Location>.
   */
  function portal(node: HTMLElement): { destroy(): void } {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      }
    };
  }

  export let geometry: 'point' | 'route' | 'area' = 'point';

  const dispatch = createEventDispatcher<{
    confirm:
      | {
          geometry: 'point';
          point: { latitude: number; longitude: number };
        }
      | {
          geometry: 'route';
          from: { latitude: number; longitude: number };
          to: { latitude: number; longitude: number };
        }
      | {
          geometry: 'area';
          area: LocalBox;
        };
    cancel: void;
  }>();

  let status: 'locating' | 'picking' | 'previewing' | 'error' = 'locating';
  let errorMessage = '';

  let zoomRequired = false;
  let zoomRequiredTimer: ReturnType<typeof setTimeout> | undefined;

  function requireZoom(): void {
    zoomRequired = true;
    if (zoomRequiredTimer) clearTimeout(zoomRequiredTimer);
    zoomRequiredTimer = setTimeout(() => (zoomRequired = false), 3000);
  }

  let fromCoords: LocalCoords | null = null;
  let toCoords: LocalCoords | null = null;
  let preview: RoutePreview | null = null;
  let areaBox: LocalBox | null = null;

  // Reverse-geocoded labels for the "Selected" card(s). Address search
  // fills these directly (selectAddress); a globe click leaves them
  // blank, which the reactive block below fills in via reverse().
  let fromAddress = '';
  let toAddress = '';
  let fromAddressLoading = false;
  let toAddressLoading = false;

  function clearPreview(): void {
    preview?.remove();
    preview = null;

    // No-op if no area picker was ever enabled (point/route geometry) —
    // globe.pick.area.clear() is safe to call regardless, same as
    // globe.pick.clear() below already is for point/route.
    globe.pick.area.clear();
    areaBox = null;
  }

  function handleAreaSelect(box: LocalBox): void {
    areaBox = box;
    status = 'previewing';
  }

  function handlePick(coords: LocalCoords | null): void {
    if (!coords) return;

    if (geometry === 'point') {
      fromCoords = coords;
      // Clear the previous pick's label so the reactive block below
      // re-fetches for the new coords instead of leaving it stale —
      // selectAddress() re-applies its own label right after this runs.
      fromAddress = '';
      fromAddressLoading = false;
      status = 'previewing';
      return;
    }

    if (!fromCoords) return;

    toCoords = coords;
    toAddress = '';
    toAddressLoading = false;

    clearPreview();
    preview = globe.route.preview(fromCoords, toCoords);
    status = 'previewing';
  }

  function pickAgain(): void {
    toCoords = null;
    toAddress = '';
    toAddressLoading = false;
    clearPreview();
    globe.pick.clear();
    status = 'picking';
  }

  let fromAddressRequestId = 0;
  let toAddressRequestId = 0;

  async function loadAddress(coords: LocalCoords, target: 'from' | 'to'): Promise<void> {
    const requestId = target === 'from' ? ++fromAddressRequestId : ++toAddressRequestId;

    if (target === 'from') fromAddressLoading = true;
    else toAddressLoading = true;

    try {
      const result = await reverse(coords.latitude, coords.longitude);
      const label = result ? formatShortAddress(result) : '';

      // A newer pick may have started (and possibly already resolved)
      // while this request was in flight — don't overwrite it with a
      // stale result.
      if (target === 'from' && requestId !== fromAddressRequestId) return;
      if (target === 'to' && requestId !== toAddressRequestId) return;

      if (target === 'from') fromAddress = label;
      else toAddress = label;
    } catch {
      if (target === 'from' && requestId === fromAddressRequestId) fromAddress = '';
      if (target === 'to' && requestId === toAddressRequestId) toAddress = '';
    } finally {
      if (target === 'from' && requestId === fromAddressRequestId) fromAddressLoading = false;
      if (target === 'to' && requestId === toAddressRequestId) toAddressLoading = false;
    }
  }

  // Fill in the address for whichever point is shown but wasn't already
  // labeled by selectAddress() below (i.e. it came from a globe click).
  $: if (status === 'previewing' && fromCoords && !fromAddress && !fromAddressLoading) {
    loadAddress(fromCoords, 'from');
  }
  $: if (status === 'previewing' && geometry === 'route' && toCoords && !toAddress && !toAddressLoading) {
    loadAddress(toCoords, 'to');
  }

  // -- Address search (picking phase only; 'area' has no address concept) --

  let searchQuery = '';
  let suggestions: NominatimResult[] = [];
  let searchLoading = false;
  let showDropdown = false;
  let selectedIndex = -1;
  let searchInput: HTMLInputElement;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function handleSearchInput(): void {
    selectedIndex = -1;
    if (debounceTimer) clearTimeout(debounceTimer);

    if (searchQuery.trim().length < 2) {
      suggestions = [];
      showDropdown = false;
      return;
    }

    searchLoading = true;
    showDropdown = true;

    debounceTimer = setTimeout(async () => {
      try {
        suggestions = await autocomplete(searchQuery);
      } catch {
        suggestions = [];
      } finally {
        searchLoading = false;
      }
    }, 400);
  }

  function selectAddress(result: NominatimResult): void {
    const coords: LocalCoords = {
      longitude: parseFloat(result.lon),
      latitude: parseFloat(result.lat)
    };

    // fromCoords is only already set here if this is a route's "to" pick
    // (its "from" comes from GPS before picking even starts) — same
    // branch handlePick() itself uses to tell the two apart. Captured
    // before pick.select() below, which is what actually assigns
    // fromCoords/toCoords via handlePick().
    const isFromPick = !fromCoords;

    searchQuery = '';
    suggestions = [];
    showDropdown = false;
    selectedIndex = -1;
    searchInput?.blur();

    globe.camera.flyTo({ longitude: coords.longitude, latitude: coords.latitude });
    // Draws the same marker a click would and runs it through handlePick
    // via the onPick callback passed to globe.pick.enable() in onMount —
    // no separate point/route branching needed here. handlePick() clears
    // fromAddress/toAddress as part of that, so the label below is set
    // afterward, overwriting the clear rather than being overwritten by it.
    globe.pick.select(coords);

    if (isFromPick) {
      fromAddress = formatShortAddress(result);
    } else {
      toAddress = formatShortAddress(result);
    }
  }

  function handleSearchKeydown(e: KeyboardEvent): void {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      selectAddress(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      showDropdown = false;
      selectedIndex = -1;
    }
  }

  function handleSearchFocus(): void {
    if (suggestions.length > 0) showDropdown = true;
  }

  function handleSearchBlur(): void {
    // Delay so a click on a suggestion fires before the dropdown hides.
    setTimeout(() => {
      showDropdown = false;
      selectedIndex = -1;
    }, 200);
  }

  function confirm(): void {
    if (geometry === 'area') {
      if (!areaBox) return;

      // Keep the drawn rectangle. Same treatment as point/route below:
      // the Location hex is now green, HexMenu (or whichever parent
      // mounted this) owns clearing it when the workflow is reset.
      globe.pick.area.disable();

      dispatch('confirm', {
        geometry: 'area',
        area: { ...areaBox }
      });

      return;
    }

    if (geometry === 'point') {
      if (!fromCoords) return;

      // Keep the picker preview. The Location hex is now green,
      // and HexMenu owns clearing it when the workflow is reset.
      globe.pick.disable();

      dispatch('confirm', {
        geometry: 'point',
        point: {
          latitude: fromCoords.latitude,
          longitude: fromCoords.longitude
        }
      });

      return;
    }

    if (!fromCoords || !toCoords) return;

    clearPreview();
    globe.pick.disable();

    dispatch('confirm', {
      geometry: 'route',
      from: {
        latitude: fromCoords.latitude,
        longitude: fromCoords.longitude
      },
      to: {
        latitude: toCoords.latitude,
        longitude: toCoords.longitude
      }
    });
  }

  function cancel(): void {
    clearPreview();
    globe.pick.clear();
    globe.pick.disable();
    // No-op for point/route, same reasoning as clearPreview()'s
    // globe.pick.area.clear() above.
    globe.pick.area.disable();
    dispatch('cancel');
  }

  onMount(async () => {
    try {
      if (geometry === 'route') {
        fromCoords = await globe.location.getCurrentPosition();
      }

      status = 'picking';

      if (geometry === 'area') {
        globe.pick.area.enable(handleAreaSelect, undefined, requireZoom);
      } else {
        globe.pick.enable(handlePick, requireZoom);
      }
    } catch (err) {
      status = 'error';
      errorMessage =
        err instanceof Error
          ? err.message
          : 'Position konnte nicht ermittelt werden.';
    }
  });

  onDestroy(() => {
    // Do not clear the picker here. After a successful confirm,
    // HexMenu owns the confirmed location and clears the preview
    // when that workflow state is reset.
    clearPreview();
    globe.pick.disable();
    globe.pick.area.disable();
    if (zoomRequiredTimer) clearTimeout(zoomRequiredTimer);
    if (debounceTimer) clearTimeout(debounceTimer);
  });
</script>

<div class="modal" use:portal role="dialog" aria-modal="true" aria-label="Location">

  <CloseButton onClose={cancel} />

  <h2>LOCATION</h2>

  {#if status === 'locating'}
    <p class="hint">Determining your location…</p>

  {:else if status === 'error'}
    <p class="error">{errorMessage}</p>

  {:else if status === 'picking'}
    <p class="hint">
      {geometry === 'point'
        ? 'Select a location on the globe or search for an address.'
        : geometry === 'area'
          ? 'Drag to select an area on the globe.'
          : 'Select the destination point on the globe or search for an address.'}
    </p>

    {#if geometry !== 'area'}
      <div class="search-wrapper">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          bind:this={searchInput}
          class="search-input"
          type="text"
          placeholder="Search an address or place..."
          bind:value={searchQuery}
          on:input={handleSearchInput}
          on:keydown={handleSearchKeydown}
          on:focus={handleSearchFocus}
          on:blur={handleSearchBlur}
          autocomplete="off"
        />
        {#if searchLoading}
          <div class="search-spinner"></div>
        {/if}

        {#if showDropdown && suggestions.length > 0}
          <ul class="suggestions-list suggestions-down">
            {#each suggestions as suggestion, i}
              <li>
                <button
                  class="suggestion-item"
                  class:highlighted={i === selectedIndex}
                  on:mousedown|preventDefault={() => selectAddress(suggestion)}
                >
                  <svg class="suggestion-pin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span class="suggestion-text">{formatShortAddress(suggestion)}</span>
                </button>
              </li>
            {/each}
          </ul>
        {:else if showDropdown && searchQuery.trim().length >= 2 && !searchLoading}
          <div class="no-results suggestions-down">No results found</div>
        {/if}
      </div>
    {/if}

  {:else if status === 'previewing'}
    <p class="hint">
      {geometry === 'point'
        ? 'Location selected.'
        : geometry === 'area'
          ? 'Area selected.'
          : 'Route selected.'}
    </p>

    {#if geometry !== 'area'}
      {#if fromCoords}
        <div class="selectcard">
          <div class="selected-header">
            <span class="selected-label">{geometry === 'route' ? 'From' : 'Selected'}</span>
          </div>
          <p class="coords-display">{fromCoords.latitude.toFixed(5)}, {fromCoords.longitude.toFixed(5)}</p>
          {#if fromAddressLoading}
            <span class="address-loading">Looking up address...</span>
          {:else if fromAddress}
            <p class="address-display">{fromAddress}</p>
          {/if}
        </div>
      {/if}

      {#if geometry === 'route' && toCoords}
        <div class="selectcard">
          <div class="selected-header">
            <span class="selected-label">To</span>
          </div>
          <p class="coords-display">{toCoords.latitude.toFixed(5)}, {toCoords.longitude.toFixed(5)}</p>
          {#if toAddressLoading}
            <span class="address-loading">Looking up address...</span>
          {:else if toAddress}
            <p class="address-display">{toAddress}</p>
          {/if}
        </div>
      {/if}
    {/if}
  {/if}

  <div class="actions">

    {#if status === 'previewing'}
      <button class="primary" on:click={confirm}>
        {geometry === 'point'
          ? 'Use this location'
          : geometry === 'area'
            ? 'Use this area'
            : 'Use this route'}
      </button>

      {#if geometry === 'route'}
        <button class="secondary" on:click={pickAgain}>
          Pick again
        </button>
      {/if}

    {:else if status === 'error'}
      <button class="secondary" on:click={cancel}>
        Close
      </button>

    {:else if status === 'picking'}
      <button class="secondary" on:click={cancel}>
        Cancel
      </button>
    {/if}

  </div>

</div>

{#if zoomRequired}
  <div class="zoom-required" use:portal>
    Zoom in closer to pick a precise location.
  </div>
{/if}
<style>
  .modal {
    position: fixed;
    top: 50%;
    left: 25%;
    transform: translate(-50%, -50%);
    z-index: 999;
    background: #161616;

    border-radius: 14px;
    padding: 28px 24px 24px;
    width: min(360px, 44vw);
    box-sizing: border-box;
    border-left: 3px solid;
    border-image: linear-gradient(180deg, #335bf4, #2ae9c9) 1;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  @media (max-width: 700px) {
    .modal {
      top: 25%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: min(360px, 92vw);
    }
  }

  h2 {
    margin: 0 0 6px;
    color: #fff;
    font-size: 1em;
    letter-spacing: 1.5px;
    text-align: center;
  }

  .hint {
    margin: 0 0 18px;
    color: #888;
    font-size: 0.78em;
    text-align: center;
  }

  /* Address search – ported from LocationPicker.svelte */
  .search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    margin: 0 0 18px;
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

  /* Suggestions dropdown — opens downward here (search box sits near the
     top of the modal, not above a bottom toolbar like in LocationPicker). */
  .suggestions-down {
    position: absolute;
    left: 0;
    right: 0;
    top: calc(100% + 6px);
    z-index: 20;
  }

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

  /* Selected location card(s) — ported from LocationPicker.svelte */
  .selectcard {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin: 0 0 10px;
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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

  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  button {
    border-radius: 10px;
    padding: 11px 12px;
    font-size: 0.9em;
    font-weight: 600;
    cursor: pointer;
  }

  .primary {
    border: 1.5px solid;
    border-image: linear-gradient(90deg, #335bf4, #2ae9c9) 1;
    background: #111;
    color: #fff;
  }

  .primary:hover {
    background: rgba(51, 91, 244, 0.38);
  }

  .secondary {
    background: #111;
    border: 1px solid #333;
    color: #aaa;
  }

  .secondary:hover {
    color: #fff;
    border-color: #666;
  }

  .error {
    color: #e05252;
    text-align: center;
  }

  .zoom-required {
    position: fixed;
    top: 50%;
    right: 25%;
    transform: translate(50%, -50%);
    z-index: 9999;

    padding: 10px 16px;
    border-radius: 12px;

    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.15);

    color: rgba(255, 255, 255, 0.9);
    font-size: 0.9rem;
    white-space: nowrap;
  }
</style>
