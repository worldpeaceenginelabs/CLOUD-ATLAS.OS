<script lang="ts">
  import GlassmorphismButton from './GlassmorphismButton.svelte';
  import { isRoamingActive, roamingModelCount } from '../store';
  import { roamingAnimationManager } from '../utils/roamingAnimation';

  function clearAllRoaming() {
    roamingAnimationManager.clearAll();
    roamingModelCount.set(0);
  }
</script>

<div class="roaming-controls">
  <h4>Roaming Controls</h4>
  
  <div class="stats">
    <div class="stat-item">
      <span class="stat-label">Active Models:</span>
      <span class="stat-value">{$roamingModelCount}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Status:</span>
      <span class="stat-value {$isRoamingActive ? 'active' : 'inactive'}">
        {$isRoamingActive ? 'Running' : 'Stopped'}
      </span>
    </div>
  </div>

  <div class="controls">
    <GlassmorphismButton 
      variant="danger" 
      onClick={clearAllRoaming}
      disabled={$roamingModelCount === 0}
    >
      Clear All
    </GlassmorphismButton>
  </div>

  {#if $roamingModelCount > 0}
    <div class="info">
      <p>{$roamingModelCount} model{$roamingModelCount === 1 ? '' : 's'} configured for roaming</p>
    </div>
  {/if}
</div>

<style>
  .roaming-controls {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .roaming-controls h4 {
    color: white;
    margin: 0 0 16px 0;
    font-size: 1.1em;
    font-weight: 600;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding-bottom: 8px;
  }

  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .stat-label {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.9em;
    font-weight: 500;
  }

  .stat-value {
    color: white;
    font-weight: 600;
    font-size: 0.9em;
  }

  .stat-value.active {
    color: #4ade80;
  }

  .stat-value.inactive {
    color: #f87171;
  }

  .controls {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .info {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px;
  }

  .info p {
    color: rgba(255, 255, 255, 0.8);
    margin: 0 0 8px 0;
    font-size: 0.85em;
    line-height: 1.4;
  }

  .info p:last-child {
    margin-bottom: 0;
  }
</style>
