<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { RADIAL_MENU_ITEMS } from '../gig/verticals';
  import type { RadialMenuItem } from '../gig/verticals';
  import { verticalIconSvg, outerRingIconSvg } from '../gig/verticalIcons';
  import type { OuterRingItem } from '../gig/verticalIcons';
  import type { GigVertical } from '../types';

  export let screenX: number;
  export let screenY: number;
  export let onSelect: (vertical: GigVertical) => void;
  export let onActionSelect: (item: OuterRingItem) => void;
  export let onClose: () => void;

  let expanded = false;

  const radius = 115;
  const startAngle = -90;
  const angleStep = 360 / RADIAL_MENU_ITEMS.length;

  interface ItemPosition {
    item: RadialMenuItem;
    x: number;
    y: number;
  }

  const positions: ItemPosition[] = RADIAL_MENU_ITEMS.map((item, i) => {
    const angle = startAngle + i * angleStep;
    const rad = (angle * Math.PI) / 180;
    return {
      item,
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius,
    };
  });

  function handleItemClick(item: RadialMenuItem) {
    if (item.kind === 'vertical') {
      onSelect(item.id);
    } else {
      onActionSelect(item.id);
    }
  }

  function iconSvg(item: RadialMenuItem, size: number): string {
    return item.kind === 'vertical'
      ? verticalIconSvg(item.id, size)
      : outerRingIconSvg(item.id, size);
  }

  onMount(() => {
    requestAnimationFrame(() => { expanded = true; });
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="radial-overlay" transition:fade={{ duration: 200 }}>
  <!-- Blur layer: blurs only outside the clear center circle -->
  <div
    class="backdrop-blur"
    style="--cx: {screenX}px; --cy: {screenY}px"
  ></div>
  <!-- Tint layer: uniform dark overlay everywhere, captures clicks -->
  <div class="backdrop-tint" on:click={onClose} role="presentation"></div>

  <div class="radial-center" style="left: {screenX}px; top: {screenY}px">
    <!-- Decorative rings -->
    <div class="ring outer" class:expanded></div>
    <div class="ring inner" class:expanded></div>

    <!-- All items on a single ring -->
    {#each positions as { item, x, y }, i}
      <button
        class="radial-item"
        class:expanded
        style="--tx: {x}px; --ty: {y}px; --delay: {i * 55 + 100}ms; --accent: {item.color}"
        on:click={() => handleItemClick(item)}
      >
        <span class="item-icon" style="background: {item.color}18; color: {item.color}">
          {@html iconSvg(item, 20)}
        </span>
        <span class="item-label">{item.name}</span>
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

  .backdrop-blur {
    position: absolute;
    inset: 0;
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    -webkit-mask-image: radial-gradient(circle at var(--cx) var(--cy), transparent 115px, black 117px);
    mask-image: radial-gradient(circle at var(--cx) var(--cy), transparent 115px, black 117px);
    pointer-events: none;
  }

  .backdrop-tint {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
  }

  .radial-center {
    position: absolute;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  /* ── Decorative rings ── */
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
    width: 230px;
    height: 230px;
    border-color: rgba(66, 133, 244, 0.2);
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
    border-color: rgba(255, 109, 0, 0.18);
  }

  @keyframes breathe-outer {
    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.65; }
    50% { transform: translate(-50%, -50%) scale(1.18); opacity: 1; }
  }

  @keyframes breathe-inner {
    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
    50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
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
    gap: 5px;
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
    width: 44px;
    height: 44px;
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
    font-size: 0.58rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    text-align: center;
    max-width: 72px;
    line-height: 1.2;
  }

  @media (max-width: 480px) {
    .item-icon {
      width: 38px;
      height: 38px;
    }

    .item-label {
      font-size: 0.52rem;
      max-width: 64px;
    }
  }
</style>
