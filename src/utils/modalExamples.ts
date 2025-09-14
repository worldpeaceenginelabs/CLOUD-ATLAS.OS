/**
 * Modal System Usage Examples
 * Demonstrates how to use the new centralized modal management system
 */

import { modalService } from './modalService';
import type { ModelData, PinData } from '../types';

// Example 1: Basic modal operations
export function basicModalExamples() {
  // Show a modal
  modalService.showBrainstorming();
  
  // Hide a modal
  modalService.hideBrainstorming();
  
  // Toggle a modal
  modalService.toggleModal('brainstorming');
  
  // Close all modals
  modalService.closeAllModals();
}

// Example 2: Modal with data
export function modalWithDataExamples() {
  const modelData: ModelData = {
    id: 'example-model',
    name: 'Example Model',
    description: 'This is an example model',
    coordinates: { latitude: 40.7128, longitude: -74.0060 },
    transform: { scale: 1.0, height: 0, heading: 0, pitch: 0, roll: 0, heightOffset: 0 },
    source: 'url',
    url: 'https://example.com/model.gltf',
    timestamp: new Date().toISOString()
  };

  const pinData: PinData = {
    mapid: 'example-pin',
    latitude: '40.7128',
    longitude: '-74.0060',
    category: 'brainstorming',
    title: 'Example Pin',
    text: 'This is an example pin',
    link: 'https://example.com',
    timestamp: new Date().toISOString(),
    height: 0
  };

  // Show modals with data
  modalService.showModelDetails(modelData);
  modalService.showRecordDetails(pinData);
}

// Example 3: Modal navigation
export function modalNavigationExamples() {
  // Navigate back in modal history
  modalService.goBack();
  
  // Navigate forward in modal history
  modalService.goForward();
}

// Example 4: Modal state checking
export function modalStateExamples() {
  // Check if a modal is open
  const isBrainstormingOpen = modalService.isModalOpen('brainstorming');
  console.log('Brainstorming modal is open:', isBrainstormingOpen);
  
  // Get modal data
  const modelData = modalService.getModalData('model-details');
  console.log('Model data:', modelData);
  
  // Update modal data
  modalService.updateModalData('model-details', { newData: 'updated' });
}

// Example 5: Event handling
export function modalEventExamples() {
  // Listen for modal events
  modalService.onModalOpen((modalId: string) => {
    console.log('Modal opened:', modalId);
  });
  
  modalService.onModalClose((modalId: string) => {
    console.log('Modal closed:', modalId);
  });
  
  modalService.onAllModalsClose(() => {
    console.log('All modals closed');
  });
}

// Example 6: Custom modal registration
export function customModalExamples() {
  // Register a custom modal (this would typically be done in modalManager.ts)
  // modalManager.registerModal({
  //   id: 'custom-modal',
  //   type: 'default',
  //   title: 'Custom Modal',
  //   maxWidth: '800px'
  // });
  
  // Show custom modal
  modalService.showModal('custom-modal', { customData: 'example' });
}

// Example 7: Modal workflow
export function modalWorkflowExample() {
  // Show a series of modals in sequence
  modalService.showBrainstorming();
  
  // After user interaction, show next modal
  setTimeout(() => {
    modalService.hideBrainstorming();
    modalService.showActionEvent();
  }, 2000);
  
  // After another interaction, show final modal
  setTimeout(() => {
    modalService.hideActionEvent();
    modalService.showPetition();
  }, 4000);
}
