<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'success' | 'danger' = 'primary';
  export let size: 'small' | 'medium' | 'large' = 'medium';
  export let disabled = false;
  export let fullWidth = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let onClick: (() => void) | undefined = undefined;

  function handleClick() {
    if (!disabled && onClick) {
      onClick();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
      event.preventDefault();
      handleClick();
    }
  }
</script>

<button
  class="glassmorphism-button {variant} {size}"
  class:full-width={fullWidth}
  class:disabled={disabled}
  on:click={handleClick}
  on:keydown={handleKeyDown}
  {disabled}
  {type}
  tabindex="0"
>
  <slot />
</button>

<style>
  .glassmorphism-button {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 10px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    color: white;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .glassmorphism-button:hover:not(.disabled) {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
  }

  .glassmorphism-button:active:not(.disabled) {
    transform: translateY(0);
  }

  .glassmorphism-button.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .glassmorphism-button:focus {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
  }

  /* Size variants */
  .small {
    padding: 8px 16px;
    font-size: 14px;
  }

  .medium {
    padding: 12px 24px;
    font-size: 16px;
  }

  .large {
    padding: 16px 32px;
    font-size: 18px;
  }

  /* Color variants */
  .primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .primary:hover:not(.disabled) {
    background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .secondary {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .secondary:hover:not(.disabled) {
    background: rgba(255, 255, 255, 0.2);
  }

  .success {
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  }

  .success:hover:not(.disabled) {
    background: linear-gradient(135deg, #45a049 0%, #3d8b40 100%);
    box-shadow: 0 4px 8px rgba(76, 175, 80, 0.3);
  }

  .danger {
    background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
  }

  .danger:hover:not(.disabled) {
    background: linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%);
    box-shadow: 0 4px 8px rgba(244, 67, 54, 0.3);
  }

  .full-width {
    width: 100%;
  }
</style>
