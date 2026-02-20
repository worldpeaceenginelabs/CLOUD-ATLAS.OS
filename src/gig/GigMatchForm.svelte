<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { MatchingVerticalConfig } from './verticals';
  import { fieldValid, getGroups, groupsSatisfied as checkGroupsSatisfied, allPatternsValid as checkAllPatternsValid } from './formValidation';
  import { formatLatLon } from '../utils/urlUtils';
  import GlassmorphismButton from '../components/GlassmorphismButton.svelte';
  import LocationPicker from '../components/LocationPicker.svelte';

  export let config: MatchingVerticalConfig;
  export let role: 'need' | 'offer';
  export let userLiveLocation: { latitude: number; longitude: number } | null;
  export let destinationLat = '';
  export let destinationLon = '';
  export let onBack: () => void;
  export let onDestinationSelected: ((lat: string, lon: string, displayName?: string) => void) | undefined = undefined;
  export let onDestinationClear: (() => void) | undefined = undefined;
  export let onSubmit: (details: Record<string, string>) => void;

  $: isNeed = role === 'need';
  $: fields = isNeed ? config.needFields : config.offerFields;
  $: groupHints = isNeed ? config.needFieldGroupHints : config.offerFieldGroupHints;
  $: formTitle = isNeed ? config.needLabel : config.offerLabel;
  $: locationLabel = isNeed ? config.gpsLocationLabel : 'Your Location';

  let fieldValues: Record<string, string> = {};

  $: {
    for (const f of fields) {
      if (!(f.key in fieldValues)) {
        fieldValues[f.key] = '';
      }
    }
  }

  $: groups = getGroups(fields);
  $: groupsSatisfied = checkGroupsSatisfied(fields, fieldValues);
  $: allPatternsValid = checkAllPatternsValid(fields, fieldValues);

  $: canSubmit = userLiveLocation
    && (!isNeed || !config.hasDestination || (destinationLat && destinationLon))
    && fields.filter(f => f.required).every(f => fieldValues[f.key]?.trim())
    && groupsSatisfied
    && allPatternsValid;

  function handleSubmit() {
    for (const f of fields) {
      if (f.required && !fieldValues[f.key]?.trim()) return;
      if (!fieldValid(f, fieldValues[f.key])) return;
    }
    if (!groupsSatisfied) return;
    onSubmit({ ...fieldValues });
  }
</script>

<div class="match-form" transition:slide={{ duration: 300 }}>
  <button class="gig-back-btn" on:click={onBack}>&larr; Back</button>
  <h3 class="gig-form-title">{formTitle}</h3>

  <div class="gig-form-group">
    <span class="gig-field-label">{locationLabel} <span class="gig-live-badge">LIVE</span></span>
    <p class="location-display">
      {#if userLiveLocation}
        {formatLatLon(userLiveLocation.latitude, userLiveLocation.longitude)}
      {:else}
        <span class="location-hint">Waiting for GPS... Enable location services if this persists.</span>
      {/if}
    </p>
  </div>

  {#if isNeed && config.hasDestination && onDestinationSelected && onDestinationClear}
    <LocationPicker
      lat={destinationLat}
      lon={destinationLon}
      label={config.mapPickLabel}
      onLocationSelected={onDestinationSelected}
      onClear={onDestinationClear}
    />
  {/if}

  {#if !isNeed && fields.length === 0}
    <p class="hint">
      You'll be matched with {config.requesterNoun}s in your geohash cell
      (~1.2 km × 0.6 km area around your location).
      Discovery and matching happen fully peer-to-peer.
    </p>
  {/if}

  {#each groups as g}
    {#if groupHints?.[g]}
      <p class="group-context-hint">{groupHints[g]}</p>
    {/if}
  {/each}

  {#each fields as field (field.key)}
    <div class="gig-form-group">
      <label class="gig-field-label" for="{role}-{field.key}">
        {field.label}
        {#if field.required}<span class="gig-required">*</span>{/if}
        {#if field.group}<span class="group-badge">*</span>{/if}
      </label>
      {#if field.type === 'textarea'}
        <textarea
          id="{role}-{field.key}"
          class="gig-field-input textarea"
          class:invalid={fieldValues[field.key]?.trim() && !fieldValid(field, fieldValues[field.key])}
          placeholder={field.placeholder}
          bind:value={fieldValues[field.key]}
          rows="3"
        ></textarea>
      {:else}
        <input
          id="{role}-{field.key}"
          class="gig-field-input"
          class:invalid={fieldValues[field.key]?.trim() && !fieldValid(field, fieldValues[field.key])}
          type="text"
          placeholder={field.placeholder}
          bind:value={fieldValues[field.key]}
        />
      {/if}
      {#if fieldValues[field.key]?.trim() && !fieldValid(field, fieldValues[field.key])}
        <span class="gig-field-error">{field.patternHint ?? 'Invalid format'}</span>
      {/if}
    </div>
  {/each}

  {#if groups.length > 0 && !groupsSatisfied}
    <p class="group-warn">{isNeed ? 'Please fill at least one field per group.' : 'Please provide at least a phone number or messenger link.'}</p>
  {/if}

  <GlassmorphismButton variant="primary" fullWidth={true} onClick={handleSubmit} disabled={!canSubmit}>
    {isNeed ? 'Submit' : 'Start Offering'}
  </GlassmorphismButton>
</div>

<style>
  .match-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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

  .hint {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
    line-height: 1.4;
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
</style>
