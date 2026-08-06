<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  import HexMenu from "./HexMenu.svelte";
  import Cesium from "./Cesium.svelte";
  import OverlayLayer from "./OverlayLayer.svelte";

  let tooltip = null;

  let workspaceEl;
  let globeWindowEl;
  let resizeObserver;

  let landscape = true;

  // The single source of truth for "how much space does HexMenu
  // actually get": measured directly from the two real DOM boxes
  // (workspace and globe-window), not recomputed from a ratio anywhere
  // else. If the CSS split below ever changes (50/50 -> 60/40, a third
  // panel, whatever), this keeps working without touching this file
  // OR HexMenu.svelte — HexMenu just gets whatever box is left over.
  let menuAreaWidth = 0;
  let menuAreaHeight = 0;

  function updateLayout() {
    if (!workspaceEl || !globeWindowEl) return;
    const ws = workspaceEl.getBoundingClientRect();
    const gw = globeWindowEl.getBoundingClientRect();
    landscape = ws.width >= ws.height;
    menuAreaWidth  = landscape ? ws.width - gw.width : ws.width;
    menuAreaHeight = landscape ? ws.height : ws.height - gw.height;
  }

  onMount(() => {
    resizeObserver = new ResizeObserver(updateLayout);
    resizeObserver.observe(workspaceEl);
    resizeObserver.observe(globeWindowEl);
    updateLayout();
  });

  onDestroy(() => {
    if (resizeObserver) resizeObserver.disconnect();
  });
</script>

<div class="workspace" bind:this={workspaceEl}>

  <div class="background-layer">
    <HexMenu
      {menuAreaWidth}
      {menuAreaHeight}
      on:tooltip={(e) => (tooltip = e.detail)}
    />
  </div>

  <div
    class="globe-window"
    bind:this={globeWindowEl}
    class:landscape={landscape}
    class:portrait={!landscape}
  >
    <div class="cesium-layer">
      <Cesium />
    </div>

    <OverlayLayer {tooltip} />
  </div>

</div>

<style>
:global(html),
:global(body),
:global(#app) {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.workspace {
  position: fixed;
  inset: 0;
}

.background-layer {
  position: absolute;
  inset: 0;
}

.background-layer > :global(*) {
  width: 100%;
  height: 100%;
}

.globe-window {
  position: absolute;
  z-index: 20;
}

.globe-window.landscape {
  top: 0;
  right: 0;
  width: 50%;
  height: 100%;
}

.globe-window.portrait {
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 50%;
}

.cesium-layer {
  width: 100%;
  height: 100%;
}
</style>