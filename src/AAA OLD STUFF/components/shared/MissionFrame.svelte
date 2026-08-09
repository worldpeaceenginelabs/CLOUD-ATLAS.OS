<script lang="ts">
  export let titleMain = '';
  export let titleSub = '';
</script>

<div class="mission">
  <p class="mission-title">
    <span class="mission-title-main animated-gradient">{titleMain}</span>
    <span class="mission-title-sub animated-gradient">{titleSub}</span>
  </p>
  <slot />
</div>

<style>
  .mission {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 1.5rem;
    width: 100%;
    height: auto;
    min-height: 100%;
    min-width: 0;
    overflow-x: hidden;
    text-align: center;
    padding: 24px;
    box-sizing: border-box;
  }

  .mission-title {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin: 0;
    overflow-wrap: break-word;
  }

  .mission-title-main {
    font-weight: 700;
    font-size: clamp(2.25rem, 14vmin, 5.5rem);
    line-height: 1;
    letter-spacing: -0.02em;
    display: block;
    max-width: 100%;
    min-width: 0;
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .mission-title-sub {
    font-weight: 700;
    font-size: clamp(1.2rem, 6.5vmin, 2.75rem);
    line-height: 1.3;
    letter-spacing: 0.02em;
    display: block;
    max-width: 100%;
    min-width: 0;
    overflow-wrap: break-word;
    word-break: break-word;
    padding-bottom: 2px;
  }

  .animated-gradient {
    background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
    background-size: 400% 400%;
    animation: gradientBG 5s ease infinite;
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  @keyframes gradientBG {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @media (max-width: 600px) {
    .mission {
      padding: 16px;
      min-height: 100%;
    }
  }
</style>
