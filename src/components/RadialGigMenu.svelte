<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { VERTICALS, VERTICAL_LIST } from '../gig/verticals';
  import type { GigVertical } from '../types';

  export let screenX: number;
  export let screenY: number;
  export let onSelect: (vertical: GigVertical) => void;
  export let onClose: () => void;

  let expanded = false;

  const radius = 105;
  const startAngle = -90;
  const angleStep = 360 / VERTICAL_LIST.length;

  interface RadialPosition {
    vertical: GigVertical;
    x: number;
    y: number;
  }

  const positions: RadialPosition[] = VERTICAL_LIST.map((v, i) => {
    const angle = startAngle + i * angleStep;
    const rad = (angle * Math.PI) / 180;
    return {
      vertical: v,
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius,
    };
  });

  onMount(() => {
    requestAnimationFrame(() => { expanded = true; });
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="radial-overlay" transition:fade={{ duration: 200 }}>
  <div class="backdrop" on:click={onClose} role="presentation"></div>

  <div class="radial-center" style="left: {screenX}px; top: {screenY}px">
    <!-- Outer ring (blue) -->
    <div class="ring outer" class:expanded></div>
    <!-- Inner ring (orange) -->
    <div class="ring inner" class:expanded></div>

    <!-- Center label -->
    <span class="center-label" class:expanded>Me</span>

    <!-- Category items -->
    {#each positions as { vertical, x, y }, i}
      {@const cfg = VERTICALS[vertical]}
      <button
        class="radial-item"
        class:expanded
        style="--tx: {x}px; --ty: {y}px; --delay: {i * 70 + 120}ms; --accent: {cfg.color}"
        on:click={() => onSelect(vertical)}
      >
        <span class="item-icon" style="background: {cfg.color}18; color: {cfg.color}">
          {#if vertical === 'rides'}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
          {:else if vertical === 'delivery'}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          {:else if vertical === 'helpouts'}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          {:else if vertical === 'social'}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          {/if}
        </span>
        <span class="item-label">{cfg.name}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .radial-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    pointer-events: auto;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
  }

  .radial-center {
    position: absolute;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  /* ── Rings ── */
  .ring {
    position: absolute;
    border-radius: 50%;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .ring.outer {
    width: 44px;
    height: 44px;
    border: 2.5px solid rgba(66, 133, 244, 0.75);
    animation: breathe-outer 4s ease-in-out infinite;
    transition: width 0.55s cubic-bezier(0.34, 1.4, 0.64, 1),
                height 0.55s cubic-bezier(0.34, 1.4, 0.64, 1),
                border-color 0.4s ease;
  }

  .ring.outer.expanded {
    animation: none;
    width: 200px;
    height: 200px;
    border-color: rgba(66, 133, 244, 0.25);
  }

  .ring.inner {
    width: 26px;
    height: 26px;
    border: 2px solid rgba(255, 109, 0, 0.75);
    animation: breathe-inner 4s ease-in-out infinite 0.7s;
    transition: width 0.5s cubic-bezier(0.34, 1.4, 0.64, 1) 0.05s,
                height 0.5s cubic-bezier(0.34, 1.4, 0.64, 1) 0.05s,
                border-color 0.4s ease;
  }

  .ring.inner.expanded {
    animation: none;
    width: 130px;
    height: 130px;
    border-color: rgba(255, 109, 0, 0.2);
  }

  @keyframes breathe-outer {
    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.65; }
    50% { transform: translate(-50%, -50%) scale(1.18); opacity: 1; }
  }

  @keyframes breathe-inner {
    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
    50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
  }

  /* ── Center label ── */
  .center-label {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    color: rgba(255, 255, 255, 0.9);
    font-weight: 700;
    font-size: 0.85rem;
    letter-spacing: 0.04em;
    opacity: 0;
    transition: opacity 0.3s ease 0.25s;
    pointer-events: none;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  }

  .center-label.expanded {
    opacity: 1;
  }

  /* ── Radial items ── */
  .radial-item {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%) translate(0px, 0px) scale(0.2);
    opacity: 0;
    pointer-events: none;
    transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) var(--delay, 0ms),
                opacity 0.35s ease var(--delay, 0ms);

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .radial-item.expanded {
    transform: translate(-50%, -50%) translate(var(--tx), var(--ty)) scale(1);
    opacity: 1;
    pointer-events: auto;
  }

  .item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1.5px solid rgba(255, 255, 255, 0.2);
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .radial-item:hover .item-icon {
    transform: scale(1.12);
    border-color: var(--accent, rgba(255, 255, 255, 0.4));
    box-shadow: 0 0 16px color-mix(in srgb, var(--accent, #fff) 30%, transparent);
  }

  .radial-item:active .item-icon {
    transform: scale(0.95);
  }

  .item-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    text-align: center;
    max-width: 100px;
  }

  @media (max-width: 480px) {
    .item-icon {
      width: 46px;
      height: 46px;
    }

    .item-label {
      font-size: 0.65rem;
    }
  }
</style>
