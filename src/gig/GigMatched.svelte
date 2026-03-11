<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { MatchingVerticalConfig } from './verticals';
  import { ensureProtocol, formatLatLon } from '../utils/urlUtils';
  import { reverse, formatShortAddress } from '../services/nominatimService';
  import GlassmorphismButton from '../components/GlassmorphismButton.svelte';

  export let config: MatchingVerticalConfig;
  export let onDone: () => void;
  export let role: 'requester' | 'provider' | null = null;
  export let providerDetails: Record<string, string> = {};
  export let pickup: { latitude: number; longitude: number };
  export let drop: { latitude: number; longitude: number };

  $: hasContact = !!(providerDetails.phone || providerDetails.messenger);
  $: showContact = role === 'requester' && hasContact;

  let pickupDisplayName = '';
  let dropDisplayName = '';
  let pickupReverseLoading = false;
  let dropReverseLoading = false;
  let pickupLastKey = '';
  let dropLastKey = '';

  $: {
    const key = `${pickup.latitude}:${pickup.longitude}`;
    if (key !== pickupLastKey) {
      pickupLastKey = key;
      pickupDisplayName = '';
      pickupReverseLoading = true;
      reverse(pickup.latitude, pickup.longitude)
        .then((result) => { if (result) pickupDisplayName = formatShortAddress(result); })
        .finally(() => { pickupReverseLoading = false; });
    }
  }

  $: {
    const key = `${drop.latitude}:${drop.longitude}`;
    if (key !== dropLastKey) {
      dropLastKey = key;
      dropDisplayName = '';
      dropReverseLoading = true;
      reverse(drop.latitude, drop.longitude)
        .then((result) => { if (result) dropDisplayName = formatShortAddress(result); })
        .finally(() => { dropReverseLoading = false; });
    }
  }

  let copiedWhich: 'phone' | 'messenger' | 'pickup' | 'drop' | null = null;

  async function copyToClipboard(text: string, which: 'phone' | 'messenger' | 'pickup' | 'drop') {
    const value = String(text).trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(which === 'phone' ? value.replace(/\s/g, '') : which === 'messenger' ? ensureProtocol(value) : value);
      copiedWhich = which;
      setTimeout(() => { copiedWhich = null; }, 2000);
    } catch {
      copiedWhich = null;
    }
  }
</script>

<div class="matched" transition:slide={{ duration: 300 }}>
  <h3 class="title">{config.matchTitle}</h3>
  <div class="success">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={config.color} stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
    <p class="message">{role === 'provider' ? config.matchMessageProvider : config.matchMessage}</p>
    <p class="peer-info">Connected directly via P2P</p>
  </div>

  {#if showContact}
    <div class="contact-card" style="--accent: {config.color}">
      <span class="contact-heading">{config.providerNoun.charAt(0).toUpperCase() + config.providerNoun.slice(1)} Contact</span>
      {#if providerDetails.phone}
        <div class="contact-row">
          <span class="contact-label">Phone</span>
          <span class="contact-value">{String(providerDetails.phone)}</span>
          <button type="button" class="copy-btn" on:click={() => copyToClipboard(providerDetails.phone ?? '', 'phone')}>
            {copiedWhich === 'phone' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      {/if}
      {#if providerDetails.messenger}
        <div class="contact-row">
          <span class="contact-label">Messenger</span>
          <a class="contact-value link" href={ensureProtocol(providerDetails.messenger)} target="_blank" rel="noopener noreferrer">{providerDetails.messenger}</a>
          <button type="button" class="copy-btn" on:click={() => copyToClipboard(providerDetails.messenger ?? '', 'messenger')}>
            {copiedWhich === 'messenger' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      {/if}
    </div>
  {/if}

  <div class="contact-card" style="--accent: {config.color}">
    <span class="contact-heading">Locations</span>
    <p class="coordinates-hint">Use these coordinates in your favorite maps app for a precise meeting point.</p>
    <div class="location-block">
      <span class="contact-label">Pickup</span>
      <span class="contact-value location-value">
        <span class="coords-display">{pickup.latitude.toFixed(5)}, {pickup.longitude.toFixed(5)}</span>
        {#if pickupReverseLoading}
          <span class="address-loading">Looking up address...</span>
        {:else if pickupDisplayName}
          <span class="address-display">{pickupDisplayName}</span>
        {/if}
      </span>
      <div class="location-actions">
        <a
          class="copy-btn"
          href={`https://www.google.com/maps/search/?api=1&query=${pickup.latitude},${pickup.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open
        </a>
        <button
          type="button"
          class="copy-btn"
          on:click={() => copyToClipboard(formatLatLon(pickup.latitude, pickup.longitude), 'pickup')}
        >
          {copiedWhich === 'pickup' ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
    <div class="location-block">
      <span class="contact-label">Drop</span>
      <span class="contact-value location-value">
        <span class="coords-display">{drop.latitude.toFixed(5)}, {drop.longitude.toFixed(5)}</span>
        {#if dropReverseLoading}
          <span class="address-loading">Looking up address...</span>
        {:else if dropDisplayName}
          <span class="address-display">{dropDisplayName}</span>
        {/if}
      </span>
      <div class="location-actions">
        <a
          class="copy-btn"
          href={`https://www.google.com/maps/search/?api=1&query=${drop.latitude},${drop.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open
        </a>
        <button
          type="button"
          class="copy-btn"
          on:click={() => copyToClipboard(formatLatLon(drop.latitude, drop.longitude), 'drop')}
        >
          {copiedWhich === 'drop' ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  </div>

  {#if config.id === 'rides'}
    <div class="safety-instructions">
      <p class="warning">⚠️ For your safety and transparency, both driver and passenger must download the <strong>Droid Dashcam</strong> app on Android or iOS. In the app settings under "Record Settings," set private storage and choose a PIN.</p>
      <ol>
        <li>Each person shows their ID and face to the other using the Dashcam app.</li>
        <li>Both confirm that the app is recording.</li>
        <li>Keep the recording on for the entire duration of the ride.</li>
        <li>After arriving at the destination, both parties delete the recording together.</li>
      </ol>
      <p class="warning">⚠️ If at any point you feel threatened, call the police immediately and put your phone on speaker.</p>
    </div>
  {/if}

  <GlassmorphismButton variant="secondary" fullWidth={true} onClick={onDone}>
    Done
  </GlassmorphismButton>
</div>

<style>
  .matched {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    text-align: center;
  }

  .title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: white;
  }

  .success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 0;
  }

  .message {
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
    font-size: 0.95rem;
  }

  .peer-info {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.4);
    margin: 0;
  }

  .contact-card {
    width: 100%;
    box-sizing: border-box;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: left;
  }

  .contact-heading {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.6);
  }

  .coordinates-hint {
    margin: 0 0 0.5rem 0;
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.4;
  }

  .location-block {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    align-items: flex-start;
  }

  .contact-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .copy-btn {
    margin-left: auto;
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

  .contact-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    min-width: 70px;
  }

  .contact-value {
    font-size: 0.9rem;
    color: white;
    text-decoration: none;
    word-break: break-all;
  }

  .contact-value.location-value {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
  }

  .contact-value.location-value:hover {
    text-decoration: none;
  }

  .contact-value .coords-display {
    font-family: monospace;
    font-size: 0.82rem;
    color: rgba(74, 222, 128, 1);
  }

  .contact-value .address-loading {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.5);
    font-style: italic;
  }

  .contact-value .address-display {
    font-size: 0.82rem;
    color: rgba(255, 255, 255, 0.75);
  }

  .contact-value:hover {
    text-decoration: underline;
  }

  .contact-value.link {
    color: rgba(96, 165, 250, 1);
  }

  .location-actions {
    display: flex;
    gap: 0.4rem;
    margin-left: auto;
  }

  .safety-instructions {
    text-align: left;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 204, 0, 0.2);
    border-radius: 0.75rem;
    padding: 1rem;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.5;
    width: 100%;
    box-sizing: border-box;
  }

  .safety-instructions ol {
    margin: 0.75rem 0;
    padding-left: 1.25rem;
  }

  .safety-instructions li {
    margin-bottom: 0.4rem;
  }

  .safety-instructions .warning {
    margin: 0;
    color: #ffcc00;
    font-weight: 600;
  }

  .safety-instructions :global(strong) {
    color: white;
  }
</style>
