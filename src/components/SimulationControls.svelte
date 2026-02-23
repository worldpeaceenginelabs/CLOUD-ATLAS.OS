<script lang="ts">
  import {
    isSimulationRunning,
    simulationSpeed,
    simulationEntityCount,
  } from '../store';
  import { simulationEngine } from '../utils/simulationEngine';

  export let onStart: () => void;
  export let onStop: () => void;

  let speedValue = $simulationSpeed;

  function toggle() {
    if ($isSimulationRunning) onStop();
    else onStart();
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
  <div class="sim-controls">
    <button class="sim-btn play" on:click={toggle} title={$isSimulationRunning ? 'Pause' : 'Play'}>
      {#if $isSimulationRunning}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
      {:else}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
      {/if}
    </button>

    <button class="sim-btn speed" on:click={cycleSpeed} title="Speed: {speedValue}x">
      {speedValue}x
    </button>

    <button class="sim-btn reset" on:click={reset} title="Reset positions">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="1 4 1 10 7 10"/>
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
      </svg>
    </button>

    <span class="sim-count">{$simulationEntityCount}</span>
  </div>
{/if}

<style>
  .sim-controls {
    position: fixed;
    bottom: calc(70px + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 14px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateX(-50%) translateY(12px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .sim-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .sim-btn.play {
    width: 40px;
    height: 36px;
    background: rgba(74, 222, 128, 0.2);
    color: #4ade80;
  }
  .sim-btn.play:hover {
    background: rgba(74, 222, 128, 0.35);
  }

  .sim-btn.speed {
    height: 36px;
    padding: 0 12px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
    font-size: 0.78rem;
    font-weight: 600;
    min-width: 42px;
  }
  .sim-btn.speed:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .sim-btn.reset {
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.6);
  }
  .sim-btn.reset:hover {
    background: rgba(255, 255, 255, 0.12);
    color: white;
  }

  .sim-count {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.4);
    padding: 0 6px 0 2px;
    font-weight: 500;
    letter-spacing: 0.3px;
  }
</style>
