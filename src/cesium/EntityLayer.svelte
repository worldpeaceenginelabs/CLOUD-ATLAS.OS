<script lang="ts">
  // cesium/EntityLayer.svelte
  // -----------------------------------------------------------------------
  // The Cesium-side half of "click a pin, see its details". Orchestrator
  // never talks to Cesium — it only writes the Store. This component is
  // the other end of that boundary: it reads the same Store, keeps Cesium
  // entities in sync with whatever has a location in it, and turns a
  // click on one of them into a Store lookup + details popup.
  //
  //   Cesium entity click → cesium/api.ts (pick.entity) → entity id
  //     → Store lookup → EntityDetails.svelte (listing/live) or
  //       missions/SwarmGovernance.svelte (mission)
  //
  // It knows only Cesium concepts (entities, picking, coordinates) plus
  // the shape of a Store record — never LIVE/LISTING/Mission business
  // logic, and it never calls into Orchestrator.svelte directly. The two
  // exceptions are strictly one-directional pass-throughs: EntityDetails'
  // and SwarmGovernance's owner-only Delete buttons dispatch a `delete`
  // event, and SwarmGovernance's Submit/Save dispatches `submit` — both
  // simply re-dispatched upward for this component's own parent to turn
  // into Orchestrator's `deleteRequest`/`missionSubmit` props. This
  // component never calls Orchestrator or Nostr itself.
  //
  // `deepLink` (set by App.svelte from the current URL) reuses this exact
  // same "look the record up in the Store and select it" mechanism — see
  // selectRecordById below — rather than a second, parallel selection
  // path, across listings *and* missions alike.
  //
  // Mount once, alongside <Cesium /> (after it, so the viewer exists by
  // the time this tries to place entities — though placement/picking both
  // retry quietly either way if the viewer isn't ready yet):
  //
  //   <Cesium />
  //   <EntityLayer {deepLink} on:delete={handleDeleteRequest} on:missionSubmit={handleMissionSubmit} />
  // -----------------------------------------------------------------------

  import * as Cesium from 'cesium';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { camera, entity, pick, location } from './api';
  import type { EntityOptions, PickedEntity } from './api';
  import { appStore, type AppState, type EntityRecord } from '../orchestrator/appStore';
  import EntityDetails from './EntityDetails.svelte';
  import { waitForGlobeLoaded } from './viewer';
  import SwarmGovernance from '../missions/SwarmGovernance.svelte';

  /** Set by App.svelte from the current URL (see its own header comment) — the event this deep link should open, once it's known locally. */
  export let deepLink: { domain: string; eventId: string } | null = null;

  const dispatch = createEventDispatcher();

  const activeMarkerIds = new Set<string>(); // record ids currently rendered as Cesium entities
  let selectedRecord: EntityRecord | null = null;
  let globeReady = false;

  /** Same value as selectedRecord, narrowed to exclude Mission — EntityDetails.svelte's prop type never included Mission and shouldn't have to; computed once here instead of relying on template-level narrowing propagating through to a child component's prop. */
  $: nonMissionRecord =
    selectedRecord && selectedRecord.kind !== 'mission' ? selectedRecord : null;

  /** The one place a record gets selected, regardless of why — an entity click or a resolved deep link both funnel through this, across every record kind. */
  function selectRecordById(recordId: string): boolean {
    const state = appStore.get();
    const match =
      state.live?.id === recordId
        ? state.live
        : state.listings[recordId] ?? state.missions[recordId] ?? null;

    selectedRecord = match;
    return !!match;
  }

  // Deep-link resolution: keeps checking every time the Store changes
  // (a fresh discovery result, a fetch Orchestrator triggered for this
  // exact event via its own `openEventId` prop, ...) until the target
  // record shows up, then stops — `deepLinkResolved` also stops it from
  // reopening itself if the person closes the panel afterward.
  let deepLinkResolved = false;

  $: if (deepLink && !deepLinkResolved && $appStore) {
    const state = appStore.get();

    const match =
      Object.values(state.listings).find(
        (listing) => listing.eventId === deepLink!.eventId
      ) ??
      Object.values(state.missions).find(
        (mission) => mission.eventId === deepLink!.eventId
      );

    if (match) {
      selectRecordById(match.id);
      deepLinkResolved = true;
    }
  }

  function colorFor(record: EntityRecord): string {
    if (record.kind === 'live') {
      return record.status === 'matched' ? '#57e389' : '#2ae9c9';
    }

    if (record.kind === 'mission') {
      return '#7e57c2';
    }

    return '#335bf4';
  }

  /** A representative lat/lon for entities whose location is always a single point — every kind except an Area mission. */
  function toLatLon(
    record: EntityRecord
  ): { latitude: number; longitude: number } | null {
    if (record.kind === 'mission') {
      return record.location.kind === 'point' ? record.location : null;
    }

    return record.location;
  }

  function entityOptionsFor(record: EntityRecord): EntityOptions {
    const color = Cesium.Color.fromCssColorString(colorFor(record));

    if (record.kind === 'mission' && record.location.kind === 'area') {
      const { west, south, east, north } = record.location;

      return {
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(west, south, east, north),
          material: color.withAlpha(0.25),
          outline: true,
          outlineColor: color,
        },
      };
    }

    const point = toLatLon(record)!;

    return {
      position: Cesium.Cartesian3.fromDegrees(
        point.longitude,
        point.latitude
      ),
      point: {
        pixelSize: record.kind === 'mission' ? 12 : 10,
        color,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    };
  }

  /** Whether a record has a location Cesium can actually render — false only for a (currently impossible, but defensively checked) locationless mission or point-kind mismatch. */
  function hasRenderableLocation(record: EntityRecord): boolean {
    if (record.kind === 'mission') {
      return true;
    }

    return !!record.location;
  }

  function syncMarkers(state: AppState) {
    const wanted = new Map<string, EntityRecord>();

    if (state.live?.location) {
      wanted.set(state.live.id, state.live);
    }

    for (const listing of Object.values(state.listings)) {
      if (listing.location) {
        wanted.set(listing.id, listing);
      }
    }

    for (const mission of Object.values(state.missions)) {
      wanted.set(mission.id, mission);
    }

    for (const id of activeMarkerIds) {
      if (wanted.has(id)) continue;

      entity.remove(id);
      activeMarkerIds.delete(id);
    }

    for (const [id, record] of wanted) {
      if (activeMarkerIds.has(id) || !hasRenderableLocation(record)) {
        continue;
      }

      try {
        entity.add(id, entityOptionsFor(record));
        activeMarkerIds.add(id);
      } catch {
        // Cesium viewer not mounted yet — retried on the next store change.
      }
    }
  }

  $: if (globeReady) syncMarkers($appStore);

  function enableEntityPicking() {
    try {
      pick.entity.enable((picked: PickedEntity) => {
        // entity.add(id, ...) sets Cesium's own Entity.id to our record id
        // directly, so a PickedEntity wrapping that entity exposes the
        // same id — no separate lookup table needed.
        const recordId = (picked as unknown as { id?: string })?.id;

        if (!recordId) return;

        selectRecordById(recordId);
      });
    } catch {
      // Cesium viewer not mounted yet — try again shortly.
      setTimeout(enableEntityPicking, 500);
    }
  }

  async function showUserLocation() {
    try {
      const { longitude, latitude } = await location.getCurrentPosition();

      const position = Cesium.Cartesian3.fromDegrees(longitude, latitude);

      const startTime = Date.now();

      const outerPulse = new Cesium.CallbackProperty(() => {
        const t = (Date.now() - startTime) / 1000;
        return 22 + 4 * Math.sin((2 * Math.PI * t) / 4);
      }, false);

      const innerPulse = new Cesium.CallbackProperty(() => {
        const t = (Date.now() - startTime) / 1000 - 0.7;
        return 13 + 3 * Math.sin((2 * Math.PI * t) / 4);
      }, false);

      entity.add('Your Location!_outer', {
        position,
        point: {
          pixelSize: outerPulse,
          color: Cesium.Color.fromCssColorString('#4285F4').withAlpha(0.04),
          outlineColor: Cesium.Color.fromCssColorString('#4285F4').withAlpha(0.7),
          outlineWidth: 2,
        },
      });

      entity.add('Your Location!_inner', {
        position,
        point: {
          pixelSize: innerPulse,
          color: Cesium.Color.fromCssColorString('#FF6D00').withAlpha(0.04),
          outlineColor: Cesium.Color.fromCssColorString('#FF6D00').withAlpha(0.7),
          outlineWidth: 2,
        },
      });

      entity.add('Your Location!', {
        position,
        point: {
          pixelSize: 4,
          color: Cesium.Color.WHITE.withAlpha(0.85),
        },
      });

      await camera.flyTo(
        {
          longitude,
          latitude,
          height: 10000000,
        },
        { duration: 1.5 }
      );
    } catch (error) {
      console.warn('[EntityLayer] User location unavailable:', error);
    }
  }

  onMount(async () => {
    await waitForGlobeLoaded();

    globeReady = true;
    syncMarkers($appStore);

    enableEntityPicking();
    await showUserLocation();
  });

  onDestroy(() => {
    pick.entity.disable();

    for (const id of activeMarkerIds) {
      entity.remove(id);
    }

    activeMarkerIds.clear();
  });
</script>

{#if selectedRecord?.kind === 'mission'}
<SwarmGovernance
record={selectedRecord}
ownPubkey={$appStore.ownPubkey}
on:close={() => (selectedRecord = null)}
on:delete={(e) => {
dispatch('delete', e.detail);
selectedRecord = null;
}}
on:submit={(e) => dispatch('missionSubmit', e.detail)}
/>
{:else if nonMissionRecord}
<EntityDetails
record={nonMissionRecord}
ownPubkey={$appStore.ownPubkey}
on:close={() => (selectedRecord = null)}
on:delete
/>
{/if}

<style>
</style>
