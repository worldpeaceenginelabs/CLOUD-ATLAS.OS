<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  
  // Component for the advertising banner
  let isVisible = false;
  let isFadingOut = false;
  let showCount = 0;
  const MAX_SHOWS = 3;
  const SHOW_DURATION = 5000; // 5 seconds
  const FADE_DURATION = 500; // 0.5 seconds fade out
  
  let timeoutId: number | null = null;
  
  onMount(() => {
    // Load show count from localStorage
    const savedCount = localStorage.getItem('advertisingBannerShowCount');
    showCount = savedCount ? parseInt(savedCount, 10) : 0;
    
    // Show banner if we haven't reached the limit
    if (showCount < MAX_SHOWS) {
      isVisible = true;
      showCount++;
      
      // Save updated count to localStorage
      localStorage.setItem('advertisingBannerShowCount', showCount.toString());
      
      // Set timer to start fade out after 5 seconds
      timeoutId = window.setTimeout(() => {
        isFadingOut = true;
        // Hide banner completely after fade animation
        setTimeout(() => {
          isVisible = false;
        }, FADE_DURATION);
      }, SHOW_DURATION);
    }
  });
  
  onDestroy(() => {
    // Clean up timeout if component is destroyed
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
</script>

{#if isVisible}
  <a href="https://cloud-atlas-peerset.pages.dev/" target="_blank" rel="noopener noreferrer" class="advertising-banner" class:fade-out={isFadingOut}>
    <div class="banner-content">
      <span class="banner-text">Try peerset.DB now</span>
      <br>
      <span class="banner-subtext">Cloud Atlas OS's new engine coming...</span>
    </div>
  </a>
{/if}

<style>
  .advertising-banner {
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 100;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    padding: 16px 20px;
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease, opacity 0.5s ease;
    max-width: 280px;
    cursor: pointer;
    text-decoration: none;
    display: block;
    opacity: 1;
  }

  .advertising-banner.fade-out {
    opacity: 0;
    transform: translateY(-10px);
  }

  .advertising-banner:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
    box-shadow: 
      0 12px 40px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .banner-content {
    text-align: left;
    line-height: 1.4;
  }

  .banner-text {
    color: #FFD700;
    font-weight: 700;
    font-size: 16px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    display: block;
  }

  .banner-subtext {
    color: #FFD700;
    font-weight: 500;
    font-size: 13px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    opacity: 0.9;
    display: block;
    margin-top: 2px;
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .advertising-banner {
      top: 15px;
      left: 15px;
      padding: 12px 16px;
      max-width: 240px;
    }

    .banner-text {
      font-size: 14px;
    }

    .banner-subtext {
      font-size: 12px;
    }
  }

  @media (max-width: 480px) {
    .advertising-banner {
      top: 10px;
      left: 10px;
      padding: 8px 12px;
      max-width: 180px;
    }

    .banner-text {
      font-size: 12px;
    }

    .banner-subtext {
      font-size: 10px;
    }
  }

  @media (max-width: 400px) {
    .advertising-banner {
      top: 8px;
      left: 8px;
      padding: 6px 10px;
      max-width: 160px;
      border-radius: 12px;
    }

    .banner-text {
      font-size: 11px;
      line-height: 1.2;
    }

    .banner-subtext {
      font-size: 9px;
      line-height: 1.2;
    }
  }
</style>
