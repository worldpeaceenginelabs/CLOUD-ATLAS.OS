<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { GigVertical } from '../types';
  import { VERTICALS, VERTICAL_LIST } from './verticals';

  export let onSelect: (vertical: GigVertical) => void;
</script>

<div class="vertical-selector" transition:slide={{ duration: 300 }}>
  <h3 class="title">Gig Economy</h3>
  <p class="subtitle">Choose a category</p>

  <div class="grid">
    {#each VERTICAL_LIST as v}
      {@const cfg = VERTICALS[v]}
      <button
        class="tile"
        style="--accent: {cfg.color}"
        on:click={() => onSelect(v)}
      >
        <span class="icon" style="background: {cfg.color}20; color: {cfg.color}">
          {#if v === 'rides'}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
          {:else if v === 'delivery'}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          {:else if v === 'stays'}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          {:else if v === 'services'}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          {:else if v === 'social'}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          {/if}
        </span>
        <span class="name">{cfg.name}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .vertical-selector {
    display: flex;
    flex-direction: column;
  }

  .title {
    margin: 0 0 0.25rem 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: white;
  }

  .subtitle {
    margin: 0 0 1rem 0;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: calc(50% - 5px);
    padding: 16px 8px;
    background: rgba(255, 255, 255, 0.06);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 14px;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tile:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: var(--accent, rgba(255, 255, 255, 0.3));
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .tile:last-child:nth-child(odd) {
    width: calc(50% - 5px);
  }

  .icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    transition: transform 0.2s ease;
  }

  .tile:hover .icon {
    transform: scale(1.08);
  }

  .name {
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }
</style>
