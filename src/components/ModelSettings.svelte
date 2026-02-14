<script lang="ts">
  import { afterUpdate } from 'svelte';
  import FormInput from './FormInput.svelte';
  import Roaming from './Roaming.svelte';
  import RoamingControls from './RoamingControls.svelte';
  
    // HeaderCard props
    export let coordinates: { latitude: string; longitude: string; height: number };
  
    // Source-related props
    export let selectedSource = 'url';
    export let gltfFile: File | null = null;
    export let gltfUrl = '';
    export let modelName = '';
    export let modelDescription = '';
    
    // Transform-related props
    export let scale = 1.0;
    export let height = 0;
    export let heightOffset = 0.0;
    export let heading = 0;
    export let pitch = 0;
    export let roll = 0;
    
    // Roaming-related props
    export let isRoamingEnabled = false;
    export let roamingSpeed = 1.0;
    export let roamingArea: {
      north: number;
      south: number;
      east: number;
      west: number;
    } | null = null;
    
    // UI state
    export let showDropdown = false;
    export let onToggleDropdown: (() => void) | undefined = undefined;
    
    // Prevent rapid toggling
    let isToggling = false;
    export let onSourceChange: ((source: string) => void) | undefined = undefined;
    export let onFileSelect: ((event: Event) => void) | undefined = undefined;
    export let onUrlChange: (() => void) | undefined = undefined;
  
    // File input reference
    let fileInput: HTMLInputElement;
    
  // Drag and drop state
  let isDragOver = false;
  
  // Copy functionality
  let copyButtonText = 'Copy';
  const exampleUrl = 'https://mixiplycontent.blob.core.windows.net/usefulstuff/51c392cb-1176-463a-a6f9-08d6bd51ab08/Duck.gltf';
  
  async function copyExampleUrl() {
    try {
      await navigator.clipboard.writeText(exampleUrl);
      copyButtonText = 'Copied!';
      setTimeout(() => {
        copyButtonText = 'Copy';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
      copyButtonText = 'Failed';
      setTimeout(() => {
        copyButtonText = 'Copy';
      }, 2000);
    }
  }
  
  // Convert string values to numbers for FormInput (transform fields)
  let scaleValue = scale.toString();
  let heightValue = height.toString();
  let heightOffsetValue = heightOffset.toString();
  let headingValue = heading.toString();
  let pitchValue = pitch.toString();
  let rollValue = roll.toString();
  
  // Track last prop values
  let lastScale = scale;
  let lastHeight = height;
  let lastHeightOffset = heightOffset;
  let lastHeading = heading;
  let lastPitch = pitch;
  let lastRoll = roll;

  // Reactive statements to update the number values when string values change
  $: scale = parseFloat(scaleValue) || 0;
  $: height = parseFloat(heightValue) || 0;
  $: heightOffset = parseFloat(heightOffsetValue) || 0;
  $: heading = parseFloat(headingValue) || 0;
  $: pitch = parseFloat(pitchValue) || 0;
  $: roll = parseFloat(rollValue) || 0;
  
  // Handle prop updates for edit mode using afterUpdate
  afterUpdate(() => {
    if (scale !== lastScale) {
      scaleValue = scale.toString();
      lastScale = scale;
    }
    if (height !== lastHeight) {
      heightValue = height.toString();
      lastHeight = height;
    }
    if (heightOffset !== lastHeightOffset) {
      heightOffsetValue = heightOffset.toString();
      lastHeightOffset = heightOffset;
    }
    if (heading !== lastHeading) {
      headingValue = heading.toString();
      lastHeading = heading;
    }
    if (pitch !== lastPitch) {
      pitchValue = pitch.toString();
      lastPitch = pitch;
    }
    if (roll !== lastRoll) {
      rollValue = roll.toString();
      lastRoll = roll;
    }
  });
  
  
    function handleSourceChange(event: Event) {
      const target = event.target as HTMLInputElement;
      if (onSourceChange) {
        onSourceChange(target.value);
      }
    }
  
    function handleFileSelect(event: Event) {
      if (onFileSelect) {
        onFileSelect(event);
      }
    }

    // Handle file selection with automatic loading
    function handleFileSelectAuto(event: Event) {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        gltfFile = file;
        if (onFileSelect) {
          onFileSelect(event);
        }
      }
    }
  
  function handleUrlChange(event: Event) {
    if (onUrlChange) {
      onUrlChange();
    }
  }

  // Handle URL input with automatic loading
  function handleUrlInput(event: Event) {
    const target = event.target as HTMLInputElement;
    gltfUrl = target.value;
    // Trigger automatic preview update when URL is pasted or typed
    if (onUrlChange) {
      onUrlChange();
    }
  }
  
    // Debounced toggle function to prevent race conditions
    function handleToggleDropdown() {
      if (isToggling) return;
      
      isToggling = true;
      if (onToggleDropdown) {
        onToggleDropdown();
      }
      
      // Reset toggle lock after a short delay
      setTimeout(() => {
        isToggling = false;
      }, 150);
    }
  
    // Drag and drop handlers
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
        if (file.type === 'model/gltf-binary' || file.type === 'model/gltf+json' || 
            file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
          // Switch to file mode and set the file
          if (onSourceChange) {
            onSourceChange('file');
          }
          // Set the file directly and trigger automatic loading
          gltfFile = file;
          if (onFileSelect) {
            // Create a synthetic event that matches the expected interface
            const syntheticEvent = {
              target: { files: [file] },
              preventDefault: () => {},
              stopPropagation: () => {}
            } as unknown as Event;
            onFileSelect(syntheticEvent);
          }
        }
      }
    }
  </script>
  
  <div class="main-container">
  
    <div class="dropdown-container">
    <button class="dropdown-trigger" on:click={handleToggleDropdown}>
      <span>Model Settings</span>
      <svg class="dropdown-arrow" class:rotated={showDropdown} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 15L12 9L6 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    
    {#if showDropdown}
      <div 
        class="dropdown-content model-settings-card" 
        class:drag-over={isDragOver}
        role="region"
        aria-label="Model settings drop zone"
        on:dragover={handleDragOver}
        on:dragleave={handleDragLeave}
        on:drop={handleDrop}
        >
          
          <!-- Source Section -->
          <div class="settings-section">
          
          <div class="form-group">
            <label id="source-file" for="source-file">Model Source</label>
            <p class="source-description">Drag & drop a GLTF/GLB file, upload a file, or provide a URL to place a 3D model on the map</p>
            <div class="source-options" role="radiogroup" aria-labelledby="source-file">
              <label class="radio-option">
                <input 
                  type="radio" 
                  name="source" 
                  value="url" 
                  bind:group={selectedSource}
                  on:change={handleSourceChange}
                />
                <span>URL</span>
              </label>
              <label class="radio-option">
                <input 
                  type="radio" 
                  name="source" 
                  value="file" 
                  bind:group={selectedSource}
                  on:change={handleSourceChange}
                />
                <span>Upload File</span>
              </label>
            </div>
          </div>
  
          <!-- File upload -->
          {#if selectedSource === 'file'}
            <div class="form-group">
              <label for="gltfFile">GLTF/GLB File</label>
              <input
                id="gltfFile"
                type="file"
                accept=".glb,.gltf"
                bind:this={fileInput}
                on:change={handleFileSelectAuto}
                class="file-input"
              />
              {#if gltfFile}
                <div class="file-info">
                  <span>Selected: {gltfFile.name}</span>
                  <span>Size: {(gltfFile.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              {/if}
            </div>
          {/if}
  
          <!-- URL input -->
          {#if selectedSource === 'url'}
            <div class="form-group">
              <label for="gltfUrl">GLTF/GLB URL</label>
              <input
                id="gltfUrl"
                type="url"
                bind:value={gltfUrl}
                on:input={handleUrlInput}
                on:paste={handleUrlInput}
                placeholder="https://example.com/model.glb"
                class="text-input"
              />
              <div class="example-link-container">
                <div class="example-link">
                  <span class="example-label">Example URL:</span>
                  <span class="example-url">{exampleUrl}</span>
                </div>
                <button 
                  type="button" 
                  class="copy-button" 
                  on:click={copyExampleUrl}
                  title="Copy example URL to clipboard"
                >
                  {copyButtonText}
                </button>
              </div>
            </div>
          {/if}
  
          <!-- Model details -->
          <FormInput
            type="text"
            bind:value={modelName}
            placeholder="Enter model name"
            label="Model Name"
            required
          />
  
          <FormInput
            type="textarea"
            bind:value={modelDescription}
            placeholder="Enter model description (optional)"
            label="Description"
            rows={3}
          />
        </div>
  
        <!-- Roaming Section -->
        <Roaming 
          bind:isEnabled={isRoamingEnabled}
          bind:roamingSpeed={roamingSpeed}
          bind:roamingArea={roamingArea}
        />

        <!-- Roaming Controls Section - Only show when roaming is enabled -->
        {#if isRoamingEnabled}
          <div class="settings-section">
            <RoamingControls />
          </div>
        {/if}
  
        <!-- Transform Section -->
        <div class="settings-section">
          <h4>Transform Properties</h4>
          
          <div class="form-row">
            <FormInput
              type="number"
              bind:value={scaleValue}
              label="Scale"
              min="0.1"
              max="100"
              step="0.1"
            />
  
            <FormInput
              type="number"
              bind:value={heightValue}
              label="Height (meters)"
              step="0.01"
              placeholder={coordinates.height ? `Surface: ${coordinates.height.toFixed(2)}m` : "Enter height"}
            />
          </div>
  
          <div class="form-row">
            <FormInput
              type="number"
              bind:value={heightOffsetValue}
              label="Height Offset (meters)"
              step="0.01"
              placeholder="Offset to place model bottom on ground"
            />
  
            <FormInput
              type="number"
              bind:value={headingValue}
              label="Heading (degrees)"
              min="0"
              max="360"
              step="1"
            />
          </div>
  
          <div class="form-row">
            <FormInput
              type="number"
              bind:value={pitchValue}
              label="Pitch (degrees)"
              min="-90"
              max="90"
              step="1"
            />
  
            <FormInput
              type="number"
              bind:value={rollValue}
              label="Roll (degrees)"
              min="-180"
              max="180"
              step="1"
            />
          </div>
        </div>
      </div>
    {/if}
    </div>
  </div>
  
  <style>
    /* Main container */
    .main-container {
      position: relative;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1002;
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 10px;
    }
  
  
  
    /* Editor Model Settings Card positioning */
    .dropdown-container {
      width: 400px;
      max-width: 90vw;
      position: relative; /* Ensure proper positioning context */
    }
  
    .main-container {
      width: 400px;
      max-width: 90vw;
    }
  
    .dropdown-trigger {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 10px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      padding: 12px;
      width: 100%;
      color: white;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.3s ease;
      z-index: 1004;
    }
  
    .dropdown-trigger:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
    }
  
    .dropdown-arrow {
      transition: transform 0.3s ease;
    }
  
    .dropdown-arrow.rotated {
      transform: rotate(180deg);
    }
  
    .dropdown-content {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
      border-radius: 12px;
      padding: 16px;
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 10px;
      max-height: 60vh;
      overflow-y: auto;
      animation: slideDown 0.3s ease;
      z-index: 1003;
    }
  
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  
    .model-settings-card {
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  
  
    .model-settings-card.drag-over {
      border: 3px solid #4ade80;
      background: rgba(74, 222, 128, 0.1);
    }
  
    .settings-section {
      margin-bottom: 25px;
    }
  
    .settings-section:last-child {
      margin-bottom: 0;
    }
  
    .settings-section h4 {
      color: white;
      margin: 0 0 15px 0;
      font-size: 1.1em;
      font-weight: 600;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      padding-bottom: 8px;
    }
  
    .source-description {
      color: rgba(255, 255, 255, 0.7);
      margin: 5px 0 15px 0;
      font-size: 0.9em;
      line-height: 1.4;
    }
  
    .source-options {
      display: flex;
      gap: 20px;
      margin-top: 5px;
    }
  
    .radio-option {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      color: white;
    }
  
    .radio-option input[type="radio"] {
      margin: 0;
    }
  
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 15px;
    }
  
    .form-group:last-child {
      margin-bottom: 0;
    }
  
    .form-group label {
      color: white;
      font-weight: 500;
      font-size: 0.9em;
    }
  
    .text-input,
    .file-input {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(5px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      padding: 12px;
      color: white;
      font-size: 0.9em;
    }
  
    .text-input::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }
  
    .text-input:focus,
    .file-input:focus {
      outline: none;
      border-color: rgba(255, 255, 255, 0.6);
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
    }
  
    .file-input {
      cursor: pointer;
    }
  
    .file-info {
      display: flex;
      flex-direction: column;
      gap: 5px;
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.9em;
      margin-top: 5px;
    }
  
    .form-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
    }
    
    .example-link-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-top: 8px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
    }
    
    .example-link {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    }
    
    .example-label {
      color: rgba(255, 255, 255, 0.6);
      font-size: 0.8em;
      font-weight: 500;
    }
    
    .example-url {
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.85em;
      word-break: break-all;
      font-family: monospace;
    }
    
    .copy-button {
      background: rgba(74, 222, 128, 0.2);
      border: 1px solid rgba(74, 222, 128, 0.4);
      color: #4ade80;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 0.8em;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      flex-shrink: 0;
    }
    
    .copy-button:hover {
      background: rgba(74, 222, 128, 0.3);
      border-color: rgba(74, 222, 128, 0.6);
      transform: translateY(-1px);
    }
    
    .copy-button:active {
      transform: translateY(0);
    }
  
  </style>