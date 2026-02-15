<script lang="ts">
  import { openModals, modalManager } from '../utils/modalManager';
  import Modal from './Modal.svelte';
  import Editor from './Editor.svelte';
  import SwarmGovernance from '../appmenu/SwarmGovernance.svelte';
  import Simulation from '../appmenu/Simulation.svelte';
  import GigEconomy from './GigEconomy.svelte';
  import { formatTimestamp } from '../utils/timeUtils';
  import { removeModel } from '../utils/modelUtils';
  import { logger } from '../utils/logger';
  import { modelEditorService } from '../utils/modelEditorService';
  import { modalService } from '../utils/modalService';
  import GlassmorphismButton from './GlassmorphismButton.svelte';
  import ShareButton from './Sharebutton.svelte';
  import { gigCanClose } from '../store';

  // Handle modal close
  function handleModalClose(modalId: string) {
    modalManager.hideModal(modalId);
  }

  // Handle model edit
  function handleModelEdit(modelData: any) {
    modalService.hideModelDetails();
    modelEditorService.handleEditModel(modelData);
  }

  // Handle model remove
  async function handleModelRemove(modelData: any) {
    try {
      await removeModel(modelData.id);
      modalService.hideModelDetails();
      logger.info('Model removed successfully', { component: 'ModalManager', operation: 'removeModel' });
    } catch (error) {
      logger.operationError('removeModel', error, { component: 'ModalManager', operation: 'removeModel' });
    }
  }

  // Handle record link click
  function handleRecordLinkClick(link: string) {
    window.open(link, '_blank');
  }
</script>

<!-- Render all open modals -->
{#each $openModals as modal (modal.id)}
  {#if modal.config.type === 'card'}
    <!-- Card-type modals (like Editor) -->
    {#if modal.id === 'model-editor'}
      <div class="modal-card-container">
        <Editor 
          isEditMode={modal.config.data?.editMode || false}
        />
      </div>
    {:else if modal.id === 'gig-economy'}
      <div class="gig-economy-panel">
        {#if $gigCanClose}
          <button class="gig-close-btn" on:click={() => handleModalClose(modal.id)} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        {/if}
        <GigEconomy />
      </div>
    {/if}
  {:else}
    <!-- Regular modals -->
    <Modal 
      isVisible={modal.isVisible}
      onClose={() => handleModalClose(modal.id)}
      title={modal.config.title}
      maxWidth={modal.config.maxWidth}
      zIndex={modal.zIndex}
      showCloseButton={modal.config.showCloseButton}
      closeOnBackdropClick={modal.config.closeOnBackdropClick}
      transitionDuration={modal.config.transitionDuration}
      customClass={modal.config.customClass}
      forwardInputs={modal.config.forwardInputs}
      modalType={modal.config.type}
    >
      {#if modal.id === 'record-details' && modal.config.data?.record}
        {@const record = modal.config.data.record}
        <div class="modal-record">
          <div>
            <p class="title">{record.title}</p>
            <p class="text">{record.text}</p>
          </div>
          <div>
            <p class="created">CREATED {formatTimestamp(record.timestamp)}</p>
            <p>
              <GlassmorphismButton 
                variant="primary" 
                onClick={() => handleRecordLinkClick(record.link)}
              >
                {record.link.includes('t.me') ? 'JOIN TELEGRAM' : 'VIEW LINK'}
              </GlassmorphismButton>
            </p>
          </div>
          <div>
            <ShareButton 
              title={record.title} 
              text={record.text} 
              link={record.link} 
            />
          </div>
        </div>
      {:else if modal.id === 'model-details' && modal.config.data?.model}
        {@const model = modal.config.data.model}
        <div class="modal-record">
          <div>
            <p class="title">{model.name}</p>
            <p class="text">{model.description || '3D Model'}</p>
            <p class="model-info">
              Scale: {model.transform.scale}x | 
              Height: {model.transform.height}m | 
              Source: {model.source}
            </p>
          </div>
          <div>
            <p class="created">CREATED {formatTimestamp(model.timestamp)}</p>
            <p>
              <GlassmorphismButton 
                variant="primary" 
                onClick={() => handleModelEdit(model)}
              >
                EDIT MODEL
              </GlassmorphismButton>
            </p>
            <p>
              <GlassmorphismButton 
                variant="danger" 
                onClick={() => handleModelRemove(model)}
              >
                REMOVE MODEL
              </GlassmorphismButton>
            </p>
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
    top: 80px;
    left: 10px;
    z-index: 50;
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
      left: 10px;
      right: 10px;
      max-height: 50vh;
    }
  }

  /* Modal content styles */
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
