<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { coordinates, viewer, rideRequests, userGigRole, isGigPickingDestination, userLiveLocation, gigPeers, currentGeohash } from '../store';
  import type { RideRequest, RideType, GigPeer, GigP2PMessage } from '../types';
  import { getCurrentTimeIso8601 } from '../utils/timeUtils';
  import { encode as geohashEncode } from '../utils/geohash';
  import { logger } from '../utils/logger';
  import { GigP2P } from '../services/gigP2P';
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

  // ─── User's Own State ────────────────────────────────────────
  let myRideRequest: RideRequest | null = null;
  let matchedRequest: RideRequest | null = null;
  let awaitingConfirmation = false;
  let connectedPeerCount = 0;

  // Rider-as-arbiter lock: once set, no other driver can claim this ride
  let rideConfirmedDriverPubkey: string | null = null;
  // The pubkey of the matched peer (driver or rider)
  let matchedPeerPubkey: string | null = null;

  // ─── Cesium Entities ─────────────────────────────────────────
  let rideEntities: any[] = [];
  let peerEntities: any[] = [];

  // ─── GigP2P Orchestrator ───────────────────────────────────
  let p2p: GigP2P | null = null;

  function createP2P(): GigP2P {
    return new GigP2P({
      onPeerDiscovered: (peer: GigPeer) => {
        gigPeers.update(p => [...p, peer]);
        addPeerToMap(peer);
        logger.info(`Peer discovered: ${peer.pubkey.slice(0, 8)} (${peer.role})`, { component: 'GigEconomy', operation: 'onPeerDiscovered' });
      },
      onPeerConnected: (pubkey: string) => {
        connectedPeerCount = p2p?.getConnectedPeerPubkeys().length ?? 0;
        logger.info(`Peer connected: ${pubkey.slice(0, 8)}`, { component: 'GigEconomy', operation: 'onPeerConnected' });

        // If I'm a rider and a driver just connected, send my ride request
        if (myRideRequest && $userGigRole === 'rider') {
          p2p?.sendTo(pubkey, { type: 'ride-request', request: myRideRequest });
        }
      },
      onPeerDisconnected: (pubkey: string) => {
        connectedPeerCount = p2p?.getConnectedPeerPubkeys().length ?? 0;
        gigPeers.update(p => p.filter(peer => peer.pubkey !== pubkey));
        removePeerFromMap(pubkey);

        // If the matched request's rider disconnected, clear it
        if (matchedRequest && matchedRequest.pubkey === pubkey) {
          matchedRequest = null;
          awaitingConfirmation = false;
        }

        logger.info(`Peer disconnected: ${pubkey.slice(0, 8)}`, { component: 'GigEconomy', operation: 'onPeerDisconnected' });
      },
      onMessage: handleP2PMessage,
    });
  }

  // ─── P2P Message Handler ───────────────────────────────────
  function handleP2PMessage(fromPubkey: string, message: GigP2PMessage) {
    switch (message.type) {
      case 'ride-request':
        handleIncomingRideRequest(fromPubkey, message.request);
        break;
      case 'accept':
        handleIncomingAccept(fromPubkey, message);
        break;
      case 'confirm':
        handleIncomingConfirm(fromPubkey, message);
        break;
      case 'taken':
        handleIncomingTaken(fromPubkey);
        break;
      case 'reject':
        handleIncomingReject(fromPubkey, message);
        break;
      case 'cancel-ride':
        handleIncomingCancelRide(fromPubkey, message);
        break;
      case 'cancel-offer':
        handleIncomingCancelOffer(fromPubkey);
        break;
    }
  }

  // Driver receives a ride request from a connected rider
  function handleIncomingRideRequest(fromPubkey: string, request: RideRequest) {
    if ($userGigRole !== 'driver') return;

    rideRequests.update(r => {
      if (r.some(existing => existing.id === request.id)) return r;
      return [...r, request];
    });
    addRideRequestToMap(request);

    // Show as match card if we don't already have one
    if (!matchedRequest && !awaitingConfirmation) {
      matchedRequest = request;
    }
  }

  // Rider receives accept from a driver — ARBITER LOGIC
  function handleIncomingAccept(fromPubkey: string, message: GigP2PMessage & { type: 'accept' }) {
    if (!myRideRequest || $userGigRole !== 'rider') return;
    if (message.rideRequestId !== myRideRequest.id) return;

    if (rideConfirmedDriverPubkey === null) {
      // First driver to accept → lock it in
      rideConfirmedDriverPubkey = fromPubkey;
      matchedPeerPubkey = fromPubkey;
      myRideRequest.status = 'accepted';
      myRideRequest.matchedDriverId = fromPubkey;
      myRideRequest = myRideRequest; // trigger reactivity

      p2p?.sendTo(fromPubkey, {
        type: 'confirm',
        rideRequestId: myRideRequest.id,
        riderPubkey: p2p.pubkey,
      });

      // Finalize: keep only the matched connection
      p2p?.finalizeMatch(fromPubkey);

      currentView = 'matched';
      logger.info('Ride confirmed with driver', { component: 'GigEconomy', operation: 'handleIncomingAccept' });
    } else {
      // Another driver tried to accept → too late
      p2p?.sendTo(fromPubkey, {
        type: 'taken',
        rideRequestId: myRideRequest.id,
        riderPubkey: p2p!.pubkey,
      });
    }
  }

  // Driver receives confirmation from rider
  function handleIncomingConfirm(fromPubkey: string, message: GigP2PMessage & { type: 'confirm' }) {
    if ($userGigRole !== 'driver') return;
    awaitingConfirmation = false;
    matchedPeerPubkey = fromPubkey;

    // Finalize: keep only the matched connection
    p2p?.finalizeMatch(fromPubkey);

    currentView = 'matched';
    logger.info('Rider confirmed the match!', { component: 'GigEconomy', operation: 'handleIncomingConfirm' });
  }

  // Driver receives already-taken
  function handleIncomingTaken(fromPubkey: string) {
    if ($userGigRole !== 'driver') return;
    awaitingConfirmation = false;
    matchedRequest = null;

    // Look for other pending requests
    const otherRequests = $rideRequests.filter(r => r.status === 'pending' && r.pubkey !== fromPubkey);
    if (otherRequests.length > 0) {
      matchedRequest = otherRequests[0];
    }

    logger.info('Ride was taken by another driver', { component: 'GigEconomy', operation: 'handleIncomingTaken' });
  }

  // Rider receives a rejection from a driver
  function handleIncomingReject(fromPubkey: string, message: GigP2PMessage & { type: 'reject' }) {
    if (!myRideRequest || $userGigRole !== 'rider') return;
    if (message.rideRequestId === myRideRequest.id) {
      // Reset to pending — another driver might still accept
      myRideRequest.status = 'pending';
      myRideRequest.matchedDriverId = null;
      myRideRequest = myRideRequest;
    }
  }

  // Driver or rider: someone cancelled their ride request
  function handleIncomingCancelRide(fromPubkey: string, message: GigP2PMessage & { type: 'cancel-ride' }) {
    rideRequests.update(r => r.filter(req => req.id !== message.rideRequestId));
    removeRideEntitiesFromMap(message.rideRequestId);

    if (matchedRequest && matchedRequest.id === message.rideRequestId) {
      matchedRequest = null;
      awaitingConfirmation = false;
    }
  }

  // Rider: a driver cancelled their offer (disconnected)
  function handleIncomingCancelOffer(fromPubkey: string) {
    removePeerFromMap(fromPubkey);
    gigPeers.update(p => p.filter(peer => peer.pubkey !== fromPubkey));
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

  function addPeerToMap(peer: GigPeer) {
    if (!$viewer || !peer.startLocation) return;
    const entityId = `peer_${peer.pubkey}`;
    if ($viewer.entities.getById(entityId)) return;

    const isDriver = peer.role === 'driver';
    const entity = $viewer.entities.add({
      id: entityId,
      position: Cesium.Cartesian3.fromDegrees(
        peer.startLocation.longitude,
        peer.startLocation.latitude,
        0
      ),
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString(isDriver ? '#FBBC04' : '#4285F4'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: isDriver ? 'Driver' : 'Rider',
        font: '11px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -14),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    peerEntities.push(entity);
  }

  function removePeerFromMap(pubkey: string) {
    if (!$viewer) return;
    const entityId = `peer_${pubkey}`;
    peerEntities = peerEntities.filter(entity => {
      if (entity.id === entityId) {
        $viewer.entities.remove(entity);
        return false;
      }
      return true;
    });
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
    [...rideEntities, ...peerEntities].forEach(entity => {
      try { $viewer.entities.remove(entity); } catch (_) { /* already removed */ }
    });
    rideEntities = [];
    peerEntities = [];
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

  async function submitRideRequest() {
    if (!$userLiveLocation) {
      logger.warn('No live GPS location available', { component: 'GigEconomy', operation: 'submitRideRequest' });
      return;
    }
    if (!destinationLat || !destinationLon) {
      logger.warn('No destination set', { component: 'GigEconomy', operation: 'submitRideRequest' });
      return;
    }

    const geohash = geohashEncode($userLiveLocation.latitude, $userLiveLocation.longitude, 6);
    currentGeohash.set(geohash);

    // Create P2P instance and start
    p2p = createP2P();
    await p2p.start('rider', geohash, {
      geohash,
      role: 'rider',
      rideType,
      startLocation: {
        latitude: $userLiveLocation.latitude,
        longitude: $userLiveLocation.longitude,
      },
      destination: {
        latitude: parseFloat(destinationLat),
        longitude: parseFloat(destinationLon),
      },
    });

    const request: RideRequest = {
      id: crypto.randomUUID(),
      pubkey: p2p.pubkey,
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
      geohash,
    };

    myRideRequest = request;
    rideConfirmedDriverPubkey = null;
    rideRequests.update(r => [...r, request]);
    userGigRole.set('rider');
    addRideRequestToMap(request);

    currentView = 'pending';
    registerBeforeUnload();
    logger.info('Ride request submitted', { component: 'GigEconomy', operation: 'submitRideRequest' });
  }

  async function submitDriverOffer() {
    if (!$userLiveLocation) {
      logger.warn('No live GPS location available', { component: 'GigEconomy', operation: 'submitDriverOffer' });
      return;
    }

    const geohash = geohashEncode($userLiveLocation.latitude, $userLiveLocation.longitude, 6);
    currentGeohash.set(geohash);

    // Create P2P instance and start
    p2p = createP2P();
    await p2p.start('driver', geohash, {
      geohash,
      role: 'driver',
      startLocation: {
        latitude: $userLiveLocation.latitude,
        longitude: $userLiveLocation.longitude,
      },
    });

    userGigRole.set('driver');
    currentView = 'pending';
    registerBeforeUnload();
    logger.info('Driver offer submitted', { component: 'GigEconomy', operation: 'submitDriverOffer' });
  }

  // ─── Driver: Accept / Reject ─────────────────────────────────
  function acceptMatch() {
    if (!matchedRequest || !p2p) return;
    awaitingConfirmation = true;
    p2p.sendTo(matchedRequest.pubkey, {
      type: 'accept',
      rideRequestId: matchedRequest.id,
      driverPubkey: p2p.pubkey,
    });
    logger.info('Sent accept, awaiting rider confirmation', { component: 'GigEconomy', operation: 'acceptMatch' });
  }

  function rejectMatch() {
    if (!matchedRequest || !p2p) return;
    p2p.sendTo(matchedRequest.pubkey, {
      type: 'reject',
      rideRequestId: matchedRequest.id,
      driverPubkey: p2p.pubkey,
    });
    const rejectedId = matchedRequest.id;
    matchedRequest = null;
    awaitingConfirmation = false;

    // Check for other pending requests
    const others = $rideRequests.filter(r => r.status === 'pending' && r.id !== rejectedId);
    if (others.length > 0) {
      matchedRequest = others[0];
    }
    logger.info('Rejected ride request', { component: 'GigEconomy', operation: 'rejectMatch' });
  }

  // ─── Cancel Flows ────────────────────────────────────────────
  async function cancelRideRequest() {
    if (!myRideRequest) return;

    // Notify all connected peers
    if (p2p) {
      p2p.broadcastMessage({ type: 'cancel-ride', rideRequestId: myRideRequest.id });
    }

    removeRideEntitiesFromMap(myRideRequest.id);
    rideRequests.update(r => r.filter(req => req.id !== myRideRequest!.id));
    myRideRequest = null;
    rideConfirmedDriverPubkey = null;

    await stopP2P();
    userGigRole.set(null);
    currentView = 'menu';
    unregisterBeforeUnload();
    logger.info('Ride request cancelled', { component: 'GigEconomy', operation: 'cancelRideRequest' });
  }

  async function cancelDriverOffer() {
    if (!p2p) return;

    // Notify all connected peers
    p2p.broadcastMessage({ type: 'cancel-offer', driverPubkey: p2p.pubkey });

    matchedRequest = null;
    awaitingConfirmation = false;

    await stopP2P();
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
    rideConfirmedDriverPubkey = null;
    matchedPeerPubkey = null;
    connectedPeerCount = 0;

    if (p2p) {
      await p2p.finish();
      p2p = null;
    }

    rideRequests.set([]);
    gigPeers.set([]);
    currentGeohash.set('');
    userGigRole.set(null);
    currentView = 'menu';
    destinationLat = '';
    destinationLon = '';
    unregisterBeforeUnload();
  }

  // ─── P2P Cleanup Helper ─────────────────────────────────────
  async function stopP2P() {
    if (p2p) {
      await p2p.stop();
      p2p = null;
    }
    connectedPeerCount = 0;
    gigPeers.set([]);
    currentGeohash.set('');
    clearAllGigEntities();
  }

  // ─── beforeunload Warning ──────────────────────────────────
  function onBeforeUnload(e: BeforeUnloadEvent) {
    e.preventDefault();
    e.returnValue = 'Your ride request/offer will be deleted if you close this tab.';
    // Best-effort cleanup
    if (p2p) {
      p2p.stop();
    }
  }

  function registerBeforeUnload() {
    window.addEventListener('beforeunload', onBeforeUnload);
  }

  function unregisterBeforeUnload() {
    window.removeEventListener('beforeunload', onBeforeUnload);
  }

  // ─── Destination Picking ─────────────────────────────────────
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

  // ─── Lifecycle ───────────────────────────────────────────────
  onDestroy(() => {
    clearAllGigEntities();
    isGigPickingDestination.set(false);
    if (unsubCoords) unsubCoords();
    if (p2p) {
      p2p.stop();
      p2p = null;
    }
    unregisterBeforeUnload();
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
        <div class="status-indicator">
          <div class="pulse-dot"></div>
          <span>
            {#if connectedPeerCount > 0}
              Connected to {connectedPeerCount} driver{connectedPeerCount !== 1 ? 's' : ''}...
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
        <div class="status-indicator">
          <div class="pulse-dot driver"></div>
          <span>
            {#if connectedPeerCount > 0}
              Connected to {connectedPeerCount} rider{connectedPeerCount !== 1 ? 's' : ''}...
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
