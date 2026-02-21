<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { logger } from '../utils/logger';
  
  import { coordinates, lastTriggeredModal, isVisible } from '../store';
  import { modalService } from '../utils/modalService';

  // Props
  export let onAddModel: (() => void) | undefined = undefined;

  // Component state
  let coordinatePickerTimer: ReturnType<typeof setTimeout> | null = null;
  let isDropdownVisible = false;
  let hoveredItem = '';
  let showInfoPanel = false;
  let infoPanelContent = '';

  // Coordinate state
  let hasCoordinates = false;

  // Reactive statement to check if coordinates are available
  $: {
    hasCoordinates = $coordinates.latitude !== '' && $coordinates.longitude !== '';
  }

  // Toggle dropdown
  function toggleDropdown() {
    isDropdownVisible = !isDropdownVisible;
    if (!isDropdownVisible) {
      hoveredItem = '';
      showInfoPanel = false;
    }
  }

  // Close menu (exported for external use)
  export function closeMenu() {
    isDropdownVisible = false;
    hoveredItem = '';
    showInfoPanel = false;
  }

  // Handle info icon click
  function handleInfoClick(item: string, event: Event) {
    event.stopPropagation();
    
    // If clicking the same item that's already showing, toggle off
    if (showInfoPanel && hoveredItem === item) {
      showInfoPanel = false;
      hoveredItem = '';
      return;
    }
    
    // Otherwise, show the info panel for this item
    hoveredItem = item;
    showInfoPanel = true;
    
    // Set info panel content based on item
    switch (item) {
      case 'model':
        infoPanelContent = 'Add 3D models to the map. Upload GLTF files or provide URLs to place interactive 3D objects at specific locations.';
        break;
      case 'simulation':
        infoPanelContent = 'Run simulations and scenarios on the map. Visualize what does not fit into words.';
        break;
    }
  }

  // Show coordinate picker modal
  function showCoordinatePickerMessage() {
    modalService.showCoordinatePicker();
    lastTriggeredModal.set('pick');
    // Clear any existing timer before starting a new one
    if (coordinatePickerTimer) clearTimeout(coordinatePickerTimer);
    // Auto-hide after 3 seconds
    coordinatePickerTimer = setTimeout(() => {
      modalService.hideCoordinatePicker();
      coordinatePickerTimer = null;
    }, 3000);
  }

  // Handle item click
  function handleItemClick(item: string) {
    logger.debug('Clicked item: ' + item, { component: 'AddButton', operation: 'handleItemClick' });
    showInfoPanel = false;
    hoveredItem = '';
    
    if (!hasCoordinates) {
      showCoordinatePickerMessage();
      return;
    }
    
    switch (item) {
      case 'model':
        if (onAddModel) {
          onAddModel();
        }
        break;
      case 'simulation':
        modalService.showSimulation();
        break;
    }
  }

  function toggleAbout() {
    isVisible.update(v => !v);
    closeMenu();
  }

  function openLiveEdit() {
    closeMenu();
    const newWindow = window.open(
      'https://stackblitz.com/github/worldpeaceenginelabs/CLOUD-ATLAS-OS/tree/main?file=src/DAPPS/HomeScreen.svelte:L294',
      '_blank',
      `width=${window.screen.width},height=${window.screen.height}`
    );
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      alert('The popup was blocked. Please disable your popup blocker for this site to continue.');
    }
  }

  // Handle escape key
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      isDropdownVisible = false;
      hoveredItem = '';
      showInfoPanel = false;
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
    // Clear pending timers
    if (coordinatePickerTimer) clearTimeout(coordinatePickerTimer);
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

      </div>

      <!-- Separator + Utility Items -->
      <div class="utility-menu">
        <div 
          class="dropdown-item"
          role="button"
          tabindex="0"
          on:click={toggleAbout}
          on:keydown={(e) => e.key === 'Enter' && toggleAbout()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="item-text">About</span>
        </div>

        <div 
          class="dropdown-item"
          role="button"
          tabindex="0"
          on:click={openLiveEdit}
          on:keydown={(e) => e.key === 'Enter' && openLiveEdit()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="item-text">Live Edit</span>
        </div>
      </div>
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

  .utility-menu {
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