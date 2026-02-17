<script lang="ts">
  import { onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { coordinates, isGigPickingDestination, gigCanClose, socialLayerRefresh } from '../store';
  import type { Listing, ListingMode } from '../types';
  import type { NostrService } from '../services/nostrService';
  import { getCurrentTimeIso8601 } from '../utils/timeUtils';
  import { encode as geohashEncode } from '../utils/geohash';
  import { logger } from '../utils/logger';
  import { ListingService } from '../services/listingService';
  import { SOCIAL_CATEGORIES, type VerticalConfig } from './verticals';
  import GlassmorphismButton from '../components/GlassmorphismButton.svelte';
  import RelayStatus from '../components/RelayStatus.svelte';

  export let config: VerticalConfig;
  export let nostr: NostrService;
  export let onBack: () => void;

  // ─── View State ──────────────────────────────────────────────
  type SocialView = 'form' | 'publishing' | 'live';
  let currentView: SocialView = 'form';

  $: gigCanClose.set(currentView === 'form');

  // ─── Form State ─────────────────────────────────────────────
  let eventMode: ListingMode = 'in-person';
  let title = '';
  let selectedCategory = '';
  let eventDate = '';
  let description = '';
  let contact = '';

  // Map-pick location (for in-person / both)
  let locationLat = '';
  let locationLon = '';
  let isPickingLocation = false;

  // ─── Service State ──────────────────────────────────────────
  let listingService: ListingService | null = null;
  let relayCount = 0;
  let relayTotal = 0;
  let publishedListing: Listing | null = null;

  // ─── Validation ─────────────────────────────────────────────
  $: needsLocation = eventMode === 'in-person' || eventMode === 'both';

  $: canSubmit =
    title.trim() &&
    selectedCategory &&
    description.trim() &&
    contact.trim() &&
    (!needsLocation || (locationLat && locationLon));

  // ─── Location Picking ──────────────────────────────────────
  let unsubCoords: (() => void) | null = null;

  function handlePickLocation() {
    isPickingLocation = true;
    isGigPickingDestination.set(true);
  }

  $: if (isPickingLocation) {
    if (unsubCoords) unsubCoords();
    let skipFirst = true;
    unsubCoords = coordinates.subscribe(value => {
      if (skipFirst) { skipFirst = false; return; }
      if (isPickingLocation && value.latitude && value.longitude) {
        locationLat = value.latitude;
        locationLon = value.longitude;
        isPickingLocation = false;
        isGigPickingDestination.set(false);
      }
    });
  }

  // ─── Submit ─────────────────────────────────────────────────
  function submitListing() {
    if (!canSubmit) return;

    currentView = 'publishing';

    const hasLocation = needsLocation && locationLat && locationLon;
    const location = hasLocation ? {
      latitude: parseFloat(locationLat),
      longitude: parseFloat(locationLon),
    } : undefined;

    const geohash = location
      ? geohashEncode(location.latitude, location.longitude, 4)
      : undefined;

    listingService = new ListingService(nostr, 'listing-social', {
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
      type: 'social',
      mode: eventMode,
      title: title.trim(),
      category: selectedCategory,
      eventDate: eventDate || undefined,
      description: description.trim(),
      contact: contact.trim(),
      location,
      timestamp: getCurrentTimeIso8601(),
      geohash,
    };

    listingService.publishListing(listing);
    publishedListing = listing;

    logger.info('Social listing submitted', { component: 'GigSocial', operation: 'submitListing' });
  }

  function handleDone() {
    cleanup();
    socialLayerRefresh.update(n => n + 1);
    onBack();
  }

  function cleanup() {
    if (listingService) {
      listingService.stop();
      listingService = null;
    }
    publishedListing = null;
    relayCount = 0;
    relayTotal = 0;
    gigCanClose.set(true);
    isGigPickingDestination.set(false);
  }

  onDestroy(() => {
    cleanup();
    if (unsubCoords) unsubCoords();
  });

  // ─── Helpers ────────────────────────────────────────────────
  function getCategoryName(id: string): string {
    return SOCIAL_CATEGORIES.find(c => c.id === id)?.name ?? id;
  }
</script>

<!-- ═══════════════════════════════════════════════════════════ -->

{#if currentView === 'form'}
  <div class="social-form" transition:slide={{ duration: 300 }}>
    <button class="back-btn" on:click={onBack}>&larr; Back</button>
    <h3 class="form-title">Host an Event</h3>
    <p class="form-subtitle">Organize a meetup or activity for people nearby</p>

    <!-- Mode Selector -->
    <div class="mode-selector">
      <button
        class="mode-btn"
        class:active={eventMode === 'in-person'}
        on:click={() => eventMode = 'in-person'}
      >In-Person</button>
      <button
        class="mode-btn"
        class:active={eventMode === 'online'}
        on:click={() => eventMode = 'online'}
      >Online</button>
      <button
        class="mode-btn"
        class:active={eventMode === 'both'}
        on:click={() => eventMode = 'both'}
      >Both</button>
    </div>

    <!-- Title -->
    <div class="form-group">
      <label class="field-label" for="event-title">
        Event Title <span class="required">*</span>
      </label>
      <input
        id="event-title"
        class="field-input"
        type="text"
        placeholder="e.g. Saturday Morning Run, Board Game Night..."
        bind:value={title}
      />
    </div>

    <!-- Location (in-person or both) -->
    {#if needsLocation}
      <div class="form-group">
        <span class="field-label">Location</span>
        {#if locationLat && locationLon}
          <p class="location-display">
            {parseFloat(locationLat).toFixed(5)}, {parseFloat(locationLon).toFixed(5)}
          </p>
          <button class="pick-again-btn" on:click={handlePickLocation}>Pick again</button>
        {:else}
          <GlassmorphismButton variant="secondary" size="small" onClick={handlePickLocation}>
            {isPickingLocation ? 'Click on the map...' : 'Pick Location on Map'}
          </GlassmorphismButton>
        {/if}
      </div>
    {/if}

    <!-- Category -->
    <div class="form-group">
      <label class="field-label" for="category">
        Category <span class="required">*</span>
      </label>
      <div class="category-grid">
        {#each SOCIAL_CATEGORIES as cat}
          <button
            class="category-chip"
            class:selected={selectedCategory === cat.id}
            on:click={() => selectedCategory = cat.id}
            title={cat.description}
          >
            {cat.name}
          </button>
        {/each}
      </div>
      {#if selectedCategory}
        <p class="category-desc">
          {SOCIAL_CATEGORIES.find(c => c.id === selectedCategory)?.description}
        </p>
      {/if}
    </div>

    <!-- Event Date (optional) -->
    <div class="form-group">
      <label class="field-label" for="event-date">
        Date & Time
      </label>
      <input
        id="event-date"
        class="field-input"
        type="datetime-local"
        bind:value={eventDate}
      />
      <span class="field-hint">Optional — leave empty for recurring or open-ended events</span>
    </div>

    <!-- Description -->
    <div class="form-group">
      <label class="field-label" for="event-desc">
        Description <span class="required">*</span>
      </label>
      <textarea
        id="event-desc"
        class="field-input textarea"
        placeholder="What's the plan? Describe the activity..."
        bind:value={description}
        rows="3"
      ></textarea>
    </div>

    <!-- Contact -->
    <div class="form-group">
      <label class="field-label" for="contact-link">
        Contact Link <span class="required">*</span>
      </label>
      <input
        id="contact-link"
        class="field-input"
        type="text"
        placeholder="e.g. https://t.me/you, https://wa.me/123..."
        bind:value={contact}
      />
      <span class="field-hint">Telegram, WhatsApp, Signal, or any link for attendees to reach you</span>
    </div>

    <!-- Submit -->
    <GlassmorphismButton
      variant="primary"
      fullWidth={true}
      onClick={submitListing}
      disabled={!canSubmit}
    >
      Publish Event
    </GlassmorphismButton>
  </div>

<!-- ═══════════════════════════════════════════════════════════ -->

{:else if currentView === 'publishing'}
  <div class="social-status" transition:slide={{ duration: 300 }}>
    <h3 class="form-title">Publishing...</h3>
    <div class="status-indicator">
      <div class="pulse-dot" style="background: {config.color}"></div>
      <span>Connecting to relays...</span>
    </div>
    <RelayStatus connected={relayCount} total={relayTotal} />
  </div>

<!-- ═══════════════════════════════════════════════════════════ -->

{:else if currentView === 'live'}
  <div class="social-live" transition:slide={{ duration: 300 }}>
    <h3 class="form-title">Your Event is Live!</h3>

    <div class="live-success">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={config.color} stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    </div>

    <RelayStatus connected={relayCount} total={relayTotal} />

    <div class="listing-summary">
      <div class="summary-row">
        <span class="summary-label">Title</span>
        <span class="summary-value">{title}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Mode</span>
        <span class="summary-value">{eventMode === 'in-person' ? 'In-Person' : eventMode === 'online' ? 'Online' : 'In-Person & Online'}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Category</span>
        <span class="summary-value">{getCategoryName(selectedCategory)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Expires</span>
        <span class="summary-value">14 days</span>
      </div>
    </div>

    <p class="live-hint">
      Your event will appear on the map for 14 days. People can contact you directly via your contact link. You can take it down anytime by tapping your marker on the map.
    </p>

    <div class="live-actions">
      <GlassmorphismButton variant="secondary" fullWidth={true} onClick={handleDone}>
        Done
      </GlassmorphismButton>
    </div>
  </div>
{/if}

<!-- ═══════════════════════════════════════════════════════════ -->

<style>
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
    margin: 0 0 0.15rem 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: white;
  }

  .form-subtitle {
    margin: 0 0 0.75rem 0;
    font-size: 0.82rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .social-form,
  .social-status,
  .social-live {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* ── Mode Selector ── */
  .mode-selector {
    display: flex;
    gap: 6px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 10px;
    padding: 4px;
  }

  .mode-btn {
    flex: 1;
    padding: 8px 4px;
    background: none;
    border: 1px solid transparent;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-btn:hover {
    color: rgba(255, 255, 255, 0.8);
  }

  .mode-btn.active {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: white;
    font-weight: 600;
  }

  /* ── Form Groups ── */
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

  .field-hint {
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.35);
    margin-top: 2px;
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
    color-scheme: dark;
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

  /* ── Location ── */
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

  /* ── Category Grid ── */
  .category-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
  }

  .category-chip {
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .category-chip:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .category-chip.selected {
    background: rgba(255, 64, 129, 0.2);
    border-color: rgba(255, 64, 129, 0.5);
    color: #FF4081;
    font-weight: 600;
  }

  .category-desc {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    margin: 2px 0 0 0;
    font-style: italic;
  }

  /* ── Publishing / Live ── */
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .pulse-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    animation: gig-pulse 1.5s ease-in-out infinite;
    flex-shrink: 0;
  }

  @keyframes gig-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.3); }
  }

  .live-success {
    display: flex;
    justify-content: center;
    padding: 0.5rem 0;
  }

  .listing-summary {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .summary-label {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .summary-value {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.85);
    font-weight: 500;
  }

  .live-hint {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.4);
    margin: 0;
    line-height: 1.4;
    text-align: center;
  }

  .live-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }
</style>
