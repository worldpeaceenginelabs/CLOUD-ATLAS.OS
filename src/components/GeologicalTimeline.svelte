<script lang="ts">
    import { currentEpoch, epochs, type Epoch } from '../store';
    
    let showDropdown = false;
    let selectedEpochIndex = 0;
    
    // Update selected index when epoch changes
    $: {
      const index = epochs.findIndex(e => e.age === $currentEpoch.age);
      if (index !== -1) {
        selectedEpochIndex = index;
      }
    }
    
    function handleEpochChange(index: number) {
      selectedEpochIndex = index;
      currentEpoch.set(epochs[index]);
      showDropdown = false;
    }
    
    function handleSliderChange(event: Event) {
      const target = event.target as HTMLInputElement;
      const index = parseInt(target.value);
      handleEpochChange(index);
    }
    
    function formatEpochLabel(epoch: Epoch): string {
      if (epoch.age === 0) return 'Present Day';
      return `${epoch.age} Million Years Ago`;
    }
  </script>
  
  <div class="timeline-container">
    <!-- Dropdown Button -->
    <button 
      class="dropdown-trigger" 
      on:click={() => showDropdown = !showDropdown}
      aria-label="Select geological epoch"
    >
      <span class="epoch-label">{formatEpochLabel($currentEpoch)}</span>
      <svg 
        class="dropdown-arrow" 
        class:rotated={showDropdown} 
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M18 15L12 9L6 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    
    <!-- Dropdown Menu -->
    {#if showDropdown}
      <div class="dropdown-content">
        {#each epochs as epoch, index}
          <button
            class="epoch-option"
            class:active={index === selectedEpochIndex}
            on:click={() => handleEpochChange(index)}
          >
            {formatEpochLabel(epoch)}
          </button>
        {/each}
      </div>
    {/if}
    
    <!-- Slider -->
    <div class="slider-container">
      <input
        type="range"
        min="0"
        max={epochs.length - 1}
        value={selectedEpochIndex}
        on:input={handleSliderChange}
        class="epoch-slider"
        aria-label="Geological timeline slider"
      />
      <div class="slider-labels">
        <span>Present</span>
        <span>600 Ma</span>
      </div>
    </div>
  </div>
  
  <style>
    .timeline-container {
      position: absolute;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 16px;
      min-width: 280px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    .dropdown-trigger {
      width: 100%;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 12px 16px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: all 0.3s ease;
      margin-bottom: 16px;
    }
    
    .dropdown-trigger:hover {
      background: rgba(255, 255, 255, 0.15);
    }
    
    .epoch-label {
      flex: 1;
      text-align: left;
    }
    
    .dropdown-arrow {
      transition: transform 0.3s ease;
      color: rgba(255, 255, 255, 0.8);
    }
    
    .dropdown-arrow.rotated {
      transform: rotate(180deg);
    }
    
    .dropdown-content {
      background: rgba(0, 0, 0, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      max-height: 300px;
      overflow-y: auto;
      margin-bottom: 16px;
    }
    
    .epoch-option {
      width: 100%;
      padding: 10px 16px;
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      text-align: left;
      cursor: pointer;
      transition: all 0.2s ease;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .epoch-option:last-child {
      border-bottom: none;
    }
    
    .epoch-option:hover {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }
    
    .epoch-option.active {
      background: rgba(66, 133, 244, 0.3);
      color: white;
      font-weight: 600;
    }
    
    .slider-container {
      margin-top: 8px;
    }
    
    .epoch-slider {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.2);
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      cursor: pointer;
    }
    
    .epoch-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #4285F4;
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    
    .epoch-slider::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #4285F4;
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    
    .slider-labels {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
    }
    
    /* Scrollbar styling for dropdown */
    .dropdown-content::-webkit-scrollbar {
      width: 8px;
    }
    
    .dropdown-content::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }
    
    .dropdown-content::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 4px;
    }
    
    .dropdown-content::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }
  </style>