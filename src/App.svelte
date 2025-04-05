<script lang="ts">
  import Cesium from "./Cesium.svelte";
  import AddMapmarker from "./DAPPS/HomeScreen/Brainstorming.svelte";
  import Appsearch from "./Dappstore/Appsearch.svelte";
  import LiveEdit from "./LiveEdit.svelte";
  import Infobox from "./Infobox.svelte";
  import Grid from "./Grid.svelte"; 
  import { writable } from 'svelte/store';

  let showPicture = true;
  let pictureUrl = "./cloudatlas8kzip.jpg";
  let quote = "“You never change things by fighting the existing reality. To change something, build a new model that makes the existing model obsolete.” Buckminster Fuller";

  const isVisible = writable(false);
</script>

<div>
  {#if showPicture}
    <div class="picture-container" on:click={() => showPicture = false}>
      <img class="picture" src={pictureUrl} alt="Inspiring" />
      <div class="overlay"></div>
      <div class="quote">{quote}</div>
      <div class="enter-text animated-gradient">ENTER</div>
    </div>
  {:else}
    <div class="gridcontainer"><Grid /></div>
    <div class="cesiumcontainer"><Cesium /></div>
    <div class="searchcontainer"><Appsearch /></div>
    <div class="liveeditcontainer"><LiveEdit/></div>
    <div class="infoboxcontainer"><Infobox {isVisible} /></div>
  {/if}
</div>

<!-- Hidden component off-screen -->
<div style="position: absolute; left: -9999px; top: -9999px;">
  <AddMapmarker />
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

  .searchcontainer {
    position: absolute;
    top: 1em;
    left: 50%;
    transform: translateX(-50%);
    z-index: 40;
    width: 99%;
    max-width: 800px;
  }

  .infoboxcontainer {
    z-index: 30;
    position: absolute;
  }

  .liveeditcontainer {
    position: absolute;
    bottom: 0.3em;
    right: 0.3em;
    z-index: 50;
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

  @media (max-width: 768px) {
  .picture {
    object-fit: contain;
  }

  .quote, .enter-text {
    font-size: 1.2em;
    padding: 0 1em;
  }

  .enter-text {
    font-size: 15vw;
  }
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
    max-width: 80%;
  }

  .enter-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    text-align: center;
    font-size: 30vw;
    background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
    background-size: 400% 400%;
    animation: gradientBG 5s ease infinite, pulse 10s infinite;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    line-height: 1.2;
    cursor: pointer;
    z-index: 4;
    pointer-events: none;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  @keyframes gradientBG {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
</style>
