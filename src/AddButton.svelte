<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import UI from './UI.svelte';
  import Brainstorming from './Brainstorming.svelte';
  import Simulation from './Simulation.svelte';
  import ActionEvent from './ActionEvent.svelte';
  import Petition from './Petition.svelte';
  import Crowdfunding from './Crowdfunding.svelte';

  // Component state
  let isDropdownVisible = false;
  let hoveredItem = '';
  let hoveredSubmenuItem = '';
  let showInfoPanel = false;
  let infoPanelContent = '';
  let uiComponent: UI | null = null;

  // Modal states
  let showBrainstormingModal = false;
  let showSimulationModal = false;
  let showActionDropdown = false;
  let showActionEventModal = false;
  let showPetitionModal = false;
  let showCrowdfundingModal = false;

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

  // Handle item hover
  function handleItemHover(item: string) {
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
        infoPanelContent = 'Run simulations and scenarios on the map. Test different parameters and see how they affect the virtual environment.';
        break;
      case 'action':
        infoPanelContent = 'Organize real-world actions and events. Create meetups, petitions, and crowdfunding campaigns to make a difference.';
        break;
    }
  }

  // Handle submenu item hover
  function handleSubmenuItemHover(item: string) {
    hoveredSubmenuItem = item;
    hoveredItem = '';
    showInfoPanel = true;
    
    // Set info panel content based on submenu item
    switch (item) {
      case 'actionevent':
        infoPanelContent = 'MeetandDo - Organize real-world meetups and action events. Coordinate with people in your area to take collective action on local and global issues. Use Telegram\'s live location feature to coordinate up to 200,000 users in real-time on a single map.';
        break;
      case 'petition':
        infoPanelContent = 'Petition - Create and sign petitions to influence decision-makers and bring about change. Gather support for causes you care about and make your voice heard through collective action.';
        break;
      case 'crowdfunding':
        infoPanelContent = 'Crowdfunding - Turn your ideas into reality by raising funds from the community. Launch crowdfunding campaigns for projects, causes, or initiatives that matter to you and others.';
        break;
    }
  }

  // Handle item leave
  function handleItemLeave() {
    hoveredItem = '';
    hoveredSubmenuItem = '';
    showInfoPanel = false;
  }

  // Handle submenu item leave
  function handleSubmenuItemLeave() {
    hoveredSubmenuItem = '';
    showInfoPanel = false;
  }

  // Handle item click
  function handleItemClick(item: string) {
    console.log('Clicked item:', item);
    switch (item) {
      case 'model':
        uiComponent?.toggle();
        isDropdownVisible = false;
        break;
      case 'brainstorming':
        showBrainstormingModal = true;
        isDropdownVisible = false;
        break;
      case 'simulation':
        showSimulationModal = true;
        isDropdownVisible = false;
        break;
      case 'action':
        console.log('Toggling action dropdown:', showActionDropdown);
        showActionDropdown = !showActionDropdown;
        break;
    }
  }

  // Close modals
  function closeBrainstormingModal() {
    showBrainstormingModal = false;
  }

  function closeSimulationModal() {
    showSimulationModal = false;
  }

  function closeActionDropdown() {
    showActionDropdown = false;
  }

  // Handle action submenu clicks
  function handleActionClick(actionType: string) {
    switch (actionType) {
      case 'actionevent':
        showActionEventModal = true;
        showActionDropdown = false;
        break;
      case 'petition':
        showPetitionModal = true;
        showActionDropdown = false;
        break;
      case 'crowdfunding':
        showCrowdfundingModal = true;
        showActionDropdown = false;
        break;
    }
  }

  // Close action modals
  function closeActionEventModal() {
    showActionEventModal = false;
  }

  function closePetitionModal() {
    showPetitionModal = false;
  }

  function closeCrowdfundingModal() {
    showCrowdfundingModal = false;
  }

  // Handle escape key
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      isDropdownVisible = false;
      showBrainstormingModal = false;
      showSimulationModal = false;
      showActionDropdown = false;
      showActionEventModal = false;
      showPetitionModal = false;
      showCrowdfundingModal = false;
      hoveredItem = '';
      hoveredSubmenuItem = '';
      showInfoPanel = false;
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
    uiComponent = null;
    
    // Reset modal states
    showBrainstormingModal = false;
    showSimulationModal = false;
    showActionDropdown = false;
    showActionEventModal = false;
    showPetitionModal = false;
    showCrowdfundingModal = false;
  });
</script>

<div class="add-button-container">
  <!-- Main Add Button -->
  <button 
    class="add-button" 
    on:click={toggleDropdown}
    class:active={isDropdownVisible}
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>
    Add
  </button>

  <!-- Blue Container -->
  {#if isDropdownVisible}
    <div class="blue-container" transition:slide={{ duration: 300, axis: 'y' }}>
      <!-- Red Container (Main Dropdown Menu) -->
      <div class="dropdown-menu">
        <div 
          class="dropdown-item" 
          role="button"
          tabindex="0"
          on:mouseenter={() => handleItemHover('model')}
          on:mouseleave={handleItemLeave}
          on:click={() => handleItemClick('model')}
          on:keydown={(e) => e.key === 'Enter' && handleItemClick('model')}
          class:hovered={hoveredItem === 'model'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          </svg>
          Add Model
        </div>

        <div 
          class="dropdown-item" 
          role="button"
          tabindex="0"
          on:mouseenter={() => handleItemHover('brainstorming')}
          on:mouseleave={handleItemLeave}
          on:click={() => handleItemClick('brainstorming')}
          on:keydown={(e) => e.key === 'Enter' && handleItemClick('brainstorming')}
          class:hovered={hoveredItem === 'brainstorming'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2"/>
          </svg>
          Add Brainstorming
        </div>

        <div 
          class="dropdown-item" 
          role="button"
          tabindex="0"
          on:mouseenter={() => handleItemHover('simulation')}
          on:mouseleave={handleItemLeave}
          on:click={() => handleItemClick('simulation')}
          on:keydown={(e) => e.key === 'Enter' && handleItemClick('simulation')}
          class:hovered={hoveredItem === 'simulation'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Add Simulation
        </div>

        <div 
          class="dropdown-item action-item-container" 
          role="button"
          tabindex="0"
          on:mouseenter={() => handleItemHover('action')}
          on:mouseleave={handleItemLeave}
          on:click={() => handleItemClick('action')}
          on:keydown={(e) => e.key === 'Enter' && handleItemClick('action')}
          class:hovered={hoveredItem === 'action'}
        >
          <div 
            class="action-item-content"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45768C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Add Action
          </div>
        </div>
      </div>

      <!-- Yellow Container (Action Dropdown) -->
      {#if showActionDropdown}
        <div class="action-dropdown" transition:slide={{ duration: 300, axis: 'y' }}>
          <div 
            class="dropdown-item" 
            role="button"
            tabindex="0"
            on:mouseenter={() => handleSubmenuItemHover('actionevent')}
            on:mouseleave={handleSubmenuItemLeave}
            on:click={() => handleActionClick('actionevent')}
            on:keydown={(e) => e.key === 'Enter' && handleActionClick('actionevent')}
            class:hovered={hoveredSubmenuItem === 'actionevent'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45768C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            MeetandDo
          </div>

          <div 
            class="dropdown-item" 
            role="button"
            tabindex="0"
            on:mouseenter={() => handleSubmenuItemHover('petition')}
            on:mouseleave={handleSubmenuItemLeave}
            on:click={() => handleActionClick('petition')}
            on:keydown={(e) => e.key === 'Enter' && handleActionClick('petition')}
            class:hovered={hoveredSubmenuItem === 'petition'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2"/>
            </svg>
            Petition
          </div>

          <div 
            class="dropdown-item" 
            role="button"
            tabindex="0"
            on:mouseenter={() => handleSubmenuItemHover('crowdfunding')}
            on:mouseleave={handleSubmenuItemLeave}
            on:click={() => handleActionClick('crowdfunding')}
            on:keydown={(e) => e.key === 'Enter' && handleActionClick('crowdfunding')}
            class:hovered={hoveredSubmenuItem === 'crowdfunding'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Crowdfunding
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

<!-- Modals -->
<UI bind:this={uiComponent} />

{#if showBrainstormingModal}
  <div class="modal" transition:fade={{ duration: 300 }}>
    <div class="modal-content">
      <div class="close" on:click={closeBrainstormingModal} on:keydown={(e) => e.key === 'Enter' && closeBrainstormingModal()} role="button" tabindex="0">
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
      </div>
      <div class="modal-header">
        <h2>Add Brainstorming</h2>
      </div>
      <Brainstorming />
    </div>
  </div>
{/if}

{#if showSimulationModal}
  <div class="modal" transition:fade={{ duration: 300 }}>
    <div class="modal-content">
      <div class="close" on:click={closeSimulationModal} on:keydown={(e) => e.key === 'Enter' && closeSimulationModal()} role="button" tabindex="0">
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
      </div>
      <div class="modal-header">
        <h2>Add Simulation</h2>
      </div>
      <Simulation />
    </div>
  </div>
{/if}

{#if showActionEventModal}
  <div class="modal" transition:fade={{ duration: 300 }}>
    <div class="modal-content">
      <div class="close" on:click={closeActionEventModal} on:keydown={(e) => e.key === 'Enter' && closeActionEventModal()} role="button" tabindex="0">
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
      </div>
      <div class="modal-header">
        <h2>Add Action Event</h2>
      </div>
      <ActionEvent />
    </div>
  </div>
{/if}

{#if showPetitionModal}
  <div class="modal" transition:fade={{ duration: 300 }}>
    <div class="modal-content">
      <div class="close" on:click={closePetitionModal} on:keydown={(e) => e.key === 'Enter' && closePetitionModal()} role="button" tabindex="0">
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
      </div>
      <div class="modal-header">
        <h2>Add Petition</h2>
      </div>
      <Petition />
    </div>
  </div>
{/if}

{#if showCrowdfundingModal}
  <div class="modal" transition:fade={{ duration: 300 }}>
    <div class="modal-content">
      <div class="close" on:click={closeCrowdfundingModal} on:keydown={(e) => e.key === 'Enter' && closeCrowdfundingModal()} role="button" tabindex="0">
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
      </div>
      <div class="modal-header">
        <h2>Add Crowdfunding</h2>
      </div>
      <Crowdfunding />
    </div>
  </div>
{/if}

<style>
  .add-button-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 50;
    display: inline-block;
  }

  .add-button {
    position: relative;
    z-index: 50;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    padding: 12px 16px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .add-button:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
  }

  .add-button.active {
    background: rgba(255, 255, 255, 0.25);
    transform: translateY(-2px);
  }

  .add-button svg {
    width: 20px;
    height: 20px;
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
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    min-width: 200px;
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
  }

  .dropdown-item:last-child {
    border-bottom: none;
  }

  .dropdown-item:hover,
  .dropdown-item.hovered {
    background: rgba(255, 255, 255, 0.2);
    transform: translateX(-4px);
  }

  .dropdown-item svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
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
  }

  .action-dropdown {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    min-width: 200px;
  }

  .info-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 8px 32px rgba(0, 0, 0, 0.3);
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

  /* Modal styles */
  .modal {
    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(5px);
    z-index: 1000;
  }

  .modal-content {
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
    border-radius: 15px;
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 30px;
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

  /* Close button styles */
  .close {
    --size: 22px;
    --borderSize: 2px;
    --borderColor: rgba(255, 255, 255, 1);
    --speed: 0.5s;

    width: var(--size);
    height: var(--size);
    position: absolute;
    top: 15px;
    right: 15px;
    background: #455A64;
    border-radius: 50%;
    box-shadow: 0 0 20px -5px rgba(255, 255, 255, 0.5);
    transition: 0.25s ease-in-out;
    cursor: pointer;
    animation: fade-in-scale-down var(--speed) ease-out 0.25s both;
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
      min-width: 180px;
    }

    .dropdown-item {
      padding: 10px 12px;
      font-size: 13px;
    }
  }
</style>
