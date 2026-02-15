<script lang="ts">
  export let connected: number;
  export let total: number;
</script>

<div
  class="relay-status"
  class:connected={connected > 0}
  class:connecting={connected === 0 && total > 0}
  class:failed={connected === 0 && total === 0}
>
  <span class="relay-dot"></span>
  {#if connected > 0}
    {connected}/{total} relays
  {:else if total > 0}
    Connecting to relays...
  {:else}
    No relays available
  {/if}
</div>

<style>
  .relay-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    padding: 2px 10px;
    border-radius: 12px;
    margin-bottom: 8px;
    font-family: monospace;
    transition: all 0.3s ease;
  }
  .relay-status.connected {
    color: rgba(100, 255, 160, 0.85);
    background: rgba(100, 255, 160, 0.08);
  }
  .relay-status.connecting {
    color: rgba(255, 200, 100, 0.85);
    background: rgba(255, 200, 100, 0.08);
  }
  .relay-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
  }
  .relay-status.connected .relay-dot {
    background: rgba(100, 255, 160, 0.9);
    box-shadow: 0 0 4px rgba(100, 255, 160, 0.5);
  }
  .relay-status.connecting .relay-dot {
    background: rgba(255, 200, 100, 0.9);
    animation: relay-blink 1s ease-in-out infinite;
  }
  .relay-status.failed {
    color: rgba(252, 165, 165, 0.85);
    background: rgba(239, 68, 68, 0.08);
  }
  .relay-status.failed .relay-dot {
    background: rgba(239, 68, 68, 0.9);
  }
  @keyframes relay-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
</style>
