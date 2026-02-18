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
</style>
