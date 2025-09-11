<script lang="ts">
  import GlassmorphismButton from './GlassmorphismButton.svelte';

  export let coordinates: { latitude: string; longitude: string; height: number };
  export let isEditMode = false;
  export let isUploading = false;
  export let onClose: (() => void) | undefined = undefined;
  export let onSubmit: (() => void) | undefined = undefined;
</script>

<div class="header-card">
  <!-- Header content -->
  <div class="header-content">
    <h2 class="header-title">3D Model Editor</h2>
    <p class="header-description">{isEditMode ? 'Edit the 3D model properties' : ''}</p>
  </div>
  
  <!-- Coordinates display -->
  <div class="coordinates-section">
    {#if coordinates.latitude && coordinates.longitude}
      <div class="coords">
        <span>Lat: {coordinates.latitude}</span>
        <span>Lng: {coordinates.longitude}</span>
        <span>Height: {coordinates.height.toFixed(1)}m</span>
      </div>
    {:else}
      <span class="no-coords">Click on the map to select coordinates</span>
    {/if}
  </div>

  <!-- Action buttons -->
  <div class="header-actions">
    <GlassmorphismButton 
      variant="secondary" 
      onClick={onClose}
      disabled={isUploading}
    >
      Cancel
    </GlassmorphismButton>
    <GlassmorphismButton 
      variant="primary" 
      disabled={isUploading}
      onClick={onSubmit}
    >
      {isUploading ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Model' : 'Add Model')}
    </GlassmorphismButton>
  </div>
</div>

<style>
  .header-card {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    padding: 10px 15px;
    margin-bottom: 15px;
    text-align: left;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    position: fixed;
    top: 20px;
    left: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
  }

  .header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .header-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .header-title {
    color: white;
    margin: 0;
    font-size: 1.3em;
    font-weight: 600;
  }

  .header-description {
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
    font-size: 0.8em;
    line-height: 1.3;
  }

  .coordinates-section {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    padding: 6px 12px;
    flex-shrink: 0;
    margin-right: 40px; /* Add spacing to prevent overlap with close button */
  }

  .coords {
    display: flex;
    gap: 12px;
    color: rgba(255, 255, 255, 0.9);
    font-family: monospace;
    font-size: 0.9em;
  }

  .no-coords {
    color: rgba(255, 255, 255, 0.6);
    font-style: italic;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .header-actions {
      flex-direction: column;
      gap: 8px;
    }
  }

  @media (max-width: 480px) {
    .header-card {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }

    .header-content {
      width: 100%;
    }

    .coordinates-section {
      width: 100%;
    }

    .header-actions {
      width: 100%;
      flex-direction: column;
    }
  }
</style>