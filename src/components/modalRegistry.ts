export type ModalId =
  | 'model-details'
  | 'model-editor'
  | 'simulation'
  | 'omnipedia'
  | 'mission-tv'
  | 'download'
  | 'layers-menu'
  | 'zoom-required'
  | 'about'
  | 'mission-log'
  | 'mission'
  | 'mission-2'
  | 'swarm-governance'
  | 'omnipedia-editor'
  | 'operator-agreement'
  | 'gig-economy';

export type ModalKind = 'mission' | 'overlay' | 'notification' | 'default';

export interface ModalConfig {
  title: string;
  zIndex: number;
  modalType: ModalKind;
  maxWidth: '100%' | '720px' | '400px' | '600px';
  showCloseButton: boolean;
  showTopHeader: boolean;
  topHeaderTransparent: boolean;
  closeOnBackdropClick: boolean;
  customClass: '' | 'layers-menu-modal' | 'missions' | 'mission2-modal';
  forwardInputs: boolean;
  isCard: boolean;
}

const BASE: Omit<ModalConfig, 'title' | 'isCard'> = {
  zIndex: 1000,
  modalType: 'default',
  maxWidth: '600px',
  showCloseButton: true,
  showTopHeader: true,
  topHeaderTransparent: false,
  closeOnBackdropClick: true,
  customClass: '',
  forwardInputs: false,
};

export const MODAL_REGISTRY: Record<ModalId, ModalConfig> = {
  'model-details': { ...BASE, title: '', isCard: false },
  'model-editor': { ...BASE, title: '', isCard: true },
  simulation: { ...BASE, title: 'SIMULATION', isCard: false },
  omnipedia: { ...BASE, title: 'OMNIPEDIA', isCard: false },
  'mission-tv': { ...BASE, title: 'MISSION TV', isCard: false },
  download: { ...BASE, title: 'DOWNLOAD', isCard: false },
  'layers-menu': {
    ...BASE,
    title: '',
    modalType: 'overlay',
    showCloseButton: false,
    showTopHeader: false,
    closeOnBackdropClick: false,
    customClass: 'layers-menu-modal',
    isCard: false,
  },
  'zoom-required': {
    ...BASE,
    title: '',
    modalType: 'notification',
    maxWidth: '400px',
    showCloseButton: false,
    closeOnBackdropClick: false,
    forwardInputs: true,
    isCard: false,
  },
  about: { ...BASE, title: 'ABOUT', maxWidth: '720px', isCard: false },
  'mission-log': {
    ...BASE,
    title: 'LOG',
    showCloseButton: false,
    topHeaderTransparent: true,
    customClass: 'missions',
    isCard: false,
  },
  mission: { ...BASE, title: 'MISSION', modalType: 'mission', maxWidth: '100%', isCard: false },
  'mission-2': {
    ...BASE,
    title: 'MISSION 2',
    modalType: 'mission',
    maxWidth: '720px',
    topHeaderTransparent: true,
    customClass: 'mission2-modal',
    isCard: false,
  },
  'swarm-governance': { ...BASE, title: 'SWARM GOVERNANCE', modalType: 'mission', maxWidth: '100%', zIndex: 1100, isCard: false },
  'omnipedia-editor': { ...BASE, title: 'MISSION', modalType: 'mission', maxWidth: '100%', isCard: false },
  'operator-agreement': {
    ...BASE,
    title: 'OPERATOR AGREEMENT',
    zIndex: 3000,
    maxWidth: '720px',
    showCloseButton: false,
    closeOnBackdropClick: false,
    isCard: false,
  },
  'gig-economy': { ...BASE, title: '', isCard: true },
};

export function getModalConfig(modalId: string): ModalConfig {
  return MODAL_REGISTRY[(modalId as ModalId)] ?? { ...BASE, title: '', isCard: false };
}
