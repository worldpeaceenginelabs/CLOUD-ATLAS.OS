<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  const shareText =
    "I keep 100% of what I earn. Do you? #cloudatlasos #keep100 #antimiddlemen https://zerodollar.app";

  const STORAGE_KEY = 'cloud-atlas-mission1';
  const DAY = 24 * 60 * 60 * 1000;

  const missionTitleMain = 'First Global Mission';
  const missionTitleSub = 'Operator Expansion';

  let stars = 0;
  let lastShareAt = 0;
  let countdownLabel = '';
  let copied = false;
  let pageUrl = '';

  const encoded = encodeURIComponent(shareText);

  $: shareLinks = [
    { name: 'X', href: `https://twitter.com/intent/tweet?text=${encoded}` },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?quote=${encoded}&u=${pageUrl}` },
    { name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${pageUrl}` },
    { name: 'Reddit', href: `https://reddit.com/submit?title=${encoded}&url=${pageUrl}` },
    { name: 'Weibo', href: `https://service.weibo.com/share/share.php?url=${pageUrl}&title=${encoded}` },
    { name: 'QQ', href: `https://connect.qq.com/widget/shareqq/index.html?url=${pageUrl}&title=${encoded}&summary=${encoded}` },
    { name: 'Line', href: `https://social-plugins.line.me/lineit/share?url=${pageUrl}` },
    { name: 'VK', href: `https://vk.com/share.php?url=${pageUrl}&title=${encoded}&comment=${encoded}` },
  ];

  $: countdownActive =
    stars > 0 &&
    stars < 3 &&
    Date.now() - lastShareAt < DAY;

  $: missionStatsText = (() => {
    if (stars >= 3) {
      return 'Mission complete: you shared on 3 different days.';
    }

    if (countdownActive) {
      return `Next star available in ${countdownLabel}. ${3 - stars} star${3 - stars === 1 ? '' : 's'} left.`;
    }

    if (stars === 0) {
      return 'Share in any way to earn your first star.';
    }

    return `Next star is ready. ${3 - stars} star${3 - stars === 1 ? '' : 's'} left.`;
  })();

  onMount(() => {
    pageUrl = encodeURIComponent(window.location.href);

    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const data = JSON.parse(saved);

        stars = Math.min(3, Math.max(0, Number(data.stars) || 0));
        lastShareAt = Number(data.lastShareAt) || 0;
      }
    } catch {
      stars = 0;
      lastShareAt = 0;
    }

    updateCountdown();

    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  });

  function saveState() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        stars,
        lastShareAt
      })
    );
  }

  function updateCountdown() {
    if (stars === 0 || stars >= 3) {
      countdownLabel = '';
      return;
    }

    const remaining = DAY - (Date.now() - lastShareAt);

    if (remaining <= 0) {
      countdownLabel = '';
      return;
    }

    const totalSeconds = Math.ceil(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    countdownLabel =
      `${String(hours).padStart(2, '0')}:` +
      `${String(minutes).padStart(2, '0')}:` +
      `${String(seconds).padStart(2, '0')}`;
  }

  function earnStar() {
    if (stars >= 3 || countdownActive) return;

    stars += 1;
    lastShareAt = Date.now();

    saveState();
    updateCountdown();

    if (stars === 3) {
      dispatch('complete');
    }
  }

  function handleShareClick() {
    earnStar();
  }

  async function copyToClipboard() {
    if (stars >= 3) return;

    try {
      await navigator.clipboard.writeText(shareText);

      copied = true;
      earnStar();

      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch {
      copied = false;
    }
  }
</script>

<div class="mission-frame">
  <div class="mission-content">

    <h2>{missionTitleMain}</h2>
    <h3>{missionTitleSub}</h3>

    <p class="mission-share-label">SHARE THIS ON 3 DIFFERENT DAYS</p>

    <div class="mission-card">
      <div class="mission-stars">
        {#each [1, 2, 3] as level}
          <span class="mission-star" class:filled={stars >= level}>★</span>
        {/each}
      </div>

      <p class="mission-stats">{missionStatsText}</p>

      <p class="mission-card-quote animated-gradient">
        {shareText}
      </p>

      <div class="mission-card-actions">
        {#each shareLinks as { name, href }}
          <a
            class="share-btn"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={stars >= 3}
            on:click={handleShareClick}
          >
            {name}
          </a>
        {/each}

        <button
          type="button"
          class="share-btn"
          on:click={copyToClipboard}
          disabled={stars >= 3}
        >
          {copied ? 'Copied!' : 'Copy Text'}
        </button>
      </div>
    </div>

    <div class="mission-bottom">
      <p class="animated-gradient">
        <span class="mission-bottom-heading">What to do?</span>
        Share Cloud Atlas OS on your social networks right now. We've cloned every major gig platform — rides, delivery, freelance, social — with zero commission
        and zero fees.<br>
        <span class="mission-bottom-heading">Free Forever</span>
      </p>

      <p class="animated-gradient">
        <span class="mission-bottom-heading">What is the goal?</span>
        Every person who joins is a potential customer, passenger, or client, and none of them owe a cut to anyone but you.
      </p>

      <p class="animated-gradient">
        <span class="mission-bottom-heading">How do we see we won?</span>
        The Revolution Will Not Be Televised <span class="mission-emoji">😂✊</span> We're having a global live user count coming soon. Watch the number grow as a direct signal of your impact.
      </p>
    </div>

  </div>
</div>

<style>
  .mission-frame {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow-y: auto;
  }

  .mission-content {
    width: 100%;
    box-sizing: border-box;
  }

  h2,
  h3 {
    margin: 0;
  }

  .mission-card {
    background: rgba(10, 15, 25, 0.85);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    border-radius: 12px;
    border: 1px solid #ffd700;
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

  .mission-stats {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
    text-align: center;
  }

  .mission-card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    justify-content: center;
  }

  .share-btn {
    background: color-mix(in srgb, #23a6d5 20%, transparent);
    border: 1px solid color-mix(in srgb, #23a6d5 45%, transparent);
    color: #23a6d5;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
    font-family: inherit;
    text-decoration: none;
  }

  .share-btn:focus {
    outline: none;
  }

  .share-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, #23a6d5 60%, transparent);
    outline-offset: 2px;
    border-color: color-mix(in srgb, #23a6d5 60%, transparent);
  }

  .share-btn:hover {
    background: color-mix(in srgb, #23a6d5 30%, transparent);
  }

  .share-btn[aria-disabled="true"] {
    opacity: 0.45;
    pointer-events: none;
  }

  .mission-share-label {
    color: #ffd700;
    font-weight: 800;
    font-size: clamp(1.3rem, 4.5vmin, 2rem);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin: 0.5rem 0 0.25rem;
  }

  .mission-stars {
    display: flex;
    justify-content: center;
    gap: 0.35rem;
    margin-bottom: 0.1rem;
  }

  .mission-star {
    font-size: 2rem;
    color: rgba(255, 255, 255, 0.2);
    transition: color 0.2s ease, transform 0.15s ease;
  }

  .mission-star.filled {
    color: #ffd700;
    transform: scale(1.05);
  }

  .mission-bottom {
    font-size: clamp(0.95rem, 4vw, 25px);
    line-height: 1.5;
    width: 100%;
    margin: 0;
  }

  .mission-bottom p {
    margin: 0.35rem 0;
  }

  .mission-bottom-heading {
    color: #ffd700;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-right: 0.25rem;
    -webkit-text-fill-color: #ffd700;
    background: none;
  }

  .mission-emoji {
    -webkit-text-fill-color: initial;
    background: none;
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
</style>
