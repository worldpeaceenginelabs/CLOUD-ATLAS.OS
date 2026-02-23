<script lang="ts">
  import {
    isSimulationRunning,
    simulationSpeed,
    simulationEntityCount,
  } from '../store';
  import { simulationEngine } from '../utils/simulationEngine';

  let speedValue = $simulationSpeed;

  function toggle() {
    if ($isSimulationRunning) {
      isSimulationRunning.set(false);
      simulationEngine.pause();
    } else {
      isSimulationRunning.set(true);
      simulationEngine.start();
    }
  }

  function handleSpeed() {
    simulationSpeed.set(speedValue);
    simulationEngine.setSpeed(speedValue);
  }

  function reset() {
    simulationEngine.reset();
  }

  $: speedValue, handleSpeed();

  const speedSteps = [0.25, 0.5, 1, 2, 4];

  function cycleSpeed() {
    const idx = speedSteps.indexOf(speedValue);
    speedValue = speedSteps[(idx + 1) % speedSteps.length];
  }
</script>

{#if $simulationEntityCount > 0}
  <div class="sim-strip">
    <div class="sim-label">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      <span>Simulation</span>
      <span class="sim-count">{$simulationEntityCount} entit{$simulationEntityCount === 1 ? 'y' : 'ies'}</span>
    </div>
    <div class="sim-buttons">
      <button class="sim-btn play" on:click={toggle} title={$isSimulationRunning ? 'Pause' : 'Play'}>
        {#if $isSimulationRunning}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        {:else}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        {/if}
      </button>

      <button class="sim-btn speed" on:click={cycleSpeed} title="Speed: {speedValue}x">
        {speedValue}x
      </button>

      <button class="sim-btn reset" on:click={reset} title="Reset positions">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="1 4 1 10 7 10"/>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
        </svg>
      </button>
    </div>
  </div>
{/if}

<style>
  .sim-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: rgba(74, 222, 128, 0.06);
    border: 1px solid rgba(74, 222, 128, 0.15);
    border-radius: 10px;
  }

  .sim-label {
    display: flex;
    align-items: center;
    gap: 6px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.82rem;
    font-weight: 500;
  }
  .sim-label svg { color: #4ade80; flex-shrink: 0; }

  .sim-count {
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 400;
  }

  .sim-buttons {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .sim-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 8px;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .sim-btn.play {
    width: 32px;
    height: 30px;
    background: rgba(74, 222, 128, 0.2);
    color: #4ade80;
  }
  .sim-btn.play:hover { background: rgba(74, 222, 128, 0.35); }

  .sim-btn.speed {
    height: 30px;
    padding: 0 10px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
    font-size: 0.72rem;
    font-weight: 600;
    min-width: 36px;
  }
  .sim-btn.speed:hover { background: rgba(255, 255, 255, 0.15); }

  .sim-btn.reset {
    width: 30px;
    height: 30px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.6);
  }
  .sim-btn.reset:hover { background: rgba(255, 255, 255, 0.12); color: white; }
</style>
