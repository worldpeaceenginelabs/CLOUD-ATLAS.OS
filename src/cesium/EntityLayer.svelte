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
  // it never calls into Orchestrator.svelte.
  //
  // Mount once, alongside <Cesium /> (after it, so the viewer exists by
  // the time this tries to place entities — though placement/picking both
  // retry quietly either way if the viewer isn't ready yet):
  //
  //   <Cesium />
  //   <EntityLayer />
  // -----------------------------------------------------------------------

  import * as Cesium from 'cesium';
  import { onMount, onDestroy } from 'svelte';
  import { entity, pick } from './api';
  import type { EntityOptions, PickedEntity } from './api';
  import { appStore, type AppState, type EntityRecord } from '../Orchestrator/appStore';
  import EntityDetails from './EntityDetails.svelte';

  const activeMarkerIds = new Set<string>(); // record ids currently rendered as Cesium entities
  let selectedRecord: EntityRecord | null = null;

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
        const state = appStore.get();
        selectedRecord = state.live?.id === recordId ? state.live : state.listings[recordId] ?? null;
      });
    } catch {
      // Cesium viewer not mounted yet — try again shortly.
      setTimeout(enableEntityPicking, 500);
    }
  }

  onMount(() => {
    enableEntityPicking();
  });

  onDestroy(() => {
    pick.entity.disable();
    for (const id of activeMarkerIds) entity.remove(id);
    activeMarkerIds.clear();
  });
</script>

{#if selectedRecord}
  <EntityDetails record={selectedRecord} on:close={() => (selectedRecord = null)} />
{/if}
