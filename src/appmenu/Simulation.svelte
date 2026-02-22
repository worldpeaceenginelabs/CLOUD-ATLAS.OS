<script lang="ts">
  import { fade } from 'svelte/transition';
</script>

<main transition:fade={{ duration: 500 }}>
  <div class="simulation-container">
    <div class="coming-soon">
      <div class="icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h1>HOLODECK & OMNIPEDIA CREATOR</h1>
      <p class="coming-soon-text">Coming Soon</p>
      <p class="description">
        Connect 3D models into a dynamic scene and run simulations to test how different parameters shape your virtual environment.<br><br> Create OMNIPEDIA — 6 million Wikipedia articles transformed into immersive 3D worlds on a live global map. Build apps, games, and experiences in seconds with the HOLODECK — no coding required.
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

  .simulation-container {
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
    color: #4CAF50;
  }

  .icon svg {
    width: 64px;
    height: 64px;
    filter: drop-shadow(0 0 10px rgba(76, 175, 80, 0.3));
  }

  h1 {
    font-size: 2.5em;
    margin: 0 0 16px 0;
    background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
    background-size: 400% 400%;
    animation: gradientBG 5s ease infinite;
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .coming-soon-text {
    font-size: 1.5em;
    font-weight: bold;
    color: #4CAF50;
    margin: 0 0 24px 0;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .description {
    font-size: 1.1em;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
  }

  @keyframes gradientBG {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .simulation-container {
      min-height: 300px;
      padding: 20px 15px;
    }

    h1 {
      font-size: 2em;
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
