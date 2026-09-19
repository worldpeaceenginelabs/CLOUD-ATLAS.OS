<script lang="ts">
  // shared/Marketing.svelte
  // -----------------------------------------------------------------------
  // A small, self-contained modal: shows a shareable link for one specific
  // event. Takes only the two plain values the link is built from — no
  // Nostr, no Store access, no knowledge of LIVE/LISTING or EntityRecord.
  // Opened locally by cesium/EntityDetails.svelte (its owner-only Marketing
  // button); this component doesn't know or care who opened it or why.
  //
  // Link shape: <origin>/<domain>/<eventId> — nothing else goes into it,
  // deliberately (no model, action, title, or payload data).
  // -----------------------------------------------------------------------
  import { createEventDispatcher } from 'svelte';
  import CloseButton from './CloseButton.svelte';

  export let domain: string;
  export let eventId: string;

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  const shareUrl = `${window.location.origin}/${domain}/${eventId}`;
  const shareText = 'Check this out on Cloud Atlas OS:';
  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(shareUrl);

  const shareLinks = [
    { name: 'X', href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}` },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: 'WhatsApp', href: `https://wa.me/?text=${encodedText}%20${encodedUrl}` },
    { name: 'Telegram', href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}` },
    { name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
    { name: 'Reddit', href: `https://reddit.com/submit?title=${encodedText}&url=${encodedUrl}` },
    { name: 'Weibo', href: `https://service.weibo.com/share/share.php?url=${encodedUrl}&title=${encodedText}` },
    { name: 'QQ', href: `https://connect.qq.com/widget/shareqq/index.html?url=${encodedUrl}&title=${encodedText}&summary=${encodedText}` },
    { name: 'Line', href: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}` },
    { name: 'VK', href: `https://vk.com/share.php?url=${encodedUrl}&title=${encodedText}&comment=${encodedText}` },
  ];

  let copied = false;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      copied = false;
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div class="backdrop" on:click={close} />
<div class="panel" role="dialog" aria-modal="true">
  <CloseButton onClose={close} />

  <div class="panel-header">
    <span class="kind-badge">Share</span>
  </div>

  <p class="lead">Share this listing with a direct link:</p>

  <div class="link-row">
    <input class="link-input" type="text" readonly value={shareUrl} on:click={(e) => e.currentTarget.select()} />
    <button class="copy-btn" on:click={copyLink}>{copied ? 'Copied!' : 'Copy'}</button>
  </div>

  <div class="share-row">
    {#each shareLinks as { name, href }}
      <a class="share-btn" {href} target="_blank" rel="noopener noreferrer">{name}</a>
    {/each}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.35);
  }

  .panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 51;
    width: min(380px, calc(100vw - 4em));
    padding: 1.5em;
    background: var(--accent-stripe), var(--glass-bg);
    backdrop-filter: var(--glass-blur);
    -webkit-backdrop-filter: var(--glass-blur);
    border: var(--glass-border);
    border-radius: var(--glass-radius);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75em;
  }

  .kind-badge {
    font-size: 0.7em;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 0.25em 0.6em;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: #8fb0ff;
  }

  .lead {
    margin: 0 0 0.9em;
    font-size: 0.88em;
    color: #dcdcdc;
  }

  .link-row {
    display: flex;
    gap: 0.5em;
    margin-bottom: 1em;
  }

  .link-input {
    flex: 1;
    min-width: 0;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 0.5em 0.7em;
    color: #fff;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.82em;
  }

  .copy-btn {
    flex-shrink: 0;
    background: linear-gradient(90deg, #335bf4, #2ae9c9);
    border: none;
    color: #0b0b0d;
    font-weight: 600;
    padding: 0 1em;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.85em;
  }
  .copy-btn:hover,
  .copy-btn:focus-visible {
    filter: brightness(1.08);
  }

  .share-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em;
  }

  .share-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #fff;
    padding: 0.35em 0.9em;
    border-radius: 999px;
    font-size: 0.82em;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }
  .share-btn:hover,
  .share-btn:focus-visible {
    background: rgba(255, 255, 255, 0.12);
  }
</style>
