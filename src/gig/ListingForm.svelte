<script lang="ts">
  import { onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { gigCanClose, layerRefresh } from '../store';
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

  export let config: ListingVerticalConfig;
  export let nostr: NostrService;
  export let onBack: () => void;

  $: vertical = config.id as ListingVertical;
  $: categories = LISTING_CATEGORIES[vertical] ?? [];
  $: serviceTag = config.listingTag;

  type ListingView = 'form' | 'publishing' | 'live';
  let currentView: ListingView = 'form';

  $: gigCanClose.set(currentView === 'form');

  let mode: ListingMode = 'in-person';
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

  $: needsLocation = mode === 'in-person' || mode === 'both';

  $: contactValid = contact.trim() && (!config.contactPattern || new RegExp(config.contactPattern).test(contact.trim()));

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

  function handleLocationClear() {
    locationLat = '';
    locationLon = '';
    locationAddress = '';
  }

  function submitListing() {
    if (!canSubmit) return;
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
        if (connected > 0 && currentView === 'publishing') {
          currentView = 'live';
        }
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

    listingService.publishListing(listing);
  }

  function handleDone() {
    cleanup();
    layerRefresh.update(r => ({ ...r, [vertical]: (r[vertical] ?? 0) + 1 }));
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

    <div class="gig-mode-selector">
      <button class="gig-mode-btn" class:active={mode === 'in-person'} on:click={() => mode = 'in-person'}>In-Person</button>
      <button class="gig-mode-btn" class:active={mode === 'online'} on:click={() => mode = 'online'}>Online</button>
      <button class="gig-mode-btn" class:active={mode === 'both'} on:click={() => mode = 'both'}>Both</button>
    </div>

    <div class="gig-form-group">
      <label class="gig-field-label" for="event-title">{config.titleLabel} <span class="gig-required">*</span></label>
      <input id="event-title" class="gig-field-input" type="text" placeholder={config.titlePlaceholder} bind:value={title} />
    </div>

    {#if needsLocation}
      <LocationPicker lat={locationLat} lon={locationLon} label="Location" onLocationSelected={handleLocationSelected} onClear={handleLocationClear} />
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
      <textarea id="listing-desc" class="gig-field-input textarea" placeholder={config.descriptionPlaceholder} bind:value={description} rows="3"></textarea>
    </div>

    <div class="gig-form-group">
      <label class="gig-field-label" for="contact-link">{config.contactLabel} <span class="gig-required">*</span></label>
      <input id="contact-link" class="gig-field-input" type="text" placeholder={config.contactPlaceholder} bind:value={contact} />
      <span class="gig-field-hint">{config.contactHint}</span>
      {#if config.contactPatternHint && contact.trim() && !contactValid}
        <span class="gig-field-hint" style="color: rgba(252, 165, 165, 0.9)">{config.contactPatternHint}</span>
      {/if}
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
      <span>Connecting to relays...</span>
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
        <span class="gig-summary-value">14 days</span>
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
