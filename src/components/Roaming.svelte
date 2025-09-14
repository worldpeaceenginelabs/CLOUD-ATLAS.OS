<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { isRoamingAreaMode, roamingAreaBounds, coordinates } from '../store';
  import FormInput from './FormInput.svelte';
  import GlassmorphismButton from './GlassmorphismButton.svelte';

  // Props
  export let isEnabled = false;
  export let roamingSpeed = 1.0;
  export let roamingArea: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null = null;

  // Local state
  let isPaintingArea = false;
  let areaBounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null = null;

  // Local state for form input
  let roamingSpeedValue = roamingSpeed.toString();

  // Reactive statements
  $: if (roamingArea) {
    areaBounds = roamingArea;
  }
  
  // Update roamingSpeed when roamingSpeedValue changes
  $: if (roamingSpeedValue !== roamingSpeed.toString()) {
    roamingSpeed = parseFloat(roamingSpeedValue) || 1.0;
  }


  function startPaintingArea() {
    isPaintingArea = true;
    isRoamingAreaMode.set(true);
    // Dispatch event to disable camera controls
    window.dispatchEvent(new CustomEvent('startRoamingAreaPainting'));
  }

  function stopPaintingArea() {
    isPaintingArea = false;
    isRoamingAreaMode.set(false);
  }

  function clearArea() {
    areaBounds = null;
    roamingAreaBounds.set(null);
    roamingArea = null; // Clear the prop
  }

  function confirmArea() {
    if (areaBounds) {
      console.log('🎯 [ROAMING] Confirming area bounds:', areaBounds);
      roamingAreaBounds.set(areaBounds);
      roamingArea = areaBounds; // Update the prop to pass to parent
      console.log('🎯 [ROAMING] Updated roamingArea prop:', roamingArea);
    }
    stopPaintingArea();
  }

  function cancelPainting() {
    // Dispatch event to cancel painting mode
    window.dispatchEvent(new CustomEvent('cancelRoamingAreaPainting'));
    stopPaintingArea();
  }

  // Listen for area bounds updates from the map
  function handleAreaBoundsUpdate(event: CustomEvent) {
    const bounds = event.detail;
    if (bounds) {
      areaBounds = bounds;
    }
  }

  onMount(() => {
    window.addEventListener('roamingAreaBounds', handleAreaBoundsUpdate as EventListener);
  });

  onDestroy(() => {
    window.removeEventListener('roamingAreaBounds', handleAreaBoundsUpdate as EventListener);
  });
</script>

<div class="roaming-section">
  <h4>Roaming Settings</h4>
  
  <!-- Enable/Disable Roaming -->
  <div class="form-group">
    <label class="checkbox-option">
      <input 
        type="checkbox" 
        bind:checked={isEnabled}
        on:change={() => {
          if (!isEnabled) {
            // Clear area when disabling roaming
            areaBounds = null;
            roamingAreaBounds.set(null);
          }
        }}
      />
      <span>Enable Roaming</span>
    </label>
  </div>

  {#if isEnabled}
    <!-- Roaming Speed -->
    <FormInput
      type="number"
      bind:value={roamingSpeedValue}
      label="Roaming Speed (m/s)"
      min="0.1"
      max="10"
      step="0.1"
      placeholder="1.0"
    />

    <!-- Area Selection -->
    <div class="form-group">
      <div class="form-label">Roaming Area</div>
      <p class="area-description">
        Paint a square on the map to define the roaming area. The model will move randomly within this area.
      </p>
      
      {#if !areaBounds}
        <div class="area-controls">
          <GlassmorphismButton 
            variant="secondary" 
            onClick={startPaintingArea}
            disabled={isPaintingArea}
          >
            {isPaintingArea ? 'Painting...' : 'Paint Area'}
          </GlassmorphismButton>
          {#if isPaintingArea}
            <GlassmorphismButton 
              variant="secondary" 
              onClick={cancelPainting}
            >
              Cancel
            </GlassmorphismButton>
          {/if}
        </div>
      {:else if areaBounds}
        <div class="area-info">
          <div class="area-bounds">
            <span>North: {areaBounds?.north?.toFixed(4) || 'N/A'}</span>
            <span>South: {areaBounds?.south?.toFixed(4) || 'N/A'}</span>
            <span>East: {areaBounds?.east?.toFixed(4) || 'N/A'}</span>
            <span>West: {areaBounds?.west?.toFixed(4) || 'N/A'}</span>
          </div>
          <div class="area-actions">
            <GlassmorphismButton 
              variant="secondary" 
              onClick={startPaintingArea}
              disabled={isPaintingArea}
            >
              {isPaintingArea ? 'Painting...' : 'Redraw Area'}
            </GlassmorphismButton>
            <GlassmorphismButton 
              variant="secondary" 
              onClick={clearArea}
            >
              Clear Area
            </GlassmorphismButton>
          </div>
        </div>
      {/if}
    </div>

    {#if isPaintingArea}
      <div class="painting-instructions">
        <p>🎨 <strong>Painting Mode Active</strong> - Camera controls are disabled. Click two points on the map to paint the roaming area.</p>
        <div class="painting-actions">
          <GlassmorphismButton 
            variant="primary" 
            onClick={confirmArea}
            disabled={!areaBounds}
          >
            Confirm Area
          </GlassmorphismButton>
          <GlassmorphismButton 
            variant="secondary" 
            onClick={cancelPainting}
          >
            Cancel
          </GlassmorphismButton>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .roaming-section {
    margin-bottom: 25px;
  }

  .roaming-section h4 {
    color: white;
    margin: 0 0 15px 0;
    font-size: 1.1em;
    font-weight: 600;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding-bottom: 8px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 15px;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-group label,
  .form-label {
    color: white;
    font-weight: 500;
    font-size: 0.9em;
  }

  .area-description {
    color: rgba(255, 255, 255, 0.7);
    margin: 5px 0 15px 0;
    font-size: 0.9em;
    line-height: 1.4;
  }

  .checkbox-option {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: white;
    margin-bottom: 10px;
  }

  .checkbox-option input[type="checkbox"] {
    margin: 0;
  }

  .area-controls {
    display: flex;
    gap: 10px;
    margin-top: 10px;
  }

  .area-info {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 12px;
    margin-top: 10px;
  }

  .area-bounds {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
    font-family: monospace;
    font-size: 0.85em;
    color: rgba(255, 255, 255, 0.9);
  }

  .area-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .painting-instructions {
    background: rgba(74, 222, 128, 0.1);
    border: 1px solid rgba(74, 222, 128, 0.3);
    border-radius: 8px;
    padding: 12px;
    margin-top: 10px;
  }

  .painting-instructions p {
    color: rgba(255, 255, 255, 0.9);
    margin: 0 0 15px 0;
    font-size: 0.9em;
  }

  .painting-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
</style>
