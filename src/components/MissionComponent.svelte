<script lang="ts">
  const shareText = "I keep 100% of what I earn. Do you? #cloudatlasos #keep100 #antimiddlemen";
  let copied = false;

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch {
      copied = false;
    }
  }
</script>

<div class="mission-component">
  <p class="mission-title">
    <span class="mission-title-main animated-gradient">First Mission</span>
    <span class="mission-title-sub animated-gradient">Operator Expansion</span>
  </p>
  <div class="mission-card" style="--accent: #23a6d5">
    <p class="mission-card-quote animated-gradient">{shareText}</p>
    <div class="mission-card-actions">
      <button
        type="button"
        class="copy-btn"
        on:click={() => copyToClipboard(shareText)}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  </div>
  <p class="mission-bottom animated-gradient">Share Cloud Atlas OS on your social networks right now. We've cloned every major gig platform — rides, delivery, freelance, social — with zero commission and zero fees. Every person who joins is a potential customer, passenger, or client, and none of them owe a cut to anyone but you.</p>
</div>

<style>
  .mission-component {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    width: 100%;
    height: 100%;
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
    margin: 0;
  }

  .mission-title-main {
    font-weight: 700;
    /* Cap by width on mobile so "Mission" doesn't overflow; desktop uses vh */
    font-size: max(2.5rem, min(22vh, 20vw));
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .mission-title-sub {
    font-weight: 700;
    font-size: max(1rem, min(8vh, 7vw));
    line-height: 1.1;
    letter-spacing: 0.02em;
  }

  .mission-card {
    background: rgba(10, 15, 25, 0.85);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    border-radius: 12px;
    padding: 28px 24px;
    font-size: 15px;
    line-height: 1.5;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: max-content;
    max-width: 100%;
    box-sizing: border-box;
  }

  .mission-card-quote {
    margin: 0;
    text-align: center;
  }

  .mission-card-actions {
    display: flex;
    gap: 0.4rem;
    justify-content: flex-end;
  }

  .copy-btn {
    background: color-mix(in srgb, var(--accent) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
    color: var(--accent);
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
    font-family: inherit;
  }

  .copy-btn:hover {
    background: color-mix(in srgb, var(--accent) 30%, transparent);
  }

  .mission-bottom {
    font-size: clamp(0.95rem, 4vw, 25px);
    line-height: 1.5;
    width: 100%;
    margin: 0;
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
    .mission-component {
      padding: 16px;
    }
  }
</style>
