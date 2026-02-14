<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ModelSettings from './ModelSettings.svelte';
  import { roamingAreaBounds, coordinates, isEditorOpen } from '../store';
  import {
    modelEditorService,
    formSelectedSource,
    formGltfFile,
    formGltfUrl,
    formModelName,
    formModelDescription,
    formScale,
    formHeight,
    formHeightOffset,
    formHeading,
    formPitch,
    formRoll,
    formIsRoamingEnabled,
    formRoamingSpeed,
    formRoamingArea
  } from '../utils/modelEditorService';
  
  // Props
  export let isEditMode = false;
  
  // Component state
  export let selectedEditor: 'caos-editor' | 'playcanvas' = 'caos-editor';
  
  // Dropdown state for ModelSettings
  let showDropdown = false;

  // Sync roamingAreaBounds (from map painting) into the form store
  $: if ($roamingAreaBounds) {
    formRoamingArea.set($roamingAreaBounds);
  }

  // Watch for form store changes and update the preview model
  $: {
    $formSelectedSource; $formGltfFile; $formGltfUrl; $formModelName; $formModelDescription;
    $formScale; $formHeight; $formHeightOffset; $formHeading; $formPitch; $formRoll;
    $formIsRoamingEnabled; $formRoamingSpeed; $formRoamingArea;
    modelEditorService.updatePreview();
  }
  
  function switchEditor(editor: 'caos-editor' | 'playcanvas') {
    if (editor === 'playcanvas') {
      const playcanvasWindow = window.open(
        'https://playcanvas.com/editor',
        'playcanvas-editor',
        'width=1200,height=800,resizable=yes,scrollbars=yes,status=yes,toolbar=no,menubar=no,location=no,personalbar=no'
      );
      if (playcanvasWindow) {
        playcanvasWindow.focus();
      }
      return;
    }
    
    if (selectedEditor !== editor) {
      selectedEditor = editor;
    }
  }
  
  function handleSave() {
    modelEditorService.handleSubmit();
  }
  
  function handleCancel() {
    modelEditorService.handleCancel();
  }
  
  function handleToggleDropdown() {
    if ($isEditorOpen) {
      showDropdown = !showDropdown;
    }
  }

  // Control dropdown state based on Editor visibility
  $: if ($isEditorOpen) {
    showDropdown = true;
  } else {
    showDropdown = false;
  }

  onMount(() => {
    isEditorOpen.set(true);
  });

  onDestroy(() => {
    isEditorOpen.set(false);
  });
</script>

<div class="editor-container">
  <!-- Editor Header -->
  <div class="editor-top-bar">
    <div class="editor-header">
      <h2 class="editor-title">
        {isEditMode ? 'Edit 3D Model' : 'Add 3D Model'}
      </h2>
      <button class="close-button" on:click={handleCancel} aria-label="Close editor">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
    
    <!-- Editor Selector -->
    <div class="editor-selector">
      <button 
        class="editor-tab" 
        class:active={selectedEditor === 'caos-editor'}
        on:click={() => switchEditor('caos-editor')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        CAOS Editor
      </button>
      
      <button 
        class="editor-tab" 
        class:active={selectedEditor === 'playcanvas'}
        on:click={() => switchEditor('playcanvas')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
          <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="2"/>
          <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="2"/>
        </svg>
        PlayCanvas
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
    bind:selectedSource={$formSelectedSource}
    bind:gltfFile={$formGltfFile}
    bind:gltfUrl={$formGltfUrl}
    bind:modelName={$formModelName}
    bind:modelDescription={$formModelDescription}
    bind:scale={$formScale}
    bind:height={$formHeight}
    bind:heightOffset={$formHeightOffset}
    bind:heading={$formHeading}
    bind:pitch={$formPitch}
    bind:roll={$formRoll}
    bind:isRoamingEnabled={$formIsRoamingEnabled}
    bind:roamingSpeed={$formRoamingSpeed}
    bind:roamingArea={$formRoamingArea}
    bind:showDropdown
    onToggleDropdown={handleToggleDropdown}
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
