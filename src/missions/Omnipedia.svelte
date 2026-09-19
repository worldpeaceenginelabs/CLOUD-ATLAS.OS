<script lang="ts">
  // missions/Omnipedia.svelte
  // -----------------------------------------------------------------------
  // Mission 3 — a static "coming soon" teaser, no interaction beyond
  // closing it. Owns its own chrome (.panel + CloseButton) now, same
  // pattern SwarmGovernance.svelte and Mission1.svelte each use
  // independently — HexMenu just decides whether to mount it
  // (missionModal===3) and reacts to its `close` event.
  // -----------------------------------------------------------------------

  import { createEventDispatcher } from 'svelte';
  import CloseButton from '../shared/CloseButton.svelte';

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }
</script>

<div class="panel">
  <CloseButton onClose={close} />

  <main>
    <div class="omnipedia-container">
      <video class="bg-video" autoplay loop muted playsinline>
        <source src="Omnipedia.mp4" type="video/mp4" />
      </video>

      <div class="coming-soon">
        <div class="icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M2 12h20" stroke="currentColor" stroke-width="2"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" stroke-width="2"/>
          </svg>
        </div>

        <h1>OMNIPEDIA</h1>
        <p class="subtitle">The Virtual Encyclopedia</p>
        <p class="coming-soon-text">Coming Soon</p>

        <p class="description">
          OMNIPEDIA transforms Wikipedia into a living, spatial encyclopedia. More than 6 million articles become 3D objects, environments, and scenes, all connected on a shared global map and powered by Nostr and BitTorrent. The more people explore and contribute, the richer the world becomes.
        </p>

        <p class="description">
          Connect 3D models into scenes. Build apps, games, and experiences from those scenes. Run simulations on a live global map. Visualize what does not fit into words.
        </p>

        <p class="description">
          Because every object follows the same underlying logic, scenes and experiences can be recombined instantly. Instead of building everything from scratch, you draw from the full structure of human knowledge — no coding required.
        </p>

        <p class="description">
          Exploration also becomes a way to discover and verify information. When something appears out of place — a green giraffe sipping coffee at Starbucks, for example — it becomes a visible anomaly that can prompt investigation and a correction request from the Cloud Atlas OS community to the Wikipedia community.
        </p>

        <p class="description">
          In this way, OMNIPEDIA turns information into a living, visual experience: a shared world for learning, creating, exploring, simulating, and continuously improving the knowledge it represents.
        </p>

        <p class="description">
          And as the community shapes OMNIPEDIA and, in turn, the HOLODECK, a Genie 3 class spatial AGI emerges from the structure itself.
        </p>
      </div>
    </div>
  </main>
</div>

<style>
  .panel {
    position: fixed;
    top: 50%;
    left: 4vw;
    transform: translateY(-50%);

    width: min(640px, 44vw);
    max-height: 88vh;
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;

    background: var(--accent-stripe), var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: var(--glass-border);
    border-radius: var(--glass-radius);

    padding: 2.5rem 1.5rem 1.5rem;


    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);

    z-index: 9999;
  }

  @media (max-width: 700px) {
      .panel {
    position: fixed;
    inset: 0;

    width: 100%;
    height: 100dvh;
    max-height: none;

    transform: none;

    border-radius: var(--glass-radius);

    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
    }
  }

  main {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: white;
    padding: 0%;
    margin: 0%;
    text-decoration: none;
  }

  .omnipedia-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
    padding: 40px 20px;
    overflow: hidden;
  }

  .bg-video {
    position: absolute;
    top: 50%;
    left: 50%;
    min-width: 100%;
    min-height: 100%;
    transform: translate(-50%, -50%);
    object-fit: cover;
    opacity: 0.25;
    z-index: 0;
    pointer-events: none;
  }

  .coming-soon {
    text-align: center;
    max-width: 500px;
    position: relative;
    z-index: 1;
  }

  .icon {
    margin-bottom: 24px;
    color: #42A5F5;
  }

  .icon svg {
    width: 64px;
    height: 64px;
    filter: drop-shadow(0 0 10px rgba(66, 165, 245, 0.3));
  }

  h1 {
    font-size: 2.5em;
    margin: 0 0 8px 0;
    background: linear-gradient(-45deg, #42A5F5, #AB47BC, #26C6DA, #66BB6A);
    background-size: 400% 400%;
    animation: gradientBG 5s ease infinite;
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    font-size: 1.3em;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 16px 0;
    letter-spacing: 1px;
  }

  .coming-soon-text {
    font-size: 1.5em;
    font-weight: bold;
    color: #42A5F5;
    margin: 0 0 24px 0;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .description {
    font-size: 1.1em;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.8);
    margin: 0 0 16px 0;
  }

  .description:last-child {
    margin-bottom: 0;
  }

  @keyframes gradientBG {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @media (max-width: 768px) {
    .omnipedia-container {
        min-height: 100%;
        padding: 40px 20px;
        box-sizing: border-box;
        align-items: flex-start;
    }

    h1 {
      font-size: 2em;
    }

    .subtitle {
      font-size: 1.1em;
    }

    .coming-soon-text {
      font-size: 1.2em;
    }

    .description {
      font-size: 1em;
    }

    .icon svg {
      width: 48px;
      height: 48px;
    }
  }
</style>
