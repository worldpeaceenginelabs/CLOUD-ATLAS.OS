<script lang="ts">
  import { fade } from 'svelte/transition';
  import CloseButton from './CloseButton.svelte';

  export let isVisible = false;
  export let onClose: (() => void) | undefined = undefined;
  export let title = '';
  export let maxWidth = '600px';
  export let showCloseButton = true;
  export let zIndex = 1000;
  export let transitionDuration = 300;
  export let closeOnBackdropClick = true;
  export let modalType: 'default' | 'notification' | 'overlay' = 'default';
  export let customClass = '';
  export let forwardInputs = false;

  function handleClose() {
    if (onClose) {
      onClose();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }

  function handleBackdropClick(event: MouseEvent | KeyboardEvent) {
    if (closeOnBackdropClick && modalType !== 'notification' && event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

{#if isVisible}
  {#if modalType === 'notification'}
    <div 
      class="modal {modalType} {customClass}" 
      class:forward-inputs={forwardInputs}
      style="z-index: {zIndex};"
      transition:fade={{ duration: transitionDuration }}
    >
      <div class="modal-content" style="max-width: {maxWidth};">
        {#if showCloseButton}
          <CloseButton onClose={handleClose} onKeydown={handleKeyDown} />
        {/if}
        
        {#if title}
          <div class="modal-header">
            <h2>{title}</h2>
          </div>
        {/if}
        
        <div class="modal-body">
          <slot />
        </div>
      </div>
    </div>
  {:else}
    <div 
      class="modal {modalType} {customClass}" 
      class:forward-inputs={forwardInputs}
      style="z-index: {zIndex};"
      transition:fade={{ duration: transitionDuration }} 
      role="dialog" 
      aria-modal="true" 
      tabindex="-1"
      on:click={handleBackdropClick}
      on:keydown={(e) => e.key === 'Enter' && handleBackdropClick(e)}
    >
      <div class="modal-content" style="max-width: {maxWidth};" class:forward-inputs={forwardInputs}>
        {#if showCloseButton}
          <CloseButton onClose={handleClose} onKeydown={handleKeyDown} />
        {/if}
        
        {#if title}
          <div class="modal-header">
            <h2>{title}</h2>
          </div>
        {/if}
        
        <div class="modal-body">
          <slot />
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .modal {
    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    backdrop-filter: none;
  }

  /* Default modal - full screen with centered content */
  .modal.default {
    display: flex;
    justify-content: center;
    align-items: center;
  }


  /* Notification modal - centered with smaller content, no background overlay */
  .modal.notification {
    display: flex;
    justify-content: center;
    align-items: center;
    background: transparent;
    backdrop-filter: none;
    pointer-events: none;
  }

  .modal.notification .modal-content {
    width: auto;
    max-width: 400px;
    padding: 0;
    text-align: center;
    pointer-events: none;
  }

  /* Overlay modal - positioned overlay without full screen */
  .modal.overlay {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: auto;
    height: auto;
    background: transparent;
    backdrop-filter: none;
  }

  .modal.overlay .modal-content {
    background-color: rgba(0, 0, 0, 0.8);
    border-radius: 15px;
    padding: 20px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .modal-content {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    border-radius: 15px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
  }

  .modal-header {
    text-align: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }

  .modal-header h2 {
    color: white;
    margin: 0;
    font-size: 1.5em;
    font-weight: 600;
  }

  .modal-body {
    color: white;
  }

  /* Input forwarding styles */
  .modal.forward-inputs {
    pointer-events: none;
  }

  .modal.forward-inputs .modal-content {
    pointer-events: none;
  }

  .modal.forward-inputs .modal-content * {
    pointer-events: none;
  }

  /* Re-enable pointer events for interactive elements */
  .modal.forward-inputs input,
  .modal.forward-inputs textarea,
  .modal.forward-inputs button,
  .modal.forward-inputs select,
  .modal.forward-inputs label,
  .modal.forward-inputs [role="button"],
  .modal.forward-inputs [tabindex] {
    pointer-events: auto;
  }

  /* Notification modal specific styles */
  .modal.notification .modal-body {
    text-align: center;
    font-size: 0.9em;
    font-weight: 500;
  }


  /* Responsive design */
  @media (max-width: 768px) {
    .modal-content {
      width: 95%;
      padding: 20px;
    }

    .modal.notification .modal-content {
      width: 90%;
      max-width: 350px;
    }
  }

  /* Mobile responsiveness for notification modals */
  @media (max-width: 1120px) {
    .modal.notification .modal-body {
      font-size: 0.8em;
    }
  }

  @media (max-width: 1020px) {
    .modal.notification .modal-body {
      font-size: 0.7em;
    }
  }

  @media (max-width: 910px) {
    .modal.notification .modal-body {
      font-size: 0.65em;
    }
  }

  @media (max-width: 480px) {
    .modal.notification .modal-body {
      font-size: 0.5em;
    }
  }

  @media (max-width: 400px) {
    .modal.notification .modal-body {
      font-size: 0.45em;
    }
  }

  @media (max-width: 360px) {
    .modal.notification .modal-body {
      font-size: 0.4em;
    }
  }
</style>
