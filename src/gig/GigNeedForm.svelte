<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { MatchingVerticalConfig, GigFormField } from './verticals';
  import GlassmorphismButton from '../components/GlassmorphismButton.svelte';
  import LocationPicker from '../components/LocationPicker.svelte';

  export let config: MatchingVerticalConfig;
  export let userLiveLocation: { latitude: number; longitude: number } | null;
  export let destinationLat: string;
  export let destinationLon: string;
  export let onBack: () => void;
  export let onDestinationSelected: (lat: string, lon: string, displayName?: string) => void;
  export let onDestinationClear: () => void;
  export let onSubmit: (details: Record<string, string>) => void;

  let fieldValues: Record<string, string> = {};

  $: {
    for (const f of config.needFields) {
      if (!(f.key in fieldValues)) {
        fieldValues[f.key] = '';
      }
    }
  }

  function fieldValid(field: GigFormField, value: string): boolean {
    const trimmed = value?.trim();
    if (!trimmed) return true;
    if (field.pattern) return new RegExp(field.pattern).test(trimmed);
    return true;
  }

  $: groups = [...new Set(config.needFields.map(f => f.group).filter((g): g is string => !!g))];

  $: groupsSatisfied = groups.every(g => {
    const gf = config.needFields.filter(f => f.group === g);
    return gf.some(f => {
      const val = fieldValues[f.key]?.trim();
      return val && fieldValid(f, val);
    });
  });

  $: allPatternsValid = config.needFields.every(f => fieldValid(f, fieldValues[f.key]));

  $: canSubmit = userLiveLocation
    && (!config.hasDestination || (destinationLat && destinationLon))
    && config.needFields.filter(f => f.required).every(f => fieldValues[f.key]?.trim())
    && groupsSatisfied
    && allPatternsValid;

  function handleSubmit() {
    for (const f of config.needFields) {
      if (f.required && !fieldValues[f.key]?.trim()) return;
      if (!fieldValid(f, fieldValues[f.key])) return;
    }
    if (!groupsSatisfied) return;
    onSubmit({ ...fieldValues });
  }
</script>

<div class="need-form" transition:slide={{ duration: 300 }}>
  <button class="back-btn" on:click={onBack}>&larr; Back</button>
  <h3 class="form-title">{config.needLabel}</h3>

  <!-- GPS Location (always shown) -->
  <div class="form-group">
    <span class="field-label">{config.gpsLocationLabel} <span class="live-badge">LIVE</span></span>
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
    <LocationPicker
      lat={destinationLat}
      lon={destinationLon}
      label={config.mapPickLabel}
      onLocationSelected={onDestinationSelected}
      onClear={onDestinationClear}
    />
  {/if}

  {#each groups as g}
    {#if config.needFieldGroupHints?.[g]}
      <p class="group-context-hint">{config.needFieldGroupHints[g]}</p>
    {/if}
  {/each}

  {#each config.needFields as field (field.key)}
    <div class="form-group">
      <label class="field-label" for="need-{field.key}">
        {field.label}
        {#if field.required}<span class="required">*</span>{/if}
        {#if field.group}<span class="group-badge">*</span>{/if}
      </label>
      {#if field.type === 'textarea'}
        <textarea
          id="need-{field.key}"
          class="field-input textarea"
          class:invalid={fieldValues[field.key]?.trim() && !fieldValid(field, fieldValues[field.key])}
          placeholder={field.placeholder}
          bind:value={fieldValues[field.key]}
          rows="3"
        ></textarea>
      {:else}
        <input
          id="need-{field.key}"
          class="field-input"
          class:invalid={fieldValues[field.key]?.trim() && !fieldValid(field, fieldValues[field.key])}
          type="text"
          placeholder={field.placeholder}
          bind:value={fieldValues[field.key]}
        />
      {/if}
      {#if fieldValues[field.key]?.trim() && !fieldValid(field, fieldValues[field.key])}
        <span class="field-error">{field.patternHint ?? 'Invalid format'}</span>
      {/if}
    </div>
  {/each}

  {#if groups.length > 0 && !groupsSatisfied}
    <p class="group-warn">Please fill at least one field per group.</p>
  {/if}

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

  .field-input.invalid {
    border-color: rgba(239, 68, 68, 0.6);
  }

  .field-input.textarea {
    resize: vertical;
    min-height: 60px;
  }

  .field-error {
    font-size: 0.75rem;
    color: rgba(239, 68, 68, 0.8);
  }

  .group-badge {
    font-size: 0.65rem;
    color: rgba(255, 204, 0, 0.7);
    margin-left: 2px;
  }

  .group-context-hint {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.45);
    margin: 0;
    line-height: 1.4;
    font-style: italic;
  }

  .group-warn {
    font-size: 0.8rem;
    color: rgba(255, 204, 0, 0.9);
    margin: 0;
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
