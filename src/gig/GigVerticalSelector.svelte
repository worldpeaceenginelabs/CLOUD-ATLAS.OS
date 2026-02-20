<script lang="ts">
  import { slide } from 'svelte/transition';
  import type { GigVertical } from '../types';
  import { VERTICALS, VERTICAL_LIST } from './verticals';
  import { verticalIconSvg } from './verticalIcons';

  export let onSelect: (vertical: GigVertical) => void;
</script>

<div class="vertical-selector" transition:slide={{ duration: 300 }}>
  <h3 class="title">Me</h3>
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
          {@html verticalIconSvg(v, 24)}
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
