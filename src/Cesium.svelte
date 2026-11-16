<script lang="ts">
  import type * as Cesium from 'cesium';
  import { onMount, onDestroy } from 'svelte';
  import { createViewer, destroyViewer, type CreateViewerOptions } from './cesium/viewer';

  /** Forwarded verbatim to createViewer(). See cesium/viewer.ts for what it accepts. */
  export let options: CreateViewerOptions = {};

  let container: HTMLDivElement;
  let viewer: Cesium.Viewer | undefined;

  onMount(() => {
    viewer = createViewer(container, options);
  });

  onDestroy(() => {
  viewer && destroyViewer(viewer);
  viewer = undefined;
});

  export function getViewer(): Cesium.Viewer | undefined {
    return viewer;
  }
</script>

<div class="cesium-container" bind:this={container} />

<style>
  .cesium-container {
    width: 100%;
    height: 100%;
  }

  /* Cesium-ion-Logo ausblenden */
  :global(.cesium-credit-logoContainer) {
    display: none !important;
  }

  /* "Data attribution"-Link (öffnet die Lightbox) ausblenden */
  :global(.cesium-credit-expand-link) {
    display: none !important;
  }

  /* Credit-Leiste an den linken Bildschirmrand */
  :global(.cesium-viewer-bottom) {
    left: 0 !important;
    right: auto !important;
    text-align: left;
  }
</style>
