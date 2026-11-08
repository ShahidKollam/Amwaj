/**
 * Current bill/cart — Zustand + IndexedDB persistence.
 * Survives refresh, PWA close, and device restart.
 */
import { create } from 'zustand';
import { saveCurrentCart, loadCurrentCart, clearCurrentCart } from '../lib/db';

function newBillId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `bill_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const emptyState = () => ({
  localBillId: newBillId(),
  items: [],
  customer: null,
  additional: 0,
  discount: 0,
  cash: '',
  upi: '',
  updatedAt: null,
});

let persistTimer = null;

function schedulePersist(getState) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const s = getState();
    saveCurrentCart({
      localBillId: s.localBillId,
      items: s.items,
      customer: s.customer,
      additional: s.additional,
      discount: s.discount,
      cash: s.cash,
      upi: s.upi,
    }).catch(console.error);
  }, 120);
}

export const useCartStore = create((set, get) => ({
  ...emptyState(),
  hydrated: false,

  hydrate: async () => {
    try {
      const saved = await loadCurrentCart();
      if (saved && Array.isArray(saved.items) && saved.items.length > 0) {
        set({
          localBillId: saved.localBillId || newBillId(),
          items: saved.items,
          customer: saved.customer || null,
          additional: saved.additional || 0,
          discount: saved.discount || 0,
          cash: saved.cash || '',
          upi: saved.upi || '',
          updatedAt: saved.updatedAt || null,
          hydrated: true,
        });
      } else {
        set({ hydrated: true });
      }
    } catch (e) {
      console.error('Cart hydrate failed', e);
      set({ hydrated: true });
    }
  },

  setItems: (items) => {
    set({ items, updatedAt: new Date().toISOString() });
    schedulePersist(get);
  },

  setCustomer: (customer) => {
    set({ customer, updatedAt: new Date().toISOString() });
    schedulePersist(get);
  },

  setAdditional: (additional) => {
    set({ additional, updatedAt: new Date().toISOString() });
    schedulePersist(get);
  },

  setDiscount: (discount) => {
    set({ discount, updatedAt: new Date().toISOString() });
    schedulePersist(get);
  },

  setCash: (cash) => {
    set({ cash, updatedAt: new Date().toISOString() });
    schedulePersist(get);
  },

  setUpi: (upi) => {
    set({ upi, updatedAt: new Date().toISOString() });
    schedulePersist(get);
  },

  /** Replace full cart snapshot (e.g. after load) */
  replaceCart: (partial) => {
    set({ ...partial, updatedAt: new Date().toISOString() });
    schedulePersist(get);
  },

  /** Clear after successful server bill or explicit discard */
  clearCart: async () => {
    set({ ...emptyState(), hydrated: true });
    await clearCurrentCart().catch(console.error);
  },
}));
