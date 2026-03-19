<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { OPERATOR_HALO_ITEMS } from '../gig/verticals';
  import type { OperatorHaloItem } from '../gig/verticals';
  import { verticalIconSvg } from '../gig/verticalIcons';
  import type { GigVertical } from '../types';
  import { modalService } from '../utils/modalService';
  import { mission1 } from '../utils/mission1';

  export let screenX: number;
  export let screenY: number;
  export let onSelect: (vertical: GigVertical) => void;
  export let onClose: () => void;

  let expanded = false;
  let infoPanelText = '';

  let shouldPulseNext = false;

  const radius = 115;
  const startAngle = -90;
  const angleStep = 360 / OPERATOR_HALO_ITEMS.length;

  interface ItemPosition {
    item: OperatorHaloItem;
    x: number;
    y: number;
  }

  const positions: ItemPosition[] = OPERATOR_HALO_ITEMS.map((item, i) => {
    const angle = startAngle + i * angleStep;
    const rad = (angle * Math.PI) / 180;
    return {
      item,
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius,
    };
  });

  function handleItemClick(item: OperatorHaloItem) {
    if (!localStorage.getItem('operatorAgreementAccepted')) {
      modalService.showOperatorAgreement();
      return;
    }
    onSelect(item.id);
  }

  function handleLogClick() {
    if (!localStorage.getItem('welcomeMessageDismissed')) {
      modalService.showAbout();
      return;
    }
    modalService.showMissionLog();
  }

  function toggleInfo(item: OperatorHaloItem, e: Event) {
    e.stopPropagation();
    if (!item.description) return;
    if (infoPanelText === item.description) {
      infoPanelText = '';
    } else {
      infoPanelText = item.description!;
    }
  }

  function iconSvg(item: OperatorHaloItem, size: number): string {
    return verticalIconSvg(item.id, size);
  }

  function onItemKeydown(e: KeyboardEvent, item: OperatorHaloItem) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleItemClick(item);
    }
  }

  onMount(() => {
    requestAnimationFrame(() => {
      expanded = true;
    });
  });

  function handleBackdropClick() {
    if (infoPanelText) {
      infoPanelText = '';
    } else {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (infoPanelText) {
        infoPanelText = '';
      } else {
        onClose();
      }
    }
  }

  $: {
    shouldPulseNext = $mission1.status === 'ready';
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="halo-overlay" transition:fade={{ duration: 200 }}>
  <!-- Blur layer: blurs only outside the clear center circle -->
  <div
    class="backdrop-blur"
    style="--cx: {screenX}px; --cy: {screenY}px"
  ></div>
  <!-- Tint layer: uniform dark overlay everywhere, captures clicks -->
  <div class="backdrop-tint" on:click={handleBackdropClick} role="presentation"></div>

  <div class="halo-center" style="left: {screenX}px; top: {screenY}px">
    <!-- Decorative rings -->
    <div class="ring outer" class:expanded></div>
    <div class="ring inner" class:expanded></div>

    <!-- LOG letters inside the orange inner ring -->
    <button
      class="halo-logo"
      type="button"
      on:click={handleLogClick}
      aria-label="Open mission log"
    >
      {#if shouldPulseNext}
        <span class="halo-logo-text pulse">
          NEXT
        </span>
      {:else}
        <span class="halo-logo-text greyed">
          <span class="log-layout">
            <span class="log-letter log-left">L</span>
            <span class="log-letter log-center">O</span>
            <span class="log-letter log-right">G</span>
          </span>
        </span>
      {/if}
    </button>

    <!-- All items on a single ring -->
    {#each positions as { item, x, y }, i}
      <div
        class="halo-item"
        class:expanded
        style="--tx: {x}px; --ty: {y}px; --delay: {i * 55 + 100}ms; --accent: {item.color}"
        on:click={() => handleItemClick(item)}
        on:keydown={(e) => onItemKeydown(e, item)}
        role="button"
        tabindex="0"
      >
        <span class="item-icon" style="background: {item.color}18; color: {item.color}">
          {@html iconSvg(item, 20)}
          {#if item.description}
            <button
              class="info-btn"
              class:active={infoPanelText === item.description}
              on:click={(e) => toggleInfo(item, e)}
              type="button"
              aria-label="Show info for {item.name}"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5"/>
                <path d="M12 16V12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M12 8H12.01" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </button>
          {/if}
        </span>
        <span class="item-label">{item.name}</span>
      </div>
    {/each}
  </div>

  <!-- Info panel (centered on screen) -->
  {#if infoPanelText}
    <div class="info-panel" transition:fade={{ duration: 200 }}>
      <div class="info-content">
        {infoPanelText}
      </div>
    </div>
  {/if}
</div>

<style>
  .halo-overlay {
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

  .halo-center {
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

  /* ── LOG glass letters inside inner ring ── */
  .halo-logo {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    outline: none;
  }

  .halo-logo-text {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-weight: 800;
    font-size: 3.2rem;
    letter-spacing: 0.06em;
    line-height: 1;
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

  .halo-logo-text.pulse {
    animation: mission1-gradient 4s ease infinite, pulse 10s infinite;
  }

  .halo-logo-text.greyed {
    background: none;
    -webkit-background-clip: initial;
    background-clip: initial;
    -webkit-text-fill-color: rgba(255, 255, 255, 0.45);
    color: rgba(255, 255, 255, 0.45);
  }

  .log-layout {
    position: relative;
    display: inline-block;
    width: 3em;
    height: 1em;
  }

  .log-letter {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
  }

  .log-letter.log-center {
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .log-letter.log-left {
    left: 0;
  }

  .log-letter.log-right {
    right: 0;
  }

  @keyframes mission1-gradient {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  @keyframes breathe-outer {
    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.65; }
    50% { transform: translate(-50%, -50%) scale(1.18); opacity: 1; }
  }

  @keyframes breathe-inner {
    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
    50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
  }

  /* ── Halo items ── */
  .halo-item {
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

  .halo-item.expanded {
    transform: translate(-50%, -50%) translate(var(--tx), var(--ty)) scale(1);
    opacity: 1;
    pointer-events: auto;
  }

  .item-icon {
    position: relative;
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

  .halo-item:hover .item-icon {
    transform: scale(1.12);
    border-color: var(--accent, rgba(255, 255, 255, 0.4));
    box-shadow: 0 0 16px color-mix(in srgb, var(--accent, #fff) 30%, transparent);
  }

  .halo-item:active .item-icon {
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

  /* ── Info button (on action items only) ── */
  .info-btn {
    position: absolute;
    top: -5px;
    right: -5px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: all 0.2s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .info-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.5);
    color: white;
    transform: scale(1.15);
  }

  .info-btn.active {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.6);
    color: white;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
  }

  /* ── Info panel ── */
  .info-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 110;
    max-width: 300px;
    min-width: 250px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .info-content {
    padding: 16px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.5;
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

    .info-panel {
      max-width: 250px;
      min-width: 200px;
    }

    .info-content {
      font-size: 13px;
      padding: 12px;
    }
  }
</style>

