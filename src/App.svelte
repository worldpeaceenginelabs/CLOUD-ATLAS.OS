<script lang="ts">
  import HexMenu from "./HexMenu.svelte";
  import Cesium from "./Cesium.svelte";
</script>

<div class="workspace">

  <div class="background-layer">
    <HexMenu />
  </div>

  <div class="globe-window">
    <Cesium />
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
  top: 0;
  right: 0;

  width: 50%;
  height: 100%;

  z-index: 20;
}

.globe-window > :global(*) {
  width: 100%;
  height: 100%;
}

@media (max-width: 768px) {
  .globe-window {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;

    width: 100%;
    height: 50%;
  }
}
</style>