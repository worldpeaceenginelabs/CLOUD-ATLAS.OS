<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let basemapProgress = 0;
  let tilesetProgress = 0;
  let isInitialLoadComplete = false;

  let progressTimer: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    let progress = 0;

    progressTimer = setInterval(() => {
      progress += 2;

      basemapProgress = Math.min(progress, 100);
      tilesetProgress = Math.min(Math.max(progress - 15, 0), 100);

      if (basemapProgress >= 100 && tilesetProgress >= 100) {
        isInitialLoadComplete = true;

        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = undefined;
        }
      }
    }, 50);
  });

  onDestroy(() => {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = undefined;
    }
  });
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
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);

    z-index: 100;
    background: var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: var(--glass-border);
    border-radius: var(--glass-radius);
    padding: 15px;
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
