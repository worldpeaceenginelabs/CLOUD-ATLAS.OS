<script lang="ts">
  import { hexPath, type HexPoint } from './geometry';

  // Pure presentation. All layout values — the hex positions, their
  // radius, and the current scale — are computed by HexMenu.svelte
  // (the container that owns the hex-system's scaling/layout) and
  // simply handed down here. This component holds no menu logic, no
  // selection state, and no DOM measurement of its own.
  export let hexes: HexPoint[] = [];
  export let radius = 0;
  export let scale = 1;
</script>

<svg class="hex-grid" xmlns="http://www.w3.org/2000/svg">
  <g class="bg-layer">
    {#each hexes as h}
      <path d={hexPath(h.x, h.y, radius * 0.985)} fill="#0E0E0E" />
      <path d={hexPath(h.x, h.y, radius * 0.985 - 2.2 * scale)} fill="#1F1F1F" />
    {/each}
  </g>
</svg>

<style>
  .hex-grid {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
    /* .light in HexMenu.svelte has z-index:1 — an explicit z-index
       here is required so the grid paints above it; a positioned
       sibling with z-index:auto always paints BELOW one with an
       explicit z-index, regardless of DOM order, so just placing
       this markup after .light was never enough. */
    z-index: 2;
  }
</style>