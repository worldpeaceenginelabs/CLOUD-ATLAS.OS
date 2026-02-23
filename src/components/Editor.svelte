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
  
  export let isEditMode = false;
  
  let sheetExpanded = true;

  $: if ($roamingAreaBounds) {
    formRoamingArea.set($roamingAreaBounds);
  }

  $: {
    $formSelectedSource; $formGltfFile; $formGltfUrl; $formModelName; $formModelDescription;
    $formScale; $formHeight; $formHeightOffset; $formHeading; $formPitch; $formRoll;
    $formIsRoamingEnabled; $formRoamingSpeed; $formRoamingArea;
    modelEditorService.updatePreview();
  }

  function openPlayCanvas() {
    const w = window.open(
      'https://playcanvas.com/editor',
      'playcanvas-editor',
      'width=1200,height=800,resizable=yes,scrollbars=yes'
    );
    if (w) w.focus();
  }
  
  function handleSave() {
    modelEditorService.handleSubmit();
  }
  
  function handleCancel() {
    modelEditorService.handleCancel();
  }

  function toggleSheet() {
    sheetExpanded = !sheetExpanded;
  }

  onMount(() => {
    isEditorOpen.set(true);
  });

  onDestroy(() => {
    isEditorOpen.set(false);
  });
</script>

<div class="editor-panel" class:expanded={sheetExpanded}>
  <!-- Drag handle for mobile bottom sheet -->
  <div class="sheet-handle" on:click={toggleSheet} on:keydown={(e) => e.key === 'Enter' && toggleSheet()} role="button" tabindex="0" aria-label="Toggle panel">
    <div class="handle-bar"></div>
  </div>

  <!-- Compact header -->
  <div class="panel-header">
    <button class="header-btn close" on:click={handleCancel} aria-label="Close editor">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    </button>
    <h2 class="panel-title">{isEditMode ? 'Edit Model' : 'Add Model'}</h2>
    <button class="header-btn save" on:click={handleSave}>
      {isEditMode ? 'Save' : 'Add'}
    </button>
  </div>

  <!-- Scrollable content -->
  <div class="panel-body" role="region" aria-label="Model settings">
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
      onOpenPlayCanvas={openPlayCanvas}
    />
  </div>
</div>

<style>
  /* ── Base panel (desktop: right side panel) ── */
  .editor-panel {
    position: fixed;
    top: 0;
    left: 0;
    width: 380px;
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: rgba(12, 12, 20, 0.92);
    backdrop-filter: blur(24px);
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    pointer-events: auto;
    animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideInRight {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
  }

  /* Hide drag handle on desktop */
  .sheet-handle {
    display: none;
  }

  /* ── Header ── */
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
    gap: 12px;
  }

  .panel-title {
    color: white;
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    flex: 1;
    text-align: center;
    letter-spacing: 0.01em;
  }

  .header-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  .header-btn.close {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
    width: 36px;
    height: 36px;
    padding: 0;
  }
  .header-btn.close:hover {
    background: rgba(255, 255, 255, 0.12);
    color: white;
  }

  .header-btn.save {
    background: #4ade80;
    color: #0a0a0a;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 8px 20px;
    min-width: 64px;
  }
  .header-btn.save:hover {
    background: #22c55e;
  }

  /* ── Scrollable body ── */
  .panel-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 16px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
  }
  .panel-body::-webkit-scrollbar { width: 4px; }
  .panel-body::-webkit-scrollbar-track { background: transparent; }
  .panel-body::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
  }

  /* ── Mobile: bottom sheet ── */
  @media (max-width: 768px) {
    .editor-panel {
      top: auto;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      height: auto;
      max-height: 85dvh;
      border-left: none;
      border-radius: 20px 20px 0 0;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.5);
      animation: slideUpSheet 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      transform: none;
      transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .editor-panel:not(.expanded) {
      max-height: 64px;
    }
    .editor-panel:not(.expanded) .panel-body {
      display: none;
    }

    @keyframes slideUpSheet {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    .sheet-handle {
      display: flex;
      justify-content: center;
      padding: 10px 0 4px;
      cursor: pointer;
      flex-shrink: 0;
      -webkit-tap-highlight-color: transparent;
    }
    .handle-bar {
      width: 36px;
      height: 4px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 2px;
    }

    .panel-header {
      padding: 8px 14px 12px;
    }
    .panel-title {
      font-size: 0.95rem;
    }
    .header-btn.save {
      padding: 7px 16px;
      font-size: 0.8rem;
    }

    .panel-body {
      padding: 12px 14px 24px;
      max-height: calc(85dvh - 100px);
    }
  }
</style>
