<script lang="ts">
  import GlassmorphismButton from '../components/GlassmorphismButton.svelte';
  import {
    nativePrompt,
    isInstalled,
    platform,
    installInstructions,
    triggerInstall,
  } from '../utils/pwaInstall';

  const DESKTOP_EXE_URL =
    'https://github.com/worldpeaceenginelabs/CLOUD-ATLAS.OS/releases/download/V1.5/Cloud.Atlas.OS.1.5.stable.Windows.exe';

  async function handlePwaInstall() {
    await triggerInstall();
  }

  function openDesktopExe() {
    window.open(DESKTOP_EXE_URL, '_blank', 'noopener,noreferrer');
  }
</script>

<div class="download-root">
  <h3 class="title">Get Cloud Atlas OS</h3>
  <p class="subtitle">
    Choose how you want to run the atlas on your device.
  </p>

  <div class="cards">
    <section class="download-card pwa-card">
      <span class="card-heading">Progressive Web App</span>
      <p class="card-text">
        Install Cloud Atlas OS directly to your home screen. Your phone becomes
        the server — no middlemen between you and your money.
      </p>

      <div class="card-body">
        <p class="hint">
          {#if $nativePrompt}
            Tap <strong>Install</strong> to add Cloud Atlas OS.
          {:else}
            {installInstructions[platform]}
          {/if}
        </p>

        <div class="actions">
          {#if !$isInstalled && $nativePrompt}
            <GlassmorphismButton
              variant="primary"
              fullWidth={true}
              onClick={handlePwaInstall}
            >
              Install PWA
            </GlassmorphismButton>
          {:else}
            <GlassmorphismButton
              variant="secondary"
              fullWidth={true}
              onClick={() => {}}
            >
              Follow instructions above
            </GlassmorphismButton>
          {/if}
        </div>
      </div>
    </section>

    <section class="download-card desktop-card">
      <span class="card-heading">Desktop App (Windows)</span>
      <p class="card-text">
        Run Cloud Atlas OS as a native Windows application. Your computer becomes
        the server — no middlemen between you and your money.
      </p>

      <div class="card-body">
        
        <p class="hint">
          Download the portable executable and run it on your desktop or
          laptop.
        </p>

        <div class="actions">
          <GlassmorphismButton
            variant="primary"
            fullWidth={true}
            onClick={openDesktopExe}
          >
            Download for Windows
          </GlassmorphismButton>
        </div>
      </div>
    </section>
  </div>
</div>

<style>
  .download-root {
    padding: 1.25rem 1.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 640px;
  }

  .title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: white;
    text-align: center;
  }

  .subtitle {
    margin: 0;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
    text-align: center;
  }

  .cards {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .download-card {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 0.75rem;
    padding: 0.85rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    text-align: left;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .pwa-card {
    --accent: #facc15;
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  }

  .desktop-card {
    --accent: #38bdf8;
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  }

  .card-heading {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.6);
  }

  .card-text {
    margin: 0;
    font-size: 0.88rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .card-body {
    margin-top: 0.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .hint {
    margin: 0;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.55);
  }

  .actions {
    margin-top: 0.4rem;
  }

  @media (min-width: 720px) {
    .cards {
      flex-direction: row;
      align-items: stretch;
    }

    .download-card {
      width: 50%;
    }
  }
</style>

