<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { VerticalConfig } from './verticals';
  import GlassmorphismButton from '../components/GlassmorphismButton.svelte';

  export let config: VerticalConfig;
  export let userLiveLocation: { latitude: number; longitude: number } | null;
  export let destinationLat: string;
  export let destinationLon: string;
  export let isPickingDestination: boolean;
  export let onBack: () => void;
  export let onPickDestination: () => void;
  export let onSubmit: (details: Record<string, string>) => void;

  // Local state for extra form fields
  let fieldValues: Record<string, string> = {};

  // Initialize field values from config
  $: {
    for (const f of config.needFields) {
      if (!(f.key in fieldValues)) {
        fieldValues[f.key] = '';
      }
    }
  }

  function handleSubmit() {
    // Validate required fields
    for (const f of config.needFields) {
      if (f.required && !fieldValues[f.key]?.trim()) {
        return;
      }
    }
    onSubmit({ ...fieldValues });
  }

  $: canSubmit = userLiveLocation
    && (!config.hasDestination || (destinationLat && destinationLon))
    && config.needFields.filter(f => f.required).every(f => fieldValues[f.key]?.trim());
</script>

<div class="need-form" transition:slide={{ duration: 300 }}>
  <button class="back-btn" on:click={onBack}>&larr; Back</button>
  <h3 class="form-title">{config.needLabel}</h3>

  <!-- Start Location (always shown) -->
  <div class="form-group">
    <span class="field-label">Your Location <span class="live-badge">LIVE</span></span>
    <p class="location-display">
      {#if userLiveLocation}
        {userLiveLocation.latitude.toFixed(5)}, {userLiveLocation.longitude.toFixed(5)}
      {:else}
        <span class="location-hint">Waiting for GPS... Enable location services if this persists.</span>
      {/if}
    </p>
  </div>

  <!-- Destination (if vertical uses it) -->
  {#if config.hasDestination}
    <div class="form-group">
      <span class="field-label">Destination</span>
      {#if destinationLat && destinationLon}
        <p class="location-display">
          {parseFloat(destinationLat).toFixed(5)}, {parseFloat(destinationLon).toFixed(5)}
        </p>
        <button class="pick-again-btn" on:click={onPickDestination}>Pick again</button>
      {:else}
        <GlassmorphismButton variant="secondary" size="small" onClick={onPickDestination}>
          {isPickingDestination ? 'Click on the map...' : 'Pick Destination on Map'}
        </GlassmorphismButton>
      {/if}
    </div>
  {/if}

  <!-- Extra fields from vertical config -->
  {#each config.needFields as field (field.key)}
    <div class="form-group">
      <label class="field-label" for="need-{field.key}">
        {field.label}
        {#if field.required}<span class="required">*</span>{/if}
      </label>
      {#if field.type === 'textarea'}
        <textarea
          id="need-{field.key}"
          class="field-input textarea"
          placeholder={field.placeholder}
          bind:value={fieldValues[field.key]}
          rows="3"
        ></textarea>
      {:else}
        <input
          id="need-{field.key}"
          class="field-input"
          type="text"
          placeholder={field.placeholder}
          bind:value={fieldValues[field.key]}
        />
      {/if}
    </div>
  {/each}

  <GlassmorphismButton
    variant="primary"
    fullWidth={true}
    onClick={handleSubmit}
    disabled={!canSubmit}
  >
    Submit
  </GlassmorphismButton>
</div>

<style>
  .need-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .back-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0;
    margin-bottom: 0.25rem;
    transition: color 0.2s;
    text-align: left;
  }

  .back-btn:hover {
    color: white;
  }

  .form-title {
    margin: 0 0 0.25rem 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: white;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
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

  .location-display {
    margin: 0;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    font-size: 0.85rem;
    color: rgba(74, 222, 128, 1);
    font-family: monospace;
  }

  .location-hint {
    color: rgba(255, 255, 255, 0.4);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .pick-again-btn {
    background: none;
    border: none;
    color: rgba(66, 133, 244, 0.8);
    font-size: 0.78rem;
    cursor: pointer;
    padding: 2px 0;
    text-align: left;
    text-decoration: underline;
  }

  .pick-again-btn:hover {
    color: rgba(66, 133, 244, 1);
  }

  .field-input {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    font-size: 0.85rem;
    color: white;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }

  .field-input::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .field-input:focus {
    border-color: rgba(255, 255, 255, 0.35);
  }

  .field-input.textarea {
    resize: vertical;
    min-height: 60px;
  }

  .live-badge {
    display: inline-block;
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #34a853;
    background: rgba(52, 168, 83, 0.15);
    border: 1px solid rgba(52, 168, 83, 0.3);
    border-radius: 4px;
    padding: 1px 5px;
    margin-left: 4px;
    vertical-align: middle;
    animation: livePulse 2s ease-in-out infinite;
  }

  @keyframes livePulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
