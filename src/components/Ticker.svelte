<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { modalService } from '../utils/modalService';
  import { missionTitleMain, missionTitleSub, missionBottom } from '../content/missionContent';

  export let speed = 80;

  let stripEl: HTMLDivElement | null = null;
  let trackEl: HTMLDivElement | null = null;
  let resizeHandler: (() => void) | null = null;

  function setDuration() {
    if (!stripEl) return;
    const stripWidth = stripEl.getBoundingClientRect().width;
    const contentWidth = trackEl?.getBoundingClientRect().width ?? 0;
    stripEl.style.setProperty('--ticker-duration', `${(stripWidth + contentWidth) / speed}s`);
  }

  onMount(() => {
    setDuration();
    resizeHandler = setDuration;
    window.addEventListener('resize', resizeHandler);
  });

  onDestroy(() => {
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
  });
</script>

<div class="ticker-strip" bind:this={stripEl} aria-hidden="true">
  <div class="ticker-track" bind:this={trackEl}>
    <button
      type="button"
      class="ticker-item ticker-item--clickable"
      on:click={() => modalService.showMissionComponent()}
      title="Mission 1"
    >
      {missionTitleMain} · {missionTitleSub} · {missionBottom}
    </button>
  </div>
</div>

<style>
  .ticker-strip {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: flex;
    align-items: center;
  }

  .ticker-track {
    position: absolute;
    right: 0;
    display: flex;
    flex-wrap: nowrap;
    white-space: nowrap;
    animation: ticker-scroll var(--ticker-duration, 25s) linear infinite;
  }

  .ticker-item {
    flex-shrink: 0;
    padding-right: 2.5em;
    font-size: 25px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
  }

  .ticker-item--clickable {
    border: none;
    background: none;
    padding-right: 2.5em;
    cursor: pointer;
    font-size: 25px;
    font-weight: 600;
    color: transparent;
    background: linear-gradient(
      90deg,
      #ff6b6b,
      #feca57,
      #48dbfb,
      #ff9ff3,
      #ff6b6b
    );
    background-size: 300% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    animation: mission1-gradient 4s ease infinite;
  }

  @keyframes mission1-gradient {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  @keyframes ticker-scroll {
    from { transform: translateX(100%); }
    to { transform: translateX(calc(58px - 100vw)); }
  }
</style>
