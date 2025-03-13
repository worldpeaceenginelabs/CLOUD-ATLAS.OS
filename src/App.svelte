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
  </style>
  
