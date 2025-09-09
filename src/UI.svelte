<script lang="ts">
  import { onMount } from 'svelte';
  import { coordinates, models, type ModelData } from './store';
  import { fade } from 'svelte/transition';

  // Component state
  let isVisible = false;
  let gltfFile: File | null = null;
  let gltfUrl = '';
  let modelName = '';
  let modelDescription = '';
  let scale = 1.0;
  let height = 0;
  let heightOffset = 0.0; // Height offset to place model bottom on ground
  let heading = 0;
  let pitch = 0;
  let roll = 0;
  let isUploading = false;
  let errorMessage = '';
  let successMessage = '';
  let selectedSource = 'url'; // Track which radio button is selected

  // Reactive coordinates from store
  $: currentCoords = $coordinates;

  // File input reference
  let fileInput: HTMLInputElement;

  // Toggle visibility
  export function toggle() {
    isVisible = !isVisible;
    if (isVisible) {
      errorMessage = '';
      successMessage = '';
    }
  }

  // Handle file selection
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file) {
      if (file.type === 'model/gltf-binary' || file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
        gltfFile = file;
        gltfUrl = '';
        errorMessage = '';
      } else {
        errorMessage = 'Please select a valid GLTF file (.glb or .gltf)';
        gltfFile = null;
      }
    }
  }

  // Handle URL input
  function handleUrlChange() {
    if (gltfUrl) {
      gltfFile = null;
      // Clear file input
      if (fileInput) {
        fileInput.value = '';
      }
    }
  }

  // Validate form
  function validateForm(): boolean {
    if (!currentCoords.latitude || !currentCoords.longitude) {
      errorMessage = 'Please click on the map to select coordinates first';
      return false;
    }

    if (selectedSource === 'file' && !gltfFile) {
      errorMessage = 'Please select a GLTF file';
      return false;
    }

    if (selectedSource === 'url' && !gltfUrl.trim()) {
      errorMessage = 'Please enter a GLTF URL';
      return false;
    }

    if (!modelName.trim()) {
      errorMessage = 'Please enter a model name';
      return false;
    }

    if (isNaN(scale) || scale <= 0) {
      errorMessage = 'Scale must be a positive number';
      return false;
    }

    if (isNaN(height)) {
      errorMessage = 'Height must be a valid number';
      return false;
    }

    return true;
  }

  // Handle form submission
  async function handleSubmit(event: Event) {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    isUploading = true;
    errorMessage = '';
    successMessage = '';

    try {
      const modelData: ModelData = {
        id: `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: modelName,
        description: modelDescription,
        coordinates: {
          latitude: parseFloat(currentCoords.latitude),
          longitude: parseFloat(currentCoords.longitude)
        },
        transform: {
          scale: scale,
          height: currentCoords.height || height, // Use surface height from coordinates, if user doesn't input height
          heading: heading,
          pitch: pitch,
          roll: roll,
          heightOffset: heightOffset // Offset to place model bottom on ground
        },
        source: gltfFile ? 'file' : 'url',
        url: gltfUrl,
        file: gltfFile || undefined,
        timestamp: new Date().toISOString()
      };

      // Add model to store
      models.update(currentModels => [...currentModels, modelData]);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      successMessage = 'Model added successfully!';
      
      // Reset form after successful submission
      setTimeout(() => {
        resetForm();
        isVisible = false;
      }, 2000);

    } catch (error) {
      errorMessage = 'Failed to add model. Please try again.';
      console.error('Error adding model:', error);
    } finally {
      isUploading = false;
    }
  }

  // Reset form
  function resetForm() {
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
    errorMessage = '';
    successMessage = '';
    selectedSource = 'url';
    
    if (fileInput) {
      fileInput.value = '';
    }
  }

  // Close modal
  function closeModal() {
    isVisible = false;
    errorMessage = '';
    successMessage = '';
  }

  // Handle escape key
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeModal();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

{#if isVisible}
  <div class="modal" transition:fade={{ duration: 300 }}>
    <div class="modal-content">
      <!-- Close button -->
      <div class="close" on:click={closeModal} on:keydown={(e) => e.key === 'Enter' && closeModal()} role="button" tabindex="0">
        <svg viewBox="0 0 36 36" class="circle">
          <path
            stroke-dasharray="100, 100"
            d="M18 2.0845
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>

      <!-- Form header -->
      <div class="form-header">
        <h2>Add 3D Model</h2>
        <p>Upload a GLTF file or provide a URL to place a 3D model on the map</p>
      </div>

      <!-- Coordinates display -->
      <div class="coordinates-display">
        <h3>Selected Location</h3>
        {#if currentCoords.latitude && currentCoords.longitude}
          <div class="coords">
            <span>Lat: {currentCoords.latitude}</span>
            <span>Lng: {currentCoords.longitude}</span>
            <span>Height: {currentCoords.height.toFixed(1)}m</span>
          </div>
        {:else}
          <div class="no-coords">
            <p>Click on the map to select coordinates</p>
          </div>
        {/if}
      </div>

      <!-- Form -->
      <form on:submit={handleSubmit} class="model-form">
        <!-- Model source selection -->
        <div class="form-group">
          <label id="source-file" for="source-file">Model Source</label>
          <div class="source-options" role="radiogroup" aria-labelledby="source-file">
            <label class="radio-option">
              <input 
                type="radio" 
                name="source" 
                value="url" 
                bind:group={selectedSource}
                on:change={() => { gltfFile = null; gltfUrl = ''; }}
              />
              <span>URL</span>
            </label>
            <label class="radio-option">
              <input 
                type="radio" 
                name="source" 
                value="file" 
                bind:group={selectedSource}
                on:change={() => { gltfFile = null; gltfUrl = ''; }}
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
        <div class="form-group">
          <label for="modelName">Model Name *</label>
          <input
            id="modelName"
            type="text"
            bind:value={modelName}
            placeholder="Enter model name"
            class="text-input"
            required
          />
        </div>

        <div class="form-group">
          <label for="modelDescription">Description</label>
          <textarea
            id="modelDescription"
            bind:value={modelDescription}
            placeholder="Enter model description (optional)"
            class="textarea-input"
            rows="3"
          ></textarea>
        </div>

        <!-- Transform properties -->
        <div class="transform-section">
          <h3>Transform Properties</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label for="scale">Scale</label>
              <input
                id="scale"
                type="number"
                bind:value={scale}
                min="0.1"
                max="100"
                step="0.1"
                class="number-input"
              />
            </div>

            <div class="form-group">
              <label for="height">Height (meters)</label>
              <input
                id="height"
                type="number"
                bind:value={height}
                step="0.1"
                class="number-input"
                placeholder={currentCoords.height ? `Surface: ${currentCoords.height.toFixed(1)}m` : "Enter height"}
              />
              {#if currentCoords.height}
                <small class="surface-height-note">Surface height detected: {currentCoords.height.toFixed(1)}m (will be used automatically)</small>
              {/if}
            </div>

            <div class="form-group">
              <label for="heightOffset">Height Offset (meters)</label>
              <input
                id="heightOffset"
                type="number"
                bind:value={heightOffset}
                step="0.1"
                class="number-input"
                placeholder="Offset to place model bottom on ground"
              />
              <small class="surface-height-note">Adjust this to fine-tune how the model sits on the ground (default: 1.0m)</small>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="heading">Heading (degrees)</label>
              <input
                id="heading"
                type="number"
                bind:value={heading}
                min="0"
                max="360"
                step="1"
                class="number-input"
              />
            </div>

            <div class="form-group">
              <label for="pitch">Pitch (degrees)</label>
              <input
                id="pitch"
                type="number"
                bind:value={pitch}
                min="-90"
                max="90"
                step="1"
                class="number-input"
              />
            </div>

            <div class="form-group">
              <label for="roll">Roll (degrees)</label>
              <input
                id="roll"
                type="number"
                bind:value={roll}
                min="-180"
                max="180"
                step="1"
                class="number-input"
              />
            </div>
          </div>
        </div>

        <!-- Error/Success messages -->
        {#if errorMessage}
          <div class="error-message">
            {errorMessage}
          </div>
        {/if}

        {#if successMessage}
          <div class="success-message">
            {successMessage}
          </div>
        {/if}

        <!-- Form actions -->
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" on:click={closeModal}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={isUploading}>
            {isUploading ? 'Adding...' : 'Add Model'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal {
    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(5px);
    z-index: 1000;
  }

  .modal-content {
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    border-radius: 15px;
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 30px;
    position: relative;
  }

  .form-header {
    text-align: center;
    margin-bottom: 30px;
  }

  .form-header h2 {
    color: white;
    margin: 0 0 10px 0;
    font-size: 1.8em;
  }

  .form-header p {
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
    font-size: 0.9em;
  }

  .coordinates-display {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 15px;
    margin-bottom: 25px;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .coordinates-display h3 {
    color: white;
    margin: 0 0 10px 0;
    font-size: 1.1em;
  }

  .coords {
    display: flex;
    gap: 20px;
    color: rgba(255, 255, 255, 0.9);
    font-family: monospace;
  }

  .no-coords {
    color: rgba(255, 255, 255, 0.6);
    font-style: italic;
  }

  .model-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-group label {
    color: white;
    font-weight: 500;
    font-size: 0.9em;
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

  .text-input,
  .number-input,
  .textarea-input,
  .file-input {
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 0.9em;
    backdrop-filter: blur(5px);
  }

  .text-input::placeholder,
  .textarea-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  .text-input:focus,
  .number-input:focus,
  .textarea-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.6);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
  }

  .surface-height-note {
    display: block;
    color: #4CAF50;
    font-size: 0.85em;
    margin-top: 4px;
    font-style: italic;
  }

  .file-input {
    cursor: pointer;
  }

  .file-info {
    display: flex;
    flex-direction: column;
    gap: 5px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.8em;
    margin-top: 5px;
  }

  .transform-section {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    padding: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .transform-section h3 {
    color: white;
    margin: 0 0 15px 0;
    font-size: 1.1em;
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
  }

  .error-message {
    background: rgba(255, 0, 0, 0.2);
    border: 1px solid rgba(255, 0, 0, 0.4);
    color: #ff6b6b;
    padding: 12px;
    border-radius: 8px;
    font-size: 0.9em;
  }

  .success-message {
    background: rgba(0, 255, 0, 0.2);
    border: 1px solid rgba(0, 255, 0, 0.4);
    color: #51cf66;
    padding: 12px;
    border-radius: 8px;
    font-size: 0.9em;
  }

  .form-actions {
    display: flex;
    gap: 15px;
    justify-content: flex-end;
    margin-top: 20px;
  }

  .btn {
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 0.9em;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* Close button styles (reused from existing code) */
  .close {
    --size: 22px;
    --borderSize: 2px;
    --borderColor: rgba(255, 255, 255, 1);
    --speed: 0.5s;

    width: var(--size);
    height: var(--size);
    position: absolute;
    top: 15px;
    right: 15px;
    background: #455A64;
    border-radius: 50%;
    box-shadow: 0 0 20px -5px rgba(255, 255, 255, 0.5);
    transition: 0.25s ease-in-out;
    cursor: pointer;
    animation: fade-in-scale-down var(--speed) ease-out 0.25s both;
  }

  @keyframes fade-in-scale-down {
    from {
      opacity: 0;
      transform: scale(1.1);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .close .circle path {
    stroke: var(--borderColor);
    fill: none;
    stroke-width: calc(var(--borderSize) / 2);
    stroke-linecap: round;
    animation: progress var(--speed) ease-out 0.25s both;
  }

  @keyframes progress {
    from {
      stroke-dasharray: 0 100;
    }
  }

  .close span {
    display: block;
    width: calc(var(--size) / 4 - 2px);
    height: var(--borderSize);
    background: var(--borderColor);
    box-shadow: 0 0 20px -5px rgba(255, 255, 255, 0.5);
    border-radius: 20px;
    position: absolute;
    --padding: calc(var(--size) / 3);
    transition: 0.25s ease-in-out;
    animation: slide-in var(--speed) ease-in-out 0.25s both;
  }

  @keyframes slide-in {
    from {
      width: 0;
    }
  }

  .close span:nth-child(2) {
    top: calc(var(--padding) - var(--borderSize) / 2);
    left: var(--padding);
    transform: rotate(45deg);
    transform-origin: top left;
  }

  .close span:nth-child(3) {
    top: calc(var(--padding) - var(--borderSize) / 2);
    right: var(--padding);
    transform: rotate(-45deg);
    transform-origin: top right;
  }

  .close span:nth-child(4) {
    bottom: calc(var(--padding) - var(--borderSize) / 2);
    left: var(--padding);
    transform: rotate(-45deg);
    transform-origin: bottom left;
  }

  .close span:nth-child(5) {
    bottom: calc(var(--padding) - var(--borderSize) / 2);
    right: var(--padding);
    transform: rotate(45deg);
    transform-origin: bottom right;
  }

  .close:hover {
    background: #37474F;
  }

  .close:hover span {
    width: calc(var(--size) / 4);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .modal-content {
      width: 95%;
      padding: 20px;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .form-actions {
      flex-direction: column;
    }

    .btn {
      width: 100%;
    }
  }
</style>
