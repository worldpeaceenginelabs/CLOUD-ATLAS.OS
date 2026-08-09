<script lang="ts">
  export let isActive = false;
  export let onClick: (() => void) | undefined = undefined;
  export let size = '16px';
  export let label = 'Show info';

  function handleClick(event: Event) {
    event.stopPropagation();
    if (onClick) {
      onClick();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick(event);
    }
  }
</script>

<button
  class="info-icon"
  class:active={isActive}
  on:click={handleClick}
  on:keydown={handleKeyDown}
  tabindex="0"
  aria-label={label}
  style="--size: {size};"
>
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
    <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
</button>

<style>
  .info-icon {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: calc(var(--size) + 8px);
    height: calc(var(--size) + 8px);
  }

  .info-icon:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
    transform: scale(1.1);
  }

  .info-icon.active {
    color: white;
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }

  .info-icon:focus {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
  }

  .info-icon svg {
    width: var(--size);
    height: var(--size);
  }
</style>
