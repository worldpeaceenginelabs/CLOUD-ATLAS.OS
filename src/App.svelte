<script lang="ts">
  import { onDestroy } from 'svelte';
  import Cesium from "./Cesium.svelte";
  // import Appsearch from "./Dappstore/Appsearch.svelte";
  import Infobox from "./Infobox.svelte";
  import Grid from "./Grid.svelte";
  import AddButton from "./AddButton.svelte";
  import { writable } from 'svelte/store';
  import ActionEvent from "./ActionEvent.svelte";
  import AdvertisingBanner from "./AdvertisingBanner.svelte";

  let showPicture = false;
  let quote = "\"You never change things by fighting the existing reality. To change something, build a new model that makes the existing model obsolete.\" Buckminster Fuller";

  const isVisible = writable(false);

  // Component references for cleanup
  let cesiumComponent: Cesium | null = null;
  let infoboxComponent: Infobox | null = null;
  let gridComponent: Grid | null = null;
  let addButtonComponent: AddButton | null = null;
  let actionEventComponent: ActionEvent | null = null;
  let advertisingBannerComponent: AdvertisingBanner | null = null;

  onDestroy(() => {
    // Reset state
    showPicture = false;
    
    // Reset store
    isVisible.set(false);
    
    // Clear component references
    cesiumComponent = null;
    infoboxComponent = null;
    gridComponent = null;
    addButtonComponent = null;
    actionEventComponent = null;
    advertisingBannerComponent = null;
  });
</script>

<div>
  {#if showPicture}
    <div class="picture-container" on:click={() => showPicture = false} on:keydown={(e) => e.key === 'Enter' && (showPicture = false)} role="button" tabindex="0">
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
    <div class="gridcontainer"><Grid bind:this={gridComponent} /></div>
    <div class="cesiumcontainer"><Cesium bind:this={cesiumComponent} /></div>
    <!--- <div class="searchcontainer"><Appsearch /></div> -->
    <div class="infoboxcontainer"><Infobox bind:this={infoboxComponent} {isVisible} /></div>
    <AdvertisingBanner bind:this={advertisingBannerComponent} />
    <AddButton bind:this={addButtonComponent} />
  {/if}
</div>

<!-- Hidden component off-screen -->
<div style="position: absolute; left: -9999px; top: -9999px;">
<ActionEvent bind:this={actionEventComponent} />
</div>


<style>
  :global(body) {
    margin: 0;
    overflow: hidden;
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

  /*.searchcontainer {
    position: absolute;
    top: 1em;
    left: 50%;
    transform: translateX(-50%);
    z-index: 40;
    width: 99%;
    max-width: 800px;
  }
*/
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

/* Specific fix for very small screens (under 400px) */
@media (max-width: 400px) {
    .quote {
      font-size: 1em; /* Reduce the font size further */
      bottom: 10%; /* Adjust the position of the quote */
      max-width: 90%; /* Make sure the quote is within bounds */
    }
    
    .enter-text {
      font-size: 30vw; /* Adjust font size of enter text for smaller screens */
    }

    .twpg-text.under-enter {
      font-size: 7vw; /* Adjust font size for the secondary text */
    }
  }

</style>
