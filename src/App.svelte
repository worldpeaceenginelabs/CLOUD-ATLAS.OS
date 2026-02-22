<script lang="ts">
  import { onDestroy } from 'svelte';
  import Cesium from "./Cesium.svelte";
  import Infobox from "./components/Infobox.svelte";
  import Grid from "./components/Grid.svelte";
  import LayersMenu from "./appmenu/LayersMenu.svelte";
  import AdvertisingBanner from "./components/AdvertisingBanner.svelte";
  import ProgressBar from "./components/ProgressBar.svelte";
  import ModalManager from "./components/ModalManager.svelte";
  import { 
    showPicture,
    gridReady,
    isVisible,
    basemapProgress,
    tilesetProgress,
    isInitialLoadComplete
  } from './store';
  import { modelEditorService } from './utils/modelEditorService';

  let quote = "\"You never change things by fighting the existing reality. To change something, build a new model that makes the existing model obsolete.\" Buckminster Fuller";

  // Component references (only those actually used)
  let cesiumComponent: Cesium | null = null;
  let layersMenuComponent: LayersMenu | null = null;

  // Roaming animation functions from Cesium component
  let updateRoamingModel: ((modelData: any) => void) | undefined = undefined;

  // Expose updateRoamingModel to the model editor service
  $: modelEditorService.setUpdateRoamingModel(updateRoamingModel);

  function handleAddModel() {
    modelEditorService.handleAddModel();
    if (layersMenuComponent) {
      layersMenuComponent.closeMenu();
    }
  }

  onDestroy(() => {
    showPicture.set(false);
    isVisible.set(false);
  });
</script>

<div class="app-container">
  {#if $showPicture}
    <div class="picture-container" on:click={() => showPicture.set(false)} on:keydown={(e) => e.key === 'Enter' && showPicture.set(false)} role="button" tabindex="0">
      <video
  autoplay
  loop
  muted
  playsinline
  poster="./cloudatlas8kzip.jpg"
  class="picture"
>
  <source src="./cloudatlas8kzip.mp4" type="video/mp4" />
</video>

      <div class="overlay"></div>
      <div class="quote">{quote}</div>
      <div class="enter-text animated-gradient">ENTER</div>
      <div class="twpg-text under-enter animated-gradient">THE WORLD PEACE GAME</div>
    </div>
  {:else}
    <div class="gridcontainer"><Grid on:gridReady={() => gridReady.set(true)} /></div>
    {#if $gridReady}
      <div class="cesiumcontainer"><Cesium bind:this={cesiumComponent} bind:updateRoamingModel /></div>
    {/if}
    <div class="infoboxcontainer"><Infobox isVisible={isVisible} /></div>
    <AdvertisingBanner />
    <ProgressBar basemapProgress={$basemapProgress} tilesetProgress={$tilesetProgress} isInitialLoadComplete={$isInitialLoadComplete} />
    <LayersMenu 
      bind:this={layersMenuComponent} 
      onAddModel={handleAddModel}
    />
    <ModalManager />
  {/if}
</div>


<style>
  :global(body) {
    margin: 0;
    overflow: hidden;
  }

  .app-container {
    height: 100vh;
    width: 100vw;
    box-sizing: border-box;
  }

  .gridcontainer {
    top: 0;
    z-index: 10;
    position: absolute;
    height: 100%;
    width: 100%;
  }

  .cesiumcontainer {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    z-index: 20;
    position: relative;
  }

  .infoboxcontainer {
    z-index: 30;
    position: absolute;
  }

  .picture-container {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    text-align: center;
    background-color: #000;
    height: 100vh;
    width: 100vw;
    position: relative;
    overflow: hidden;
  }

  .picture {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
    cursor: pointer;
  }

  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.7));
    z-index: 2;
    pointer-events: none;
  }

  .quote {
    margin-top: 2em;
    font-size: 1.5em;
    font-style: italic;
    color: white;
    z-index: 3;
    max-width: 90%;
  }

  .enter-text {
    position: absolute;
    top: 33%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    text-align: center;
    font-size: 30vw;
    line-height: 1.2;
    cursor: pointer;
    z-index: 4;
    pointer-events: none;
  }

  .twpg-text.under-enter {
    position: absolute;
    top: calc(33% + 18vw);
    left: 50%;
    transform: translateX(-50%);
    font-size: 4.3vw;
    width: fit-content;
    max-width: 100%;
    z-index: 4;
    pointer-events: none;
  }

  /* Gradient animation for ENTER + TWPG */
  .animated-gradient {
    background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
    background-size: 400% 400%;
    animation: gradientBG 5s ease infinite, pulse 10s infinite;
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0; }
    100% { opacity: 1; }
  }

  @keyframes gradientBG {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  /* Mobile Layout */
  @media (max-width: 768px) {
  .picture-container {
    background: black;
    justify-content: center;
    align-items: center;
  }

  .picture {
    object-fit: contain;
    background-color: rgba(255, 255, 255, 0.97);
  }

  .quote {
    color: black;
    position: absolute;
    bottom: 10%;
    font-size: 1.1em;
    padding: 0 1em;
    text-align: center;
    max-width: 90%;
    z-index: 3;
  }

  .enter-text {
    position: relative;
    top: auto;
    left: auto;
    transform: none;
    font-size: 30vw;
    margin-bottom: 0.5em;
  }

  .twpg-text.under-enter {
    position: relative;
    top: auto;
    left: auto;
    transform: none;
    font-size: 7vw;
  }
}

  /* Very small screens (under 400px) */
  @media (max-width: 400px) {
    .quote {
      font-size: 1em;
    }
  }

</style>