<script lang="ts">
  import FormInput from './FormInput.svelte';

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
  export let currentCoords: { latitude: string; longitude: string; height: number };
  
  // UI state
  export let showDropdown = false;
  export let onToggleDropdown: (() => void) | undefined = undefined;
  export let onSourceChange: ((source: string) => void) | undefined = undefined;
  export let onFileSelect: ((event: Event) => void) | undefined = undefined;
  export let onUrlChange: (() => void) | undefined = undefined;

  // File input reference
  let fileInput: HTMLInputElement;
  
  // Drag and drop state
  let isDragOver = false;

  // Convert string values to numbers for FormInput (transform fields)
  let scaleValue = scale.toString();
  let heightValue = height.toString();
  let heightOffsetValue = heightOffset.toString();
  let headingValue = heading.toString();
  let pitchValue = pitch.toString();
  let rollValue = roll.toString();

  // Reactive statements to update the number values when string values change
  $: scale = parseFloat(scaleValue) || 0;
  $: height = parseFloat(heightValue) || 0;
  $: heightOffset = parseFloat(heightOffsetValue) || 0;
  $: heading = parseFloat(headingValue) || 0;
  $: pitch = parseFloat(pitchValue) || 0;
  $: roll = parseFloat(rollValue) || 0;

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

  function handleUrlChange(event: Event) {
    if (onUrlChange) {
      onUrlChange();
    }
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

<div class="dropdown-container">
  <button class="dropdown-trigger" on:click={onToggleDropdown}>
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
      <h3>Model Settings</h3>
      
      <!-- Source Section -->
      <div class="settings-section">
        <h4>Source & Details</h4>
        
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
            <label for="gltfFile">GLTF File</label>
            <input
              id="gltfFile"
              type="file"
              accept=".glb,.gltf"
              bind:this={fileInput}
              on:change={handleFileSelect}
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
            <label for="gltfUrl">GLTF URL</label>
            <input
              id="gltfUrl"
              type="url"
              bind:value={gltfUrl}
              on:input={handleUrlChange}
              placeholder="https://example.com/model.glb"
              class="text-input"
            />
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
            placeholder={currentCoords.height ? `Surface: ${currentCoords.height.toFixed(2)}m` : "Enter height"}
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

<style>
  /* Editor Model Settings Card positioning */
  .dropdown-container {
    flex: 1;
    position: fixed;
    top: 100px; /* Position under HeaderCard */
    left: 10px;
    right: 10px;
    z-index: 10;
    width: 400px;
    max-width: 90vw;
  }

  .dropdown-trigger {
    width: 100%;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    padding: 15px 20px;
    color: white;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.3s ease;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }

  .dropdown-trigger:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  }

  .dropdown-arrow {
    transition: transform 0.3s ease;
  }

  .dropdown-arrow.rotated {
    transform: rotate(180deg);
  }

  .dropdown-content {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 10px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    max-height: 60vh;
    overflow-y: auto;
    animation: slideDown 0.3s ease;
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

  .model-settings-card h3 {
    color: white;
    margin: 0 0 20px 0;
    font-size: 1.3em;
    font-weight: 600;
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
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 0.9em;
    backdrop-filter: blur(5px);
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

  /* Responsive design */
  @media (max-width: 480px) {
    .dropdown-trigger {
      padding: 12px 16px;
      font-size: 14px;
    }

    .dropdown-content {
      padding: 15px;
    }

    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
