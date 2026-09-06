<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  import HexMenu from "./HexMenu.svelte";
  import Cesium from "./Cesium.svelte";
  import OverlayLayer from "./OverlayLayer.svelte";
  import EntityLayer from "./cesium/EntityLayer.svelte";
  import Orchestrator from "./Orchestrator.svelte";

  let tooltip = null;

  // Orchestrator is mounted persistently (it owns a standing relay
  // connection, the tombstone watcher and any in-progress LIVE session —
  // none of that should restart on every submit). New work reaches it
  // purely as a prop: HexMenu's submit events only bubble to their direct
  // parent (this component), so they're captured here as plain reactive
  // state and passed straight down — no event forwarding, no bind:this,
  // no controller layer.
  let submit: { payload: { tags: string[][]; content: string }; action: "offer" | "search" } | null = null;

  function handleOfferSubmit(e) {
    submit = { payload: e.detail, action: "offer" };
  }
  function handleSearchSubmit(e) {
    submit = { payload: e.detail, action: "search" };
  }

  let workspaceEl;
  let resizeObserver;
  let landscape = true;

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

    <EntityLayer />

    <OverlayLayer {tooltip} />
  </div>

  <Orchestrator {submit} />

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
