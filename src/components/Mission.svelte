<script lang="ts">
  import { onMount } from 'svelte';
  import { missionTitleMain, missionTitleSub } from '../content/missionContent';
  import { missionProgress } from '../utils/missionProgress';
  import { missionShareStreak } from '../utils/missionShareStreak';

  const shareText = "I keep 100% of what I earn. Do you? #cloudatlasos #keep100 #antimiddlemen";
  const encoded = encodeURIComponent(shareText);
  let copied = false;
  let pageUrl = '';

  const missionShareStreakStatus = missionShareStreak.status;

  onMount(() => {
    pageUrl = encodeURIComponent(window.location.href);
    missionProgress.markMissionsSeen();
  });

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

  $: missionStatsText = (() => {
    const { stars } = $missionShareStreak;
    const status = $missionShareStreakStatus;

    if (status === 'completed' || $missionProgress.missionCompleted) {
      return 'Mission complete: you shared 3 days in a row.';
    }

    const remaining = 3 - stars;

    if (status === 'idle') {
      return 'Share in any way to earn your first star.';
    }

    if (status === 'available') {
      return `Share in any way to earn star ${stars + 1} of 3. ${remaining} star${remaining === 1 ? '' : 's'} left.`;
    }

    const hours = missionShareStreak.hoursUntilNextStar();

    return `Next star available in about ${hours} hour${hours === 1 ? '' : 's'}. ${remaining} star${remaining === 1 ? '' : 's'} left.`;
  })();

  function handleShareClick(name: string) {
    missionShareStreak.earnStar();
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      missionShareStreak.earnStar();

      setTimeout(() => { copied = false; }, 2000);
    } catch {
      copied = false;
    }
  }
</script>

<div class="mission">
  <p class="mission-title">
    <span class="mission-title-main animated-gradient">{missionTitleMain}</span>
    <span class="mission-title-sub animated-gradient">{missionTitleSub}</span>
  </p>
  <p class="mission-share-label">SHARE THIS ON 3 DIFFERENT DAYS</p>
  <div class="mission-card" style="--accent: #23a6d5">
    <div class="mission-stars">
      {#each [1, 2, 3] as level}
        <span class="mission-star" class:filled={$missionShareStreak.stars >= level}>★</span>
      {/each}
    </div>
    <p class="mission-stats">{missionStatsText}</p>
    <p class="mission-card-quote animated-gradient">{shareText}</p>
    <div class="mission-card-actions">
      {#each shareLinks as { name, href }}
        <a
          class="share-btn"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          on:click={() => handleShareClick(name)}
        >
          {name}
        </a>
      {/each}
      <button
        type="button"
        class="share-btn"
        on:click={() => copyToClipboard(shareText)}
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
      We're adding a live user count for your region. Watch the number grow as a direct signal of your impact.
    </p>
  </div>
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
    text-decoration: none;
  }

  .share-btn:focus {
    outline: none;
  }

  .share-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent) 60%, transparent);
    outline-offset: 2px;
    border-color: color-mix(in srgb, var(--accent) 60%, transparent);
  }

  .share-btn:hover {
    background: color-mix(in srgb, var(--accent) 30%, transparent);
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
