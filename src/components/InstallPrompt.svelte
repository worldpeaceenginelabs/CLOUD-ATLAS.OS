<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  type Platform = 'android' | 'ios' | 'desktop';

  let deferredPrompt: any = null;
  let showIOSGuide = false;
  let platform: Platform = 'desktop';
  let isInstalled = false;
  let installing = false;

  function detectPlatform(): Platform {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    return 'desktop';
  }

  function checkInstalled(): boolean {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if ((navigator as any).standalone === true) return true;
    if (localStorage.getItem('pwa-installed') === 'true') return true;
    return false;
  }

  function handleBeforeInstallPrompt(e: Event) {
    e.preventDefault();
    deferredPrompt = e;
  }

  function handleAppInstalled() {
    isInstalled = true;
    deferredPrompt = null;
    localStorage.setItem('pwa-installed', 'true');
  }

  async function installApp(e: MouseEvent) {
    e.stopPropagation();
    if (!deferredPrompt) return;
    installing = true;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      isInstalled = true;
    }
    deferredPrompt = null;
    installing = false;
  }

  function openIOSGuide(e: MouseEvent) {
    e.stopPropagation();
    showIOSGuide = true;
  }

  function closeIOSGuide() {
    showIOSGuide = false;
  }

  onMount(() => {
    platform = detectPlatform();
    isInstalled = checkInstalled();

    if (!isInstalled) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
    }
  });

  onDestroy(() => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
  });
</script>

{#if !isInstalled}
  <div class="install-section">
    <div class="install-content">
      <div class="install-header">
        <img src="/icons/icon_192.png" alt="Cloud Atlas OS" class="install-icon" width="56" height="56" />

        <div class="install-text">
          <strong class="install-title">Install the App</strong>
        {#if platform === 'ios'}
          <span class="install-sub">Available on iPhone &amp; iPad</span>
        {:else if platform === 'android'}
          <span class="install-sub">Available on Android</span>
        {:else}
          <span class="install-sub">Available on Desktop</span>
        {/if}
        </div>
      </div>

      {#if platform === 'ios'}
        <button class="install-btn" on:click={openIOSGuide}>
          How to Install
        </button>
      {:else if deferredPrompt}
        <button class="install-btn" on:click={installApp} disabled={installing}>
          {installing ? 'Installing…' : 'Install Now'}
        </button>
      {:else}
        <span class="install-unavailable">Not available on your device</span>
      {/if}
    </div>
  </div>
{/if}

{#if showIOSGuide}
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="ios-overlay" on:click={closeIOSGuide} on:keydown={(e) => e.key === 'Escape' && closeIOSGuide()} role="dialog" aria-label="iOS install instructions" tabindex="-1">
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions a11y-click-events-have-key-events -->
    <div class="ios-guide" on:click|stopPropagation role="document">
      <button class="ios-guide-close" on:click={closeIOSGuide} aria-label="Close">&times;</button>
      <h3 class="ios-guide-title">Install Cloud Atlas OS</h3>
      <p class="ios-guide-intro">Follow these steps in Safari:</p>

      <div class="ios-steps">
        <div class="ios-step">
          <div class="ios-step-num">1</div>
          <div class="ios-step-content">
            <span class="ios-step-text">Tap the <strong>Share</strong> button</span>
            <svg class="ios-share-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2v10M10 2l3.5 3.5M10 2L6.5 5.5M4 9v7a2 2 0 002 2h8a2 2 0 002-2V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
        <div class="ios-step">
          <div class="ios-step-num">2</div>
          <div class="ios-step-content">
            <span class="ios-step-text">Scroll down and tap <strong>"Add to Home Screen"</strong></span>
          </div>
        </div>
        <div class="ios-step">
          <div class="ios-step-num">3</div>
          <div class="ios-step-content">
            <span class="ios-step-text">Tap <strong>"Add"</strong> to confirm</span>
          </div>
        </div>
      </div>

      <button class="ios-guide-done" on:click={closeIOSGuide}>Got it</button>
    </div>
  </div>
{/if}

<style>
  /* ── Inline Install Section (bottom of splash) ── */

  .install-section {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 5;
    display: flex;
    justify-content: center;
    padding: 3rem 1.5rem 2.5rem;
    background: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.75) 40%, rgba(0, 0, 0, 0.92) 100%);
    pointer-events: none;
    animation: installFadeIn 1s ease 0.5s both;
  }

  .install-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    pointer-events: auto;
    max-width: 440px;
    width: 100%;
  }

  .install-header {
    display: contents;
  }

  .install-icon {
    flex-shrink: 0;
    width: 56px;
    height: 56px;
  }

  .install-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    flex: 1;
    min-width: 0;
  }

  .install-title {
    font-size: 1rem;
    font-weight: 700;
    color: #fff;
  }

  .install-sub {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.45);
  }

  .install-btn {
    flex-shrink: 0;
    padding: 0.6rem 1.3rem;
    border: none;
    border-radius: 12px;
    background: linear-gradient(-45deg, #23a6d5, #23d5ab);
    color: #000;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.15s;
    white-space: nowrap;
  }
  .install-btn:hover:not(:disabled) {
    opacity: 0.88;
    transform: scale(1.03);
  }
  .install-btn:active:not(:disabled) {
    transform: scale(0.97);
  }
  .install-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .install-unavailable {
    flex-shrink: 0;
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.3);
    font-style: italic;
    white-space: nowrap;
  }

  @keyframes installFadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Mobile ── */

  @media (max-width: 768px) {
    .install-section {
      padding: 2rem 1.25rem 1.75rem;
    }

    .install-content {
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .install-header {
      display: flex;
      align-items: center;
      gap: 0.875rem;
    }

    .install-btn {
      width: 100%;
      max-width: 220px;
      padding: 0.7rem 1.5rem;
    }
  }

  /* ── iOS Guide Overlay ── */

  .ios-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease;
  }

  .ios-guide {
    position: relative;
    width: 100%;
    max-width: 340px;
    background: rgba(20, 20, 30, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    padding: 2rem 1.5rem 1.5rem;
    backdrop-filter: blur(20px);
    animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .ios-guide-close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    font-size: 1.5rem;
    cursor: pointer;
    line-height: 1;
    padding: 0.25rem;
  }
  .ios-guide-close:hover { color: #fff; }

  .ios-guide-title {
    margin: 0 0 0.25rem;
    font-size: 1.15rem;
    font-weight: 700;
    color: #fff;
  }

  .ios-guide-intro {
    margin: 0 0 1.25rem;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .ios-steps {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .ios-step {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .ios-step-num {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: linear-gradient(-45deg, #23a6d5, #23d5ab);
    color: #000;
    font-weight: 700;
    font-size: 0.8rem;
  }

  .ios-step-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ios-step-text {
    font-size: 0.88rem;
    color: rgba(255, 255, 255, 0.85);
  }

  .ios-share-icon {
    color: #23a6d5;
    flex-shrink: 0;
  }

  .ios-guide-done {
    width: 100%;
    padding: 0.7rem;
    border: none;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .ios-guide-done:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.92); }
    to { opacity: 1; transform: scale(1); }
  }
</style>
