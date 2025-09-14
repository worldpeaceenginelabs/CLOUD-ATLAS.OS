/**
 * Centralized Modal Management System for Cloud Atlas OS
 * Provides unified modal state management, stacking, and history
 */

import { writable, derived, type Writable } from 'svelte/store';
import type { ModelData, PinData } from '../types';

// Modal Types
export type ModalType = 'default' | 'notification' | 'overlay' | 'card';

export interface ModalConfig {
  id: string;
  type: ModalType;
  title?: string;
  maxWidth?: string;
  zIndex?: number;
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  transitionDuration?: number;
  customClass?: string;
  forwardInputs?: boolean;
  data?: any;
}

export interface ModalState {
  id: string;
  config: ModalConfig;
  isVisible: boolean;
  timestamp: number;
  zIndex: number;
}

export interface ModalHistory {
  modals: string[];
  currentIndex: number;
}

// Modal Registry - stores all available modal configurations
const modalRegistry = new Map<string, ModalConfig>();

// Modal Stack - manages currently open modals
const modalStack = writable<ModalState[]>([]);

// Modal History - tracks modal navigation
const modalHistory = writable<ModalHistory>({
  modals: [],
  currentIndex: -1
});

// Base z-index for modals
const BASE_Z_INDEX = 1000;
const Z_INDEX_INCREMENT = 10;

// Current z-index counter
let currentZIndex = BASE_Z_INDEX;

// Derived stores
export const openModals = derived(modalStack, $stack => $stack.filter(modal => modal.isVisible));
export const topModal = derived(modalStack, $stack => {
  const visibleModals = $stack.filter(modal => modal.isVisible);
  return visibleModals.length > 0 ? visibleModals[visibleModals.length - 1] : null;
});
export const modalCount = derived(modalStack, $stack => $stack.filter(modal => modal.isVisible).length);

// Modal Manager Class
class ModalManager {
  private static instance: ModalManager;
  private eventListeners: Map<string, (() => void)[]> = new Map();

  private constructor() {
    this.setupKeyboardHandlers();
  }

  static getInstance(): ModalManager {
    if (!ModalManager.instance) {
      ModalManager.instance = new ModalManager();
    }
    return ModalManager.instance;
  }

  /**
   * Register a modal configuration
   */
  registerModal(config: ModalConfig): void {
    modalRegistry.set(config.id, config);
  }

  /**
   * Show a modal
   */
  showModal(modalId: string, data?: any): void {
    const config = modalRegistry.get(modalId);
    if (!config) {
      console.error(`Modal ${modalId} not found in registry`);
      return;
    }

    // Check if modal is already open
    modalStack.update(stack => {
      const existingModal = stack.find(modal => modal.id === modalId);
      if (existingModal && existingModal.isVisible) {
        return stack; // Modal already open
      }

      // Create new modal state
      const modalState: ModalState = {
        id: modalId,
        config: { ...config, data },
        isVisible: true,
        timestamp: Date.now(),
        zIndex: currentZIndex
      };

      // Add to stack
      const newStack = existingModal 
        ? stack.map(modal => modal.id === modalId ? modalState : modal)
        : [...stack, modalState];

      // Update z-index for next modal
      currentZIndex += Z_INDEX_INCREMENT;

      // Add to history
      this.addToHistory(modalId);

      return newStack;
    });
  }

  /**
   * Hide a modal
   */
  hideModal(modalId: string): void {
    modalStack.update(stack => {
      return stack.map(modal => 
        modal.id === modalId 
          ? { ...modal, isVisible: false }
          : modal
      );
    });

    // Remove from history
    this.removeFromHistory(modalId);
  }

  /**
   * Toggle a modal
   */
  toggleModal(modalId: string, data?: any): void {
    modalStack.update(stack => {
      const existingModal = stack.find(modal => modal.id === modalId);
      if (existingModal && existingModal.isVisible) {
        this.hideModal(modalId);
        return stack;
      } else {
        this.showModal(modalId, data);
        return stack;
      }
    });
  }

  /**
   * Close all modals
   */
  closeAllModals(): void {
    modalStack.update(stack => 
      stack.map(modal => ({ ...modal, isVisible: false }))
    );
    this.clearHistory();
  }

  /**
   * Close top modal
   */
  closeTopModal(): void {
    modalStack.update(stack => {
      const visibleModals = stack.filter(modal => modal.isVisible);
      if (visibleModals.length > 0) {
        const topModal = visibleModals[visibleModals.length - 1];
        return stack.map(modal => 
          modal.id === topModal.id 
            ? { ...modal, isVisible: false }
            : modal
        );
      }
      return stack;
    });
  }

  /**
   * Get modal state
   */
  getModalState(modalId: string): ModalState | undefined {
    let modalState: ModalState | undefined;
    modalStack.subscribe(stack => {
      modalState = stack.find(modal => modal.id === modalId);
    })();
    return modalState;
  }

  /**
   * Update modal data
   */
  updateModalData(modalId: string, data: any): void {
    modalStack.update(stack => 
      stack.map(modal => 
        modal.id === modalId 
          ? { ...modal, config: { ...modal.config, data } }
          : modal
      )
    );
  }

  /**
   * Add to history
   */
  private addToHistory(modalId: string): void {
    modalHistory.update(history => {
      const newModals = [...history.modals, modalId];
      return {
        modals: newModals,
        currentIndex: newModals.length - 1
      };
    });
  }

  /**
   * Remove from history
   */
  private removeFromHistory(modalId: string): void {
    modalHistory.update(history => {
      const newModals = history.modals.filter(id => id !== modalId);
      return {
        modals: newModals,
        currentIndex: Math.min(history.currentIndex, newModals.length - 1)
      };
    });
  }

  /**
   * Clear history
   */
  private clearHistory(): void {
    modalHistory.set({
      modals: [],
      currentIndex: -1
    });
  }

  /**
   * Navigate back in modal history
   */
  goBack(): void {
    modalHistory.update(history => {
      if (history.currentIndex > 0) {
        const previousModalId = history.modals[history.currentIndex - 1];
        this.showModal(previousModalId);
        return {
          ...history,
          currentIndex: history.currentIndex - 1
        };
      }
      return history;
    });
  }

  /**
   * Navigate forward in modal history
   */
  goForward(): void {
    modalHistory.update(history => {
      if (history.currentIndex < history.modals.length - 1) {
        const nextModalId = history.modals[history.currentIndex + 1];
        this.showModal(nextModalId);
        return {
          ...history,
          currentIndex: history.currentIndex + 1
        };
      }
      return history;
    });
  }

  /**
   * Setup keyboard handlers
   */
  private setupKeyboardHandlers(): void {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeTopModal();
      } else if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        this.goBack();
      } else if (event.altKey && event.key === 'ArrowRight') {
        event.preventDefault();
        this.goForward();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
    }
  }

  /**
   * Add event listener for modal events
   */
  on(event: string, callback: () => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: () => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback());
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.setupKeyboardHandlers);
    }
    this.eventListeners.clear();
  }
}

// Export singleton instance
export const modalManager = ModalManager.getInstance();

// Export stores for reactive usage
export { modalStack, modalHistory };

// Predefined modal configurations
export const MODAL_CONFIGS: Record<string, ModalConfig> = {
  // Record modals
  'record-details': {
    id: 'record-details',
    type: 'default',
    title: 'Record Details',
    maxWidth: '500px',
    showCloseButton: true,
    closeOnBackdropClick: true
  },

  // Model modals
  'model-details': {
    id: 'model-details',
    type: 'default',
    title: '3D Model Details',
    maxWidth: '500px',
    showCloseButton: true,
    closeOnBackdropClick: true
  },

  // Editor card
  'model-editor': {
    id: 'model-editor',
    type: 'card',
    showCloseButton: true,
    closeOnBackdropClick: false
  },

  // AddButton modals
  'brainstorming': {
    id: 'brainstorming',
    type: 'default',
    title: 'Add Brainstorming',
    maxWidth: '600px',
    showCloseButton: true,
    closeOnBackdropClick: true,
    transitionDuration: 500
  },

  'simulation': {
    id: 'simulation',
    type: 'default',
    title: 'Add Simulation',
    maxWidth: '600px',
    showCloseButton: true,
    closeOnBackdropClick: true,
    transitionDuration: 500
  },

  'action-event': {
    id: 'action-event',
    type: 'default',
    title: 'Add Action Event',
    maxWidth: '600px',
    showCloseButton: true,
    closeOnBackdropClick: true,
    transitionDuration: 500
  },

  'petition': {
    id: 'petition',
    type: 'default',
    title: 'Add Petition',
    maxWidth: '600px',
    showCloseButton: true,
    closeOnBackdropClick: true,
    transitionDuration: 500
  },

  'crowdfunding': {
    id: 'crowdfunding',
    type: 'default',
    title: 'Add Crowdfunding',
    maxWidth: '600px',
    showCloseButton: true,
    closeOnBackdropClick: true,
    transitionDuration: 500
  },

  // Notification modals
  'coordinate-picker': {
    id: 'coordinate-picker',
    type: 'notification',
    showCloseButton: false,
    closeOnBackdropClick: false,
    transitionDuration: 500
  },

  'zoom-required': {
    id: 'zoom-required',
    type: 'notification',
    showCloseButton: false,
    closeOnBackdropClick: false,
    transitionDuration: 500
  }
};

// Register all predefined modals
Object.values(MODAL_CONFIGS).forEach(config => {
  modalManager.registerModal(config);
});
