<script lang="ts">
  import { afterUpdate, onDestroy } from 'svelte';
  import FormInput from './FormInput.svelte';
  import BehaviorEditor from './BehaviorEditor.svelte';
  import SimulationControls from './SimulationControls.svelte';
  import SceneSection from './SceneSection.svelte';
  import type { Behavior } from '../types';

  export let coordinates: { latitude: string; longitude: string; height: number };

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
  
  export let behavior: Behavior | null = null;

  export let onOpenPlayCanvas: (() => void) | undefined = undefined;

  let fileInput: HTMLInputElement;
  let isDragOver = false;

  type SectionId = 'source' | 'details' | 'transform' | 'roaming' | 'scene';
  let openSection: SectionId = 'source';

  let copyButtonText = 'Copy';
  const exampleUrl = 'https://mixiplycontent.blob.core.windows.net/usefulstuff/51c392cb-1176-463a-a6f9-08d6bd51ab08/Duck.gltf';

  async function copyExampleUrl() {
    try {
      await navigator.clipboard.writeText(exampleUrl);
      copyButtonText = 'Copied!';
      setTimeout(() => { copyButtonText = 'Copy'; }, 2000);
    } catch {
      copyButtonText = 'Failed';
      setTimeout(() => { copyButtonText = 'Copy'; }, 2000);
    }
  }

  // String <-> number bridging for transform sliders
  let scaleValue = scale.toString();
  let heightValue = height.toString();
  let heightOffsetValue = heightOffset.toString();
  let headingValue = heading.toString();
  let pitchValue = pitch.toString();
  let rollValue = roll.toString();

  let lastScale = scale;
  let lastHeight = height;
  let lastHeightOffset = heightOffset;
  let lastHeading = heading;
  let lastPitch = pitch;
  let lastRoll = roll;

  $: scale = parseFloat(scaleValue) || 0;
  $: height = parseFloat(heightValue) || 0;
  $: heightOffset = parseFloat(heightOffsetValue) || 0;
  $: heading = parseFloat(headingValue) || 0;
  $: pitch = parseFloat(pitchValue) || 0;
  $: roll = parseFloat(rollValue) || 0;

  afterUpdate(() => {
    if (scale !== lastScale) { scaleValue = scale.toString(); lastScale = scale; }
    if (height !== lastHeight) { heightValue = height.toString(); lastHeight = height; }
    if (heightOffset !== lastHeightOffset) { heightOffsetValue = heightOffset.toString(); lastHeightOffset = heightOffset; }
    if (heading !== lastHeading) { headingValue = heading.toString(); lastHeading = heading; }
    if (pitch !== lastPitch) { pitchValue = pitch.toString(); lastPitch = pitch; }
    if (roll !== lastRoll) { rollValue = roll.toString(); lastRoll = roll; }
  });

  function handleFileSelectAuto(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) gltfFile = file;
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }
  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
  }
  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.glb') || file.name.endsWith('.gltf') ||
          file.type === 'model/gltf-binary' || file.type === 'model/gltf+json') {
        selectedSource = 'file';
        gltfFile = file;
      }
    }
  }

  function toggleSection(id: SectionId) {
    openSection = openSection === id ? openSection : id;
  }

  function sourcePreview(): string {
    if (selectedSource === 'file' && gltfFile) return gltfFile.name;
    if (selectedSource === 'url' && gltfUrl) {
      const parts = gltfUrl.split('/');
      return parts[parts.length - 1] || 'URL';
    }
    return 'Not set';
  }

  function transformPreview(): string {
    return `${scale.toFixed(1)}x  ${heading}°`;
  }

  function removeFile() {
    gltfFile = null;
    if (fileInput) fileInput.value = '';
  }

  let toggleTimer: ReturnType<typeof setTimeout> | null = null;
  onDestroy(() => { if (toggleTimer) clearTimeout(toggleTimer); });
</script>

<div
  class="settings-root"
  class:drag-over={isDragOver}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  role="region"
  aria-label="Model settings"
>
  <!-- ═══ SIMULATION CONTROLS (inline) ═══ -->
  <SimulationControls />

  <!-- ═══ SOURCE SECTION ═══ -->
  <button class="section-header" class:open={openSection === 'source'} on:click={() => toggleSection('source')}>
    <div class="section-left">
      <svg class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Source</span>
    </div>
    <div class="section-right">
      <span class="section-preview">{sourcePreview()}</span>
      <svg class="chevron" class:rotated={openSection === 'source'} width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  </button>
  {#if openSection === 'source'}
    <div class="section-body">
      <!-- Segmented control -->
      <div class="segmented-control">
        <button class="segment" class:active={selectedSource === 'url'} on:click={() => selectedSource = 'url'}>URL</button>
        <button class="segment" class:active={selectedSource === 'file'} on:click={() => selectedSource = 'file'}>Upload</button>
      </div>

      {#if selectedSource === 'file'}
        <input type="file" accept=".glb,.gltf" bind:this={fileInput} on:change={handleFileSelectAuto} class="sr-only" id="gltfFileInput" />
        {#if gltfFile}
          <div class="file-chip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <div class="file-chip-info">
              <span class="file-chip-name">{gltfFile.name}</span>
              <span class="file-chip-size">{(gltfFile.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <button class="file-chip-remove" on:click={removeFile} aria-label="Remove file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        {/if}
        <label for="gltfFileInput" class="upload-card">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="upload-text">Tap to upload .glb / .gltf</span>
          <span class="upload-hint">or drag & drop anywhere</span>
        </label>
      {:else}
        <input
          type="url"
          bind:value={gltfUrl}
          placeholder="https://example.com/model.glb"
          class="app-input"
        />
        <div class="example-row">
          <span class="example-label">Example:</span>
          <span class="example-url">{exampleUrl.split('/').pop()}</span>
          <button class="pill-btn" on:click={copyExampleUrl}>{copyButtonText}</button>
        </div>
      {/if}

      {#if onOpenPlayCanvas}
        <button class="playcanvas-link" on:click={onOpenPlayCanvas}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/><line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="2"/><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="2"/></svg>
          Open PlayCanvas Editor
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      {/if}
    </div>
  {/if}

  <!-- ═══ DETAILS SECTION ═══ -->
  <button class="section-header" class:open={openSection === 'details'} on:click={() => toggleSection('details')}>
    <div class="section-left">
      <svg class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Details</span>
    </div>
    <div class="section-right">
      <span class="section-preview">{modelName || 'Unnamed'}</span>
      <svg class="chevron" class:rotated={openSection === 'details'} width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  </button>
  {#if openSection === 'details'}
    <div class="section-body">
      <FormInput
        type="text"
        bind:value={modelName}
        placeholder="Model name"
        label="Name"
        required
      />
      <FormInput
        type="textarea"
        bind:value={modelDescription}
        placeholder="Description (optional)"
        label="Description"
        rows={2}
      />
    </div>
  {/if}

  <!-- ═══ TRANSFORM SECTION ═══ -->
  <button class="section-header" class:open={openSection === 'transform'} on:click={() => toggleSection('transform')}>
    <div class="section-left">
      <svg class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Transform</span>
    </div>
    <div class="section-right">
      <span class="section-preview">{transformPreview()}</span>
      <svg class="chevron" class:rotated={openSection === 'transform'} width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  </button>
  {#if openSection === 'transform'}
    <div class="section-body">
      <div class="slider-row">
        <label for="slider-scale">Scale</label>
        <input id="slider-scale" type="range" min="0.1" max="20" step="0.1" bind:value={scaleValue} class="app-slider" />
        <input type="number" class="slider-num" bind:value={scaleValue} min="0.1" max="100" step="0.1" aria-label="Scale value" />
      </div>
      <div class="slider-row">
        <label for="slider-height">Height (m)</label>
        <input id="slider-height" type="range" min="-100" max="1000" step="0.5" bind:value={heightValue} class="app-slider" />
        <input type="number" class="slider-num" bind:value={heightValue} step="0.01" aria-label="Height value" />
      </div>
      {#if coordinates.height}
        <div class="surface-hint">Surface: {coordinates.height.toFixed(1)}m</div>
      {/if}
      <div class="slider-row">
        <label for="slider-offset">Offset (m)</label>
        <input id="slider-offset" type="range" min="-50" max="50" step="0.1" bind:value={heightOffsetValue} class="app-slider" />
        <input type="number" class="slider-num" bind:value={heightOffsetValue} step="0.01" aria-label="Height offset value" />
      </div>
      <div class="slider-row">
        <label for="slider-heading">Heading</label>
        <input id="slider-heading" type="range" min="0" max="360" step="1" bind:value={headingValue} class="app-slider" />
        <input type="number" class="slider-num" bind:value={headingValue} min="0" max="360" step="1" aria-label="Heading value" />
      </div>
      <div class="slider-row">
        <label for="slider-pitch">Pitch</label>
        <input id="slider-pitch" type="range" min="-90" max="90" step="1" bind:value={pitchValue} class="app-slider" />
        <input type="number" class="slider-num" bind:value={pitchValue} min="-90" max="90" step="1" aria-label="Pitch value" />
      </div>
      <div class="slider-row">
        <label for="slider-roll">Roll</label>
        <input id="slider-roll" type="range" min="-180" max="180" step="1" bind:value={rollValue} class="app-slider" />
        <input type="number" class="slider-num" bind:value={rollValue} min="-180" max="180" step="1" aria-label="Roll value" />
      </div>
    </div>
  {/if}

  <!-- ═══ BEHAVIOR SECTION ═══ -->
  <button class="section-header" class:open={openSection === 'roaming'} on:click={() => toggleSection('roaming')}>
    <div class="section-left">
      <svg class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Behavior</span>
    </div>
    <div class="section-right">
      <span class="section-preview">{behavior ? behavior.type : 'None'}</span>
      <svg class="chevron" class:rotated={openSection === 'roaming'} width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  </button>
  {#if openSection === 'roaming'}
    <div class="section-body">
      <BehaviorEditor bind:behavior={behavior} />
    </div>
  {/if}

  <!-- ═══ SCENE SECTION ═══ -->
  <button class="section-header" class:open={openSection === 'scene'} on:click={() => toggleSection('scene')}>
    <div class="section-left">
      <svg class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Scene</span>
    </div>
    <div class="section-right">
      <svg class="chevron" class:rotated={openSection === 'scene'} width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  </button>
  {#if openSection === 'scene'}
    <div class="section-body">
      <SceneSection />
    </div>
  {/if}
</div>

<style>
  .settings-root {
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: border-color 0.2s;
  }
  .settings-root.drag-over {
    border: 2px dashed #4ade80;
    border-radius: 12px;
    padding: 4px;
  }

  /* ── Accordion headers ── */
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: none;
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 500;
    -webkit-tap-highlight-color: transparent;
  }
  .section-header:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  .section-header.open {
    background: rgba(255, 255, 255, 0.06);
    color: white;
    border-radius: 10px 10px 0 0;
  }

  .section-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-icon {
    opacity: 0.6;
    flex-shrink: 0;
  }
  .section-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-preview {
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.78rem;
    font-weight: 400;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chevron {
    opacity: 0.4;
    transition: transform 0.25s ease;
    flex-shrink: 0;
  }
  .chevron.rotated {
    transform: rotate(180deg);
  }

  /* ── Section body ── */
  .section-body {
    padding: 14px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 0 0 10px 10px;
    margin-bottom: 2px;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Segmented control ── */
  .segmented-control {
    display: flex;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 3px;
    gap: 2px;
    margin-bottom: 14px;
  }
  .segment {
    flex: 1;
    padding: 9px 0;
    text-align: center;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
  }
  .segment.active {
    background: rgba(74, 222, 128, 0.15);
    color: #4ade80;
    font-weight: 600;
  }
  .segment:not(.active):hover {
    color: rgba(255, 255, 255, 0.7);
  }

  /* ── Upload card ── */
  .upload-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 24px 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1.5px dashed rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.5);
    transition: all 0.2s ease;
    width: 100%;
    box-sizing: border-box;
  }
  .upload-card:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.7);
  }
  .upload-text {
    font-size: 0.85rem;
    font-weight: 500;
  }
  .upload-hint {
    font-size: 0.75rem;
    opacity: 0.6;
  }

  /* ── File chip ── */
  .file-chip {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: rgba(74, 222, 128, 0.08);
    border: 1px solid rgba(74, 222, 128, 0.2);
    border-radius: 10px;
    margin-bottom: 10px;
    color: rgba(255, 255, 255, 0.9);
  }
  .file-chip svg { flex-shrink: 0; opacity: 0.6; }
  .file-chip-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .file-chip-name {
    font-size: 0.85rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .file-chip-size {
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.45);
  }
  .file-chip-remove {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    transition: all 0.15s;
  }
  .file-chip-remove:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  /* ── App input ── */
  .app-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 11px 14px;
    color: white;
    font-size: 0.88rem;
    font-family: inherit;
    transition: border-color 0.15s;
    margin-bottom: 8px;
  }
  .app-input::placeholder { color: rgba(255, 255, 255, 0.3); }
  .app-input:focus {
    outline: none;
    border-color: rgba(74, 222, 128, 0.5);
  }

  /* ── Example row ── */
  .example-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 0;
    font-size: 0.78rem;
  }
  .example-label {
    color: rgba(255, 255, 255, 0.35);
    flex-shrink: 0;
  }
  .example-url {
    color: rgba(255, 255, 255, 0.5);
    font-family: monospace;
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
  .pill-btn {
    background: rgba(74, 222, 128, 0.12);
    border: 1px solid rgba(74, 222, 128, 0.25);
    color: #4ade80;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
    font-family: inherit;
  }
  .pill-btn:hover {
    background: rgba(74, 222, 128, 0.2);
  }

  /* ── PlayCanvas link ── */
  .playcanvas-link {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 9px 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s;
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
  }
  .playcanvas-link:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
  }
  .playcanvas-link svg:last-child {
    margin-left: auto;
    opacity: 0.4;
  }

  /* ── Slider rows ── */
  .slider-row {
    display: grid;
    grid-template-columns: 90px 1fr 64px;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .slider-row:last-child { margin-bottom: 0; }
  .slider-row label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.82rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .app-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }
  .app-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #4ade80;
    cursor: pointer;
    border: 2px solid rgba(0, 0, 0, 0.3);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
  .app-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #4ade80;
    cursor: pointer;
    border: 2px solid rgba(0, 0, 0, 0.3);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }

  .slider-num {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 6px 8px;
    color: white;
    font-size: 0.8rem;
    text-align: center;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .slider-num::-webkit-outer-spin-button,
  .slider-num::-webkit-inner-spin-button {
    -webkit-appearance: none;
    appearance: none;
    margin: 0;
  }
  .slider-num:focus {
    outline: none;
    border-color: rgba(74, 222, 128, 0.4);
  }

  /* ── Surface hint ── */
  .surface-hint {
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.35);
    padding: 0 0 4px 92px;
    margin-top: -6px;
  }

  /* ── Screen-reader only ── */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* ── Mobile tweaks ── */
  @media (max-width: 768px) {
    .section-header { padding: 11px 12px; }
    .slider-row {
      grid-template-columns: 72px 1fr 56px;
      gap: 8px;
    }
    .slider-row label { font-size: 0.78rem; }
    .slider-num { font-size: 0.75rem; padding: 5px 6px; }
  }
</style>
