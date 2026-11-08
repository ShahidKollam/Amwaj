/**
 * IndexedDB persistence via Dexie.
 * Stores: products, categories, metadata, currentCart, pendingBills
 */
import Dexie from 'dexie';

export const db = new Dexie('amwaj_pos');

db.version(1).stores({
  products: 'id, categoryId, name, updatedAt, isActive',
  categories: 'id, name, sortOrder',
  metadata: 'key',
  currentCart: 'id',
  pendingBills: 'localId, status, createdAt, idempotencyKey',
});

export async function cacheProducts(products) {
  if (!Array.isArray(products)) return;
  await db.products.clear();
  await db.products.bulkPut(
    products.map((p) => ({
      ...p,
      updatedAt: p.updatedAt || new Date().toISOString(),
    }))
  );
  await db.metadata.put({ key: 'productsSyncedAt', value: new Date().toISOString() });
}

export async function cacheCategories(categories) {
  if (!Array.isArray(categories)) return;
  await db.categories.clear();
  await db.categories.bulkPut(categories);
  await db.metadata.put({ key: 'categoriesSyncedAt', value: new Date().toISOString() });
}

export async function getCachedProducts() {
  return db.products.toArray();
}

export async function getCachedCategories() {
  return db.categories.orderBy('sortOrder').toArray();
}

export async function getMeta(key) {
  const row = await db.metadata.get(key);
  return row?.value ?? null;
}

export async function setMeta(key, value) {
  await db.metadata.put({ key, value });
}

/** Current unfinished cart */
export async function saveCurrentCart(cartState) {
  await db.currentCart.put({
    id: 'active',
    ...cartState,
    updatedAt: new Date().toISOString(),
  });
}

export async function loadCurrentCart() {
  return db.currentCart.get('active');
}

export async function clearCurrentCart() {
  await db.currentCart.delete('active');
}

/** Pending / offline bills */
export async function savePendingBill(bill) {
  await db.pendingBills.put(bill);
}

export async function getPendingBills() {
  return db.pendingBills
    .where('status')
    .anyOf(['pending_sync', 'sync_failed', 'syncing'])
    .sortBy('createdAt');
}

export async function updatePendingBill(localId, patch) {
  await db.pendingBills.update(localId, patch);
}

export async function getPendingBillByKey(idempotencyKey) {
  return db.pendingBills.where('idempotencyKey').equals(idempotencyKey).first();
}

export async function countPendingBills() {
  return db.pendingBills
    .where('status')
    .anyOf(['pending_sync', 'sync_failed', 'syncing'])
    .count();
}
