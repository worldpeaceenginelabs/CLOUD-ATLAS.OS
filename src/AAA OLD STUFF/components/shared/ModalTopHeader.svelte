<script lang="ts">
  import CloseButton from '../CloseButton.svelte';

  export let title: string = '';
  export let showCloseButton = true;
  export let transparent = false;
  export let onClose: (() => void) | undefined = undefined;
  export let onKeydown: ((event: KeyboardEvent) => void) | undefined = undefined;
</script>

{#if title}
  <header class="modal-top-header" class:transparent>
    {#if showCloseButton}
      <CloseButton
        onClose={onClose}
        onKeydown={onKeydown}
        size="20px"
        position="absolute"
        top="8px"
        right="10px"
      />
    {/if}
    <h2 class="modal-top-title">{title}</h2>
  </header>
{/if}

<style>
  .modal-top-header {
    padding: 10px 16px 8px;
    text-align: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    position: sticky;
    top: 0;
    z-index: 2;
    background: rgba(10, 15, 25, 0.82);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    box-sizing: border-box;
  }

  .modal-top-header.transparent {
    background: transparent;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }

  .modal-top-title {
    margin: 0;
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.35);
  }
</style>
