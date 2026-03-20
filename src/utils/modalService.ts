import { showModal, hideModal, closeAllModals, closeTopModal, toggleModal } from './modalManager';
import type { ModelData } from '../types';
import { missionProgress } from './missionProgress';

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
  showOperatorAgreement: ()               => showModal('operator-agreement'),
  hideOperatorAgreement: ()               => hideModal('operator-agreement'),
  showAbout:            ()                  => showModal('about'),
  hideAbout:            ()                  => hideModal('about'),
  showMission: ()                  => showModal('mission'),
  hideMission: ()                  => hideModal('mission'),
  showSwarmGovernance: () => {
    missionProgress.recordMission2FirstOpened();
    showModal('swarm-governance');
  },
  hideSwarmGovernance: ()          => hideModal('swarm-governance'),
  showOmnipediaEditor: () => {
    missionProgress.recordMission3FirstOpened();
    showModal('omnipedia-editor');
  },
  hideOmnipediaEditor: ()          => hideModal('omnipedia-editor'),
  showMissionLog: ()               => showModal('mission-log'),
  hideMissionLog: ()               => hideModal('mission-log'),
  closeAllModals,
  closeTopModal,
  toggleModal,
};
