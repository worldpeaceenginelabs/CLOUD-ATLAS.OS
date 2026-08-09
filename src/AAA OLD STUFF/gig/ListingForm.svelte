<script lang="ts">
  import { onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { gigCanClose, bumpLayerRefresh } from '../store';
  import type { Listing, ListingMode, ListingVertical } from '../types';
  import type { NostrService } from '../services/nostrService';
  import { getCurrentTimeIso8601 } from '../utils/timeUtils';
  import { encode as geohashEncode } from '../utils/geohash';
  import { ListingService } from '../services/listingService';
  import { LISTING_CATEGORIES, type ListingVerticalConfig } from './verticals';
  import { getCategoryName } from './categoryUtils';
  import { GEOHASH_PRECISION_LISTING } from './constants';
  import GlassmorphismButton from '../components/GlassmorphismButton.svelte';
  import RelayStatus from '../components/RelayStatus.svelte';
  import LocationPicker from '../components/LocationPicker.svelte';
  import { matchesUrlPattern } from '../utils/urlUtils';

  export let config: ListingVerticalConfig;
  export let nostr: NostrService;
  export let onBack: () => void;

  $: vertical = config.id as ListingVertical;
  $: categories = LISTING_CATEGORIES[vertical] ?? [];
  $: serviceTag = config.listingTag;

  type ListingView = 'form' | 'publishing' | 'live';
  let currentView: ListingView = 'form';

  $: gigCanClose.set(currentView === 'form');

  let mode: ListingMode = config.defaultMode ?? 'in-person';
  let title = '';
  let selectedCategory = '';
  let eventDate = '';
  let description = '';
  let contact = '';
  let locationLat = '';
  let locationLon = '';
  let locationAddress = '';

  let listingService: ListingService | null = null;
  let relayCount = 0;
  let relayTotal = 0;
  let publishError = '';

  $: needsLocation = mode === 'in-person' || mode === 'both' || !!config.defaultMode;

  $: formContact = config.contactApps?.[0];
  $: contactPlaceholder = formContact?.placeholderExamples?.length
    ? formContact.placeholderExamples.join(' or ')
    : config.contactPlaceholder;
  $: contactMaxLength = formContact?.contactMaxLength ?? config.contactMaxLength ?? 120;
  $: contactPatterns = (config.contactApps ?? [])
    .map((v) => v.urlPattern)
    .filter((p): p is string => !!p && p.trim().length > 0);
  $: contactValid =
    contact.trim().length > 0 &&
    contactPatterns.length > 0 &&
    contactPatterns.some((p) => matchesUrlPattern(contact, p));

  $: hasCategories = categories.length > 0;

  $: canSubmit =
    (!hasCategories || selectedCategory) &&
    title.trim() &&
    description.trim() &&
    contactValid &&
    (!needsLocation || (locationLat && locationLon));

  function handleLocationSelected(lat: string, lon: string, displayName?: string) {
    locationLat = lat;
    locationLon = lon;
    locationAddress = displayName ?? '';
  }

  async function submitListing() {
    if (!canSubmit) return;
    publishError = '';
    currentView = 'publishing';

    const hasLocation = needsLocation && locationLat && locationLon;
    const location = hasLocation ? {
      latitude: parseFloat(locationLat),
      longitude: parseFloat(locationLon),
    } : undefined;

    const geohash = location
      ? geohashEncode(location.latitude, location.longitude, GEOHASH_PRECISION_LISTING)
      : undefined;

    listingService = new ListingService(nostr, serviceTag, {
      onRelayStatus: (connected: number, total: number) => {
        relayCount = connected;
        relayTotal = total;
      },
    });

    const listing: Listing = {
      id: crypto.randomUUID(),
      pubkey: listingService.pubkey,
      mode,
      category: selectedCategory,
      title: title.trim(),
      description: description.trim(),
      contact: contact.trim(),
      location,
      address: locationAddress || undefined,
      timestamp: getCurrentTimeIso8601(),
      geohash,
      ...(config.hasEventDate && { eventDate: eventDate || undefined }),
    };

    try {
      const result = await listingService.publishListing(listing);
      if (result.outcome === 'verified_synced' || result.outcome === 'verified_partial') {
        currentView = 'live';
      } else if (result.outcome === 'verify_pending') {
        publishError = 'Published, relay sync pending. Please check again in a moment.';
        currentView = 'form';
      } else {
        publishError = 'Publishing failed. Please check relay connection and try again.';
        currentView = 'form';
      }
    } catch {
      publishError = 'Publishing failed. Please check relay connection and try again.';
      currentView = 'form';
    }
  }

  function handleDone() {
    cleanup();
    bumpLayerRefresh(vertical);
    onBack();
  }

  function cleanup() {
    if (listingService) {
      listingService.stop();
      listingService = null;
    }
    relayCount = 0;
    relayTotal = 0;
    gigCanClose.set(true);
  }

  onDestroy(cleanup);

  $: categoryName = getCategoryName(categories, selectedCategory);
  $: modeLabel = mode === 'in-person' ? 'In-Person' : mode === 'online' ? 'Online' : 'In-Person & Online';
</script>

{#if currentView === 'form'}
  <div class="listing-form" transition:slide={{ duration: 300 }}>
    <button class="gig-back-btn" on:click={onBack}>&larr; Back</button>
    <h3 class="gig-form-title">{config.formTitle}</h3>
    <p class="gig-form-subtitle">{config.formSubtitle}</p>
    {#if publishError}
      <p class="gig-form-subtitle" style="color: rgba(252, 165, 165, 1);">{publishError}</p>
    {/if}

    {#if config.directiveNoun}
      <div class="directive-banner">
        <p class="directive-quote">
          <strong>Our Main Directive:</strong> "Make the world work for 100% of humanity,
          in the shortest possible time, through spontaneous cooperation, without ecological
          offense or the disadvantage of anyone." — Buckminster Fuller
        </p>
        <p class="directive-rule">
          <strong>One Rule:</strong> If your {config.directiveNoun} does not meet this standard,
          iterating a better one is mandatory.
        </p>
      </div>
    {/if}

    {#if !config.defaultMode}
      <div class="gig-mode-selector">
        <button class="gig-mode-btn" class:active={mode === 'in-person'} on:click={() => mode = 'in-person'}>In-Person</button>
        <button class="gig-mode-btn" class:active={mode === 'online'} on:click={() => mode = 'online'}>Online</button>
        <button class="gig-mode-btn" class:active={mode === 'both'} on:click={() => mode = 'both'}>Both</button>
      </div>
    {/if}

    <div class="gig-form-group">
      <label class="gig-field-label" for="event-title">{config.titleLabel} <span class="gig-required">*</span></label>
      <input id="event-title" class="gig-field-input" type="text" placeholder={config.titlePlaceholder} bind:value={title} maxlength={100} />
    </div>

    {#if needsLocation}
      <LocationPicker lat={locationLat} lon={locationLon} onLocationSelected={handleLocationSelected} />
    {/if}

    {#if hasCategories}
      <div class="gig-form-group">
        <label class="gig-field-label" for="category">Category <span class="gig-required">*</span></label>
        <div class="gig-category-grid">
          {#each categories as cat}
            <button
              class="gig-category-chip"
              class:selected={selectedCategory === cat.id}
              on:click={() => selectedCategory = cat.id}
              title={cat.description}
              style:--sel-bg="color-mix(in srgb, {config.color} 20%, transparent)"
              style:--sel-border="color-mix(in srgb, {config.color} 50%, transparent)"
              style:--sel-color={config.color}
            >{cat.name}</button>
          {/each}
        </div>
        {#if selectedCategory}
          <p class="gig-category-desc">{categories.find(c => c.id === selectedCategory)?.description}</p>
        {/if}
      </div>
    {/if}

    {#if config.hasEventDate}
      <div class="gig-form-group">
        <label class="gig-field-label" for="event-date">Date & Time</label>
        <input id="event-date" class="gig-field-input date-input" type="datetime-local" bind:value={eventDate} />
        <span class="gig-field-hint">Optional — leave empty for recurring or open-ended events</span>
      </div>
    {/if}

    <div class="gig-form-group">
      <label class="gig-field-label" for="listing-desc">Description <span class="gig-required">*</span></label>
      <textarea id="listing-desc" class="gig-field-input textarea" placeholder={config.descriptionPlaceholder} bind:value={description} rows="3" maxlength={500}></textarea>
    </div>

    <div class="gig-form-group">
      <label class="gig-field-label" for="contact-link">
        {formContact?.contactLabel ?? config.contactLabel} <span class="gig-required">*</span>
      </label>
      <input id="contact-link" class="gig-field-input" type="text" placeholder={contactPlaceholder} bind:value={contact} maxlength={contactMaxLength} />
      <span class="gig-field-hint">{formContact?.contactHint ?? config.contactHint}</span>
    </div>

    <GlassmorphismButton variant="primary" fullWidth={true} onClick={submitListing} disabled={!canSubmit}>
      {config.submitLabel}
    </GlassmorphismButton>
  </div>

{:else if currentView === 'publishing'}
  <div class="listing-form" transition:slide={{ duration: 300 }}>
    <h3 class="gig-form-title">Publishing...</h3>
    <div class="gig-status-indicator">
      <div class="gig-pulse-dot" style="background: {config.color}"></div>
      <span>Publishing and verifying relay sync...</span>
    </div>
    <RelayStatus connected={relayCount} total={relayTotal} />
  </div>

{:else if currentView === 'live'}
  <div class="listing-form" transition:slide={{ duration: 300 }}>
    <h3 class="gig-form-title">{config.liveTitle}</h3>

    <div class="live-success">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={config.color} stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    </div>

    <RelayStatus connected={relayCount} total={relayTotal} />

    <div class="gig-listing-summary">
      {#if title}
        <div class="gig-summary-row">
          <span class="gig-summary-label">Title</span>
          <span class="gig-summary-value">{title}</span>
        </div>
      {/if}
      <div class="gig-summary-row">
        <span class="gig-summary-label">Mode</span>
        <span class="gig-summary-value">{modeLabel}</span>
      </div>
      {#if hasCategories && categoryName}
        <div class="gig-summary-row">
          <span class="gig-summary-label">Category</span>
          <span class="gig-summary-value">{categoryName}</span>
        </div>
      {/if}
      <div class="gig-summary-row">
        <span class="gig-summary-label">Expires</span>
        <span class="gig-summary-value">7 days</span>
      </div>
    </div>

    <p class="gig-live-hint">{config.liveHint}</p>

    <div class="live-actions">
      <GlassmorphismButton variant="secondary" fullWidth={true} onClick={handleDone}>Done</GlassmorphismButton>
    </div>
  </div>
{/if}

<style>
  .listing-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .gig-category-chip.selected {
    background: var(--sel-bg);
    border-color: var(--sel-border);
    color: var(--sel-color);
    font-weight: 600;
  }

  .date-input { color-scheme: dark; }

  .directive-banner {
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-left: 3px solid rgba(255, 202, 40, 0.7);
    background: rgba(255, 255, 255, 0.04);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin: 0.25rem 0;
  }

  .directive-quote {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.5;
    margin: 0 0 0.5rem 0;
    font-style: italic;
  }

  .directive-rule {
    font-size: 0.82rem;
    color: rgba(255, 202, 40, 0.9);
    line-height: 1.4;
    margin: 0;
  }

  .live-success {
    display: flex;
    justify-content: center;
    padding: 0.5rem 0;
  }

  .live-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }
</style>
