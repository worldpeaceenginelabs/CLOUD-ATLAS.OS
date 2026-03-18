<script lang="ts">
  import { slide } from 'svelte/transition';
  import { activeMapLayers, onlinePanelOpen } from '../store';
  import { VERTICALS, type ListingVerticalConfig } from '../gig/verticals';

  $: helpoutsOn = $activeMapLayers.has('helpouts');
  $: socialOn = $activeMapLayers.has('social');
  $: visible = helpoutsOn || socialOn;

  $: label = helpoutsOn && socialOn
    ? 'Online Helpouts & Social'
    : helpoutsOn
      ? 'Online Helpouts'
      : 'Online Social';

  $: barColor = helpoutsOn && socialOn
    ? `linear-gradient(90deg, ${(VERTICALS.helpouts as ListingVerticalConfig).color}, ${(VERTICALS.social as ListingVerticalConfig).color})`
    : helpoutsOn
      ? (VERTICALS.helpouts as ListingVerticalConfig).color
      : (VERTICALS.social as ListingVerticalConfig).color;

  function open() {
    onlinePanelOpen.set(true);
  }
</script>

{#if visible}
  <button class="online-topbar" on:click={open} transition:slide={{ duration: 250, axis: 'y' }}>
    <span class="topbar-accent" style="background: {barColor}"></span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
    <span class="topbar-label">{label}</span>
    <svg class="topbar-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  </button>
{/if}

<style>
  .online-topbar {
    position: fixed;
    top: calc(10px + env(safe-area-inset-top, 0px));
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px 8px 10px;
    background: rgba(15, 15, 25, 0.85);
    backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.85);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .online-topbar:hover {
    background: rgba(15, 15, 25, 0.95);
    border-color: rgba(255, 255, 255, 0.25);
    transform: translateX(-50%) translateY(-1px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }

  .topbar-accent {
    width: 4px;
    height: 18px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .topbar-label {
    flex: 1;
  }

  .topbar-arrow {
    opacity: 0.4;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .online-topbar {
      font-size: 0.76rem;
      padding: 7px 14px 7px 8px;
      gap: 6px;
    }
  }
</style>
