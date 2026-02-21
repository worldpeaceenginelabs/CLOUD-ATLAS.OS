<script lang="ts">
  import { onMount } from 'svelte';

  let isVisible = false;
  let isFadingOut = false;
  const FADE_DURATION = 500;

  onMount(() => {
    const dismissed = localStorage.getItem('advertisingBannerDismissed');
    if (!dismissed) {
      isVisible = true;
    }
  });

  function dismiss() {
    if (isFadingOut) return;
    isFadingOut = true;
    setTimeout(() => {
      isVisible = false;
      localStorage.setItem('advertisingBannerDismissed', 'true');
    }, FADE_DURATION);
  }
</script>

{#if isVisible}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="banner-backdrop" class:fade-out={isFadingOut} on:click={dismiss} role="presentation"></div>
  <div class="advertising-banner" class:fade-out={isFadingOut}>
    <button class="close-btn" on:click={dismiss} aria-label="Close banner">✕</button>
    <div class="banner-content">
      <p class="headline">What if the world was run by you and me?</p>
      <p class="tagline">Science fiction meets the real world.</p>

      <p>Cloud Atlas OS is a community-owned super-app where the entire gig economy lives under one roof — ridesharing, delivery, freelance, spontaneous connections — with zero commissions. <strong>Keep 100% of what you earn.</strong> We'll teach you how to keep it, legally.</p>

      <p class="accent">But that's just the beginning.</p>

      <p>Govern your city through <strong>SWARM GOVERNANCE</strong> — brainstorm, petition, crowdfund, and organize real change. Stream your impact live on <strong>MissionTV</strong> and get paid for the causes you love. Explore <strong>OMNIPEDIA</strong> — 6 million Wikipedia articles transformed into immersive 3D worlds on a live global map. Build apps, games, and experiences in seconds with the <strong>HOLODECK</strong> — no coding required.</p>

      <p>Think Google Maps, Wikipedia, Twitch, Kickstarter, and an App Store — raised by the open-source community. 🔥</p>

      <p class="cta">Community-owned. Open-source. Yours.<br/>Redefine the way we live together.</p>
    </div>
  </div>
{/if}

<style>
  .banner-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    opacity: 1;
    transition: opacity 0.5s ease;
  }

  .banner-backdrop.fade-out {
    opacity: 0;
  }

  .advertising-banner {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 100;
    background: rgba(18, 18, 30, 0.92);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 215, 0, 0.25);
    border-radius: 20px;
    padding: 36px 40px 32px;
    box-shadow:
      0 24px 80px rgba(0, 0, 0, 0.4),
      0 0 60px rgba(255, 215, 0, 0.06),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    max-width: 520px;
    width: calc(100% - 40px);
    max-height: 85vh;
    overflow-y: auto;
    opacity: 1;
    transition: opacity 0.5s ease, transform 0.5s ease;
  }

  .advertising-banner.fade-out {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.96);
  }

  .close-btn {
    position: absolute;
    top: 14px;
    right: 16px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    padding: 0;
    line-height: 1;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .banner-content {
    text-align: left;
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.85);
    font-size: 14px;
  }

  .banner-content p {
    margin: 0 0 14px;
  }

  .banner-content p:last-child {
    margin-bottom: 0;
  }

  .headline {
    color: #FFD700;
    font-weight: 800;
    font-size: 22px;
    line-height: 1.3;
    margin-bottom: 4px !important;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }

  .tagline {
    color: rgba(255, 215, 0, 0.7);
    font-size: 15px;
    font-style: italic;
    font-weight: 500;
    margin-bottom: 18px !important;
  }

  .accent {
    color: #FFD700;
    font-weight: 700;
    font-size: 15px;
    text-align: center;
    margin-top: 2px !important;
    margin-bottom: 14px !important;
  }

  .banner-content strong {
    color: #FFD700;
    font-weight: 700;
  }

  .cta {
    color: rgba(255, 255, 255, 0.95);
    font-weight: 700;
    font-size: 15px;
    text-align: center;
    margin-top: 18px !important;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 215, 0, 0.15);
    line-height: 1.5;
  }

  @media (max-width: 600px) {
    .advertising-banner {
      padding: 28px 24px 24px;
      border-radius: 16px;
      max-height: 80vh;
    }

    .headline {
      font-size: 19px;
    }

    .banner-content {
      font-size: 13px;
    }
  }

  @media (max-width: 400px) {
    .advertising-banner {
      padding: 24px 18px 20px;
      border-radius: 14px;
      width: calc(100% - 24px);
    }

    .headline {
      font-size: 17px;
    }

    .banner-content {
      font-size: 12.5px;
      line-height: 1.55;
    }

    .tagline {
      font-size: 13px;
    }
  }
</style>
