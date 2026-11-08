/**
 * Offline bill queue + safe synchronisation.
 * - Saves bill locally before network
 * - Retries with same idempotency key (no duplicates)
 * - Never claims UPI verified offline
 */
import { api } from '../services/api';
import {
  savePendingBill,
  getPendingBills,
  updatePendingBill,
  countPendingBills,
} from './db';

function uuid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

let syncing = false;
const listeners = new Set();

export function onSyncStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(status) {
  listeners.forEach((fn) => {
    try {
      fn(status);
    } catch (_) {}
  });
}

/**
 * Queue a completed bill for server sync.
 * Call AFTER local validation; payload is the same body as online completeBill.
 */
export async function queueBill(payload) {
  const localId = uuid();
  const idempotencyKey = payload.idempotencyKey || uuid();
  const record = {
    localId,
    idempotencyKey,
    status: 'pending_sync',
    payload: { ...payload, idempotencyKey },
    createdAt: new Date().toISOString(),
    lastError: null,
    serverInvoiceId: null,
    invoiceNumber: null,
  };
  await savePendingBill(record);
  emit({ type: 'queued', localId });
  // Try immediate sync if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    scheduleSyncSoon();
  }
  return record;
}

/**
 * Online path: try server first; on failure queue for later.
 * Returns { ok, invoice?, pending?, error? }
 */
export async function completeBillSafe(payload) {
  const idempotencyKey = payload.idempotencyKey || uuid();
  const body = { ...payload, idempotencyKey };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    // Offline: cash-only style local record — never claim UPI verified
    const pending = await queueBill(body);
    return {
      ok: false,
      pending: true,
      localId: pending.localId,
      message: 'Saved offline. Will sync when online. UPI is not verified offline.',
    };
  }

  try {
    const invoice = await api.completeBill(body);
    return { ok: true, invoice };
  } catch (err) {
    const pending = await queueBill(body);
    return {
      ok: false,
      pending: true,
      localId: pending.localId,
      error: err.message,
      message: 'Network error. Bill saved locally and will sync automatically.',
    };
  }
}

async function syncOne(bill) {
  if (bill.status === 'synced') return true;
  await updatePendingBill(bill.localId, { status: 'syncing' });
  try {
    const invoice = await api.completeBill({
      ...bill.payload,
      idempotencyKey: bill.idempotencyKey,
    });
    await updatePendingBill(bill.localId, {
      status: 'synced',
      serverInvoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      lastError: null,
      syncedAt: new Date().toISOString(),
    });
    emit({ type: 'synced', localId: bill.localId, invoice });
    return true;
  } catch (err) {
    await updatePendingBill(bill.localId, {
      status: 'sync_failed',
      lastError: err.message || 'Sync failed',
    });
    emit({ type: 'failed', localId: bill.localId, error: err.message });
    return false;
  }
}

export async function runBillSync() {
  if (syncing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  syncing = true;
  emit({ type: 'sync_start' });
  try {
    const pending = await getPendingBills();
    for (const bill of pending) {
      if (bill.status === 'syncing') continue;
      await syncOne(bill);
    }
  } finally {
    syncing = false;
    const count = await countPendingBills().catch(() => 0);
    emit({ type: 'sync_end', pendingCount: count });
  }
}

let soonTimer = null;
function scheduleSyncSoon() {
  if (soonTimer) clearTimeout(soonTimer);
  soonTimer = setTimeout(() => runBillSync(), 800);
}

export function startBillSyncListeners() {
  if (typeof window === 'undefined') return () => {};
  const onOnline = () => runBillSync();
  const onFocus = () => {
    if (navigator.onLine) runBillSync();
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) runBillSync();
  });
  // Initial attempt
  if (navigator.onLine) scheduleSyncSoon();
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('focus', onFocus);
  };
}

export async function getPendingCount() {
  return countPendingBills();
}
