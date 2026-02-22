import { showModal, hideModal, closeAllModals, closeTopModal, toggleModal } from './modalManager';
import type { ModelData } from '../types';

export const modalService = {
  showModelDetails:   (model: ModelData)  => showModal('model-details', { model }),
  hideModelDetails:   ()                  => hideModal('model-details'),
  showModelEditor:    (editMode = false, modelData?: ModelData) => showModal('model-editor', { editMode, modelData }),
  hideModelEditor:    ()                  => hideModal('model-editor'),
  showSimulation:     ()                  => showModal('simulation'),
  hideSimulation:     ()                  => hideModal('simulation'),
  showMissionTV:      ()                  => showModal('mission-tv'),
  hideMissionTV:      ()                  => hideModal('mission-tv'),
  showGigEconomy:     ()                  => showModal('gig-economy'),
  hideGigEconomy:     ()                  => hideModal('gig-economy'),
  showZoomRequired:   ()                  => showModal('zoom-required'),
  hideZoomRequired:   ()                  => hideModal('zoom-required'),
  closeAllModals,
  closeTopModal,
  toggleModal,
};
