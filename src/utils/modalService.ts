/**
 * Modal Service - High-level API for modal operations
 * Provides convenient methods for common modal operations
 */

import { modalManager, type ModalConfig } from './modalManager';
import type { ModelData, PinData } from '../types';

export class ModalService {
  private static instance: ModalService;

  private constructor() {}

  static getInstance(): ModalService {
    if (!ModalService.instance) {
      ModalService.instance = new ModalService();
    }
    return ModalService.instance;
  }

  // Record modals
  showRecordDetails(record: PinData): void {
    modalManager.showModal('record-details', { record });
  }

  hideRecordDetails(): void {
    modalManager.hideModal('record-details');
  }

  // Model modals
  showModelDetails(model: ModelData): void {
    modalManager.showModal('model-details', { model });
  }

  hideModelDetails(): void {
    modalManager.hideModal('model-details');
  }

  // Editor card
  showModelEditor(editMode: boolean = false, modelData?: ModelData): void {
    modalManager.showModal('model-editor', { editMode, modelData });
  }

  hideModelEditor(): void {
    modalManager.hideModal('model-editor');
  }

  // AddButton modals
  showBrainstorming(): void {
    modalManager.showModal('brainstorming');
  }

  hideBrainstorming(): void {
    modalManager.hideModal('brainstorming');
  }

  showSimulation(): void {
    modalManager.showModal('simulation');
  }

  hideSimulation(): void {
    modalManager.hideModal('simulation');
  }

  showActionEvent(): void {
    modalManager.showModal('action-event');
  }

  hideActionEvent(): void {
    modalManager.hideModal('action-event');
  }

  showPetition(): void {
    modalManager.showModal('petition');
  }

  hidePetition(): void {
    modalManager.hideModal('petition');
  }

  showCrowdfunding(): void {
    modalManager.showModal('crowdfunding');
  }

  hideCrowdfunding(): void {
    modalManager.hideModal('crowdfunding');
  }

  // Gig Economy
  showGigEconomy(): void {
    modalManager.showModal('gig-economy');
  }

  hideGigEconomy(): void {
    modalManager.hideModal('gig-economy');
  }

  // Notification modals
  showCoordinatePicker(): void {
    modalManager.showModal('coordinate-picker');
  }

  hideCoordinatePicker(): void {
    modalManager.hideModal('coordinate-picker');
  }

  showZoomRequired(): void {
    modalManager.showModal('zoom-required');
  }

  hideZoomRequired(): void {
    modalManager.hideModal('zoom-required');
  }

  // Generic modal operations
  showModal(modalId: string, data?: any): void {
    modalManager.showModal(modalId, data);
  }

  hideModal(modalId: string): void {
    modalManager.hideModal(modalId);
  }

  toggleModal(modalId: string, data?: any): void {
    modalManager.toggleModal(modalId, data);
  }

  closeAllModals(): void {
    modalManager.closeAllModals();
  }

  closeTopModal(): void {
    modalManager.closeTopModal();
  }

  // Navigation
  goBack(): void {
    modalManager.goBack();
  }

  goForward(): void {
    modalManager.goForward();
  }

  // Utility methods
  isModalOpen(modalId: string): boolean {
    const modalState = modalManager.getModalState(modalId);
    return modalState?.isVisible || false;
  }

  getModalData(modalId: string): any {
    const modalState = modalManager.getModalState(modalId);
    return modalState?.config.data;
  }

  updateModalData(modalId: string, data: any): void {
    modalManager.updateModalData(modalId, data);
  }

  // Event handling
  onModalOpen(callback: (modalId: string) => void): void {
    modalManager.on('modalOpen', callback);
  }

  onModalClose(callback: (modalId: string) => void): void {
    modalManager.on('modalClose', callback);
  }

  onAllModalsClose(callback: (modalId: string) => void): void {
    modalManager.on('allModalsClose', callback);
  }
}

// Export singleton instance
export const modalService = ModalService.getInstance();

// Convenience functions for direct usage
export const showRecordDetails = (record: PinData) => modalService.showRecordDetails(record);
export const hideRecordDetails = () => modalService.hideRecordDetails();
export const showModelDetails = (model: ModelData) => modalService.showModelDetails(model);
export const hideModelDetails = () => modalService.hideModelDetails();
export const showModelEditor = (editMode: boolean = false, modelData?: ModelData) => modalService.showModelEditor(editMode, modelData);
export const hideModelEditor = () => modalService.hideModelEditor();
export const showBrainstorming = () => modalService.showBrainstorming();
export const hideBrainstorming = () => modalService.hideBrainstorming();
export const showSimulation = () => modalService.showSimulation();
export const hideSimulation = () => modalService.hideSimulation();
export const showActionEvent = () => modalService.showActionEvent();
export const hideActionEvent = () => modalService.hideActionEvent();
export const showPetition = () => modalService.showPetition();
export const hidePetition = () => modalService.hidePetition();
export const showCrowdfunding = () => modalService.showCrowdfunding();
export const hideCrowdfunding = () => modalService.hideCrowdfunding();
export const showCoordinatePicker = () => modalService.showCoordinatePicker();
export const hideCoordinatePicker = () => modalService.hideCoordinatePicker();
export const showZoomRequired = () => modalService.showZoomRequired();
export const hideZoomRequired = () => modalService.hideZoomRequired();
export const showGigEconomy = () => modalService.showGigEconomy();
export const hideGigEconomy = () => modalService.hideGigEconomy();
export const closeAllModals = () => modalService.closeAllModals();
export const closeTopModal = () => modalService.closeTopModal();
