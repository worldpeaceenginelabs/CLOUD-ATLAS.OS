<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { HelpoutListing } from '../types';
  import { HELPOUT_CATEGORIES } from './verticals';
  import { getKeypair } from '../services/keyManager';
  import { NostrService } from '../services/nostrService';

  export let listing: HelpoutListing;
  export let myPk: string;
  export let onClose: () => void;
  /** Called after the publisher takes down their listing. */
  export let onTakenDown: ((listingId: string) => void) | undefined = undefined;

  let isTakingDown = false;

  $: isOwner = listing.pubkey === myPk;

  $: categoryName = HELPOUT_CATEGORIES.find(c => c.id === listing.category)?.name ?? listing.category;

  $: modeLabel =
    listing.mode === 'in-person' ? 'In-Person' :
    listing.mode === 'online' ? 'Online' : 'In-Person & Online';

  /** Ensure URL has a protocol so window.open doesn't treat it as relative. */
  function ensureProtocol(url: string): string {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) return url;
    return 'https://' + url;
  }

  function openContact() {
    window.open(ensureProtocol(listing.contact), '_blank', 'noopener');
  }

  async function takeDown() {
    isTakingDown = true;
    try {
      const { sk } = await getKeypair();
      const nostr = new NostrService(sk);

      // Publish a replacement event with 1-second TTL
      const expiration = String(Math.floor(Date.now() / 1000) + 1);
      const tags: string[][] = [
        ['t', 'listing-helpouts'],
        ['expiration', expiration],
      ];
      if (listing.geohash) tags.push(['g', listing.geohash]);

      nostr.publishReplaceable(listing.id, tags, JSON.stringify(listing));
      nostr.connectInBackground();

      // Give relays a moment to receive the event, then disconnect
      setTimeout(() => {
        nostr.disconnect();
        onTakenDown?.(listing.id);
        onClose();
      }, 3000);
    } catch {
      isTakingDown = false;
    }
  }
</script>

<div class="helpout-detail-overlay" on:click|self={onClose} on:keydown={undefined} role="presentation">
  <div class="helpout-detail" transition:fly={{ y: 40, duration: 250 }}>

    <!-- Header -->
    <div class="detail-header">
      <div class="detail-badge" style="background: rgba(0, 188, 212, 0.15); color: #00BCD4">
        {categoryName}
      </div>
      <button class="close-btn" on:click={onClose}>&times;</button>
    </div>

    <!-- Mode -->
    <div class="detail-mode">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        {#if listing.mode === 'online'}
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        {:else}
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        {/if}
      </svg>
      <span>{modeLabel}</span>
    </div>

    <!-- Description -->
    <p class="detail-desc">{listing.description}</p>

    <!-- Actions -->
    <div class="detail-actions">
      <button class="action-btn primary" on:click={openContact}>
        Contact
      </button>

      {#if isOwner}
        <button
          class="action-btn danger"
          on:click={takeDown}
          disabled={isTakingDown}
        >
          {isTakingDown ? 'Taking down...' : 'Take Down Listing'}
        </button>
      {/if}
    </div>

    <span class="detail-hint">
      Published {new Date(listing.timestamp).toLocaleDateString()}
    </span>
  </div>
</div>

<style>
  .helpout-detail-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.3);
  }

  .helpout-detail {
    width: 100%;
    max-width: 380px;
    background: rgba(15, 15, 25, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    backdrop-filter: blur(16px);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 40px;
  }

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .detail-badge {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.78rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.4rem;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    transition: color 0.15s;
  }

  .close-btn:hover {
    color: white;
  }

  .detail-mode {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .detail-desc {
    margin: 0;
    font-size: 0.88rem;
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.5;
  }

  .detail-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
  }

  .action-btn {
    width: 100%;
    padding: 10px 16px;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.primary {
    background: rgba(0, 188, 212, 0.2);
    color: #00BCD4;
    border: 1px solid rgba(0, 188, 212, 0.35);
  }

  .action-btn.primary:hover:not(:disabled) {
    background: rgba(0, 188, 212, 0.3);
  }

  .action-btn.danger {
    background: rgba(239, 68, 68, 0.12);
    color: rgba(239, 68, 68, 0.85);
    border: 1px solid rgba(239, 68, 68, 0.25);
  }

  .action-btn.danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
  }

  .detail-hint {
    font-size: 0.72rem;
    color: rgba(255, 255, 255, 0.3);
    text-align: center;
  }
</style>
