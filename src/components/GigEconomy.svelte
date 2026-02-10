<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import { fade, slide } from 'svelte/transition';
  import { joinRoom } from 'trystero';
  import { coordinates, viewer, rideRequests, driverOffers, userGigRole, isGigPickingDestination, userLiveLocation } from '../store';
  import type { RideRequest, DriverOffer, RideType } from '../types';
  import { getCurrentTimeIso8601 } from '../utils/timeUtils';
  import { logger } from '../utils/logger';
  import GlassmorphismButton from './GlassmorphismButton.svelte';
  import * as Cesium from 'cesium';

  // ─── View State ──────────────────────────────────────────────
  type GigView = 'menu' | 'need-ride' | 'offer-ride' | 'pending' | 'matched';
  let currentView: GigView = 'menu';

  // ─── Ride Request Form ───────────────────────────────────────
  let rideType: RideType = 'person';
  let destinationLat = '';
  let destinationLon = '';
  let isPickingDestination = false;

  // ─── Driver Offer Form ───────────────────────────────────────
  let driverRadiusKm = 4;

  // ─── User's Own State ────────────────────────────────────────
  let myRideRequest: RideRequest | null = null;
  let myDriverOffer: DriverOffer | null = null;
  let matchedRequest: RideRequest | null = null;
  let awaitingConfirmation = false;

  // Rider-as-arbiter lock: once set, no other driver can claim this ride
  let rideConfirmedDriverId: string | null = null;

  // ─── Cesium Entities ─────────────────────────────────────────
  let rideEntities: any[] = [];
  let driverEntities: any[] = [];

  // ─── Trystero P2P ───────────────────────────────────────────
  const config = { appId: 'cloud-atlas-gig' };
  const room = joinRoom(config, 'gig-economy-room');
  const myPeerId = crypto.randomUUID();

  // P2P Actions — 3-step matching + cancel flows
  // Note: Trystero action names must be ≤12 bytes
  const [sendRideRequest, onRideRequest] = room.makeAction('rideReq');
  const [sendDriverOffer, onDriverOffer] = room.makeAction('drvOffer');
  const [sendAccept, onAccept] = room.makeAction('gigAccept');
  const [sendConfirm, onConfirm] = room.makeAction('gigConfirm');
  const [sendAlreadyTaken, onAlreadyTaken] = room.makeAction('gigTaken');
  const [sendReject, onReject] = room.makeAction('gigReject');
  const [sendCancelRide, onCancelRide] = room.makeAction('gigCxRide');
  const [sendCancelOffer, onCancelOffer] = room.makeAction('gigCxOffer');

  // ─── Haversine Distance ──────────────────────────────────────
  function haversineDistanceKm(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ─── Matching Logic ──────────────────────────────────────────
  function findMatchingDrivers(request: RideRequest): DriverOffer[] {
    return $driverOffers.filter(driver => {
      if (!driver.isAvailable) return false;
      const distance = haversineDistanceKm(
        request.startLocation.latitude, request.startLocation.longitude,
        driver.currentLocation.latitude, driver.currentLocation.longitude
      );
      return distance <= driver.radiusKm;
    });
  }

  function findMatchingRequests(offer: DriverOffer): RideRequest[] {
    return $rideRequests.filter(request => {
      if (request.status !== 'pending') return false;
      const distance = haversineDistanceKm(
        request.startLocation.latitude, request.startLocation.longitude,
        offer.currentLocation.latitude, offer.currentLocation.longitude
      );
      return distance <= offer.radiusKm;
    });
  }

  // ─── Cesium Visualization ────────────────────────────────────
  function addRideRequestToMap(request: RideRequest) {
    if (!$viewer) return;

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

    // Dashed line from start → destination
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

  function addDriverOfferToMap(offer: DriverOffer) {
    if (!$viewer) return;

    // Yellow point + radius circle
    const entity = $viewer.entities.add({
      id: `driver_${offer.id}`,
      position: Cesium.Cartesian3.fromDegrees(
        offer.currentLocation.longitude,
        offer.currentLocation.latitude,
        0
      ),
      ellipse: {
        semiMajorAxis: offer.radiusKm * 1000,
        semiMinorAxis: offer.radiusKm * 1000,
        material: Cesium.Color.fromCssColorString('#4285F4').withAlpha(0.12),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#4285F4').withAlpha(0.4),
        outlineWidth: 2,
        height: 0,
      },
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString('#FBBC04'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    driverEntities.push(entity);
  }

  function updateDriverEntityOnMap(offer: DriverOffer) {
    if (!$viewer) return;
    const entity = $viewer.entities.getById(`driver_${offer.id}`);
    if (entity) {
      (entity.position as any) = Cesium.Cartesian3.fromDegrees(
        offer.currentLocation.longitude,
        offer.currentLocation.latitude,
        0
      );
    }
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

  function removeDriverEntitiesFromMap(offerId: string) {
    if (!$viewer) return;
    driverEntities = driverEntities.filter(entity => {
      if (entity.id === `driver_${offerId}`) {
        $viewer.entities.remove(entity);
        return false;
      }
      return true;
    });
  }

  function clearAllGigEntities() {
    if (!$viewer) return;
    [...rideEntities, ...driverEntities].forEach(entity => {
      try { $viewer.entities.remove(entity); } catch (_) { /* already removed */ }
    });
    rideEntities = [];
    driverEntities = [];
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
      logger.warn('No live GPS location available', { component: 'GigEconomy', operation: 'submitRideRequest' });
      return;
    }
    if (!destinationLat || !destinationLon) {
      logger.warn('No destination set', { component: 'GigEconomy', operation: 'submitRideRequest' });
      return;
    }

    const request: RideRequest = {
      id: crypto.randomUUID(),
      startLocation: {
        latitude: $userLiveLocation.latitude,
        longitude: $userLiveLocation.longitude,
      },
      destination: {
        latitude: parseFloat(destinationLat),
        longitude: parseFloat(destinationLon),
      },
      rideType,
      status: 'pending',
      matchedDriverId: null,
      timestamp: getCurrentTimeIso8601(),
      requesterId: myPeerId,
    };

    myRideRequest = request;
    rideConfirmedDriverId = null;
    rideRequests.update(r => [...r, request]);
    userGigRole.set('rider');
    sendRideRequest(request);
    addRideRequestToMap(request);

    currentView = 'pending';
    logger.info('Ride request submitted', { component: 'GigEconomy', operation: 'submitRideRequest' });
  }

  function submitDriverOffer() {
    if (!$userLiveLocation) {
      logger.warn('No live GPS location available', { component: 'GigEconomy', operation: 'submitDriverOffer' });
      return;
    }

    const offer: DriverOffer = {
      id: crypto.randomUUID(),
      currentLocation: {
        latitude: $userLiveLocation.latitude,
        longitude: $userLiveLocation.longitude,
      },
      radiusKm: driverRadiusKm,
      isAvailable: true,
      timestamp: getCurrentTimeIso8601(),
      driverId: myPeerId,
    };

    myDriverOffer = offer;
    driverOffers.update(d => [...d, offer]);
    userGigRole.set('driver');
    sendDriverOffer(offer);
    addDriverOfferToMap(offer);

    // Check for existing matching requests
    const matching = findMatchingRequests(offer);
    if (matching.length > 0) {
      matchedRequest = matching[0];
    }

    currentView = 'pending';
    startDriverLocationUpdates();
    logger.info('Driver offer submitted', { component: 'GigEconomy', operation: 'submitDriverOffer' });
  }

  // ─── Driver: Accept / Reject ─────────────────────────────────
  function acceptMatch() {
    if (!matchedRequest || !myDriverOffer) return;
    // Don't jump to matched yet — wait for rider's confirmation (3-step flow)
    awaitingConfirmation = true;
    sendAccept({
      rideRequestId: matchedRequest.id,
      driverId: myPeerId,
    });
    logger.info('Sent accept, awaiting rider confirmation', { component: 'GigEconomy', operation: 'acceptMatch' });
  }

  function rejectMatch() {
    if (!matchedRequest) return;
    sendReject({
      rideRequestId: matchedRequest.id,
      driverId: myPeerId,
    });
    matchedRequest = null;
    awaitingConfirmation = false;
    logger.info('Rejected ride request', { component: 'GigEconomy', operation: 'rejectMatch' });
  }

  // ─── Cancel Flows ────────────────────────────────────────────
  function cancelRideRequest() {
    if (!myRideRequest) return;
    myRideRequest.status = 'cancelled';
    sendCancelRide({ rideRequestId: myRideRequest.id });
    removeRideEntitiesFromMap(myRideRequest.id);
    rideRequests.update(r => r.filter(req => req.id !== myRideRequest!.id));
    myRideRequest = null;
    rideConfirmedDriverId = null;
    userGigRole.set(null);
    currentView = 'menu';
    logger.info('Ride request cancelled', { component: 'GigEconomy', operation: 'cancelRideRequest' });
  }

  function cancelDriverOffer() {
    if (!myDriverOffer) return;
    myDriverOffer.isAvailable = false;
    sendCancelOffer({ driverOfferId: myDriverOffer.id });
    removeDriverEntitiesFromMap(myDriverOffer.id);
    driverOffers.update(d => d.filter(o => o.id !== myDriverOffer!.id));
    myDriverOffer = null;
    matchedRequest = null;
    awaitingConfirmation = false;
    stopDriverLocationUpdates();
    userGigRole.set(null);
    currentView = 'menu';
    logger.info('Driver offer cancelled', { component: 'GigEconomy', operation: 'cancelDriverOffer' });
  }

  function goBack() {
    // Back acts as cancel if the user has an active request/offer
    if (myRideRequest) {
      cancelRideRequest();
    } else if (myDriverOffer) {
      cancelDriverOffer();
    } else {
      currentView = 'menu';
    }
    isPickingDestination = false;
    isGigPickingDestination.set(false);
    destinationLat = '';
    destinationLon = '';
  }

  function finishAndReset() {
    clearAllGigEntities();
    myRideRequest = null;
    myDriverOffer = null;
    matchedRequest = null;
    awaitingConfirmation = false;
    rideConfirmedDriverId = null;
    stopDriverLocationUpdates();
    userGigRole.set(null);
    currentView = 'menu';
    destinationLat = '';
    destinationLon = '';
  }

  // ─── P2P Listeners ──────────────────────────────────────────

  // Incoming ride request (seen by drivers)
  onRideRequest((data: any) => {
    if (!data || !data.id || data.requesterId === myPeerId) return;
    const request = data as RideRequest;

    rideRequests.update(r => {
      if (r.some(existing => existing.id === request.id)) return r;
      return [...r, request];
    });
    addRideRequestToMap(request);

    // If I'm an active driver, check spatial match
    if (myDriverOffer && myDriverOffer.isAvailable && !matchedRequest && !awaitingConfirmation) {
      const distance = haversineDistanceKm(
        request.startLocation.latitude, request.startLocation.longitude,
        myDriverOffer.currentLocation.latitude, myDriverOffer.currentLocation.longitude
      );
      if (distance <= myDriverOffer.radiusKm) {
        matchedRequest = request;
      }
    }
  });

  // Incoming driver offer (seen by riders)
  onDriverOffer((data: any) => {
    if (!data || !data.id || data.driverId === myPeerId) return;
    const offer = data as DriverOffer;

    driverOffers.update(d => {
      if (d.some(existing => existing.id === offer.id)) return d;
      return [...d, offer];
    });
    addDriverOfferToMap(offer);
  });

  // Rider receives accept from a driver — ARBITER LOGIC
  onAccept((data: any) => {
    if (!data || !myRideRequest) return;
    if (data.rideRequestId !== myRideRequest.id) return;

    if (rideConfirmedDriverId === null) {
      // First driver to accept — lock it in
      rideConfirmedDriverId = data.driverId;
      myRideRequest.status = 'accepted';
      myRideRequest.matchedDriverId = data.driverId;
      myRideRequest = myRideRequest; // trigger reactivity

      sendConfirm({
        rideRequestId: myRideRequest.id,
        driverId: data.driverId,
      });

      currentView = 'matched';
      logger.info('Ride confirmed with driver', { component: 'GigEconomy', operation: 'onAccept' });
    } else {
      // Another driver tried to accept — too late
      sendAlreadyTaken({
        rideRequestId: myRideRequest.id,
        driverId: data.driverId,
      });
    }
  });

  // Driver receives confirmation from rider — you got it
  onConfirm((data: any) => {
    if (!data || data.driverId !== myPeerId) return;
    awaitingConfirmation = false;
    currentView = 'matched';
    logger.info('Rider confirmed the match!', { component: 'GigEconomy', operation: 'onConfirm' });
  });

  // Driver receives already-taken — someone else got it
  onAlreadyTaken((data: any) => {
    if (!data || data.driverId !== myPeerId) return;
    awaitingConfirmation = false;
    matchedRequest = null;
    logger.info('Ride was taken by another driver', { component: 'GigEconomy', operation: 'onAlreadyTaken' });
  });

  // Driver or rider receives a rejection
  onReject((data: any) => {
    if (!data) return;
    // If I'm a rider and my ride was rejected by a driver
    if (myRideRequest && data.rideRequestId === myRideRequest.id) {
      myRideRequest.status = 'pending';
      myRideRequest.matchedDriverId = null;
      myRideRequest = myRideRequest;
    }
  });

  // Someone cancelled their ride request
  onCancelRide((data: any) => {
    if (!data || !data.rideRequestId) return;
    rideRequests.update(r => r.filter(req => req.id !== data.rideRequestId));
    removeRideEntitiesFromMap(data.rideRequestId);

    // If the driver was looking at or confirming this request
    if (matchedRequest && matchedRequest.id === data.rideRequestId) {
      matchedRequest = null;
      awaitingConfirmation = false;
    }
  });

  // Someone cancelled their driver offer
  onCancelOffer((data: any) => {
    if (!data || !data.driverOfferId) return;
    driverOffers.update(d => d.filter(o => o.id !== data.driverOfferId));
    removeDriverEntitiesFromMap(data.driverOfferId);
  });

  // ─── Live Location Updates (driver) ─────────────────────────
  let locationUpdateInterval: ReturnType<typeof setInterval> | null = null;

  function startDriverLocationUpdates() {
    if (locationUpdateInterval) return;
    locationUpdateInterval = setInterval(() => {
      if (!myDriverOffer || !$userLiveLocation) return;
      // Update local offer
      myDriverOffer.currentLocation = {
        latitude: $userLiveLocation.latitude,
        longitude: $userLiveLocation.longitude,
      };
      myDriverOffer = myDriverOffer; // trigger reactivity
      // Broadcast updated position to peers
      sendDriverOffer(myDriverOffer);
      // Update map entity
      updateDriverEntityOnMap(myDriverOffer);
    }, 10000); // every 10s
  }

  function stopDriverLocationUpdates() {
    if (locationUpdateInterval) {
      clearInterval(locationUpdateInterval);
      locationUpdateInterval = null;
    }
  }

  // ─── Destination Picking ─────────────────────────────────────
  let unsubCoords: (() => void) | null = null;

  $: if (isPickingDestination) {
    if (unsubCoords) unsubCoords();
    let skipFirst = true;
    unsubCoords = coordinates.subscribe(value => {
      // Skip the initial subscription fire
      if (skipFirst) { skipFirst = false; return; }
      if (isPickingDestination && value.latitude && value.longitude) {
        destinationLat = value.latitude;
        destinationLon = value.longitude;
        isPickingDestination = false;
        isGigPickingDestination.set(false);
      }
    });
  }

  // ─── Lifecycle ───────────────────────────────────────────────
  onDestroy(() => {
    clearAllGigEntities();
    stopDriverLocationUpdates();
    isGigPickingDestination.set(false);
    if (unsubCoords) unsubCoords();
    try { room.leave(); } catch (_) { /* room may already be left */ }
  });
</script>

<div class="gig-economy" transition:fade={{ duration: 300 }}>

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
            <span class="action-desc">Set your service radius</span>
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
            <span class="location-hint">Waiting for GPS signal...</span>
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
            <span class="location-hint">Waiting for GPS signal...</span>
          {/if}
        </p>
      </div>

      <div class="form-group">
        <label for="radius-slider">Service Radius: {driverRadiusKm} km</label>
        <input
          id="radius-slider"
          type="range"
          min="3"
          max="5"
          step="0.5"
          bind:value={driverRadiusKm}
          class="radius-slider"
        />
        <div class="radius-labels">
          <span>3 km</span>
          <span>5 km</span>
        </div>
      </div>

      <p class="hint">
        You'll be automatically matched with ride requests
        starting within your {driverRadiusKm} km radius.
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
      {#if myRideRequest}
        <h3 class="gig-title">Waiting for Driver</h3>
        <div class="status-indicator">
          <div class="pulse-dot"></div>
          <span>
            {#if myRideRequest.status === 'matched'}
              Driver found! Waiting for confirmation...
            {:else}
              Searching for nearby drivers...
            {/if}
          </span>
        </div>
        <p class="ride-info">
          {myRideRequest.rideType === 'person' ? 'Passenger' : 'Delivery'} ride
        </p>

        <div class="cancel-section">
          <GlassmorphismButton variant="danger" fullWidth={true} onClick={cancelRideRequest}>
            Cancel Request
          </GlassmorphismButton>
        </div>

      <!-- ── Driver pending ── -->
      {:else if myDriverOffer}
        <h3 class="gig-title">Offering Rides</h3>
        <div class="status-indicator">
          <div class="pulse-dot driver"></div>
          <span>Listening for rides within {myDriverOffer.radiusKm} km...</span>
        </div>

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
            <p class="match-distance">
              {haversineDistanceKm(
                matchedRequest.startLocation.latitude,
                matchedRequest.startLocation.longitude,
                myDriverOffer.currentLocation.latitude,
                myDriverOffer.currentLocation.longitude
              ).toFixed(1)} km away
            </p>
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

  .form-group label,
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

  .radius-slider {
    width: 100%;
    accent-color: #4285F4;
    margin: 0.25rem 0;
  }

  .radius-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
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

  .match-distance {
    margin: 0.25rem 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: white;
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
