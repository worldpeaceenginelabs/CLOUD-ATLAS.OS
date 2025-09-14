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
  import ModalManager from "./components/ModalManager.svelte";
  import ShareButton from "./components/Sharebutton.svelte";
  import GlassmorphismButton from "./components/GlassmorphismButton.svelte";
  import { 
    models, 
    coordinates, 
    currentCoords,
    showPicture,
    gridReady,
    isVisible,
    cesiumActions,
    basemapProgress,
    tilesetProgress,
    isInitialLoadComplete,
    editingModelId,
    temporaryModelId
  } from './store';
  import type { ModelData } from './types';
  import { modalService } from './utils/modalService';
  import { dataManager } from './dataManager';
  import { formatTimestamp } from './utils/timeUtils';
  import { addModel, updateModel, removeModel, createFinalModelData, validateModelForm, addTemporaryModel, removeTemporaryModel, persistTemporaryModel } from './utils/modelUtils';
  import { logger } from './utils/logger';

  let quote = "\"You never change things by fighting the existing reality. To change something, build a new model that makes the existing model obsolete.\" Buckminster Fuller";

  // Component references for cleanup
  let cesiumComponent: Cesium | null = null;
  let infoboxComponent: Infobox | null = null;
  let gridComponent: Grid | null = null;
  let addButtonComponent: AddButton | null = null;
  let actionEventComponent: ActionEvent | null = null;
  let advertisingBannerComponent: AdvertisingBanner | null = null;
  let progressBarComponent: ProgressBar | null = null;

  // Note: Preview functions removed - using temporary model system instead
  
  // Roaming animation functions from Cesium component
  let updateRoamingModel: ((modelData: any) => void) | undefined = undefined;

  // Card visibility states - now managed by modal system
  let showModelSettingsCard = false;

  // Dropdown states for bottom cards
  let showModelSettingsDropdown = true;

  // Form data states - now managed by preview store
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

  // Reactive statement to track editingModelId changes
  $: if ($editingModelId) {
    console.log('🎯 [DEBUG] editingModelId changed to:', $editingModelId);
  } else {
    console.log('🎯 [DEBUG] editingModelId is now null');
  }

  // Note: Preview model updates are now handled by the temporary model system in handleEditorFormDataChange

  // Reactive statement to update temporary model when coordinates change
  $: if ($temporaryModelId && ($coordinates.latitude || $coordinates.longitude)) {
    console.log('🎯 [DEBUG] Coordinates changed, updating temporary model position:', {
      tempModelId: $temporaryModelId,
      latitude: $coordinates.latitude,
      longitude: $coordinates.longitude,
      height: $coordinates.height
    });
    updateTemporaryModelFromFormData();
  }

  // Functions to show/hide all cards
  function showAllCards() {
    showModelSettingsCard = true;
    // Reset dropdown states to open when showing cards
    showModelSettingsDropdown = true;
  }

  function hideAllCards() {
    showModelSettingsCard = false;
    // Reset dropdown states
    showModelSettingsDropdown = false;
    // Reset form data
    resetFormData();
  }

  function resetFormData() {
    // Remove temporary model if it exists
    if ($temporaryModelId) {
      console.log('🎯 [APP] Removing temporary model on form reset:', $temporaryModelId);
      removeTemporaryModel($temporaryModelId);
      temporaryModelId.set(null);
    }
    
    // Reset edit state
    editingModelId.set(null);
    
    // Reset form data
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
    isRoamingEnabled = false;
    roamingSpeed = 1.0;
    roamingArea = null;
  }

  // Handle Add Model trigger
  function handleAddModel() {
    console.log('🎯 [DEBUG] handleAddModel called - Starting model creation workflow');
    
    // Reset edit state for add mode
    editingModelId.set(null);
    
    // Clear any existing temporary model
    if ($temporaryModelId) {
      console.log('🎯 [DEBUG] handleAddModel - Removing existing temporary model:', $temporaryModelId);
      removeTemporaryModel($temporaryModelId);
      temporaryModelId.set(null);
    }
    
    console.log('🎯 [DEBUG] handleAddModel - State reset:', {
      editingModelId: $editingModelId,
      temporaryModelId: $temporaryModelId
    });
    
    modalService.showModelEditor(false);
    // Close the AddButton menu
    if (addButtonComponent) {
      addButtonComponent.closeMenu();
    }
    
    console.log('🎯 [DEBUG] handleAddModel - Model editor opened in add mode');
  }

  // Handle Edit Model trigger
  function handleEditModel(modelData: any) {
    console.log('🎯 [DEBUG] handleEditModel called - Starting model edit workflow', {
      modelId: modelData?.id,
      modelName: modelData?.name,
      modelData: modelData
    });
    
    if (modelData) {
      // Set editing model ID
      editingModelId.set(modelData.id);
      
      console.log('🎯 [DEBUG] handleEditModel - Edit mode set:', {
        editingModelId: $editingModelId
      });
      
      // Update coordinates store with model data for edit mode
      coordinates.set({
        latitude: modelData.coordinates.latitude.toString(),
        longitude: modelData.coordinates.longitude.toString(),
        height: modelData.transform.height
      });
      
      console.log('🎯 [DEBUG] handleEditModel - Coordinates updated:', {
        latitude: modelData.coordinates.latitude,
        longitude: modelData.coordinates.longitude,
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
      
      console.log('🎯 [DEBUG] handleEditModel - Form data populated:', {
        modelName,
        modelDescription,
        scale,
        height,
        heightOffset,
        heading,
        pitch,
        roll
      });
      
      // Set source type
      if (modelData.source === 'file' && modelData.file) {
        selectedSource = 'file';
        gltfFile = modelData.file;
        gltfUrl = '';
        console.log('🎯 [DEBUG] handleEditModel - File source set:', { selectedSource, hasFile: !!gltfFile });
      } else {
        selectedSource = 'url';
        gltfUrl = modelData.url || '';
        gltfFile = null;
        console.log('🎯 [DEBUG] handleEditModel - URL source set:', { selectedSource, gltfUrl });
      }
      
      // Set roaming data
      isRoamingEnabled = modelData.roaming?.isEnabled || false;
      roamingSpeed = modelData.roaming?.speed || 1.0;
      roamingArea = modelData.roaming?.area || null;
      
      console.log('🎯 [DEBUG] handleEditModel - Roaming data set:', {
        isRoamingEnabled,
        roamingSpeed,
        roamingArea
      });
      
      // Clear any existing temporary model
      if ($temporaryModelId) {
        console.log('🎯 [DEBUG] handleEditModel - Removing existing temporary model:', $temporaryModelId);
        removeTemporaryModel($temporaryModelId);
        temporaryModelId.set(null);
      }
      
      console.log('🎯 [DEBUG] handleEditModel - Ready for edit mode with form data populated');
      
      modalService.showModelEditor(true, modelData);
      // Close the AddButton menu
      if (addButtonComponent) {
        addButtonComponent.closeMenu();
      }
      
      console.log('🎯 [DEBUG] handleEditModel - Model editor opened in edit mode');
    } else {
      console.error('🎯 [DEBUG] handleEditModel - No model data provided');
    }
  }

  // Handle form submission
  async function handleSubmit() {
    console.log('🎯 [DEBUG] handleSubmit called - Starting form submission workflow', {
      isEditMode: !!$editingModelId,
      editingModelId: $editingModelId,
      modelName,
      selectedSource,
      hasFile: !!gltfFile,
      hasUrl: !!gltfUrl,
      coordinates: $coordinates,
      latitude: $coordinates.latitude,
      longitude: $coordinates.longitude,
      height: $coordinates.height
    });
    
    // Debug: Check if editingModelId is null and why
    if (!$editingModelId) {
      console.warn('🎯 [DEBUG] WARNING: editingModelId is null in handleSubmit! This will create a new model instead of updating.');
    }
    
    try {
      // Validate form using shared utility
      const validation = validateModelForm(
        modelName,
        $coordinates,
        selectedSource,
        gltfFile,
        gltfUrl
      );

      console.log('🎯 [DEBUG] handleSubmit - Form validation result:', {
        isValid: validation.isValid,
        errorMessage: validation.errorMessage
      });

      if (!validation.isValid) {
        console.error('🎯 [DEBUG] handleSubmit - Form validation failed:', validation.errorMessage);
        alert(validation.errorMessage);
        return;
      }

      // Create model data using shared utility
      console.log('🎯 [DEBUG] handleSubmit - Form data before createFinalModelData:', {
        selectedSource,
        modelName,
        scale,
        height,
        isRoamingEnabled,
        roamingSpeed,
        roamingArea
      });
      
      const modelData = createFinalModelData(
        $coordinates,
        {
          selectedSource: selectedSource as 'url' | 'file',
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
        !!$editingModelId,
        $editingModelId || undefined
      );

      console.log('🎯 [DEBUG] handleSubmit - Model data created:', {
        id: modelData.id,
        name: modelData.name,
        source: modelData.source,
        coordinates: modelData.coordinates,
        transform: modelData.transform,
        roaming: modelData.roaming
      });

      // Note: Preview model cleanup is now handled by the temporary model system

      if ($editingModelId) {
        // Update existing model - use the original model ID, not preview ID
        const originalModelData = {
          ...modelData,
          id: $editingModelId, // Use original model ID
          name: modelData.name.replace(' (Preview)', '') // Remove preview suffix
        };
        
        console.log('🎯 [DEBUG] handleSubmit - Updating existing model:', {
          originalId: $editingModelId,
          newId: originalModelData.id,
          name: originalModelData.name,
          scale: originalModelData.transform.scale,
          height: originalModelData.transform.height,
          coordinates: originalModelData.coordinates
        });
        
        await updateModel(originalModelData);
        logger.modelUpdated(originalModelData.name);
        
        console.log('🎯 [DEBUG] handleSubmit - Model updated successfully');
        
        // Clean up temporary preview model if it exists
        if ($temporaryModelId) {
          console.log('🎯 [DEBUG] handleSubmit - Removing temporary preview model:', $temporaryModelId);
          removeTemporaryModel($temporaryModelId);
          temporaryModelId.set(null);
        }
        
        // Update roaming animation if enabled
        if (updateRoamingModel && originalModelData.roaming?.isEnabled) {
          console.log('🎯 [DEBUG] handleSubmit - Updating roaming animation for model:', originalModelData.name);
          updateRoamingModel(originalModelData);
        }
      } else if ($temporaryModelId) {
        // Persist the temporary model
        console.log('🎯 [DEBUG] handleSubmit - Persisting temporary model:', {
          tempId: $temporaryModelId,
          modelName: modelData.name
        });
        
        await persistTemporaryModel($temporaryModelId);
        logger.modelAdded(modelData.name);
        
        console.log('🎯 [DEBUG] handleSubmit - Temporary model persisted successfully');
        
        // Clear the temporary model ID
        temporaryModelId.set(null);
        
        // Add to roaming animation if enabled
        if (updateRoamingModel && modelData.roaming?.isEnabled) {
          console.log('🎯 [DEBUG] handleSubmit - Adding model to roaming animation:', modelData.name);
          updateRoamingModel(modelData);
        }
      } else {
        // Add new model (fallback for non-temporary models)
        console.log('🎯 [DEBUG] handleSubmit - Adding new model:', {
          id: modelData.id,
          name: modelData.name,
          source: modelData.source
        });
        
        await addModel(modelData);
        logger.modelAdded(modelData.name);
        
        console.log('🎯 [DEBUG] handleSubmit - Model added successfully');
        
        // Add to roaming animation if enabled
        if (updateRoamingModel && modelData.roaming?.isEnabled) {
          console.log('🎯 [DEBUG] handleSubmit - Adding model to roaming animation:', modelData.name);
          updateRoamingModel(modelData);
        }
      }

      // Hide modal after successful submission
      console.log('🎯 [DEBUG] handleSubmit - Hiding model editor modal');
      modalService.hideModelEditor();
      
      console.log('🎯 [DEBUG] handleSubmit - Form submission completed successfully');
    } catch (error) {
      console.error('🎯 [DEBUG] handleSubmit - Form submission failed:', error);
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
      // Note: Preview updates are now handled by the temporary model system
    }
  }

  // Handle URL change
  function handleUrlChange() {
    gltfFile = null;
    // Note: Preview updates are now handled by the temporary model system
  }

  // Update preview model - now reactive and connected to store
  // Note: updatePreviewModel function removed - preview functionality now handled by temporary model system

  // Toggle dropdown functions
  function toggleModelSettingsDropdown() {
    showModelSettingsDropdown = !showModelSettingsDropdown;
  }

  // Modal management functions - now handled by modal service
  function closeRecordModal() {
    modalService.hideRecordDetails();
  }

  function closeModelModal() {
    modalService.hideModelDetails();
  }

  function closeModelModalForEdit() {
    modalService.hideModelDetails();
    // The edit functionality will be handled by the existing handleEditModel function
  }

  // Time formatting now uses centralized utility from timeUtils.ts

  // Model management functions are now imported from utils/modelUtils.ts

  // Set up event listener for edit model events
  function setupEventListeners() {
    window.addEventListener('editModel', handleEditModelEvent as EventListener);
    window.addEventListener('editorFormDataChange', handleEditorFormDataChange as EventListener);
    window.addEventListener('editorSave', handleEditorSave as EventListener);
    window.addEventListener('editorCancel', handleEditorCancel as EventListener);
    window.addEventListener('editorOpened', handleEditorOpened as EventListener);
  }

  function cleanupEventListeners() {
    window.removeEventListener('editModel', handleEditModelEvent as EventListener);
    window.removeEventListener('editorFormDataChange', handleEditorFormDataChange as EventListener);
    window.removeEventListener('editorSave', handleEditorSave as EventListener);
    window.removeEventListener('editorCancel', handleEditorCancel as EventListener);
    window.removeEventListener('editorOpened', handleEditorOpened as EventListener);
  }
  
  // Handle form data changes from Editor modal
  function handleEditorFormDataChange(event: CustomEvent) {
    const formData = event.detail;
    
    console.log('🎯 [APP] Editor form data change received:', {
      selectedSource: formData.selectedSource,
      modelName: formData.modelName,
      scale: formData.scale,
      isRoamingEnabled: formData.isRoamingEnabled,
      roamingSpeed: formData.roamingSpeed,
      roamingArea: formData.roamingArea
    });
    
    // Update the form data in App.svelte to trigger preview
    selectedSource = formData.selectedSource;
    gltfFile = formData.gltfFile;
    gltfUrl = formData.gltfUrl;
    modelName = formData.modelName;
    modelDescription = formData.modelDescription;
    scale = formData.scale;
    height = formData.height;
    heightOffset = formData.heightOffset;
    heading = formData.heading;
    pitch = formData.pitch;
    roll = formData.roll;
    isRoamingEnabled = formData.isRoamingEnabled;
    roamingSpeed = formData.roamingSpeed;
    roamingArea = formData.roamingArea;
    
    console.log('🎯 [APP] Form data updated, checking for automatic model loading...', {
      isRoamingEnabled,
      roamingSpeed,
      roamingArea,
      hasUrl: !!gltfUrl,
      hasFile: !!gltfFile,
      hasCoordinates: !!$coordinates.latitude && !!$coordinates.longitude
    });
    
    // Check if we should show a preview model
    if ((selectedSource === 'url' && gltfUrl) || (selectedSource === 'file' && gltfFile)) {
      
      // Show preview model (works for both add and edit mode)
      if (!$temporaryModelId) {
        console.log('🎯 [APP] Adding preview model for', $editingModelId ? 'edit mode' : 'add mode');
        addTemporaryModelFromFormData();
      } else {
        console.log('🎯 [APP] Updating existing preview model');
        updateTemporaryModelFromFormData();
      }
    }
  }

  // Add temporary model from form data
  function addTemporaryModelFromFormData() {
    console.log('🎯 [APP] addTemporaryModelFromFormData called');
    
    // Use current coordinates or default coordinates if not set
    const modelCoordinates = {
      latitude: $coordinates.latitude || '0',
      longitude: $coordinates.longitude || '0',
      height: $coordinates.height || 0
    };
    
    console.log('🎯 [APP] Using coordinates for temporary model:', modelCoordinates);
    
    const tempModelData = createFinalModelData(
      modelCoordinates,
      {
        selectedSource: selectedSource as 'url' | 'file',
        gltfFile,
        gltfUrl,
        modelName: modelName || (gltfFile?.name || 'New Model'),
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
      !!$editingModelId, // isEditMode
      $editingModelId || undefined // editingModelId
    );
    
    const tempId = addTemporaryModel(tempModelData);
    temporaryModelId.set(tempId);
    
    console.log('🎯 [APP] Temporary model added:', {
      tempId,
      modelName: tempModelData.name,
      coordinates: tempModelData.coordinates
    });
  }

  // Update existing temporary model
  function updateTemporaryModelFromFormData() {
    console.log('🎯 [APP] updateTemporaryModelFromFormData called');
    
    if ($temporaryModelId) {
      // Remove the old temporary model
      removeTemporaryModel($temporaryModelId);
      
      // Add a new one with updated data
      addTemporaryModelFromFormData();
    }
  }

  // Handle Editor save event
  function handleEditorSave() {
    console.log('🎯 [DEBUG] handleEditorSave called - Edit mode state:', {
      isEditMode: !!$editingModelId,
      editingModelId: $editingModelId,
      coordinates: $coordinates,
      latitude: $coordinates.latitude,
      longitude: $coordinates.longitude,
      height: $coordinates.height
    });
    // Call the existing handleSubmit function
    handleSubmit();
  }

  // Handle Editor cancel event
  function handleEditorCancel() {
    console.log('🎯 [DEBUG] handleEditorCancel called - Removing temporary model and resetting form');
    
    // Remove temporary model if it exists
    if ($temporaryModelId) {
      console.log('🎯 [DEBUG] handleEditorCancel - Removing temporary model:', $temporaryModelId);
      removeTemporaryModel($temporaryModelId);
      temporaryModelId.set(null);
    }
    
    // In edit mode, the original model will remain unchanged (no action needed)
    
    // Reset form data
    resetFormData();
    
    // Hide the modal
    modalService.hideModelEditor();
  }

  // Handle Editor opened event (for edit mode)
  function handleEditorOpened(event: CustomEvent) {
    const { editMode, modelData } = event.detail;
    
    if (editMode && modelData) {
      console.log('🎯 [APP] Editor opened in edit mode with model:', modelData);
      
      // Set editing model ID
      editingModelId.set(modelData.id);
      
      console.log('🎯 [APP] Editor opened - editingModelId set to:', modelData.id);
      
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
      
      // Clear any existing temporary model
      if ($temporaryModelId) {
        console.log('🎯 [DEBUG] handleEditorOpened - Removing existing temporary model:', $temporaryModelId);
        removeTemporaryModel($temporaryModelId);
        temporaryModelId.set(null);
      }
    } else {
      // Reset to add mode
      editingModelId.set(null);
      resetFormData();
    }
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
      <div class="cesiumcontainer"><Cesium bind:this={cesiumComponent} bind:updateRoamingModel /></div>
    {/if}
    <!--- <div class="searchcontainer"><Appsearch /></div> -->
    <div class="infoboxcontainer"><Infobox bind:this={infoboxComponent} isVisible={isVisible} /></div>
    <AdvertisingBanner bind:this={advertisingBannerComponent} />
    <ProgressBar bind:this={progressBarComponent} basemapProgress={$basemapProgress} tilesetProgress={$tilesetProgress} isInitialLoadComplete={$isInitialLoadComplete} />
    <AddButton 
      bind:this={addButtonComponent} 
      onAddModel={handleAddModel}
    />

    <!-- Modal Manager handles all modals -->
    <ModalManager />

    <!-- All modals are now handled by ModalManager component -->
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

  /* Editor Model Settings Card positioning - now handled by ModalManager */


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

  /* Modal styles moved to ModalManager.svelte */

</style>