<script lang="ts">
  export let onClose: (() => void) | undefined = undefined;
  export let onKeydown: ((event: KeyboardEvent) => void) | undefined = undefined;
  export let size = '22px';
  export let position: 'absolute' | 'relative' = 'absolute';
  export let top = '15px';
  export let right = '15px';

  function handleClick() {
    if (onClose) {
      onClose();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
    if (onKeydown) {
      onKeydown(event);
    }
  }
</script>

<button
  class="close"
  style="--size: {size}; position: {position}; top: {top}; right: {right};"
  on:click={handleClick}
  on:keydown={handleKeyDown}
  tabindex="0"
  aria-label="Close"
>
  <svg viewBox="0 0 36 36" class="circle">
    <path
      stroke-dasharray="100, 100"
      d="M18 2.0845
        a 15.9155 15.9155 0 0 1 0 31.831
        a 15.9155 15.9155 0 0 1 0 -31.831"
    />
  </svg>
  <span></span>
  <span></span>
  <span></span>
  <span></span>
</button>

<style>
  .close {
    --borderSize: 2px;
    --borderColor: rgba(255, 255, 255, 1);
    --speed: 0.5s;

    width: var(--size);
    height: var(--size);
    background: #455A64;
    border-radius: 50%;
    box-shadow: 0 0 20px -5px rgba(255, 255, 255, 0.5);
    transition: 0.25s ease-in-out;
    cursor: pointer;
    animation: fade-in-scale-down var(--speed) ease-out 0.25s both;
    border: none;
    padding: 0;
  }

  @keyframes fade-in-scale-down {
    from {
      opacity: 0;
      transform: scale(1.1);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .close .circle path {
    stroke: var(--borderColor);
    fill: none;
    stroke-width: calc(var(--borderSize) / 2);
    stroke-linecap: round;
    animation: progress var(--speed) ease-out 0.25s both;
  }

  @keyframes progress {
    from {
      stroke-dasharray: 0 100;
    }
  }

  .close span {
    display: block;
    width: calc(var(--size) / 4 - 2px);
    height: var(--borderSize);
    background: var(--borderColor);
    box-shadow: 0 0 20px -5px rgba(255, 255, 255, 0.5);
    border-radius: 20px;
    position: absolute;
    --padding: calc(var(--size) / 3);
    transition: 0.25s ease-in-out;
    animation: slide-in var(--speed) ease-in-out 0.25s both;
  }

  @keyframes slide-in {
    from {
      width: 0;
    }
  }

  .close span:nth-child(2) {
    top: calc(var(--padding) - var(--borderSize) / 2);
    left: var(--padding);
    transform: rotate(45deg);
    transform-origin: top left;
  }

  .close span:nth-child(3) {
    top: calc(var(--padding) - var(--borderSize) / 2);
    right: var(--padding);
    transform: rotate(-45deg);
    transform-origin: top right;
  }

  .close span:nth-child(4) {
    bottom: calc(var(--padding) - var(--borderSize) / 2);
    left: var(--padding);
    transform: rotate(-45deg);
    transform-origin: bottom left;
  }

  .close span:nth-child(5) {
    bottom: calc(var(--padding) - var(--borderSize) / 2);
    right: var(--padding);
    transform: rotate(45deg);
    transform-origin: bottom right;
  }

  .close:hover {
    background: #37474F;
  }

  .close:hover span {
    width: calc(var(--size) / 4);
  }

  .close:focus {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
  }
</style>
