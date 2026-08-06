<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  import HexMenu from "./HexMenu.svelte";
  import Cesium from "./Cesium.svelte";
  import OverlayLayer from "./OverlayLayer.svelte";

  let tooltip = null;

  let landscape = true;

  function updateLayout() {
    landscape = window.innerWidth >= window.innerHeight;
  }

  onMount(() => {
    updateLayout();
    window.addEventListener("resize", updateLayout);
  });

  onDestroy(() => {
    window.removeEventListener("resize", updateLayout);
  });
</script>

<div class="workspace">

  <div class="background-layer">
    <HexMenu {landscape} on:tooltip={(e) => (tooltip = e.detail)} />
  </div>

  <div
    class="globe-window"
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