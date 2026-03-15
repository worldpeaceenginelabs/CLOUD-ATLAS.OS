<script lang="ts">
  import { onMount } from 'svelte';
  import { missionTitleMain, missionTitleSub, missionBottom } from '../content/missionContent';

  const shareText = "I keep 100% of what I earn. Do you? #cloudatlasos #keep100 #antimiddlemen";
  const encoded = encodeURIComponent(shareText);
  let copied = false;
  let pageUrl = '';

  onMount(() => {
    pageUrl = encodeURIComponent(window.location.href);
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

<div class="mission">
  <p class="mission-title">
    <span class="mission-title-main animated-gradient">{missionTitleMain}</span>
    <span class="mission-title-sub animated-gradient">{missionTitleSub}</span>
  </p>
  <div class="mission-card" style="--accent: #23a6d5">
    <p class="mission-card-quote animated-gradient">{shareText}</p>
    <div class="mission-card-actions">
      {#each shareLinks as { name, href }}
        <a class="share-btn" href={href} target="_blank" rel="noopener noreferrer">{name}</a>
      {/each}
      <button
        type="button"
        class="share-btn"
        on:click={() => copyToClipboard(shareText)}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  </div>
  <p class="mission-bottom animated-gradient">{missionBottom}</p>
</div>

<style>
  .mission {
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
    line-height: 1.1;
    letter-spacing: 0.02em;
    display: block;
    max-width: 100%;
    min-width: 0;
    overflow-wrap: break-word;
    word-break: break-word;
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

  .share-btn:hover {
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
    .mission {
      padding: 16px;
    }
  }
</style>
