<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Cesium from "./Cesium.svelte";
  // import Appsearch from "./Dappstore/Appsearch.svelte";
  import Infobox from "./components/Infobox.svelte";
  import Grid from "./components/Grid.svelte";
  import AddButton from "./appmenu/AddButton.svelte";
  import { writable } from 'svelte/store';
  import ActionEvent from "./appmenu/ActionEvent.svelte";
  import AdvertisingBanner from "./components/AdvertisingBanner.svelte";
  import ProgressBar from "./components/ProgressBar.svelte";
  import HeaderCard from "./components/HeaderCard.svelte";
  import ModelSettings from "./components/ModelSettings.svelte";
  import { models, coordinates } from './store';
  import { dataManager } from './dataManager';

  let showPicture = true;
  let quote = "\"You never change things by fighting the existing reality. To change something, build a new model that makes the existing model obsolete.\" Buckminster Fuller";
  let gridReady = false;

  const isVisible = writable(false);

  // Component references for cleanup
  let cesiumComponent: Cesium | null = null;
  let infoboxComponent: Infobox | null = null;
  let gridComponent: Grid | null = null;
  let addButtonComponent: AddButton | null = null;
  let actionEventComponent: ActionEvent | null = null;
  let advertisingBannerComponent: AdvertisingBanner | null = null;
  let progressBarComponent: ProgressBar | null = null;

  // Progress data from Cesium component
  let basemapProgress = 0;
  let tilesetProgress = 0;
  let isInitialLoadComplete = false;
  let toggleModelUI: (() => void) | undefined = undefined;
  
  // Preview functions from Cesium component
  let addPreviewModelToScene: ((modelData: any) => void) | undefined = undefined;
  let removePreviewModelFromScene: (() => void) | undefined = undefined;
  let updatePreviewModelInScene: ((modelData: any) => void) | undefined = undefined;

  // Card visibility states
  let showHeaderCard = false;
  let showModelSettingsCard = false;

  // Dropdown states for bottom cards
  let showModelSettingsDropdown = true;

  // Card data states
  let isEditMode = false;
  let editingModelId = '';
  let currentCoords = { latitude: '', longitude: '', height: 0 };

  // Reactive statement to update currentCoords when coordinates store changes
  $: currentCoords = {
    latitude: $coordinates.latitude || '',
    longitude: $coordinates.longitude || '',
    height: $coordinates.height || 0
  };
  
  // Form data states
  let selectedSource = 'url';
  let gltfFile: File | null = null;
  let gltfUrl = '';
  let modelName = '';
  let modelDescription = '';
  let scale = 1.0;
  let height = 0;
  let heightOffset = 0.0;
  let heading = 0;
  let pitch = 0;
  let roll = 0;

  // Reactive statements to update preview when form data changes
  $: if (gltfFile || gltfUrl) {
    updatePreview();
  }

  $: if (modelName || modelDescription || scale !== 1.0 || height !== 0 || 
         heightOffset !== 0.0 || heading !== 0 || pitch !== 0 || roll !== 0) {
    updatePreview();
  }

  // Functions to show/hide all cards
  function showAllCards() {
    showHeaderCard = true;
    showModelSettingsCard = true;
    // Reset dropdown states to open when showing cards
    showModelSettingsDropdown = true;
  }

  function hideAllCards() {
    // Remove preview model when hiding cards
    if (removePreviewModelFromScene) {
      removePreviewModelFromScene();
    }
    
    showHeaderCard = false;
    showModelSettingsCard = false;
    // Reset dropdown states
    showModelSettingsDropdown = false;
    // Reset form data
    resetFormData();
  }

  function resetFormData() {
    isEditMode = false;
    editingModelId = '';
    selectedSource = 'url';
    gltfFile = null;
    gltfUrl = '';
    modelName = '';
    modelDescription = '';
    scale = 1.0;
    height = 0;
    heightOffset = 0.0;
    heading = 0;
    pitch = 0;
    roll = 0;
  }

  // Handle Add Model trigger
  function handleAddModel() {
    isEditMode = false;
    showAllCards();
    // Close the AddButton menu
    if (addButtonComponent) {
      addButtonComponent.closeMenu();
    }
  }

  // Handle Edit Model trigger
  function handleEditModel(modelData: any) {
    if (modelData) {
      isEditMode = true;
      editingModelId = modelData.id;
      // Update coordinates store with model data for edit mode
      coordinates.set({
        latitude: modelData.coordinates.latitude.toString(),
        longitude: modelData.coordinates.longitude.toString(),
        height: modelData.transform.height
      });
      
      // Populate form with existing model data
      modelName = modelData.name;
      modelDescription = modelData.description || '';
      scale = modelData.transform.scale;
      height = modelData.transform.height;
      heightOffset = modelData.transform.heightOffset || 0.0;
      heading = modelData.transform.heading;
      pitch = modelData.transform.pitch;
      roll = modelData.transform.roll;
      
      // Set source type
      if (modelData.source === 'file' && modelData.file) {
        selectedSource = 'file';
        gltfFile = modelData.file;
        gltfUrl = '';
      } else {
        selectedSource = 'url';
        gltfUrl = modelData.url || '';
        gltfFile = null;
      }
      
      showAllCards();
      // Close the AddButton menu
      if (addButtonComponent) {
        addButtonComponent.closeMenu();
      }
    }
  }

  // Handle form submission
  async function handleSubmit() {
    try {
      // Validate required fields
      if (!modelName.trim()) {
        alert('Please enter a model name');
        return;
      }

      if (!$coordinates.latitude || !$coordinates.longitude) {
        alert('Please select coordinates on the map');
        return;
      }

      if (selectedSource === 'file' && !gltfFile) {
        alert('Please select a file');
        return;
      }

      if (selectedSource === 'url' && !gltfUrl.trim()) {
        alert('Please enter a URL');
        return;
      }

      // Create model data
      const modelData = {
        id: isEditMode ? editingModelId : 'model_' + Date.now(),
        name: modelName.trim(),
        description: modelDescription.trim(),
        source: selectedSource,
        file: gltfFile,
        url: gltfUrl.trim(),
        coordinates: {
          latitude: parseFloat($coordinates.latitude),
          longitude: parseFloat($coordinates.longitude)
        },
        transform: {
          scale: scale,
          height: height,
          heightOffset: heightOffset,
          heading: heading,
          pitch: pitch,
          roll: roll
        },
        timestamp: new Date().toISOString()
      };

      // Remove preview model before adding to store
      if (removePreviewModelFromScene) {
        removePreviewModelFromScene();
      }

      if (isEditMode) {
        // Update existing model
        await updateModel(modelData);
        console.log('Model updated:', modelData.name);
      } else {
        // Add new model
        await addModel(modelData);
        console.log('Model added:', modelData.name);
      }

      // Hide all cards after successful submission
      hideAllCards();
    } catch (error) {
      console.error('Error submitting model:', error);
      alert('Failed to save model. Please try again.');
    }
  }

  // Handle edit model events from Cesium
  function handleEditModelEvent(event: CustomEvent) {
    const { modelData } = event.detail;
    if (modelData) {
      handleEditModel(modelData);
    }
  }

  // Handle file selection
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      gltfFile = file;
      gltfUrl = '';
      // Trigger preview update
      updatePreview();
    }
  }

  // Handle URL change
  function handleUrlChange() {
    gltfFile = null;
    // Trigger preview update
    updatePreview();
  }

  // Update preview model
  function updatePreview() {
    if (!addPreviewModelToScene || !$coordinates.latitude || !$coordinates.longitude) {
      return;
    }

    // Only show preview if we have a valid source
    if ((selectedSource === 'file' && gltfFile) || (selectedSource === 'url' && gltfUrl)) {
      const modelData = {
        id: 'preview_' + Date.now(),
        name: modelName || (gltfFile?.name || 'Preview Model'),
        description: modelDescription || '',
        source: selectedSource,
        file: gltfFile,
        url: gltfUrl,
        coordinates: {
          latitude: parseFloat($coordinates.latitude),
          longitude: parseFloat($coordinates.longitude)
        },
        transform: {
          scale: scale,
          height: height,
          heightOffset: heightOffset,
          heading: heading,
          pitch: pitch,
          roll: roll
        },
        timestamp: new Date().toISOString()
      };

      addPreviewModelToScene(modelData);
    } else {
      // Remove preview if no valid source
      if (removePreviewModelFromScene) {
        removePreviewModelFromScene();
      }
    }
  }

  // Toggle dropdown functions
  function toggleModelSettingsDropdown() {
    showModelSettingsDropdown = !showModelSettingsDropdown;
  }

  // Model management functions
  async function addModel(modelData: any) {
    try {
      await dataManager.addModel(modelData);
      // Update store after successful IDB + scene operation
      models.update((currentModels: any[]) => [...currentModels, modelData]);
    } catch (error) {
      console.error('Error adding model:', error);
      throw error;
    }
  }

  async function updateModel(modelData: any) {
    try {
      await dataManager.updateModel(modelData);
      // Update store after successful IDB + scene operation
      models.update((currentModels: any[]) => 
        currentModels.map((model: any) => 
          model.id === modelData.id ? modelData : model
        )
      );
    } catch (error) {
      console.error('Error updating model:', error);
      throw error;
    }
  }

  // Set up event listener for edit model events
  function setupEventListeners() {
    window.addEventListener('editModel', handleEditModelEvent as EventListener);
  }

  function cleanupEventListeners() {
    window.removeEventListener('editModel', handleEditModelEvent as EventListener);
  }

  onDestroy(() => {
    // Reset state
    showPicture = false;
    
    // Reset store
    isVisible.set(false);
    
    // Clean up event listeners
    cleanupEventListeners();
    
    // Clear component references
    cesiumComponent = null;
    infoboxComponent = null;
    gridComponent = null;
    addButtonComponent = null;
    actionEventComponent = null;
    advertisingBannerComponent = null;
    progressBarComponent = null;
  });

  onMount(() => {
    // Set up event listeners when component mounts
    setupEventListeners();
  });
</script>

<div class="app-container">
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
    <div class="gridcontainer"><Grid bind:this={gridComponent} on:gridReady={() => gridReady = true} /></div>
    {#if gridReady}
      <div class="cesiumcontainer"><Cesium bind:this={cesiumComponent} bind:basemapProgress bind:tilesetProgress bind:isInitialLoadComplete bind:toggleModelUI bind:addPreviewModelToScene bind:removePreviewModelFromScene bind:updatePreviewModelInScene /></div>
    {/if}
    <!--- <div class="searchcontainer"><Appsearch /></div> -->
    <div class="infoboxcontainer"><Infobox bind:this={infoboxComponent} {isVisible} /></div>
    <AdvertisingBanner bind:this={advertisingBannerComponent} />
    <ProgressBar bind:this={progressBarComponent} {basemapProgress} {tilesetProgress} {isInitialLoadComplete} />
    <AddButton 
      bind:this={addButtonComponent} 
      {addPreviewModelToScene}
      {removePreviewModelFromScene}
      {updatePreviewModelInScene}
      onAddModel={handleAddModel}
    />

    <!-- Three Card Components -->
    {#if showHeaderCard}
      <div class="header-card-container">
        <HeaderCard 
          coordinates={currentCoords}
          {isEditMode}
          isUploading={false}
          onClose={hideAllCards}
          onSubmit={handleSubmit}
        />
      </div>
    {/if}

    {#if showModelSettingsCard}
      <div class="model-settings-card-container">
        <ModelSettings 
          bind:selectedSource
          bind:gltfFile
          bind:gltfUrl
          bind:modelName
          bind:modelDescription
          bind:scale
          bind:height
          bind:heightOffset
          bind:heading
          bind:pitch
          bind:roll
          {currentCoords}
          showDropdown={showModelSettingsDropdown}
          onToggleDropdown={toggleModelSettingsDropdown}
          onSourceChange={(source) => selectedSource = source}
          onFileSelect={handleFileSelect}
          onUrlChange={handleUrlChange}
        />
      </div>
    {/if}
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

  /* Editor Header Card positioning */
  .header-card-container {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
  }

  /* Editor Model Settings Card positioning */
  .model-settings-card-container {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
  }

  /* Responsive design for cards */
  @media (max-width: 768px) {
    .header-card-container {
      top: 10px;
      left: 10px;
      right: 10px;
      transform: none;
      max-width: none;
    }

    .model-settings-card-container {
      bottom: 10px;
      left: 10px;
      right: 10px;
      max-width: none;
    }
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
