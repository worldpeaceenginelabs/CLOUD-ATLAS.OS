<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Cesium from "./Cesium.svelte";
  // import Appsearch from "./Dappstore/Appsearch.svelte";
  import Infobox from "./components/Infobox.svelte";
  import Grid from "./components/Grid.svelte";
  import AddButton from "./appmenu/AddButton.svelte";
  import ActionEvent from "./appmenu/ActionEvent.svelte";
  import AdvertisingBanner from "./components/AdvertisingBanner.svelte";
  import ProgressBar from "./components/ProgressBar.svelte";
  import Editor from "./components/Editor.svelte";
  import Modal from "./components/Modal.svelte";
  import ShareButton from "./components/Sharebutton.svelte";
  import GlassmorphismButton from "./components/GlassmorphismButton.svelte";
  import RoamingControls from "./components/RoamingControls.svelte";
  import { 
    models, 
    coordinates, 
    currentCoords,
    showPicture,
    gridReady,
    isVisible,
    isRecordModalVisible,
    isModelModalVisible,
    selectedRecord,
    selectedModel,
    recordButtonText,
    cesiumActions,
    basemapProgress,
    tilesetProgress,
    isInitialLoadComplete
  } from './store';
  import { dataManager } from './dataManager';
  import { formatTimestamp } from './utils/timeUtils';
  import { addModel, updateModel, removeModel, createFinalModelData, validateModelForm } from './utils/modelUtils';
  import { logger } from './utils/logger';
  import './shared-styles.css';

  let quote = "\"You never change things by fighting the existing reality. To change something, build a new model that makes the existing model obsolete.\" Buckminster Fuller";

  // Component references for cleanup
  let cesiumComponent: Cesium | null = null;
  let infoboxComponent: Infobox | null = null;
  let gridComponent: Grid | null = null;
  let addButtonComponent: AddButton | null = null;
  let actionEventComponent: ActionEvent | null = null;
  let advertisingBannerComponent: AdvertisingBanner | null = null;
  let progressBarComponent: ProgressBar | null = null;

  // Preview functions from Cesium component
  let addPreviewModelToScene: ((modelData: any) => void) | undefined = undefined;
  let removePreviewModelFromScene: (() => void) | undefined = undefined;
  let updatePreviewModelInScene: ((modelData: any) => void) | undefined = undefined;
  
  // Roaming animation functions from Cesium component
  let updateRoamingModel: ((modelData: any) => void) | undefined = undefined;

  // Card visibility states
  let showModelSettingsCard = true;

  // Dropdown states for bottom cards
  let showModelSettingsDropdown = true;

  // Card data states
  let isEditMode = false;
  let editingModelId = '';

  
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

  // Roaming-related variables
  let isRoamingEnabled = false;
  let roamingSpeed = 1.0;
  let roamingArea: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null = null;

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
    showModelSettingsCard = true;
    // Reset dropdown states to open when showing cards
    showModelSettingsDropdown = true;
  }

  function hideAllCards() {
    // Remove preview model when hiding cards
    if (removePreviewModelFromScene) {
      removePreviewModelFromScene();
    }
    
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
      
      // Set roaming data
      isRoamingEnabled = modelData.roaming?.isEnabled || false;
      roamingSpeed = modelData.roaming?.speed || 1.0;
      roamingArea = modelData.roaming?.area || null;
      
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
      // Validate form using shared utility
      const validation = validateModelForm(
        modelName,
        $coordinates,
        selectedSource,
        gltfFile,
        gltfUrl
      );

      if (!validation.isValid) {
        alert(validation.errorMessage);
        return;
      }

      // Create model data using shared utility
      const modelData = createFinalModelData(
        $coordinates,
        {
          selectedSource,
          gltfFile,
          gltfUrl,
          modelName,
          modelDescription,
          scale,
          height,
          heightOffset,
          heading,
          pitch,
          roll,
          isRoamingEnabled,
          roamingSpeed,
          roamingArea
        },
        isEditMode,
        editingModelId
      );

      // Remove preview model before adding to store
      if (removePreviewModelFromScene) {
        removePreviewModelFromScene();
      }

      if (isEditMode) {
        // Update existing model
        await updateModel(modelData);
        logger.modelUpdated(modelData.name);
        
        // Update roaming animation if enabled
        if (updateRoamingModel && modelData.roaming?.isEnabled) {
          updateRoamingModel(modelData);
        }
      } else {
        // Add new model
        await addModel(modelData);
        logger.modelAdded(modelData.name);
        
        // Add to roaming animation if enabled
        if (updateRoamingModel && modelData.roaming?.isEnabled) {
          updateRoamingModel(modelData);
        }
      }

      // Hide all cards after successful submission
      hideAllCards();
    } catch (error) {
      logger.operationError('submitModel', error, { component: 'App', operation: 'handleSubmit' });
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

  // Modal management functions
  function closeRecordModal() {
    isRecordModalVisible.set(false);
    selectedRecord.set(null);
    recordButtonText.set('');
  }

  function closeModelModal() {
    isModelModalVisible.set(false);
    selectedModel.set(null);
  }

  function closeModelModalForEdit() {
    isModelModalVisible.set(false);
    // The edit functionality will be handled by the existing handleEditModel function
  }

  // Time formatting now uses centralized utility from timeUtils.ts

  // Model management functions are now imported from utils/modelUtils.ts

  // Set up event listener for edit model events
  function setupEventListeners() {
    window.addEventListener('editModel', handleEditModelEvent as EventListener);
  }

  function cleanupEventListeners() {
    window.removeEventListener('editModel', handleEditModelEvent as EventListener);
  }

  onDestroy(() => {
    // Reset state
    showPicture.set(false);

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
    <div class="gridcontainer"><Grid bind:this={gridComponent} on:gridReady={() => gridReady.set(true)} /></div>
    {#if $gridReady}
      <div class="cesiumcontainer"><Cesium bind:this={cesiumComponent} bind:addPreviewModelToScene bind:removePreviewModelFromScene bind:updatePreviewModelInScene bind:updateRoamingModel /></div>
    {/if}
    <!--- <div class="searchcontainer"><Appsearch /></div> -->
    <div class="infoboxcontainer"><Infobox bind:this={infoboxComponent} isVisible={isVisible} /></div>
    <AdvertisingBanner bind:this={advertisingBannerComponent} />
    <ProgressBar bind:this={progressBarComponent} basemapProgress={$basemapProgress} tilesetProgress={$tilesetProgress} isInitialLoadComplete={$isInitialLoadComplete} />
    <AddButton 
      bind:this={addButtonComponent} 
      onAddModel={handleAddModel}
    />

    <!-- Editor Card -->
    {#if showModelSettingsCard}
      <div class="model-settings-card-container">
        <Editor 
          {isEditMode}
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
          bind:isRoamingEnabled
          bind:roamingSpeed
          bind:roamingArea
          on:save={handleSubmit}
          on:cancel={hideAllCards}
          on:close={hideAllCards}
        />
      </div>
    {/if}

    <!-- Roaming Controls -->
    <RoamingControls />

    <!-- Modals moved from Cesium.svelte -->
    {#if $isRecordModalVisible && $selectedRecord}
      <Modal 
        isVisible={$isRecordModalVisible} 
        onClose={closeRecordModal}
        title="Record Details"
        maxWidth="500px"
      >
        <div class="modal-record">
          <div>
            <p class="title">{$selectedRecord.title}</p>
            <p class="text">{$selectedRecord.text}</p>
          </div>
          <div>
            <p class="created">CREATED {formatTimestamp($selectedRecord.timestamp)}</p>
            <p>
              <GlassmorphismButton variant="primary" onClick={() => $selectedRecord && window.open($selectedRecord.link, '_blank')}>
                {$recordButtonText}
              </GlassmorphismButton>
            </p>
          </div>
          <div>
            <ShareButton 
              title={$selectedRecord.title} 
              text={$selectedRecord.text} 
              link={$selectedRecord.link} 
            />
          </div>
        </div>
      </Modal>
    {/if}

    {#if $isModelModalVisible && $selectedModel}
      <Modal 
        isVisible={$isModelModalVisible} 
        onClose={closeModelModal}
        title="3D Model Details"
        maxWidth="500px"
      >
        <div class="modal-record">
          <div>
            <p class="title">{$selectedModel.name}</p>
            <p class="text">{$selectedModel.description || '3D Model'}</p>
            <p class="model-info">
              Scale: {$selectedModel.transform.scale}x | 
              Height: {$selectedModel.transform.height}m | 
              Source: {$selectedModel.source}
            </p>
          </div>
          <div>
            <p class="created">CREATED {formatTimestamp($selectedModel.timestamp)}</p>
            <p>
              <GlassmorphismButton 
                variant="primary" 
                onClick={() => {
                  // Store the model data before closing the modal
                  const modelToEdit = $selectedModel;
                  closeModelModalForEdit();
                  if (modelToEdit) {
                    handleEditModel(modelToEdit);
                  }
                }}
              >
                EDIT MODEL
              </GlassmorphismButton>
            </p>
            <p>
              <GlassmorphismButton 
                variant="danger" 
                onClick={async () => {
                  try {
                    await removeModel($selectedModel.id);
                    closeModelModal();
                  } catch (error) {
                    logger.operationError('removeModel', error, { component: 'App', operation: 'removeModel' });
                  }
                }}
              >
                REMOVE MODEL
              </GlassmorphismButton>
            </p>
          </div>
        </div>
      </Modal>
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
    border: 3px solid #ff6b6b;
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

  /* Editor Model Settings Card positioning */
  .model-settings-card-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 1000;
  }

  /* Responsive design for cards */
  @media (max-width: 768px) {
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

  /* Modal styles moved from Cesium.svelte */
  .modal-record {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .modal-record .title {
    font-size: 1.2rem;
    font-weight: bold;
    margin: 0 0 0.5rem 0;
    color: #333;
  }

  .modal-record .text {
    font-size: 1rem;
    margin: 0 0 1rem 0;
    color: #666;
    line-height: 1.4;
  }

  .modal-record .model-info {
    font-size: 0.9rem;
    margin: 0 0 1rem 0;
    color: #888;
    font-style: italic;
  }

  .modal-record .created {
    font-size: 0.8rem;
    margin: 0 0 1rem 0;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .modal-record p {
    margin: 0.5rem 0;
  }

</style>