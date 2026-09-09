<script lang="ts">
  // cesium/EntityLayer.svelte
  // -----------------------------------------------------------------------
  // The Cesium-side half of "click a pin, see its details". Orchestrator
  // never talks to Cesium — it only writes the Store. This component is
  // the other end of that boundary: it reads the same Store, keeps Cesium
  // entities in sync with whatever has a location in it, and turns a
  // click on one of them into a Store lookup + EntityDetails popup.
  //
  //   Cesium entity click → cesium/api.ts (pick.entity) → entity id
  //     → Store lookup → EntityDetails.svelte
  //
  // It knows only Cesium concepts (entities, picking, coordinates) plus
  // the shape of a Store record — never LIVE/LISTING business logic, and
  // it never calls into Orchestrator.svelte directly. The one exception is
  // strictly one-directional: EntityDetails' owner-only Delete button
  // dispatches a `delete` event, which this component simply re-dispatches
  // upward (`on:delete`, no handler — a pure pass-through) for its own
  // parent to turn into Orchestrator's `deleteRequest` prop. This component
  // never calls Orchestrator or Nostr itself.
  //
  // `deepLink` (set by App.svelte from the current URL) reuses this exact
  // same "look the record up in the Store and select it" mechanism — see
  // selectRecordById below — rather than a second, parallel selection path.
  //
  // Mount once, alongside <Cesium /> (after it, so the viewer exists by
  // the time this tries to place entities — though placement/picking both
  // retry quietly either way if the viewer isn't ready yet):
  //
  //   <Cesium />
  //   <EntityLayer {deepLink} on:delete={handleDeleteRequest} />
  // -----------------------------------------------------------------------

  import * as Cesium from 'cesium';
  import { onMount, onDestroy } from 'svelte';
  import { camera, entity, pick, location } from './api';
  import type { EntityOptions, PickedEntity } from './api';
  import { appStore, type AppState, type EntityRecord } from '../orchestrator/appStore';
  import EntityDetails from './EntityDetails.svelte';

  /** Set by App.svelte from the current URL (see its own header comment) — the event this deep link should open, once it's known locally. */
  export let deepLink: { domain: string; eventId: string } | null = null;

  const activeMarkerIds = new Set<string>(); // record ids currently rendered as Cesium entities
  let selectedRecord: EntityRecord | null = null;

  /** The one place a record gets selected, regardless of *why* — an entity click or a resolved deep link both funnel through this. */
  function selectRecordById(recordId: string): boolean {
    const state = appStore.get();
    const match = state.live?.id === recordId ? state.live : state.listings[recordId] ?? null;
    selectedRecord = match;
    return !!match;
  }

  // Deep-link resolution: keeps checking every time the Store changes
  // (a fresh discovery result, a fetch Orchestrator triggered for this
  // exact event via its own `openEventId` prop, ...) until the target
  // listing shows up, then stops — `deepLinkResolved` also stops it from
  // reopening itself if the person closes the panel afterward.
  let deepLinkResolved = false;
  $: if (deepLink && !deepLinkResolved && $appStore) {
    const state = appStore.get();
    const match = Object.values(state.listings).find((l) => l.eventId === deepLink!.eventId);
    if (match) {
      selectedRecord = match;
      deepLinkResolved = true;
    }
  }

  function colorFor(record: EntityRecord): string {
    if (record.kind === 'live') return record.status === 'matched' ? '#57e389' : '#2ae9c9';
    return '#335bf4';
  }

  function entityOptionsFor(record: EntityRecord): EntityOptions {
    const loc = record.location!;
    return {
      position: Cesium.Cartesian3.fromDegrees(loc.longitude, loc.latitude),
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString(colorFor(record)),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 1,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    };
  }

  function syncMarkers(state: AppState) {
    const wanted = new Map<string, EntityRecord>();
    if (state.live?.location) wanted.set(state.live.id, state.live);
    for (const listing of Object.values(state.listings)) {
      if (listing.location) wanted.set(listing.id, listing);
    }

    for (const id of activeMarkerIds) {
      if (wanted.has(id)) continue;
      entity.remove(id);
      activeMarkerIds.delete(id);
    }

    for (const [id, record] of wanted) {
      if (activeMarkerIds.has(id) || !record.location) continue;
      try {
        entity.add(id, entityOptionsFor(record));
        activeMarkerIds.add(id);
      } catch {
        // Cesium viewer not mounted yet — retried on the next store change.
      }
    }
  }

  $: syncMarkers($appStore);

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

  onMount(() => {
    enableEntityPicking();
    showUserLocation();
  });

  onDestroy(() => {
    pick.entity.disable();
    for (const id of activeMarkerIds) entity.remove(id);
    activeMarkerIds.clear();
  });
</script>

{#if selectedRecord}
  <EntityDetails
    record={selectedRecord}
    ownPubkey={$appStore.ownPubkey}
    on:close={() => (selectedRecord = null)}
    on:delete
  />
{/if}
