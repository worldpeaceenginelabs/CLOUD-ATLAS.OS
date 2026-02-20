<script lang="ts">
  import { openModals, hideModal } from '../utils/modalManager';
  import Modal from './Modal.svelte';
  import Editor from './Editor.svelte';
  import SwarmGovernance from '../appmenu/SwarmGovernance.svelte';
  import Simulation from '../appmenu/Simulation.svelte';
  import GigEconomy from '../appmenu/GigEconomy.svelte';
  import { formatTimestamp } from '../utils/timeUtils';
  import { removeModel } from '../utils/modelUtils';
  import { logger } from '../utils/logger';
  import { modelEditorService } from '../utils/modelEditorService';
  import { modalService } from '../utils/modalService';
  import GlassmorphismButton from './GlassmorphismButton.svelte';
  import ShareButton from './Sharebutton.svelte';
  import { gigCanClose } from '../store';

  const CARD_MODALS = new Set(['model-editor', 'gig-economy']);
  const NOTIFICATION_MODALS = new Set(['coordinate-picker', 'zoom-required']);

  function handleModelEdit(modelData: any) {
    modalService.hideModelDetails();
    modelEditorService.handleEditModel(modelData);
  }

  async function handleModelRemove(modelData: any) {
    try {
      await removeModel(modelData.id);
      modalService.hideModelDetails();
      logger.info('Model removed successfully', { component: 'ModalManager', operation: 'removeModel' });
    } catch (error) {
      logger.error('Failed to remove model', { component: 'ModalManager', operation: 'removeModel' });
    }
  }
</script>

{#each $openModals as modal (modal.id)}
  {#if CARD_MODALS.has(modal.id)}
    {#if modal.id === 'model-editor'}
      <div class="modal-card-container">
        <Editor isEditMode={modal.data?.editMode || false} />
      </div>
    {:else if modal.id === 'gig-economy'}
      <div class="gig-economy-panel">
        {#if $gigCanClose}
          <button class="gig-close-btn" on:click={() => hideModal(modal.id)} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        {/if}
        <GigEconomy />
      </div>
    {/if}
  {:else}
    <Modal
      isVisible={true}
      onClose={() => hideModal(modal.id)}
      title={modal.id === 'record-details' ? 'Record Details' : modal.id === 'model-details' ? '3D Model Details' : ''}
      maxWidth={NOTIFICATION_MODALS.has(modal.id) ? '400px' : '600px'}
      showCloseButton={!NOTIFICATION_MODALS.has(modal.id)}
      closeOnBackdropClick={!NOTIFICATION_MODALS.has(modal.id)}
      modalType={NOTIFICATION_MODALS.has(modal.id) ? 'notification' : 'default'}
      forwardInputs={NOTIFICATION_MODALS.has(modal.id)}
    >
      {#if modal.id === 'record-details' && modal.data?.record}
        {@const record = modal.data.record}
        <div class="modal-record">
          <div>
            <p class="title">{record.title}</p>
            <p class="text">{record.text}</p>
          </div>
          <div>
            <p class="created">CREATED {formatTimestamp(record.timestamp)}</p>
            <p>
              <GlassmorphismButton variant="primary" onClick={() => window.open(record.link, '_blank')}>
                {record.link.includes('t.me') ? 'JOIN TELEGRAM' : 'VIEW LINK'}
              </GlassmorphismButton>
            </p>
          </div>
          <div>
            <ShareButton title={record.title} text={record.text} link={record.link} />
          </div>
        </div>
      {:else if modal.id === 'model-details' && modal.data?.model}
        {@const model = modal.data.model}
        <div class="modal-record">
          <div>
            <p class="title">{model.name}</p>
            <p class="text">{model.description || '3D Model'}</p>
            <p class="model-info">Scale: {model.transform.scale}x | Height: {model.transform.height}m | Source: {model.source}</p>
          </div>
          <div>
            <p class="created">CREATED {formatTimestamp(model.timestamp)}</p>
            <p><GlassmorphismButton variant="primary" onClick={() => handleModelEdit(model)}>EDIT MODEL</GlassmorphismButton></p>
            <p><GlassmorphismButton variant="danger" onClick={() => handleModelRemove(model)}>REMOVE MODEL</GlassmorphismButton></p>
          </div>
        </div>
      {:else if modal.id === 'brainstorming'}
        <SwarmGovernance category="brainstorming" />
      {:else if modal.id === 'simulation'}
        <Simulation />
      {:else if modal.id === 'action-event'}
        <SwarmGovernance category="actionevent" />
      {:else if modal.id === 'petition'}
        <SwarmGovernance category="petition" />
      {:else if modal.id === 'crowdfunding'}
        <SwarmGovernance category="crowdfunding" />
      {:else if modal.id === 'coordinate-picker'}
        <p>Please pick coordinates on the map first — then you can add application pins.</p>
      {:else if modal.id === 'zoom-required'}
        <p>Zoom in until the city level comes into view — then you can drop a pin.</p>
      {/if}
    </Modal>
  {/if}
{/each}

<style>
  .modal-card-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 1000;
  }

  .gig-economy-panel {
    position: fixed;
    top: 50%;
    left: 10px;
    transform: translateY(-50%);
    z-index: 50;
    width: fit-content;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
  }

  .gig-close-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 2;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .gig-close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  @media (max-width: 768px) {
    .gig-economy-panel {
      top: auto;
      bottom: 10px;
      left: 50%;
      right: auto;
      width: calc(100% - 20px);
      max-width: 360px;
      transform: translateX(-50%);
      max-height: 50vh;
    }
  }

  .modal-record {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .modal-record .title {
    font-size: 1.2rem;
    font-weight: bold;
    margin: 0 0 0.5rem 0;
    color: #333;
  }

  .modal-record .text {
    font-size: 1rem;
    margin: 0 0 1rem 0;
    color: #666;
    line-height: 1.4;
  }

  .modal-record .model-info {
    font-size: 0.9rem;
    margin: 0 0 1rem 0;
    color: #888;
    font-style: italic;
  }

  .modal-record .created {
    font-size: 0.8rem;
    margin: 0 0 1rem 0;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .modal-record p {
    margin: 0.5rem 0;
  }
</style>
