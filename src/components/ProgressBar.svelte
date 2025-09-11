<script lang="ts">
  // Progress tracking for new UX
  export let basemapProgress = 0;
  export let tilesetProgress = 0;
  export let isInitialLoadComplete = false;
</script>

{#if !isInitialLoadComplete}
  <div class="progress-container">
    <div class="progress-item">
      <span>Basemap: {Math.round(basemapProgress)}%</span>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {basemapProgress}%"></div>
      </div>
    </div>
    <div class="progress-item">
      <span>3D Tileset: {Math.round(tilesetProgress)}%</span>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {tilesetProgress}%"></div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Progress indicators (top left) */
  .progress-container {
    position: absolute;
    top: 20px;
    left: 10px;
    z-index: 1001; /* Higher than AdvertisingBanner (100) */
    background: rgba(0, 0, 0, 0.7);
    padding: 15px;
    border-radius: 8px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .progress-item {
    margin-bottom: 10px;
  }

  .progress-item:last-child {
    margin-bottom: 0;
  }

  .progress-item span {
    color: white;
    font-size: 14px;
    font-weight: 500;
    display: block;
    margin-bottom: 5px;
  }

  .progress-bar {
    width: 200px;
    height: 6px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4285F4, #34A853);
    border-radius: 3px;
    transition: width 0.3s ease;
  }
</style>
