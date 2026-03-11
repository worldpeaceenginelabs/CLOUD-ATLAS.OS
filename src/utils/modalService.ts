import { showModal, hideModal, closeAllModals, closeTopModal, toggleModal } from './modalManager';
import type { ModelData } from '../types';

export const modalService = {
  showModelDetails:   (model: ModelData)  => showModal('model-details', { model }),
  hideModelDetails:   ()                  => hideModal('model-details'),
  showModelEditor:    (editMode = false, modelData?: ModelData) => showModal('model-editor', { editMode, modelData }),
  hideModelEditor:    ()                  => hideModal('model-editor'),
  showSimulation:     ()                  => showModal('simulation'),
  hideSimulation:     ()                  => hideModal('simulation'),
  showOmnipedia:      ()                  => showModal('omnipedia'),
  hideOmnipedia:      ()                  => hideModal('omnipedia'),
  showMissionTV:      ()                  => showModal('mission-tv'),
  hideMissionTV:      ()                  => hideModal('mission-tv'),
  showDownload:       ()                  => showModal('download'),
  hideDownload:       ()                  => hideModal('download'),
  showLayersMenu:     ()                  => showModal('layers-menu'),
  hideLayersMenu:     ()                  => hideModal('layers-menu'),
  toggleLayersMenu:   ()                  => toggleModal('layers-menu'),
  showGigEconomy:     ()                  => showModal('gig-economy'),
  hideGigEconomy:     ()                  => hideModal('gig-economy'),
  showZoomRequired:   ()                  => showModal('zoom-required'),
  hideZoomRequired:   ()                  => hideModal('zoom-required'),
  closeAllModals,
  closeTopModal,
  toggleModal,
};
