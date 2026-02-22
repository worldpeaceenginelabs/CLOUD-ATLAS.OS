<script lang="ts">
  import { onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { fade, slide } from 'svelte/transition';
  import { viewer, userGigRole, userLiveLocation, currentGeohash, gigCanClose, preselectedGigVertical, showRadialGigMenu } from '../store';
  import { modalService } from '../utils/modalService';
  import type { GigRequest, GigVertical } from '../types';
  import { encode as geohashEncode } from '../utils/geohash';
  import { GEOHASH_PRECISION_MATCHING } from '../gig/constants';
  import { logger } from '../utils/logger';
  import { GigService } from '../services/gigService';
  import { getSharedNostr } from '../services/nostrPool';
  import { REPLACEABLE_KIND, type NostrService, type NostrEvent } from '../services/nostrService';
  import { VERTICALS, type VerticalConfig, type ListingVerticalConfig } from '../gig/verticals';
  import GigMatchForm from '../gig/GigMatchForm.svelte';
  import GigPending from '../gig/GigPending.svelte';
  import GigMatched from '../gig/GigMatched.svelte';
  import ListingForm from '../gig/ListingForm.svelte';
  import * as Cesium from 'cesium';
  import { clampToSurface } from '../utils/clampToSurface';

  // ─── View State ──────────────────────────────────────────────
  type GigView = 'menu' | 'need' | 'offer' | 'pending' | 'matched' | 'listing';
  let currentView: GigView = 'menu';
  let config: VerticalConfig | null = null;

  // ─── Shared Nostr (loaded once on mount) ─────────────────
  let sharedNostr: NostrService | null = null;
  let nostrError = false;
  let recovering = true;

  (async () => {
    try {
      sharedNostr = await getSharedNostr();
      await attemptRecovery();
    } catch {
      nostrError = true;
    } finally {
      recovering = false;
      const preselected = get(preselectedGigVertical);
      if (preselected) {
        preselectedGigVertical.set(null);
        selectVertical(preselected);
      } else if (currentView === 'menu' && !config) {
        modalService.hideGigEconomy();
      }
    }
  })();

  $: matchingConfig = config?.mode === 'matching' ? config : null;

  $: gigCanClose.set(
    currentView === 'menu' ||
    currentView === 'need' ||
    currentView === 'offer' ||
    currentView === 'listing'
  );

  // ─── Form State ─────────────────────────────────────────────
  let destinationLat = '';
  let destinationLon = '';

  // ─── User State ─────────────────────────────────────────────
  let myRequest: GigRequest | null = null;
  let matchedRequest: GigRequest | null = null;
  let awaitingConfirmation = false;
  let nearbyCount = 0;
  let relayCount = 0;
  let relayTotal = 0;
  let confirmedProviderPubkey: string | null = null;
  let matchedProviderDetails: Record<string, string> = {};
  let requestQueue: GigRequest[] = [];

  // ─── Error State ────────────────────────────────────────────
  let errorMessage: string | null = null;
  let errorTimeout: ReturnType<typeof setTimeout> | null = null;

  function showError(msg: string, durationMs = 5000) {
    errorMessage = msg;
    if (errorTimeout) clearTimeout(errorTimeout);
    errorTimeout = setTimeout(() => { errorMessage = null; }, durationMs);
  }

  function clearError() {
    errorMessage = null;
    if (errorTimeout) clearTimeout(errorTimeout);
  }

  // ─── Cesium Entities ─────────────────────────────────────────
  let gigEntities: any[] = [];

  // ─── Service ─────────────────────────────────────────────────
  let service: GigService | null = null;

  function createService(): GigService {
    if (!matchingConfig) throw new Error('No matching vertical selected');
    if (!sharedNostr) throw new Error('Nostr not connected');
    return new GigService(sharedNostr, matchingConfig.id, {
      onRelayStatus: (connected: number, total: number) => {
        relayCount = connected;
        relayTotal = total;
      },
      onRequest: handleRequest,
      onRequestGone: handleRequestGone,
      onProviderAccepted: handleProviderAccepted,
      onProviderCount: (count: number) => {
        nearbyCount = count;
      },
      onOwnRequestExpired: handleOwnRequestExpired,
      onOwnOfferExpired: handleOwnOfferExpired,
    });
  }

  // ─── Session Recovery (relay is source of truth) ────────────
  function attemptRecovery(): Promise<void> {
    if (!sharedNostr) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const events: NostrEvent[] = [];
      const subId = `recovery-${Date.now()}`;
      const timeout = setTimeout(() => { cleanup(); resolve(); }, 5000);

      function cleanup() {
        clearTimeout(timeout);
        sharedNostr!.unsubscribe(subId);
      }

      sharedNostr!.subscribe(subId, {
        kinds: [REPLACEABLE_KIND],
        authors: [sharedNostr!.pubkey],
        since: Math.floor(Date.now() / 1000) - 120,
      }, (event: NostrEvent) => {
        events.push(event);
      }, () => {
        cleanup();
        bootstrapFromEvents(events);
        resolve();
      });
    });
  }

  function bootstrapFromEvents(events: NostrEvent[]): void {
    for (const event of events) {
      const tTag = event.tags?.find((t: string[]) => t[0] === 't')?.[1];
      const gTag = event.tags?.find((t: string[]) => t[0] === 'g')?.[1];
      if (!tTag || !gTag) continue;

      const isNeed = tTag.startsWith('need-');
      const isOffer = tTag.startsWith('offer-');
      if (!isNeed && !isOffer) continue;

      const verticalId = tTag.replace(/^(need|offer)-/, '') as GigVertical;
      const verticalConfig = VERTICALS[verticalId];
      if (!verticalConfig || verticalConfig.mode !== 'matching') continue;

      config = verticalConfig;

      try {
        if (isNeed) {
          const request: GigRequest = JSON.parse(event.content);
          request.pubkey = event.pubkey;

          if (request.status === 'taken') {
            userGigRole.set('requester');
            myRequest = request;
            confirmedProviderPubkey = request.matchedProviderPubkey;
            currentView = 'matched';
          } else if (request.status === 'open') {
            currentGeohash.set(gTag);
            service = createService();
            service.startAsRequester(gTag, request);
            myRequest = request;
            userGigRole.set('requester');
            currentView = 'pending';
          }
        } else {
          const data = JSON.parse(event.content);
          currentGeohash.set(gTag);
          service = createService();
          service.startAsProvider(gTag, data.location, data.details || {});
          userGigRole.set('provider');
          currentView = 'pending';
        }
        logger.info(`Recovered ${isNeed ? 'requester' : 'provider'} session [${verticalId}]`, { component: 'GigEconomy', operation: 'bootstrapFromEvents' });
        return;
      } catch {
        logger.warn('Failed to parse recovery event', { component: 'GigEconomy', operation: 'bootstrapFromEvents' });
      }
    }
  }

  // ─── Vertical Selection ─────────────────────────────────────
  function selectVertical(vertical: GigVertical) {
    config = VERTICALS[vertical];
    if (config.mode === 'listing') {
      currentView = 'listing';
    } else {
      currentView = 'menu';
    }
    logger.info(`Selected vertical: ${vertical}`, { component: 'GigEconomy', operation: 'selectVertical' });
  }

  // ─── View Navigation ───────────────────────────────────────
  function handleNeed() { currentView = 'need'; }
  function handleOffer() { currentView = 'offer'; }

  function closePanel() {
    modalService.hideGigEconomy();
  }

  function goBackToRadial() {
    closePanel();
    showRadialGigMenu.set(true);
  }

  function goBack() {
    if (currentView === 'menu' || currentView === 'listing') {
      goBackToRadial();
    } else if (currentView === 'need' || currentView === 'offer') {
      currentView = 'menu';
      destinationLat = '';
      destinationLon = '';
    }
  }

  // ─── Service Callbacks ──────────────────────────────────────

  function handleOwnRequestExpired() {
    removeGigEntitiesFromMap(myRequest?.id ?? '');
    myRequest = null;
    confirmedProviderPubkey = null;
    stopService();
    userGigRole.set(null);
    currentView = 'need';
    showError(`Your ${matchingConfig?.requestNoun ?? 'request'} expired. Please submit again.`);
    logger.info('Own request expired', { component: 'GigEconomy', operation: 'handleOwnRequestExpired' });
  }

  function resetProviderState() {
    matchedRequest = null;
    awaitingConfirmation = false;
    requestQueue = [];
    nearbyCount = 0;
    stopService();
    userGigRole.set(null);
  }

  function handleOwnOfferExpired() {
    resetProviderState();
    currentView = 'offer';
    showError('Your offer expired. Please start again.');
    logger.info('Own offer expired', { component: 'GigEconomy', operation: 'handleOwnOfferExpired' });
  }

  function handleRequest(request: GigRequest) {
    requestQueue = [...requestQueue, request];
    addRequestToMap(request);
    nearbyCount = requestQueue.length;
    if (!matchedRequest && !awaitingConfirmation) {
      matchedRequest = request;
    }
  }

  function handleRequestGone(requestId: string, matchedPubkey: string | null) {
    if (matchedPubkey && matchedPubkey === service?.pubkey) {
      awaitingConfirmation = false;
      currentView = 'matched';
      logger.info('We won the match!', { component: 'GigEconomy', operation: 'handleRequestGone' });
      return;
    }

    const wasShowing = matchedRequest?.id === requestId;
    if (wasShowing) {
      matchedRequest = null;
      awaitingConfirmation = false;
    }

    requestQueue = requestQueue.filter(r => r.id !== requestId);
    removeGigEntitiesFromMap(requestId);
    nearbyCount = requestQueue.length;

    if (wasShowing && requestQueue.length > 0) {
      matchedRequest = requestQueue[0];
    }
  }

  function handleProviderAccepted(providerPubkey: string, requestId: string, details?: Record<string, string>) {
    if (!myRequest || !service) return;
    if (requestId !== myRequest.id) return;

    if (confirmedProviderPubkey === null) {
      confirmedProviderPubkey = providerPubkey;
      matchedProviderDetails = details ?? {};
      service.confirmMatch(myRequest, providerPubkey);
      myRequest = { ...myRequest, status: 'taken', matchedProviderPubkey: providerPubkey };
      currentView = 'matched';
      logger.info(`Confirmed provider ${providerPubkey.slice(0, 8)}`, { component: 'GigEconomy', operation: 'handleProviderAccepted' });
    }
  }

  // ─── Cesium Visualization ────────────────────────────────────

  async function addRequestToMap(request: GigRequest) {
    if (!$viewer || !matchingConfig) return;
    if ($viewer.entities.getById(`gig_${request.id}`)) return;

    const startPos = await clampToSurface(
      request.startLocation.longitude, request.startLocation.latitude
    );

    const startEntity = $viewer.entities.add({
      id: `gig_${request.id}`,
      position: startPos,
      point: {
        pixelSize: 12,
        color: Cesium.Color.fromCssColorString(matchingConfig.mapColor),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: matchingConfig.mapLabel,
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -16),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    gigEntities.push(startEntity);

    if (request.destination) {
      const destPos = await clampToSurface(
        request.destination.longitude, request.destination.latitude
      );

      const destEntity = $viewer.entities.add({
        id: `gig_dest_${request.id}`,
        position: destPos,
        point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString(matchingConfig.mapDestColor),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      gigEntities.push(destEntity);

      const lineEntity = $viewer.entities.add({
        id: `gig_line_${request.id}`,
        polyline: {
          positions: [startPos, destPos],
          width: 2,
          material: Cesium.Color.fromCssColorString(matchingConfig.mapColor).withAlpha(0.6),
          clampToGround: true,
        },
      });
      gigEntities.push(lineEntity);
    }
  }

  function removeGigEntitiesFromMap(requestId: string) {
    if (!$viewer) return;
    const idsToRemove = [
      `gig_${requestId}`,
      `gig_dest_${requestId}`,
      `gig_line_${requestId}`,
    ];
    gigEntities = gigEntities.filter(entity => {
      if (entity.id && idsToRemove.includes(entity.id)) {
        $viewer.entities.remove(entity);
        return false;
      }
      return true;
    });
  }

  function clearAllGigEntities() {
    if (!$viewer) return;
    gigEntities.forEach(entity => {
      try { $viewer.entities.remove(entity); } catch (_) { /* already removed */ }
    });
    gigEntities = [];
  }

  // ─── User Actions ────────────────────────────────────────────

  function handleDestinationSelected(lat: string, lon: string, _displayName?: string) {
    destinationLat = lat;
    destinationLon = lon;
  }

  function handleDestinationClear() {
    destinationLat = '';
    destinationLon = '';
  }

  function prepareService(): { geohash: string; location: { latitude: number; longitude: number } } | null {
    if (!$userLiveLocation) {
      showError('GPS location not available. Please enable location services and try again.');
      return null;
    }
    const geohash = geohashEncode($userLiveLocation.latitude, $userLiveLocation.longitude, GEOHASH_PRECISION_MATCHING);
    currentGeohash.set(geohash);
    service = createService();
    return { geohash, location: { latitude: $userLiveLocation.latitude, longitude: $userLiveLocation.longitude } };
  }

  function submitRequest(details: Record<string, string>) {
    if (!matchingConfig) return;

    if (matchingConfig.hasDestination && (!destinationLat || !destinationLon)) {
      showError(`Please pick a ${matchingConfig.mapPickLabel.toLowerCase()} on the map first.`);
      return;
    }

    const ctx = prepareService();
    if (!ctx) return;

    const mapPickLocation = matchingConfig.hasDestination ? {
      latitude: parseFloat(destinationLat),
      longitude: parseFloat(destinationLon),
    } : undefined;

    const request: GigRequest = {
      id: crypto.randomUUID(),
      pubkey: service!.pubkey,
      startLocation: matchingConfig.reverseLocations && mapPickLocation ? mapPickLocation : ctx.location,
      destination: matchingConfig.hasDestination
        ? (matchingConfig.reverseLocations ? ctx.location : mapPickLocation)
        : undefined,
      status: 'open',
      matchedProviderPubkey: null,
      geohash: ctx.geohash,
      details,
    };

    service!.startAsRequester(ctx.geohash, request);
    myRequest = request;
    confirmedProviderPubkey = null;
    userGigRole.set('requester');
    addRequestToMap(request);
    currentView = 'pending';
    logger.info('Request submitted', { component: 'GigEconomy', operation: 'submitRequest' });
  }

  function submitOffer(details: Record<string, string>) {
    if (!matchingConfig) return;

    const ctx = prepareService();
    if (!ctx) return;

    service!.startAsProvider(ctx.geohash, ctx.location, details);
    userGigRole.set('provider');
    currentView = 'pending';
    logger.info('Offer submitted', { component: 'GigEconomy', operation: 'submitOffer' });
  }

  function acceptMatch() {
    if (!matchedRequest || !service) return;
    const sent = service.acceptRequest(matchedRequest.pubkey, matchedRequest.id);
    if (sent) {
      awaitingConfirmation = true;
      logger.info('Sent accept, awaiting confirmation', { component: 'GigEconomy', operation: 'acceptMatch' });
    } else {
      showError('Failed to send accept. Check your connection.');
    }
  }

  function rejectMatch() {
    if (!matchedRequest) return;
    const rejectedId = matchedRequest.id;
    matchedRequest = null;
    awaitingConfirmation = false;

    requestQueue = requestQueue.filter(r => r.id !== rejectedId);
    nearbyCount = requestQueue.length;

    if (requestQueue.length > 0) {
      matchedRequest = requestQueue[0];
    }
    logger.info('Rejected request', { component: 'GigEconomy', operation: 'rejectMatch' });
  }

  function cancelRequest() {
    if (!myRequest || !service) return;

    service.cancelRequest(myRequest);
    removeGigEntitiesFromMap(myRequest.id);
    myRequest = null;
    confirmedProviderPubkey = null;

    stopService();
    userGigRole.set(null);
    currentView = 'menu';
    logger.info('Request cancelled', { component: 'GigEconomy', operation: 'cancelRequest' });
  }

  function cancelOffer() {
    resetProviderState();
    currentView = 'menu';
    logger.info('Offer cancelled', { component: 'GigEconomy', operation: 'cancelOffer' });
  }

  function finishAndReset() {
    myRequest = null;
    confirmedProviderPubkey = null;
    matchedProviderDetails = {};
    resetProviderState();
    config = null;
    destinationLat = '';
    destinationLon = '';
    closePanel();
  }

  // ─── Service Cleanup ────────────────────────────────────────
  function stopService() {
    if (service) {
      service.stop();
      service = null;
    }
    relayCount = 0;
    relayTotal = 0;
    currentGeohash.set('');
    clearAllGigEntities();
  }


  // ─── Lifecycle ──────────────────────────────────────────────
  onDestroy(() => {
    stopService();
    gigCanClose.set(true);
    clearError();
  });
</script>

<div class="gig-economy" transition:fade={{ duration: 300 }}>

  <!-- ═══════════════ ERROR BANNER ═══════════════════ -->
  {#if errorMessage}
    <div class="error-banner" transition:slide={{ duration: 200 }}>
      <span class="error-icon">!</span>
      <span class="error-text">{errorMessage}</span>
      <button class="error-dismiss" on:click={clearError}>&times;</button>
    </div>
  {/if}

  <!-- ═══════════════ STORAGE ERROR ═════════════════════ -->
  {#if nostrError}
    <div class="storage-error" transition:slide={{ duration: 300 }}>
      <span class="storage-error-icon">⚠</span>
      <p class="storage-error-text">Storage unavailable — gig features require browser storage to be enabled.</p>
    </div>

  <!-- ═══════════════ LOADING / CONNECTING / RECOVERING ═ -->
  {:else if !sharedNostr || recovering}
    <div class="loading-keys" transition:slide={{ duration: 300 }}>
      <div class="gig-pulse-dot" style="background: rgba(255,255,255,0.5)"></div>
      <span style="color: rgba(255,255,255,0.6); font-size: 0.85rem;">{recovering ? 'Reconnecting...' : 'Loading...'}</span>
    </div>

  <!-- ═══════════════ LISTING MODE ═══════════════════ -->
  {:else if currentView === 'listing' && config?.mode === 'listing'}
    <ListingForm config={config} nostr={sharedNostr} onBack={goBackToRadial} />

  <!-- ═══════════════ NEED / OFFER MENU ═══════════════ -->
  {:else if currentView === 'menu' && matchingConfig}
    <div class="gig-menu" transition:slide={{ duration: 300 }}>
      <button class="gig-back-btn" on:click={goBack}>&larr; Back</button>

      <h3 class="gig-title">What would you like to do?</h3>

      <div class="gig-actions">
        <button
          class="gig-action-btn"
          style="--hover-border: {matchingConfig.color}"
          on:click={handleNeed}
        >
          <div class="action-accent" style="background: {matchingConfig.color}"></div>
          <div class="action-text">
            <span class="action-label">{matchingConfig.needLabel}</span>
            <span class="action-desc">{matchingConfig.needDesc}</span>
          </div>
        </button>

        <button
          class="gig-action-btn"
          style="--hover-border: {matchingConfig.color}"
          on:click={handleOffer}
        >
          <div class="action-accent" style="background: {matchingConfig.color}; opacity: 0.6"></div>
          <div class="action-text">
            <span class="action-label">{matchingConfig.offerLabel}</span>
            <span class="action-desc">{matchingConfig.offerDesc}</span>
          </div>
        </button>
      </div>
    </div>

  <!-- ═══════════════ NEED / OFFER FORM ════════════════ -->
  {:else if (currentView === 'need' || currentView === 'offer') && matchingConfig}
    <GigMatchForm
      config={matchingConfig}
      role={currentView}
      userLiveLocation={$userLiveLocation}
      {destinationLat}
      {destinationLon}
      onBack={goBack}
      onDestinationSelected={handleDestinationSelected}
      onDestinationClear={handleDestinationClear}
      onSubmit={currentView === 'need' ? submitRequest : submitOffer}
    />

  <!-- ═══════════════ PENDING VIEW ═══════════════════ -->
  {:else if currentView === 'pending' && matchingConfig}
    <GigPending
      config={matchingConfig}
      role={$userGigRole}
      {relayCount}
      {relayTotal}
      {nearbyCount}
      currentGeohash={$currentGeohash}
      hasOwnRequest={!!myRequest}
      {matchedRequest}
      {awaitingConfirmation}
      onCancel={myRequest ? cancelRequest : cancelOffer}
      onAccept={acceptMatch}
      onReject={rejectMatch}
    />

  <!-- ═══════════════ MATCHED VIEW ═══════════════════ -->
  {:else if currentView === 'matched' && matchingConfig}
    <GigMatched config={matchingConfig} onDone={finishAndReset} role={$userGigRole} providerDetails={matchedProviderDetails} />
  {/if}
</div>

<style>
  .gig-economy {
    padding: 1rem;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 360px;
  }

  /* ── Error Banner ── */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    margin-bottom: 0.75rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 8px;
    font-size: 0.8rem;
    color: rgba(252, 165, 165, 1);
  }

  .error-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.3);
    font-size: 0.7rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .error-text {
    flex: 1;
    line-height: 1.3;
  }

  .error-dismiss {
    background: none;
    border: none;
    color: rgba(252, 165, 165, 0.7);
    font-size: 1rem;
    cursor: pointer;
    padding: 0 2px;
    flex-shrink: 0;
  }

  .error-dismiss:hover {
    color: rgba(252, 165, 165, 1);
  }

  /* ── Storage Error ── */
  .storage-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 24px 16px;
    text-align: center;
  }

  .storage-error-icon {
    font-size: 2rem;
  }

  .storage-error-text {
    margin: 0;
    font-size: 0.85rem;
    color: rgba(252, 165, 165, 1);
    line-height: 1.5;
  }

  .loading-keys {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px;
  }

  /* ── Menu ── */
  .gig-menu {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .gig-title {
    margin: 0 0 0.75rem 0;
    font-size: 1.1rem;
    font-weight: 700;
  }

  .gig-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .gig-action-btn {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .gig-action-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateX(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    border-color: var(--hover-border, rgba(255, 255, 255, 0.3));
  }

  .action-accent {
    width: 4px;
    height: 32px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .action-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .action-label {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .action-desc {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.5);
  }


  /* ── Responsive ── */
  @media (max-width: 768px) {
    .gig-economy {
      max-width: none;
      padding: 0.75rem;
    }

    .gig-action-btn {
      padding: 12px 14px;
    }
  }
</style>
