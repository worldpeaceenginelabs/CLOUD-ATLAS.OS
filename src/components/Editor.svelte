<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ModelSettings from './ModelSettings.svelte';
  import { roamingAreaBounds, coordinates, editingModelId } from '../store';
  
  // Props
  export let isEditMode = false;
  export let modelData: any = null;
  
  // Component state
  export let selectedEditor: 'threejs' | 'webglstudio' = 'threejs';
  
  // Dropdown state for ModelSettings
  let showDropdown = false;
  
  // ModelSettings props
  export let selectedSource = 'url';
  export let gltfFile: File | null = null;
  export let gltfUrl = '';
  export let modelName = '';
  export let modelDescription = '';
  export let scale = 1.0;
  export let height = 0;
  export let heightOffset = 0.0;
  export let heading = 0;
  export let pitch = 0;
  export let roll = 0;
  export let isRoamingEnabled = false;
  export let roamingSpeed = 1.0;
  export let roamingArea: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null = null;

  // Reactive statement to sync roamingArea with store
  $: if ($roamingAreaBounds) {
    roamingArea = $roamingAreaBounds;
  }

  // Track if form has been initially populated to prevent overwriting user changes
  let hasBeenInitiallyPopulated = false;
  
  // Reset populated flag when component mounts
  $: if (typeof window !== 'undefined') {
    hasBeenInitiallyPopulated = false;
  }
  
  // Populate form fields when modelData is provided (edit mode) - only once
  $: if (modelData && isEditMode && !hasBeenInitiallyPopulated) {
    console.log('🎯 [EDITOR] Populating form with model data (EDIT MODE):', {
      modelId: modelData.id,
      modelName: modelData.name,
      isEditMode,
      hasBeenInitiallyPopulated,
      coordinates: modelData.coordinates
    });
    
    // Set coordinates in store for edit mode
    coordinates.set({
      latitude: modelData.coordinates.latitude.toString(),
      longitude: modelData.coordinates.longitude.toString(),
      height: modelData.transform.height
    });
    
    console.log('🎯 [EDITOR] Coordinates set in store:', {
      latitude: modelData.coordinates.latitude,
      longitude: modelData.coordinates.longitude,
      height: modelData.transform.height
    });
    
    // Set the editing model ID directly in the store
    editingModelId.set(modelData.id);
    console.log('🎯 [EDITOR] editingModelId set to:', modelData.id);
    
    // Dispatch event to notify App.svelte about edit mode
    dispatch('editorOpened', { editMode: true, modelData });
    
    // Populate basic fields
    modelName = modelData.name || '';
    modelDescription = modelData.description || '';
    scale = modelData.transform?.scale || 1.0;
    height = modelData.transform?.height || 0;
    heightOffset = modelData.transform?.heightOffset || 0.0;
    heading = modelData.transform?.heading || 0;
    pitch = modelData.transform?.pitch || 0;
    roll = modelData.transform?.roll || 0;
    
    // Populate source and file/URL
    if (modelData.source === 'file' && modelData.file) {
      selectedSource = 'file';
      gltfFile = modelData.file instanceof File ? modelData.file : null;
      gltfUrl = '';
    } else {
      selectedSource = 'url';
      gltfUrl = modelData.url || '';
      gltfFile = null;
    }
    
    // Populate roaming data
    isRoamingEnabled = modelData.roaming?.isEnabled || false;
    roamingSpeed = modelData.roaming?.speed || 1.0;
    roamingArea = modelData.roaming?.area || null;
    
    console.log('🎯 [EDITOR] Form populated (EDIT MODE):', {
      modelName,
      selectedSource,
      isRoamingEnabled,
      roamingSpeed,
      roamingArea
    });
    
    // Mark as initially populated
    hasBeenInitiallyPopulated = true;
  } else if (modelData && !isEditMode) {
    console.log('🎯 [EDITOR] Model data provided but NOT in edit mode - ignoring form population:', {
      modelId: modelData.id,
      modelName: modelData.name,
      isEditMode,
      hasBeenInitiallyPopulated
    });
  }

  // Dispatch event when Editor opens in add mode
  $: if (!isEditMode && !modelData) {
    dispatch('editorOpened', { editMode: false, modelData: null });
    // Reset the populated flag for add mode
    hasBeenInitiallyPopulated = false;
  }
  
  
  // Event dispatcher
  const dispatch = createEventDispatcher();
  
  function switchEditor(editor: 'threejs' | 'webglstudio') {
    selectedEditor = editor;
    dispatch('editorSwitch', editor);
  }
  
  function handleSave() {
    dispatch('save');
  }
  
  function handleCancel() {
    dispatch('cancel');
  }
  
  function handleClose() {
    dispatch('close');
  }
  
  function handleToggleDropdown() {
    showDropdown = !showDropdown;
  }
  
  // Emit form data changes for preview
  function emitFormDataChange() {
    console.log('🎯 [EDITOR] Emitting form data change for automatic preview update:', {
      selectedSource,
      hasFile: !!gltfFile,
      hasUrl: !!gltfUrl,
      modelName,
      isRoamingEnabled
    });
    dispatch('formDataChange', {
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
    });
  }
  
  // Watch for form data changes and emit events
  $: {
    console.log('🎯 [EDITOR] Reactive statement triggered:', {
      selectedSource,
      modelName,
      scale,
      height,
      isEditMode,
      hasFile: !!gltfFile,
      hasUrl: !!gltfUrl,
      isRoamingEnabled,
      roamingSpeed,
      hasRoamingArea: !!roamingArea
    });
    emitFormDataChange();
  }
</script>

<div class="editor-container">
  <!-- Editor Header -->
  <div class="editor-top-bar">
    <div class="editor-header">
      <h2 class="editor-title">
        {isEditMode ? 'Edit 3D Model' : 'Add 3D Model'}
      </h2>
      <button class="close-button" on:click={handleClose} aria-label="Close editor">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    
    <!-- Editor Selector -->
    <div class="editor-selector">
      <button 
        class="editor-tab" 
        class:active={selectedEditor === 'threejs'}
        on:click={() => switchEditor('threejs')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        ThreeJS Editor
      </button>
      
      <button 
        class="editor-tab" 
        class:active={selectedEditor === 'webglstudio'}
        on:click={() => switchEditor('webglstudio')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
          <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="2"/>
          <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="2"/>
        </svg>
        WebGL Studio
      </button>
    </div>
    
    <!-- Action Buttons -->
    <div class="editor-actions">
      <button class="action-button secondary" on:click={handleCancel}>
        Cancel
      </button>
      <button class="action-button primary" on:click={handleSave}>
        {isEditMode ? 'Update Model' : 'Add Model'}
      </button>
    </div>
  </div>

  <!-- Model Settings Component -->
  <ModelSettings 
    coordinates={$coordinates}
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
    bind:showDropdown
    onToggleDropdown={handleToggleDropdown}
    onSourceChange={(source) => selectedSource = source}
    onFileSelect={() => { console.log('🎯 [EDITOR] onFileSelect called'); emitFormDataChange(); }}
    onUrlChange={() => { console.log('🎯 [EDITOR] onUrlChange called'); emitFormDataChange(); }}
  />
</div>

<style>
  .editor-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    position: relative;
    z-index: 1000;
  }
  
  .editor-top-bar {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    border-radius: 0 0 12px 12px;
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    flex-shrink: 0;
    pointer-events: auto;
    z-index: 1000;
    position: relative;
  }
  
  .editor-header {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .editor-title {
    color: white;
    margin: 0;
    font-size: 1.5em;
    font-weight: 600;
  }
  
  .close-button {
    background: transparent;
    border: none;
    color: #ccc;
    cursor: pointer;
    padding: 8px;
    border-radius: 6px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .close-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
  
  .editor-selector {
    display: flex;
    gap: 8px;
    background: rgba(255, 255, 255, 0.05);
    padding: 4px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .editor-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: none;
    color: #ccc;
    padding: 12px 16px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.9em;
    font-weight: 500;
  }
  
  .editor-tab:hover {
    background: rgba(255, 255, 255, 0.05);
    color: white;
  }
  
  .editor-tab.active {
    background: #4ade80;
    color: #1a1a1a;
    font-weight: 600;
  }
  
  .editor-tab svg {
    flex-shrink: 0;
  }
  
  .editor-actions {
    display: flex;
    gap: 12px;
  }
  
  .action-button {
    padding: 12px 24px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 0.9em;
    font-weight: 600;
    transition: all 0.2s ease;
    min-width: 120px;
  }
  
  .action-button.secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .action-button.secondary:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }
  
  .action-button.primary {
    background: #4ade80;
    color: #1a1a1a;
    border: 1px solid #4ade80;
  }
  
  .action-button.primary:hover {
    background: #22c55e;
    border-color: #22c55e;
  }
  
  /* Mobile responsive */
  @media (max-width: 768px) {
    .editor-top-bar {
      flex-direction: column;
      align-items: stretch;
      gap: 16px;
      padding: 12px 16px;
    }
    
    .editor-header {
      justify-content: space-between;
    }
    
    .editor-selector {
      order: 2;
      justify-content: center;
    }
    
    .editor-actions {
      order: 3;
      justify-content: center;
    }
    
    .editor-tab {
      flex: 1;
      justify-content: center;
    }
    
    .action-button {
      flex: 1;
      min-width: auto;
    }
  }
  
  @media (max-width: 480px) {
    .editor-title {
      font-size: 1.2em;
    }
    
    .editor-tab {
      padding: 10px 12px;
      font-size: 0.8em;
    }
    
    .editor-tab svg {
      width: 16px;
      height: 16px;
    }
    
    .action-button {
      padding: 10px 16px;
      font-size: 0.8em;
    }
  }
</style>
