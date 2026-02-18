<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { MatchingVerticalConfig } from './verticals';
  import GlassmorphismButton from '../components/GlassmorphismButton.svelte';

  export let config: MatchingVerticalConfig;
  export let onDone: () => void;
</script>

<div class="matched" transition:slide={{ duration: 300 }}>
  <h3 class="title">{config.matchTitle}</h3>
  <div class="success">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={config.color} stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
    <p class="message">{config.matchMessage}</p>
    <p class="peer-info">Connected directly via P2P</p>
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
