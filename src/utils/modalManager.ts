import { writable, derived, get } from 'svelte/store';

export interface ModalEntry {
  id: string;
  data?: any;
}

const _modals = writable<ModalEntry[]>([]);

export const openModals = derived(_modals, $m => $m);

export function showModal(id: string, data?: any): void {
  _modals.update(list => {
    if (list.some(m => m.id === id)) return list;
    return [...list, { id, data }];
  });
}

export function hideModal(id: string): void {
  _modals.update(list => list.filter(m => m.id !== id));
}

export function toggleModal(id: string, data?: any): void {
  const list = get(_modals);
  if (list.some(m => m.id === id)) hideModal(id);
  else showModal(id, data);
}

export function closeAllModals(): void {
  _modals.set([]);
}

export function closeTopModal(): void {
  _modals.update(list => list.length > 0 ? list.slice(0, -1) : list);
}

export function isModalOpen(id: string): boolean {
  return get(_modals).some(m => m.id === id);
}

export function getModalData(id: string): any {
  return get(_modals).find(m => m.id === id)?.data;
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTopModal();
  });
}

export const modalManager = {
  showModal,
  hideModal,
  toggleModal,
  closeAllModals,
  closeTopModal,
  getModalState: (id: string) => {
    const entry = get(_modals).find(m => m.id === id);
    return entry ? { isVisible: true, config: { data: entry.data } } : undefined;
  },
};
