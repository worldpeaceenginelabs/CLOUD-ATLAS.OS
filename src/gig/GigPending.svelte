<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { GigRequest } from '../types';
  import type { VerticalConfig } from './verticals';
  import GlassmorphismButton from '../components/GlassmorphismButton.svelte';
  import RelayStatus from '../components/RelayStatus.svelte';

  export let config: VerticalConfig;
  export let role: 'rider' | 'driver' | null;
  export let relayCount: number;
  export let relayTotal: number;
  export let nearbyCount: number;
  export let currentGeohash: string;
  export let hasOwnRequest: boolean;
  export let matchedRequest: GigRequest | null;
  export let awaitingConfirmation: boolean;
  export let onCancel: () => void;
  export let onAccept: () => void;
  export let onReject: () => void;
</script>

<div class="pending" transition:slide={{ duration: 300 }}>

  <!-- ── Requester pending ── -->
  {#if hasOwnRequest && role === 'rider'}
    <h3 class="title">Waiting for {config.providerNoun}</h3>
    <RelayStatus connected={relayCount} total={relayTotal} />
    <div class="status-indicator">
      <div class="pulse-dot" style="background: {config.color}"></div>
      <span>
        {#if nearbyCount > 0}
          Found {nearbyCount} {config.providerNoun}{nearbyCount !== 1 ? 's' : ''} nearby...
        {:else}
          Searching for {config.providerNoun}s...
        {/if}
      </span>
    </div>
    {#if currentGeohash}
      <p class="cell-info">Cell: {currentGeohash}</p>
    {/if}

    <div class="cancel-section">
      <GlassmorphismButton variant="danger" fullWidth={true} onClick={onCancel}>
        Cancel Request
      </GlassmorphismButton>
    </div>

  <!-- ── Provider pending ── -->
  {:else if role === 'driver'}
    <h3 class="title">Offering {config.name}</h3>
    <RelayStatus connected={relayCount} total={relayTotal} />
    <div class="status-indicator">
      <div class="pulse-dot provider" style="background: {config.color}"></div>
      <span>
        {#if nearbyCount > 0}
          Found {nearbyCount} {config.requesterNoun}{nearbyCount !== 1 ? 's' : ''} nearby...
        {:else}
          Listening for {config.requesterNoun}s in your cell...
        {/if}
      </span>
    </div>
    {#if currentGeohash}
      <p class="cell-info">Cell: {currentGeohash}</p>
    {/if}

    <!-- Awaiting requester confirmation after clicking Accept -->
    {#if awaitingConfirmation}
      <div class="confirming-card">
        <div class="status-indicator">
          <div class="pulse-dot" style="background: {config.color}"></div>
          <span>Confirming with {config.requesterNoun}...</span>
        </div>
      </div>

    <!-- New request available to accept/reject -->
    {:else if matchedRequest}
      <div class="match-card" style="--accent: {config.color}">
        <h4>New Request!</h4>
        <p class="match-type">{config.requestNoun}</p>

        <!-- Show vertical-specific details from the request -->
        {#each config.needFields as field}
          {#if matchedRequest.details?.[field.key]}
            <p class="match-detail">
              <span class="detail-label">{field.label}:</span>
              {matchedRequest.details[field.key]}
            </p>
          {/if}
        {/each}

        <p class="match-detail">From {config.requesterNoun} in your cell</p>

        <div class="match-actions">
          <GlassmorphismButton variant="success" size="small" onClick={onAccept}>
            Accept
          </GlassmorphismButton>
          <GlassmorphismButton variant="danger" size="small" onClick={onReject}>
            Decline
          </GlassmorphismButton>
        </div>
      </div>
    {/if}

    <div class="cancel-section">
      <GlassmorphismButton variant="danger" fullWidth={true} onClick={onCancel}>
        Stop Offering
      </GlassmorphismButton>
    </div>
  {/if}
</div>

<style>
  .pending {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .title {
    margin: 0 0 0.25rem 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: white;
    text-transform: capitalize;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .pulse-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    animation: gig-pulse 1.5s ease-in-out infinite;
    flex-shrink: 0;
  }

  @keyframes gig-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.3); }
  }

  .cell-info {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.35);
    margin: 0;
    font-family: monospace;
  }

  .cancel-section {
    margin-top: 0.5rem;
  }

  /* ── Match Card ── */
  .match-card {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    border-radius: 12px;
    padding: 1rem;
  }

  .match-card h4 {
    margin: 0 0 0.5rem 0;
    color: var(--accent, #4ade80);
    font-size: 1rem;
  }

  .match-type {
    margin: 0.25rem 0;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.7);
    text-transform: capitalize;
  }

  .match-detail {
    margin: 0.25rem 0;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1.4;
  }

  .detail-label {
    color: rgba(255, 255, 255, 0.65);
    font-weight: 500;
  }

  .match-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .confirming-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(66, 133, 244, 0.3);
    border-radius: 12px;
    padding: 1rem;
  }
</style>
