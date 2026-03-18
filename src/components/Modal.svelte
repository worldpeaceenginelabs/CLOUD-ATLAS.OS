<script lang="ts">
  import { fade } from 'svelte/transition';
  import CloseButton from './CloseButton.svelte';
  import ModalTopHeader from './shared/ModalTopHeader.svelte';
  import { onEnter } from '../utils/keyboard';

  export let isVisible = false;
  export let onClose: (() => void) | undefined = undefined;
  export let title = '';
  export let maxWidth = '600px';
  export let showCloseButton = true;
  export let showTopHeader = true;
  export let topHeaderTransparent = false;
  export let zIndex = 1000;
  export let transitionDuration = 300;
  export let closeOnBackdropClick = true;
  export let modalType: 'default' | 'notification' | 'overlay' | 'mission' = 'default';
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
        {#if showTopHeader}
          <ModalTopHeader {title} {showCloseButton} transparent={topHeaderTransparent} onClose={handleClose} onKeydown={handleKeyDown} />
        {:else if showCloseButton}
          <div class="modal-top-controls">
            <CloseButton onClose={handleClose} onKeydown={handleKeyDown} />
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
      on:keydown={(e) => onEnter(e, () => handleBackdropClick(e))}
    >
      <div class="modal-content" style="max-width: {maxWidth};" class:forward-inputs={forwardInputs}>
        {#if showTopHeader}
          <ModalTopHeader {title} {showCloseButton} transparent={topHeaderTransparent} onClose={handleClose} onKeydown={handleKeyDown} />
        {:else if showCloseButton}
          <div class="modal-top-controls">
            <CloseButton onClose={handleClose} onKeydown={handleKeyDown} />
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
    right: 0;
    top: 0;
    height: 100vh;
    height: 100dvh;
    max-height: 100vh;
    max-height: 100dvh;
    padding-top: calc(10px + env(safe-area-inset-top, 0px));
    padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
    box-sizing: border-box;
    background: transparent;
    backdrop-filter: none;
  }

  /* Default modal - full screen with centered content */
  .modal.default {
    display: flex;
    justify-content: center;
    align-items: center;
    background: rgba(0, 0, 0, 0.55);
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

  /* Mission modal - full viewport with blur */
  .modal.mission {
    background: rgba(0, 0, 0, 0.35);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .modal.mission .modal-content {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    background: transparent;
    border: none;
    box-shadow: none;
    width: 100%;
    height: 100%;
    min-height: 100%;
    max-height: none;
    box-sizing: border-box;
    overflow: hidden;
  }

  .modal.mission .modal-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 1.5rem;
    width: 100%;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    box-sizing: border-box;
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
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  /* Layers menu: compact card under the top-right button */
  .modal.overlay.layers-menu-modal {
    position: fixed;
    top: calc(10px + env(safe-area-inset-top, 0px) + 40px + 8px);
    right: 10px;
    left: auto;
    bottom: calc(5px + env(safe-area-inset-bottom, 0px));
    transform: none;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    background: transparent;
  }

  .modal.overlay.layers-menu-modal .modal-content {
    background: transparent;
    border: none;
    box-shadow: none;
    width: auto;
    max-width: unset;
    padding: 0;
    height: 100%;
    max-height: 100%;
    overflow-y: auto;
    border-radius: 0;
    margin: 0;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }

  .modal-content {
    background: rgba(10, 15, 25, 0.82);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    border-radius: 15px;
    width: 90%;
    max-height: 100%;
    margin-top: 0;
    margin-bottom: 0;
    overflow-y: auto;
    position: relative;
  }

  .modal-top-controls {
    position: sticky;
    top: 0;
    z-index: 2;
    padding: 8px 10px;
    display: flex;
    justify-content: flex-end;
    background: rgba(10, 15, 25, 0.82);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    box-sizing: border-box;
  }

  /* Missions modal (mission-log) – yellow border */
  .modal.missions .modal-content {
    background: transparent;
    border: none;
    box-shadow: none;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    width: auto;
    max-width: 420px;
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
