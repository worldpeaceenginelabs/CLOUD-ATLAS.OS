<script lang="ts">
  import { fade } from 'svelte/transition';
</script>

<main transition:fade={{ duration: 500 }}>
  <div class="omnipedia-container">
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
        Over 6 Million Wikipedia articles sourced into immersive, animated 3D objects and scenes — geolocated on a global map and powered by BitTorrent. The more people explore, the smarter and faster it gets.
      </p>
      <p class="description">
        Truth-checking happens by exploration: users naturally flag anomalies while navigating the world. Imagine spotting a green giraffe sipping coffee at Starbucks—an anomaly that hints at a factual error or absurdity in the source Wikipedia article, and automatically flags a correction request from the Cloud Atlas OS community to the Wikipedia community.
      </p>
      <p class="description">
        This feature transforms information into a living, visual experience—blending learning, truth detection, and storytelling in a gamified, immersive world.
      </p>
    </div>
  </div>
</main>

<style>
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
  }

  .coming-soon {
    text-align: center;
    max-width: 500px;
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
      min-height: 300px;
      padding: 20px 15px;
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
