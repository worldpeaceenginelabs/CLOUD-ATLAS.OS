<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { logger } from '../utils/logger';
  import Brainstorming from './Brainstorming.svelte';
  import Simulation from './Simulation.svelte';
  import ActionEvent from './ActionEvent.svelte';
  import Petition from './Petition.svelte';
  import Crowdfunding from './Crowdfunding.svelte';
  import Modal from '../components/Modal.svelte';
  
  import { coordinates, isZoomModalVisible, lastTriggeredModal, models } from '../store';
  import type { ModelData } from '../types';
  import { dataManager } from '../dataManager';
  import { addModel, updateModel } from '../utils/modelUtils';
  import { modalService } from '../utils/modalService';

  // Props - removed toggleModelUI as it's handled internally now
  export const addPreviewModelToScene: ((modelData: any) => void) | undefined = undefined;
  export const removePreviewModelFromScene: (() => void) | undefined = undefined;
  export const updatePreviewModelInScene: ((modelData: any) => void) | undefined = undefined;
  export let onAddModel: (() => void) | undefined = undefined;

  // Component state
  let isDropdownVisible = false;
  let hoveredItem = '';
  let hoveredSubmenuItem = '';
  let showInfoPanel = false;
  let infoPanelContent = '';
  let touchStartTime = 0;

  // Coordinate state
  let hasCoordinates = false;

  // Reactive statement to check if coordinates are available
  $: {
    hasCoordinates = $coordinates.latitude !== '' && $coordinates.longitude !== '';
  }

  // Modal states - now managed by modal service
  let showActionDropdown = false;

  // Toggle dropdown
  function toggleDropdown() {
    isDropdownVisible = !isDropdownVisible;
    if (!isDropdownVisible) {
      hoveredItem = '';
      hoveredSubmenuItem = '';
      showInfoPanel = false;
      showActionDropdown = false;
    }
  }

  // Close menu (exported for external use)
  export function closeMenu() {
    isDropdownVisible = false;
    hoveredItem = '';
    hoveredSubmenuItem = '';
    showInfoPanel = false;
    showActionDropdown = false;
  }

  // Handle info icon click
  function handleInfoClick(item: string, event: Event) {
    event.stopPropagation();
    
    // If clicking the same item that's already showing, toggle off
    if (showInfoPanel && hoveredItem === item) {
      showInfoPanel = false;
      hoveredItem = '';
      hoveredSubmenuItem = '';
      return;
    }
    
    // Otherwise, show the info panel for this item
    hoveredItem = item;
    hoveredSubmenuItem = '';
    showInfoPanel = true;
    
    // Set info panel content based on item
    switch (item) {
      case 'model':
        infoPanelContent = 'Add 3D models to the map. Upload GLTF files or provide URLs to place interactive 3D objects at specific locations.';
        break;
      case 'brainstorming':
        infoPanelContent = 'Flip the script on every bad news! Take every flood, fire, drought, blackout, eviction, protest, injustice, crisis, or failure—or any everyday issue, whether local or global—and turn it into a public brainstorm. Open to everyone, including entrepreneurs, to brainstorm their own challenges and co-create innovative products, services, and solutions. Collaborate with people from all walks of life to address both real-world problems and business opportunities, locally and globally.';
        break;
      case 'simulation':
        infoPanelContent = 'Run simulations and scenarios on the map. Visualize what does not fit into words.';
        break;
      case 'action':
        infoPanelContent = 'Organize real-world actions and events. Create meetups, petitions, and crowdfunding campaigns to make a difference.';
        break;
    }
  }

  // Handle submenu info icon click
  function handleSubmenuInfoClick(item: string, event: Event) {
    event.stopPropagation();
    
    // If clicking the same submenu item that's already showing, toggle off
    if (showInfoPanel && hoveredSubmenuItem === item) {
      showInfoPanel = false;
      hoveredItem = '';
      hoveredSubmenuItem = '';
      return;
    }
    
    // Otherwise, show the info panel for this submenu item
    hoveredSubmenuItem = item;
    hoveredItem = '';
    showInfoPanel = true;
    
    // Set info panel content based on submenu item
    switch (item) {
      case 'actionevent':
        infoPanelContent = 'MeetandDo - From idea to impact—organize real-world missions with local teams. Rally your community, show up, and take action where it counts.';
        break;
      case 'petition':
        infoPanelContent = 'Petition - Make your voice count. Push for change, win approvals, and unlock collective power to reshape spaces, systems, and policies.';
        break;
      case 'crowdfunding':
        infoPanelContent = 'Crowdfunding - Fuel your mission. Raise the resources to launch your project and solutions—and turn bold ideas into real-world transformations.';
        break;
    }
  }

  // Show coordinate picker modal
  function showCoordinatePickerMessage() {
    modalService.showCoordinatePicker();
    lastTriggeredModal.set('pick');
    // Auto-hide after 3 seconds
    setTimeout(() => {
      modalService.hideCoordinatePicker();
    }, 3000);
  }

  // Handle item click
  function handleItemClick(item: string) {
    logger.debug('Clicked item: ' + item, { component: 'AddButton', operation: 'handleItemClick' });
    // Close info panel when clicking on touch devices
    showInfoPanel = false;
    hoveredItem = '';
    hoveredSubmenuItem = '';
    
    // Check if coordinates are available for main menu items (not submenu)
    if (!hasCoordinates && item !== 'action') {
      showCoordinatePickerMessage();
      return;
    }
    
    switch (item) {
      case 'model':
        if (onAddModel) {
          onAddModel();
        }
        break;
      case 'brainstorming':
        modalService.showBrainstorming();
        // Don't close menu - let user decide when to close it
        break;
      case 'simulation':
        modalService.showSimulation();
        // Don't close menu - let user decide when to close it
        break;
      case 'action':
        logger.debug('Toggling action dropdown: ' + showActionDropdown, { component: 'AddButton', operation: 'toggleActionDropdown' });
        showActionDropdown = !showActionDropdown;
        break;
    }
  }

  // Close modals - now handled by modal service
  function closeActionDropdown() {
    showActionDropdown = false;
  }

  // Handle action submenu clicks
  function handleActionClick(actionType: string) {
    // Close info panel when clicking on touch devices
    showInfoPanel = false;
    hoveredItem = '';
    hoveredSubmenuItem = '';
    
    // Check if coordinates are available for submenu items
    if (!hasCoordinates) {
      showCoordinatePickerMessage();
      return;
    }
    
    switch (actionType) {
      case 'actionevent':
        modalService.showActionEvent();
        // Don't close submenu - let user decide when to close it
        break;
      case 'petition':
        modalService.showPetition();
        // Don't close submenu - let user decide when to close it
        break;
      case 'crowdfunding':
        modalService.showCrowdfunding();
        // Don't close submenu - let user decide when to close it
        break;
    }
  }

  // Close action modals - now handled by modal service


  // Model operations now use centralized utilities from modelUtils.ts

  // Handle escape key
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      isDropdownVisible = false;
      showActionDropdown = false;
      hoveredItem = '';
      hoveredSubmenuItem = '';
      showInfoPanel = false;
      // Close all modals via modal service
      modalService.closeAllModals();
    }
  }


  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  onDestroy(() => {
    // Remove event listeners
    window.removeEventListener('keydown', handleKeyDown);
    
    // Reset component state
    isDropdownVisible = false;
    hoveredItem = '';
    hoveredSubmenuItem = '';
    showInfoPanel = false;
    infoPanelContent = '';
    
    // Reset modal states
    showActionDropdown = false;
  });
</script>

<div class="add-button-container">
  <!-- Main Add Button -->
  <button 
    class="add-button" 
    on:click={toggleDropdown}
    class:active={isDropdownVisible}
    class:has-coordinates={hasCoordinates}
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>
    Add
    {#if hasCoordinates}
      <div class="coordinate-indicator">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 10C21 17 12 23 12 23S3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.3639 3.63604C20.0518 5.32387 21 7.61305 21 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    {/if}
  </button>

  <!-- Blue Container -->
  {#if isDropdownVisible}
    <div class="blue-container" transition:slide={{ duration: 500, axis: 'y' }}>
      <!-- Red Container (Main Dropdown Menu) -->
      <div class="dropdown-menu">
        <div 
          class="dropdown-item" 
          role="button"
          tabindex="0"
          on:click={() => handleItemClick('model')}
          on:keydown={(e) => e.key === 'Enter' && handleItemClick('model')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          </svg>
          <span class="item-text">Add Model</span>
          <button 
            class="info-icon" 
            class:active={showInfoPanel && hoveredItem === 'model'}
            on:click={(e) => handleInfoClick('model', e)}
            on:keydown={(e) => e.key === 'Enter' && handleInfoClick('model', e)}
            tabindex="0"
            aria-label="Show info for Add Model"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div 
          class="dropdown-item" 
          role="button"
          tabindex="0"
          on:click={() => handleItemClick('brainstorming')}
          on:keydown={(e) => e.key === 'Enter' && handleItemClick('brainstorming')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 18h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M10 22h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="item-text">Add Brainstorming</span>
          <button 
            class="info-icon" 
            class:active={showInfoPanel && hoveredItem === 'brainstorming'}
            on:click={(e) => handleInfoClick('brainstorming', e)}
            on:keydown={(e) => e.key === 'Enter' && handleInfoClick('brainstorming', e)}
            tabindex="0"
            aria-label="Show info for Add Brainstorming"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div 
          class="dropdown-item" 
          role="button"
          tabindex="0"
          on:click={() => handleItemClick('simulation')}
          on:keydown={(e) => e.key === 'Enter' && handleItemClick('simulation')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="item-text">Add Simulation</span>
          <button 
            class="info-icon" 
            class:active={showInfoPanel && hoveredItem === 'simulation'}
            on:click={(e) => handleInfoClick('simulation', e)}
            on:keydown={(e) => e.key === 'Enter' && handleInfoClick('simulation', e)}
            tabindex="0"
            aria-label="Show info for Add Simulation"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div 
          class="dropdown-item action-item-container" 
          role="button"
          tabindex="0"
          on:click={() => handleItemClick('action')}
          on:keydown={(e) => e.key === 'Enter' && handleItemClick('action')}
        >
          <div 
            class="action-item-content"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="4.5" r="2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="m10.2 6.3-3.9 3.9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="4.5" cy="12" r="2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="19.5" cy="12" r="2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="m13.8 17.7 3.9-3.9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="19.5" r="2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="item-text">Add Action</span>
          </div>
          <button 
            class="info-icon" 
            class:active={showInfoPanel && hoveredItem === 'action'}
            on:click={(e) => handleInfoClick('action', e)}
            on:keydown={(e) => e.key === 'Enter' && handleInfoClick('action', e)}
            tabindex="0"
            aria-label="Show info for Add Action"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Yellow Container (Action Dropdown) -->
      {#if showActionDropdown}
        <div class="action-dropdown" transition:slide={{ duration: 500, axis: 'y' }}>
          <div 
            class="dropdown-item" 
            role="button"
            tabindex="0"
            on:click={() => handleActionClick('actionevent')}
            on:keydown={(e) => e.key === 'Enter' && handleActionClick('actionevent')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45768C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="item-text">MeetandDo</span>
            <button 
              class="info-icon" 
              class:active={showInfoPanel && hoveredSubmenuItem === 'actionevent'}
              on:click={(e) => handleSubmenuInfoClick('actionevent', e)}
              on:keydown={(e) => e.key === 'Enter' && handleSubmenuInfoClick('actionevent', e)}
              tabindex="0"
              aria-label="Show info for MeetandDo"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div 
            class="dropdown-item" 
            role="button"
            tabindex="0"
            on:click={() => handleActionClick('petition')}
            on:keydown={(e) => e.key === 'Enter' && handleActionClick('petition')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="8" height="4" x="8" y="2" rx="1" ry="1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span class="item-text">Petition</span>
            <button 
              class="info-icon" 
              class:active={showInfoPanel && hoveredSubmenuItem === 'petition'}
              on:click={(e) => handleSubmenuInfoClick('petition', e)}
              on:keydown={(e) => e.key === 'Enter' && handleSubmenuInfoClick('petition', e)}
              tabindex="0"
              aria-label="Show info for Petition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div 
            class="dropdown-item" 
            role="button"
            tabindex="0"
            on:click={() => handleActionClick('crowdfunding')}
            on:keydown={(e) => e.key === 'Enter' && handleActionClick('crowdfunding')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M8 8h8M8 12h8M8 16h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span class="item-text">Crowdfunding</span>
            <button 
              class="info-icon" 
              class:active={showInfoPanel && hoveredSubmenuItem === 'crowdfunding'}
              on:click={(e) => handleSubmenuInfoClick('crowdfunding', e)}
              on:keydown={(e) => e.key === 'Enter' && handleSubmenuInfoClick('crowdfunding', e)}
              tabindex="0"
              aria-label="Show info for Crowdfunding"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Info Panel -->
  {#if showInfoPanel && infoPanelContent}
    <div class="info-panel slide-in">
      <div class="info-content">
        {infoPanelContent}
      </div>
    </div>
  {/if}
</div>

<!-- All modals are now handled by the centralized ModalManager component -->


<style>
  .add-button-container {
    position: fixed;
    top: 20px;
    right: 10px;
    z-index: 50;
    display: inline-block;
  }

  .add-button {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 10px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 8px;
    position: relative;
    z-index: 50;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
  }

  .add-button:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
  }

  .add-button.active {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
  }

  .add-button.has-coordinates {
    background: rgba(74, 222, 128, 0.2);
    border-color: rgba(74, 222, 128, 0.4);
  }

  .add-button.has-coordinates:hover {
    background: rgba(74, 222, 128, 0.3);
    border-color: rgba(74, 222, 128, 0.5);
  }

  .add-button svg {
    width: 20px;
    height: 20px;
  }

  .coordinate-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
    color: #4ade80;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.1);
    }
  }

  .blue-container {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 60;
  }

  .dropdown-menu {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    overflow: hidden;
    min-width: 250px;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
  }

  .dropdown-item:last-child {
    border-bottom: none;
  }

  .dropdown-item:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateX(-4px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
  }

  .dropdown-item svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .item-text {
    flex: 1;
    text-align: left;
  }

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
  }

  .info-icon:hover {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    color: white;
    transform: scale(1.1);
  }

  .info-icon.active {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
    color: white;
    transform: scale(1.05);
  }

  .info-icon:focus {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
  }

  .info-icon svg {
    width: 16px;
    height: 16px;
  }

  .action-item-container {
    position: relative;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-item-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .action-dropdown {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    overflow: hidden;
    min-width: 250px;
  }

  .info-panel {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 70;
    max-width: 300px;
    min-width: 250px;
    opacity: 0;
    transition: all 0.3s ease;
  }

  .info-panel.slide-in {
    transform: translate(-50%, -50%);
    opacity: 1;
  }

  .info-content {
    padding: 16px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.5;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .info-panel {
      max-width: 250px;
      min-width: 200px;
    }

    .info-content {
      font-size: 13px;
      padding: 12px;
    }

    .dropdown-menu {
      min-width: 220px;
    }

    .dropdown-item {
      padding: 10px 12px;
      font-size: 13px;
    }
  }
</style>