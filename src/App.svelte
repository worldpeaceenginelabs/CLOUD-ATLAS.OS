<script lang="ts">
  import Cesium from "./Cesium.svelte";
  import AddMapmarker from "./DAPPS/HomeScreen/Brainstorming.svelte";
  import Appsearch from "./Dappstore/Appsearch.svelte";
  import LiveEdit from "./LiveEdit.svelte";
  import Infobox from "./Infobox.svelte";
  import Grid from "./Grid.svelte"; 
  import { writable } from 'svelte/store';

  // State to track visibility of the picture
  let showPicture = true;
  let pictureUrl = "./cloudatlas8kzip.jpg";
  let quote = "“You never change things by fighting the existing reality. To change something, build a new model that makes the existing model obsolete.” Buckminster Fuller";

  const isVisible = writable(false);
</script>

<div>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  {#if showPicture}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="picture-container" on:click={() => showPicture = false}>
      <img class="picture" src={pictureUrl} alt="Inspiring" />
      <div class="quote">{quote}</div>
      <div class="enter-text animated-gradient">ENTER</div> <!-- Pulsating ENTER text -->
    </div>
  {:else}
     
  <div class="gridcontainer"><Grid /></div>
  <div class="cesiumcontainer"><Cesium /></div>
  
  <div class="searchcontainer"><Appsearch /></div>
    <div class="liveeditcontainer"><LiveEdit/></div>
    <div class="infoboxcontainer"><Infobox {isVisible} /></div>
  {/if}
</div>

<div style="position: absolute; left: -9999px; top: -9999px;">
  <AddMapmarker />
</div>

<style>
  :global(body) {
    margin: 0;
    overflow: hidden;
  }

  .gridcontainer{
      top: 0px;
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

  .infoboxcontainer{
    z-index: 30;
    position: absolute;
  }

  .liveeditcontainer {
    position: absolute;
        bottom: 0.3em;
        right:0.3em;
        z-index: 50;
  }

  .picture-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    text-align: center;
    background-color: #f0f0f0;
    height: 100vh;
    width: 100vw;
    position: relative;
  }
  .picture {
    max-width: 100%;
    max-height: 80vh;
    cursor: pointer;
  }
  .quote {
    margin-top: 20px;
    font-size: 1.5em;
    font-style: italic;
    color: black;
  }
  .enter-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 25rem; /* Adjust the font size */
    padding-bottom: 5px;
    background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
    background-size: 400% 400%;
    animation: gradientBG 5s ease infinite, pulse 10s infinite;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    line-height: 1.2;
    cursor: pointer;
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