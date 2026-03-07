<script lang="ts">
  import { onMount } from 'svelte';
  import {
    isInstalled,
    nativePrompt,
    platform,
    installInstructions,
    triggerInstall,
  } from '../utils/pwaInstall';

  const DISMISSED_KEY = 'pwaInstallDismissed';
  const FADE_DURATION = 500;

  let visible = false;
  let fadingOut = false;

  onMount(() => {
    if ($isInstalled) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    visible = true;
  });

  $: if ($isInstalled && visible) {
    visible = false;
  }

  function dismiss() {
    if (fadingOut) return;
    fadingOut = true;
    setTimeout(() => {
      visible = false;
      localStorage.setItem(DISMISSED_KEY, 'true');
    }, FADE_DURATION);
  }

  async function handleInstall() {
    await triggerInstall();
  }
</script>

{#if visible}
  <div
    class="pwa-banner"
    class:fade-out={fadingOut}
    role="banner"
    aria-label="Install app"
  >
    <div class="pwa-icon">⬇</div>
    <div class="pwa-text">
      <p class="pwa-title">Install Cloud Atlas OS</p>
      {#if $nativePrompt}
        <p class="pwa-sub">Add to home screen → Your phone is the server. No middlemen between you and your money.</p>
      {:else}
        <p class="pwa-sub">{installInstructions[platform]}</p>
      {/if}
    </div>
    {#if $nativePrompt}
      <button class="pwa-install-btn" on:click={handleInstall}>Install</button>
    {/if}
    <button class="pwa-close-btn" on:click={dismiss} aria-label="Dismiss">✕</button>
  </div>
{/if}

<style>
  .pwa-banner {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(18, 18, 30, 0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 215, 0, 0.25);
    border-radius: 16px;
    padding: 14px 18px;
    box-shadow:
      0 8px 40px rgba(0, 0, 0, 0.45),
      0 0 40px rgba(255, 215, 0, 0.05),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    max-width: calc(100vw - 48px);
    width: max-content;
    opacity: 1;
    transition: opacity 0.5s ease, transform 0.5s ease;
  }

  .pwa-banner.fade-out {
    opacity: 0;
    transform: translateX(-50%) translateY(8px);
  }

  .pwa-icon {
    font-size: 22px;
    flex-shrink: 0;
    color: #FFD700;
  }

  .pwa-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .pwa-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: #FFD700;
    white-space: nowrap;
  }

  .pwa-sub {
    margin: 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.65);
    max-width: 260px;
  }

  .pwa-install-btn {
    flex-shrink: 0;
    white-space: nowrap;
    min-width: fit-content;
    overflow: visible;
    background: #FFD700;
    color: #000;
    border: none;
    border-radius: 8px;
    padding: 7px 16px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.1s ease;
  }

  .pwa-install-btn:hover {
    background: #ffe033;
    transform: scale(1.03);
  }

  .pwa-close-btn {
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    width: 26px;
    height: 26px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    line-height: 1;
    transition: all 0.2s ease;
  }

  .pwa-close-btn:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
  }

  @media (max-width: 480px) {
    .pwa-banner {
      bottom: 16px;
      padding: 12px 14px;
      gap: 10px;
    }

    .pwa-sub {
      max-width: 220px;
    }
  }
</style>
