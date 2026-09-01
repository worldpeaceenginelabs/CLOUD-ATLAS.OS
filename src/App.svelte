<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  import HexMenu from "./HexMenu.svelte";
  import Cesium from "./Cesium.svelte";
  import OverlayLayer from "./OverlayLayer.svelte";
  import Orchestrator from "./Orchestrator.svelte";

  let tooltip = null;
  let orchestrator: Orchestrator;

  let workspaceEl;
  let resizeObserver;
  let landscape = true;

  // HexMenu's submit events only bubble to its direct parent (this
  // component), so App.svelte forwards them to Orchestrator — see
  // Orchestrator.svelte's own header comment for the full integration
  // contract. Wrapped rather than bound directly so a submit fired before
  // orchestrator finishes mounting is simply a (harmless) no-op instead of
  // throwing.
  function handleOfferSubmit(e) {
    orchestrator?.handleOfferSubmit(e);
  }
  function handleSearchSubmit(e) {
    orchestrator?.handleSearchSubmit(e);
  }

  function updateLayout() {
    if (!workspaceEl) return;
    const ws = workspaceEl.getBoundingClientRect();
    landscape = ws.width >= ws.height;
  }

  onMount(() => {
    resizeObserver = new ResizeObserver(updateLayout);
    resizeObserver.observe(workspaceEl);
    updateLayout();
  });

  onDestroy(() => {
    if (resizeObserver) resizeObserver.disconnect();
  });
</script>

<div class="workspace" bind:this={workspaceEl}>

  <div class="background-layer">
    <HexMenu
      on:tooltip={(e) => (tooltip = e.detail)}
      on:offerSubmit={handleOfferSubmit}
      on:searchSubmit={handleSearchSubmit}
    />
  </div>

  <div
    class="globe-window"
    class:landscape={landscape}
    class:portrait={!landscape}
  >
    <div class="cesium-layer">
      <Cesium />
    </div>

    <Orchestrator bind:this={orchestrator} />

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