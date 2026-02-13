<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { coordinates, viewer, userGigRole, isGigPickingDestination, userLiveLocation, currentGeohash } from '../store';
  import type { RideRequest, RideType } from '../types';
  import { getCurrentTimeIso8601 } from '../utils/timeUtils';
  import { encode as geohashEncode } from '../utils/geohash';
  import { logger } from '../utils/logger';
  import { GigService } from '../services/gigService';
  import GlassmorphismButton from './GlassmorphismButton.svelte';
  import * as Cesium from 'cesium';

  // ─── View State ──────────────────────────────────────────────
  type GigView = 'menu' | 'need-ride' | 'offer-ride' | 'pending' | 'matched';
  let currentView: GigView = 'menu';

  // ─── Form State ─────────────────────────────────────────────
  let rideType: RideType = 'person';
  let destinationLat = '';
  let destinationLon = '';
  let isPickingDestination = false;

  // ─── User State ─────────────────────────────────────────────
  let myRideRequest: RideRequest | null = null;
  let matchedRequest: RideRequest | null = null;
  let awaitingConfirmation = false;
  let nearbyCount = 0;
  let relayCount = 0;
  let relayTotal = 0;
  let confirmedDriverPubkey: string | null = null;
  let requestQueue: RideRequest[] = [];

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
  let rideEntities: any[] = [];
  // ─── Service ─────────────────────────────────────────────────
  let service: GigService | null = null;

  function createService(): GigService {
    return new GigService({
      onRelayStatus: (connected: number, total: number) => {
        relayCount = connected;
        relayTotal = total;
      },
      onRideRequest: handleRideRequest,
      onRideRequestGone: handleRideRequestGone,
      onDriverAccepted: handleDriverAccepted,
      onDriverCount: (count: number) => {
        nearbyCount = count;
      },
    });
  }

  // ─── Service Callbacks ──────────────────────────────────────

  /** Driver: a new open ride request appeared in the cell. */
  function handleRideRequest(request: RideRequest) {
    requestQueue = [...requestQueue, request];
    addRideRequestToMap(request);
    nearbyCount = requestQueue.length;

    // Show as match card if we don't already have one
    if (!matchedRequest && !awaitingConfirmation) {
      matchedRequest = request;
    }
  }

  /** Driver: a ride request was taken or cancelled. */
  function handleRideRequestGone(requestId: string, matchedDriverPubkey: string | null) {
    // Check if WE are the winning driver
    if (matchedDriverPubkey && matchedDriverPubkey === service?.pubkey) {
      awaitingConfirmation = false;
      currentView = 'matched';
      logger.info('We won the match!', { component: 'GigEconomy', operation: 'handleRideRequestGone' });
      return;
    }

    // We lost or it was cancelled — clean up
    const wasShowing = matchedRequest?.id === requestId;
    if (wasShowing) {
      matchedRequest = null;
      awaitingConfirmation = false;
    }

    requestQueue = requestQueue.filter(r => r.id !== requestId);
    removeRideEntitiesFromMap(requestId);
    nearbyCount = requestQueue.length;

    // Promote next request if we just cleared the card
    if (wasShowing && requestQueue.length > 0) {
      matchedRequest = requestQueue[0];
    }
  }

  /** Rider: a driver accepted our request — ARBITER LOGIC. */
  function handleDriverAccepted(driverPubkey: string, requestId: string) {
    if (!myRideRequest || !service) return;
    if (requestId !== myRideRequest.id) return;

    if (confirmedDriverPubkey === null) {
      // First driver wins — lock it in
      confirmedDriverPubkey = driverPubkey;

      // Update the public event: status → taken, embed the winner's pubkey
      service.confirmMatch(myRideRequest, driverPubkey);
      myRideRequest = { ...myRideRequest, status: 'taken', matchedDriverPubkey: driverPubkey };

      currentView = 'matched';
      logger.info(`Confirmed driver ${driverPubkey.slice(0, 8)}`, { component: 'GigEconomy', operation: 'handleDriverAccepted' });
    }
    // Late accepts are ignored — drivers see the 'taken' event update themselves
  }

  // ─── Cesium Visualization ────────────────────────────────────
  function addRideRequestToMap(request: RideRequest) {
    if (!$viewer) return;
    if ($viewer.entities.getById(`ride_${request.id}`)) return;

    // Blue point at start location
    const startEntity = $viewer.entities.add({
      id: `ride_${request.id}`,
      position: Cesium.Cartesian3.fromDegrees(
        request.startLocation.longitude,
        request.startLocation.latitude,
        100
      ),
      point: {
        pixelSize: 12,
        color: Cesium.Color.fromCssColorString('#4285F4'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: request.rideType === 'person' ? 'Ride' : 'Delivery',
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
    rideEntities.push(startEntity);

    // Green point at destination
    const destEntity = $viewer.entities.add({
      id: `ride_dest_${request.id}`,
      position: Cesium.Cartesian3.fromDegrees(
        request.destination.longitude,
        request.destination.latitude,
        100
      ),
      point: {
        pixelSize: 8,
        color: Cesium.Color.fromCssColorString('#34A853'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    rideEntities.push(destEntity);

    // Line from start → destination
    const lineEntity = $viewer.entities.add({
      id: `ride_line_${request.id}`,
      polyline: {
        positions: [
          Cesium.Cartesian3.fromDegrees(
            request.startLocation.longitude,
            request.startLocation.latitude,
            100
          ),
          Cesium.Cartesian3.fromDegrees(
            request.destination.longitude,
            request.destination.latitude,
            100
          ),
        ],
        width: 2,
        material: Cesium.Color.fromCssColorString('#4285F4').withAlpha(0.6),
        clampToGround: true,
      },
    });
    rideEntities.push(lineEntity);
  }

  function removeRideEntitiesFromMap(requestId: string) {
    if (!$viewer) return;
    const idsToRemove = [
      `ride_${requestId}`,
      `ride_dest_${requestId}`,
      `ride_line_${requestId}`,
    ];
    rideEntities = rideEntities.filter(entity => {
      if (entity.id && idsToRemove.includes(entity.id)) {
        $viewer.entities.remove(entity);
        return false;
      }
      return true;
    });
  }

  function clearAllGigEntities() {
    if (!$viewer) return;
    rideEntities.forEach(entity => {
      try { $viewer.entities.remove(entity); } catch (_) { /* already removed */ }
    });
    rideEntities = [];
  }

  // ─── User Actions ────────────────────────────────────────────
  function handleNeedRide() {
    currentView = 'need-ride';
  }

  function handleOfferRide() {
    currentView = 'offer-ride';
  }

  function handlePickDestination() {
    isPickingDestination = true;
    isGigPickingDestination.set(true);
  }

  function submitRideRequest() {
    if (!$userLiveLocation) {
      showError('GPS location not available. Please enable location services and try again.');
      return;
    }
    if (!destinationLat || !destinationLon) {
      showError('Please pick a destination on the map first.');
      return;
    }

    const geohash = geohashEncode($userLiveLocation.latitude, $userLiveLocation.longitude, 6);
    currentGeohash.set(geohash);

    service = createService();

    const request: RideRequest = {
      id: crypto.randomUUID(),
      pubkey: service.pubkey,
      startLocation: {
        latitude: $userLiveLocation.latitude,
        longitude: $userLiveLocation.longitude,
      },
      destination: {
        latitude: parseFloat(destinationLat),
        longitude: parseFloat(destinationLon),
      },
      rideType,
      status: 'open',
      matchedDriverPubkey: null,
      timestamp: getCurrentTimeIso8601(),
      geohash,
    };

    service.startAsRider(geohash, request);
    myRideRequest = request;
    confirmedDriverPubkey = null;
    userGigRole.set('rider');
    addRideRequestToMap(request);
    currentView = 'pending';
    registerBeforeUnload();
    logger.info('Ride request submitted', { component: 'GigEconomy', operation: 'submitRideRequest' });
  }

  function submitDriverOffer() {
    if (!$userLiveLocation) {
      showError('GPS location not available. Please enable location services and try again.');
      return;
    }

    const geohash = geohashEncode($userLiveLocation.latitude, $userLiveLocation.longitude, 6);
    currentGeohash.set(geohash);

    service = createService();
    service.startAsDriver(geohash, {
      latitude: $userLiveLocation.latitude,
      longitude: $userLiveLocation.longitude,
    });

    userGigRole.set('driver');
    currentView = 'pending';
    registerBeforeUnload();
    logger.info('Driver offer submitted', { component: 'GigEconomy', operation: 'submitDriverOffer' });
  }

  // ─── Driver: Accept / Reject ────────────────────────────────
  function acceptMatch() {
    if (!matchedRequest || !service) return;
    const sent = service.acceptRequest(matchedRequest.pubkey, matchedRequest.id);
    if (sent) {
      awaitingConfirmation = true;
      logger.info('Sent accept, awaiting rider confirmation', { component: 'GigEconomy', operation: 'acceptMatch' });
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

    // Promote next request
    if (requestQueue.length > 0) {
      matchedRequest = requestQueue[0];
    }
    logger.info('Rejected ride request', { component: 'GigEconomy', operation: 'rejectMatch' });
  }

  // ─── Cancel Flows ──────────────────────────────────────────
  async function cancelRideRequest() {
    if (!myRideRequest || !service) return;

    // Update the public event to 'cancelled' — all drivers see it
    service.cancelRequest(myRideRequest);

    removeRideEntitiesFromMap(myRideRequest.id);
    myRideRequest = null;
    confirmedDriverPubkey = null;

    await stopService();
    userGigRole.set(null);
    currentView = 'menu';
    unregisterBeforeUnload();
    logger.info('Ride request cancelled', { component: 'GigEconomy', operation: 'cancelRideRequest' });
  }

  async function cancelDriverOffer() {
    matchedRequest = null;
    awaitingConfirmation = false;
    requestQueue = [];
    nearbyCount = 0;

    await stopService();
    userGigRole.set(null);
    currentView = 'menu';
    unregisterBeforeUnload();
    logger.info('Driver offer cancelled', { component: 'GigEconomy', operation: 'cancelDriverOffer' });
  }

  function goBack() {
    if (myRideRequest) {
      cancelRideRequest();
    } else if ($userGigRole === 'driver') {
      cancelDriverOffer();
    } else {
      currentView = 'menu';
    }
    isPickingDestination = false;
    isGigPickingDestination.set(false);
    destinationLat = '';
    destinationLon = '';
  }

  async function finishAndReset() {
    clearAllGigEntities();
    myRideRequest = null;
    matchedRequest = null;
    awaitingConfirmation = false;
    confirmedDriverPubkey = null;
    nearbyCount = 0;
    relayCount = 0;
    relayTotal = 0;
    requestQueue = [];

    await stopService();
    currentGeohash.set('');
    userGigRole.set(null);
    currentView = 'menu';
    destinationLat = '';
    destinationLon = '';
    unregisterBeforeUnload();
  }

  // ─── Service Cleanup ────────────────────────────────────────
  async function stopService() {
    if (service) {
      await service.stop();
      service = null;
    }
    relayCount = 0;
    relayTotal = 0;
    currentGeohash.set('');
    clearAllGigEntities();
  }

  // ─── beforeunload Warning ──────────────────────────────────
  function onBeforeUnload(e: BeforeUnloadEvent) {
    e.preventDefault();
    e.returnValue = 'Your ride request/offer will be deleted if you close this tab.';
    if (service) {
      service.stop();
    }
  }

  function registerBeforeUnload() {
    window.addEventListener('beforeunload', onBeforeUnload);
  }

  function unregisterBeforeUnload() {
    window.removeEventListener('beforeunload', onBeforeUnload);
  }

  // ─── Destination Picking ────────────────────────────────────
  let unsubCoords: (() => void) | null = null;

  $: if (isPickingDestination) {
    if (unsubCoords) unsubCoords();
    let skipFirst = true;
    unsubCoords = coordinates.subscribe(value => {
      if (skipFirst) { skipFirst = false; return; }
      if (isPickingDestination && value.latitude && value.longitude) {
        destinationLat = value.latitude;
        destinationLon = value.longitude;
        isPickingDestination = false;
        isGigPickingDestination.set(false);
      }
    });
  }

  // ─── Lifecycle ──────────────────────────────────────────────
  onDestroy(() => {
    clearAllGigEntities();
    isGigPickingDestination.set(false);
    if (unsubCoords) unsubCoords();
    if (service) {
      service.stop();
      service = null;
    }
    unregisterBeforeUnload();
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

  <!-- ═══════════════════════ MENU VIEW ═══════════════════════ -->
  {#if currentView === 'menu'}
    <div class="gig-menu" transition:slide={{ duration: 300 }}>
      <h3 class="gig-title">Gig Economy</h3>
      <p class="gig-subtitle">What would you like to do?</p>

      <div class="gig-actions">
        <button class="gig-action-btn need-ride" on:click={handleNeedRide}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
          <div class="action-text">
            <span class="action-label">I need a Ride</span>
            <span class="action-desc">Person or delivery</span>
          </div>
        </button>

        <button class="gig-action-btn offer-ride" on:click={handleOfferRide}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
          <div class="action-text">
            <span class="action-label">I offer a Ride</span>
            <span class="action-desc">Offer rides in your area</span>
          </div>
        </button>
      </div>
    </div>

  <!-- ═══════════════════ NEED RIDE FORM ═══════════════════ -->
  {:else if currentView === 'need-ride'}
    <div class="gig-form" transition:slide={{ duration: 300 }}>
      <button class="back-btn" on:click={goBack}>&larr; Back</button>
      <h3 class="gig-title">Request a Ride</h3>

      <div class="form-group">
        <span class="field-label">Start Location <span class="live-badge">LIVE</span></span>
        <p class="location-display">
          {#if $userLiveLocation}
            {$userLiveLocation.latitude.toFixed(5)}, {$userLiveLocation.longitude.toFixed(5)}
          {:else}
            <span class="location-hint">Waiting for GPS... Enable location services if this persists.</span>
          {/if}
        </p>
      </div>

      <div class="form-group">
        <span class="field-label">Destination</span>
        {#if destinationLat && destinationLon}
          <p class="location-display">
            {parseFloat(destinationLat).toFixed(5)}, {parseFloat(destinationLon).toFixed(5)}
          </p>
          <button class="pick-again-btn" on:click={handlePickDestination}>Pick again</button>
        {:else}
          <GlassmorphismButton
            variant="secondary"
            size="small"
            onClick={handlePickDestination}
          >
            {isPickingDestination ? 'Click on the map...' : 'Pick Destination on Map'}
          </GlassmorphismButton>
        {/if}
      </div>

      <div class="form-group">
        <span class="field-label">Type</span>
        <div class="ride-type-toggle">
          <button
            class="type-btn"
            class:active={rideType === 'person'}
            on:click={() => (rideType = 'person')}
          >
            Person
          </button>
          <button
            class="type-btn"
            class:active={rideType === 'delivery'}
            on:click={() => (rideType = 'delivery')}
          >
            Delivery
          </button>
        </div>
      </div>

      <GlassmorphismButton
        variant="primary"
        fullWidth={true}
        onClick={submitRideRequest}
        disabled={!$userLiveLocation || !destinationLat}
      >
        Request Ride
      </GlassmorphismButton>
    </div>

  <!-- ═══════════════════ OFFER RIDE FORM ══════════════════ -->
  {:else if currentView === 'offer-ride'}
    <div class="gig-form" transition:slide={{ duration: 300 }}>
      <button class="back-btn" on:click={goBack}>&larr; Back</button>
      <h3 class="gig-title">Offer a Ride</h3>

      <div class="form-group">
        <span class="field-label">Your Location <span class="live-badge">LIVE</span></span>
        <p class="location-display">
          {#if $userLiveLocation}
            {$userLiveLocation.latitude.toFixed(5)}, {$userLiveLocation.longitude.toFixed(5)}
          {:else}
            <span class="location-hint">Waiting for GPS... Enable location services if this persists.</span>
          {/if}
        </p>
      </div>

      <p class="hint">
        You'll be matched with riders in your geohash cell
        (~1.2 km × 0.6 km area around your location).
        Discovery and matching happen fully peer-to-peer.
      </p>

      <GlassmorphismButton
        variant="primary"
        fullWidth={true}
        onClick={submitDriverOffer}
        disabled={!$userLiveLocation}
      >
        Start Offering
      </GlassmorphismButton>
    </div>

  <!-- ═══════════════════ PENDING VIEW ═════════════════════ -->
  {:else if currentView === 'pending'}
    <div class="gig-pending" transition:slide={{ duration: 300 }}>

      <!-- ── Rider pending ── -->
      {#if myRideRequest && $userGigRole === 'rider'}
        <h3 class="gig-title">Waiting for Driver</h3>
        <div class="relay-status" class:connected={relayCount > 0} class:connecting={relayCount === 0 && relayTotal > 0} class:failed={relayCount === 0 && relayTotal === 0}>
          <span class="relay-dot"></span>
          {#if relayCount > 0}
            {relayCount}/{relayTotal} relays
          {:else if relayTotal > 0}
            Connecting to relays...
          {:else}
            No relays available
          {/if}
        </div>
        <div class="status-indicator">
          <div class="pulse-dot"></div>
          <span>
            {#if nearbyCount > 0}
              Found {nearbyCount} driver{nearbyCount !== 1 ? 's' : ''} nearby...
            {:else}
              Searching for nearby drivers...
            {/if}
          </span>
        </div>
        <p class="ride-info">
          {myRideRequest.rideType === 'person' ? 'Passenger' : 'Delivery'} ride
        </p>
        {#if $currentGeohash}
          <p class="cell-info">Cell: {$currentGeohash}</p>
        {/if}

        <div class="cancel-section">
          <GlassmorphismButton variant="danger" fullWidth={true} onClick={cancelRideRequest}>
            Cancel Request
          </GlassmorphismButton>
        </div>

      <!-- ── Driver pending ── -->
      {:else if $userGigRole === 'driver'}
        <h3 class="gig-title">Offering Rides</h3>
        <div class="relay-status" class:connected={relayCount > 0} class:connecting={relayCount === 0 && relayTotal > 0} class:failed={relayCount === 0 && relayTotal === 0}>
          <span class="relay-dot"></span>
          {#if relayCount > 0}
            {relayCount}/{relayTotal} relays
          {:else if relayTotal > 0}
            Connecting to relays...
          {:else}
            No relays available
          {/if}
        </div>
        <div class="status-indicator">
          <div class="pulse-dot driver"></div>
          <span>
            {#if nearbyCount > 0}
              Found {nearbyCount} rider{nearbyCount !== 1 ? 's' : ''} nearby...
            {:else}
              Listening for riders in your cell...
            {/if}
          </span>
        </div>
        {#if $currentGeohash}
          <p class="cell-info">Cell: {$currentGeohash}</p>
        {/if}

        <!-- Awaiting rider confirmation after clicking Accept -->
        {#if awaitingConfirmation}
          <div class="confirming-card">
            <div class="status-indicator">
              <div class="pulse-dot"></div>
              <span>Confirming with rider...</span>
            </div>
          </div>

        <!-- New match available to accept/reject -->
        {:else if matchedRequest}
          <div class="match-card">
            <h4>New Request!</h4>
            <p class="match-type">
              {matchedRequest.rideType === 'person' ? 'Passenger' : 'Delivery'}
            </p>
            <p class="match-detail">From rider in your cell</p>
            <div class="match-actions">
              <GlassmorphismButton variant="success" size="small" onClick={acceptMatch}>
                Accept
              </GlassmorphismButton>
              <GlassmorphismButton variant="danger" size="small" onClick={rejectMatch}>
                Decline
              </GlassmorphismButton>
            </div>
          </div>
        {/if}

        <div class="cancel-section">
          <GlassmorphismButton variant="danger" fullWidth={true} onClick={cancelDriverOffer}>
            Stop Offering
          </GlassmorphismButton>
        </div>
      {/if}
    </div>

  <!-- ═══════════════════ MATCHED VIEW ═════════════════════ -->
  {:else if currentView === 'matched'}
    <div class="gig-matched" transition:slide={{ duration: 300 }}>
      <h3 class="gig-title">Ride Matched!</h3>
      <div class="match-success">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p>Your ride has been confirmed.</p>
        <p class="match-peer-info">
          Connected directly via P2P
        </p>
      </div>
      <GlassmorphismButton variant="secondary" fullWidth={true} onClick={finishAndReset}>
        Done
      </GlassmorphismButton>
    </div>
  {/if}
</div>

<style>
  .gig-economy {
    padding: 1rem;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 320px;
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

  .gig-title {
    margin: 0 0 0.25rem 0;
    font-size: 1.2rem;
    font-weight: 700;
  }

  .gig-subtitle {
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
  }

  /* ── Actions Menu ── */
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
  }

  .gig-action-btn.need-ride:hover {
    border-color: rgba(66, 133, 244, 0.5);
  }

  .gig-action-btn.offer-ride:hover {
    border-color: rgba(251, 188, 4, 0.5);
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

  /* ── Back Button ── */
  .back-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0;
    margin-bottom: 0.5rem;
    transition: color 0.2s;
    text-align: left;
  }

  .back-btn:hover {
    color: white;
  }

  /* ── Form ── */
  .gig-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .form-group .field-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
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

  .ride-type-toggle {
    display: flex;
    gap: 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .type-btn {
    flex: 1;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .type-btn.active {
    background: rgba(66, 133, 244, 0.3);
    color: white;
  }

  .type-btn:first-child {
    border-right: 1px solid rgba(255, 255, 255, 0.15);
  }

  .hint {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
    line-height: 1.4;
  }

  /* ── Pending View ── */
  .gig-pending {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

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
    background: #4285F4;
    animation: gig-pulse 1.5s ease-in-out infinite;
    flex-shrink: 0;
  }

  .pulse-dot.driver {
    background: #FBBC04;
  }

  @keyframes gig-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.3); }
  }

  .ride-info {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
  }

  .cell-info {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.35);
    margin: 0;
    font-family: monospace;
  }

  .relay-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    padding: 2px 10px;
    border-radius: 12px;
    margin-bottom: 8px;
    font-family: monospace;
    transition: all 0.3s ease;
  }
  .relay-status.connected {
    color: rgba(100, 255, 160, 0.85);
    background: rgba(100, 255, 160, 0.08);
  }
  .relay-status.connecting {
    color: rgba(255, 200, 100, 0.85);
    background: rgba(255, 200, 100, 0.08);
  }
  .relay-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
  }
  .relay-status.connected .relay-dot {
    background: rgba(100, 255, 160, 0.9);
    box-shadow: 0 0 4px rgba(100, 255, 160, 0.5);
  }
  .relay-status.connecting .relay-dot {
    background: rgba(255, 200, 100, 0.9);
    animation: relay-blink 1s ease-in-out infinite;
  }
  .relay-status.failed {
    color: rgba(252, 165, 165, 0.85);
    background: rgba(239, 68, 68, 0.08);
  }
  .relay-status.failed .relay-dot {
    background: rgba(239, 68, 68, 0.9);
  }
  @keyframes relay-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .cancel-section {
    margin-top: 0.5rem;
  }

  /* ── Match Card ── */
  .match-card {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(74, 222, 128, 0.3);
    border-radius: 12px;
    padding: 1rem;
  }

  .match-card h4 {
    margin: 0 0 0.5rem 0;
    color: #4ade80;
    font-size: 1rem;
  }

  .match-type {
    margin: 0.25rem 0;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .match-detail {
    margin: 0.25rem 0;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .match-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .confirming-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(66, 133, 244, 0.3);
    border-radius: 12px;
    padding: 1rem;
  }

  /* ── Matched View ── */
  .gig-matched {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    text-align: center;
  }

  .match-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 0;
  }

  .match-success p {
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
  }

  .match-peer-info {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.4) !important;
  }

  /* ── Live Badge ── */
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

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .gig-economy {
      max-width: 280px;
      padding: 0.75rem;
    }

    .gig-action-btn {
      padding: 12px 14px;
    }
  }
</style>
