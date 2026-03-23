<script lang="ts">
  import { openModals, hideModal } from '../utils/modalManager';
  import Modal from './Modal.svelte';
  import Editor from '../appmenu/Editor.svelte';
  import Simulation from '../appmenu/Simulation.svelte';
  import Omnipedia from '../appmenu/Omnipedia.svelte';
  import MissionTV from '../appmenu/MissionTV.svelte';
  import Download from '../appmenu/Download.svelte';
  // @ts-ignore Svelte component default export is provided by the Svelte compiler
  import LayersMenu from '../appmenu/LayersMenu.svelte';
  import GigEconomy from '../appmenu/GigEconomy.svelte';
  import OperatorAgreement from './OperatorAgreement.svelte';
  import About from './About.svelte';
  import Mission from './Mission.svelte';
  import Missions from './Missions.svelte';
  import SwarmGovernance from '../appmenu/SwarmGovernance.svelte';
  import MissionCard from '../appmenu/MissionCard.svelte';
  import OmnipediaEditor from '../appmenu/OmnipediaEditor.svelte';
  import { formatTimestamp } from '../utils/timeUtils';
  import { removeModel } from '../utils/modelUtils';
  import { logger } from '../utils/logger';
  import { modelEditorService } from '../utils/modelEditorService';
  import { modalService } from '../utils/modalService';
  import GlassmorphismButton from './GlassmorphismButton.svelte';
  import { gigCanClose } from '../store';

  const CARD_MODALS = new Set(['model-editor', 'gig-economy']);
  const NOTIFICATION_MODALS = new Set(['zoom-required']);

  const MODAL_TITLES: Record<string, string> = {
    about: 'ABOUT',
    simulation: 'SIMULATION',
    mission: 'MISSION',
    'swarm-governance': 'SWARM GOVERNANCE',
    'mission-2': 'MISSION 2',
    'omnipedia-editor': 'MISSION',
    'mission-log': 'LOG',
    omnipedia: 'OMNIPEDIA',
    'mission-tv': 'MISSION TV',
    download: 'DOWNLOAD',
    'operator-agreement': 'OPERATOR AGREEMENT',
  };

  /** Fixed z-index per modal id (not derived from open order). */
  const MODAL_Z_INDEX: Record<string, number> = {
    'model-details': 1000,
    about: 1000,
    simulation: 1000,
    omnipedia: 1000,
    'mission-tv': 1000,
    download: 1000,
    'layers-menu': 1000,
    'zoom-required': 1000,
    'mission-log': 1000,
    mission: 1000,
    'mission-2': 1000,
    'swarm-governance': 1100,
    'omnipedia-editor': 1000,
    'operator-agreement': 3000,
  };

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

  function handleSelectMission(index: 1 | 2 | 3) {
    if (index === 1) modalService.showMission();
    if (index === 2) modalService.showMission2();
    if (index === 3) modalService.showOmnipediaEditor();
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
      onClose={() => { if (modal.id === 'about') localStorage.setItem('welcomeMessageDismissed', 'true'); hideModal(modal.id); }}
      title={MODAL_TITLES[modal.id] ?? ''}
      maxWidth={modal.id === 'mission' || modal.id === 'swarm-governance' || modal.id === 'omnipedia-editor' ? '100%' : modal.id === 'mission-2' || modal.id === 'operator-agreement' || modal.id === 'about' ? '720px' : NOTIFICATION_MODALS.has(modal.id) ? '400px' : '600px'}
      zIndex={MODAL_Z_INDEX[modal.id] ?? 1000}
      showCloseButton={modal.id !== 'layers-menu' && !NOTIFICATION_MODALS.has(modal.id) && modal.id !== 'operator-agreement' && modal.id !== 'mission-log'}
      showTopHeader={modal.id !== 'layers-menu'}
      topHeaderTransparent={modal.id === 'mission-log'}
      closeOnBackdropClick={modal.id !== 'layers-menu' && !NOTIFICATION_MODALS.has(modal.id) && modal.id !== 'operator-agreement'}
      modalType={
        modal.id === 'mission' || modal.id === 'swarm-governance' || modal.id === 'mission-2' || modal.id === 'omnipedia-editor'
          ? 'mission'
          : modal.id === 'layers-menu'
            ? 'overlay'
            : NOTIFICATION_MODALS.has(modal.id)
              ? 'notification'
              : 'default'
      }
      customClass={
        modal.id === 'layers-menu'
          ? 'layers-menu-modal'
          : modal.id === 'mission-log'
            ? 'missions'
            : ''
      }
      forwardInputs={NOTIFICATION_MODALS.has(modal.id)}
    >
      {#if modal.id === 'model-details' && modal.data?.model}
        {@const model = modal.data.model}
        <div class="modal-record">
          <p class="title">{model.name}</p>
          <p class="text">{model.description || '3D Model'}</p>

          <div class="info-grid">
            <span class="info-label">Scale</span>
            <span class="info-value">{model.transform.scale}x</span>
            <span class="info-label">Height</span>
            <span class="info-value">{model.transform.height}m</span>
            <span class="info-label">Source</span>
            <span class="info-value">{model.source}</span>
            {#if model.behavior}
              <span class="info-label">Behavior</span>
              <span class="info-value behavior-tag {model.behavior.type}">
                {#if model.behavior.type === 'herd'}
                  Herd · {model.behavior.count} members · {model.behavior.motionPattern}
                {:else if model.behavior.type === 'path'}
                  Path · {model.behavior.waypoints.length} waypoints{model.behavior.loop ? ' · loop' : ''}
                {:else if model.behavior.type === 'roam'}
                  Roam · {model.behavior.speed} m/s
                {:else if model.behavior.type === 'orbit'}
                  Orbit · r {model.behavior.radius}m · {model.behavior.speed} m/s
                {:else if model.behavior.type === 'follow'}
                  Follow · {model.behavior.speed} m/s
                {/if}
              </span>
            {/if}
          </div>

          <p class="created">CREATED {formatTimestamp(model.timestamp)}</p>

          <div class="actions">
            <GlassmorphismButton variant="primary" onClick={() => handleModelEdit(model)}>EDIT MODEL</GlassmorphismButton>
            <GlassmorphismButton variant="danger" onClick={() => handleModelRemove(model)}>REMOVE MODEL</GlassmorphismButton>
          </div>
        </div>
      {:else if modal.id === 'simulation'}
        <Simulation />
      {:else if modal.id === 'omnipedia'}
        <Omnipedia />
      {:else if modal.id === 'mission-tv'}
        <MissionTV />
      {:else if modal.id === 'download'}
        <Download />
      {:else if modal.id === 'layers-menu'}
        <LayersMenu />
      {:else if modal.id === 'zoom-required'}
        <p>Zoom in closer to pick a precise location.</p>
      {:else if modal.id === 'about'}
        <About />
      {:else if modal.id === 'mission-log'}
        <Missions onSelectMission={handleSelectMission} />
      {:else if modal.id === 'mission'}
        <Mission />
      {:else if modal.id === 'swarm-governance'}
        <SwarmGovernance />
      {:else if modal.id === 'mission-2'}
        <MissionCard
          mission={null}
          viewerPubkey="demo"
          onCommit={async () => modalService.hideMission2()}
        />
      {:else if modal.id === 'omnipedia-editor'}
        <OmnipediaEditor />
      {:else if modal.id === 'operator-agreement'}
        <OperatorAgreement onAccept={() => { localStorage.setItem('operatorAgreementAccepted', 'true'); hideModal('operator-agreement'); }} />
      {/if}
    </Modal>
  {/if}
{/each}

<style>
  .modal-card-container {
    position: contents;
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
    gap: 0.25rem;
    padding: 1.25rem;
  }

  .modal-record .title {
    font-size: 1.3rem;
    font-weight: 600;
    margin: 0;
    color: rgba(255, 255, 255, 0.95);
  }

  .modal-record .text {
    font-size: 0.95rem;
    margin: 0 0 0.75rem 0;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.4;
  }

  .modal-record .info-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.35rem 0.75rem;
    margin-bottom: 0.75rem;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-record .info-label {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .modal-record .info-value {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.85);
    font-weight: 500;
  }

  .modal-record .behavior-tag {
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .modal-record .behavior-tag.herd   { background: rgba(34, 197, 94, 0.2); color: #86efac; }
  .modal-record .behavior-tag.path   { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
  .modal-record .behavior-tag.roam   { background: rgba(234, 179, 8, 0.2); color: #fde68a; }
  .modal-record .behavior-tag.orbit  { background: rgba(168, 85, 247, 0.2); color: #d8b4fe; }
  .modal-record .behavior-tag.follow { background: rgba(236, 72, 153, 0.2); color: #f9a8d4; }

  .modal-record .created {
    font-size: 0.75rem;
    margin: 0;
    color: rgba(255, 255, 255, 0.35);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .modal-record .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .modal-record p {
    margin: 0.25rem 0;
  }
</style>
