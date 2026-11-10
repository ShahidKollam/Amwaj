import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { api, formatINR } from '../services/api';
import {
  Plus, Package, Pencil, Trash2, ChevronLeft, ChevronRight, Search,
  Droplet, SprayCan, Flame, Box,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import {
  cacheProducts,
  cacheCategories,
  getCachedProducts,
  getCachedCategories,
} from '../lib/db';
import { ConfirmModal } from '../components/Modal';

const PAGE_SIZE = 15;

const CATEGORY_ICON = {
  Attar: Droplet,
  Oud: Package,
  Spray: SprayCan,
  Bakhoor: Flame,
  Accessories: Box,
};

const emptyForm = {
  name: '',
  categoryId: '',
  productType: 'PER_ML',
  unitPrice: '',
  unit: 'ml',
};

function asArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /** Keep Bill catalog (active only) + IDB in sync after management changes */
  const syncCache = useCallback(
    async (list) => {
      const all = asArray(list);
      const active = all.filter((x) => x?.isActive !== false);
      qc.setQueryData(queryKeys.products, active);
      // Full list in IDB so Products page hydrates offline too
      await cacheProducts(all).catch(console.error);
    },
    [qc]
  );

  /** Instant hydrate from IndexedDB / Query cache, then background network refresh */
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const fromQc = asArray(qc.getQueryData(queryKeys.products));
        const catsQc = asArray(qc.getQueryData(queryKeys.categories));
        const [fromIdb, catsIdb] = await Promise.all([
          getCachedProducts().catch(() => []),
          getCachedCategories().catch(() => []),
        ]);
        const prods = asArray(fromIdb).length ? asArray(fromIdb) : fromQc;
        const cats = asArray(catsIdb).length ? asArray(catsIdb) : catsQc;

        if (!cancelled && prods.length) {
          setProducts(prods);
          setLoading(false);
        }
        if (!cancelled && cats.length) {
          setCategories(cats);
          setCategoryId((prev) => prev || cats[0]?.id || '');
          setForm((f) => ({ ...f, categoryId: f.categoryId || cats[0]?.id || '' }));
        }
        if (!cancelled && (prods.length || cats.length)) setLoading(false);
      } catch (e) {
        console.error('Products IDB hydrate failed', e);
      }
    };

    const refresh = async () => {
      setRefreshing(true);
      setError('');
      try {
        const [p, c] = await Promise.all([
          api.getProducts({ active: 'false' }),
          api.getCategories(),
        ]);
        if (cancelled) return;
        const cats = asArray(c);
        const list = asArray(p);
        setProducts(list);
        setCategories(cats);
        if (cats[0]) {
          setCategoryId((prev) => prev || cats[0].id);
          setForm((f) => ({ ...f, categoryId: f.categoryId || cats[0].id }));
        }
        await syncCache(list);
        await cacheCategories(cats).catch(console.error);
        qc.setQueryData(queryKeys.categories, cats);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err?.message || 'Failed to load products');
          setProducts((prev) => (prev.length ? prev : []));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    hydrate().then(() => refresh());
    return () => {
      cancelled = true;
    };
  }, [qc, syncCache]);

  const filtered = useMemo(() => {
    let list = Array.isArray(products) ? products : [];
    if (categoryId) list = list.filter((p) => p?.categoryId === categoryId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          (p?.name || '').toLowerCase().includes(q) ||
          (p?.category?.name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, search, categoryId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [search, categoryId]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      categoryId: categoryId || categories[0]?.id || '',
    });
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name || '',
      categoryId: p.categoryId || p.category?.id || '',
      productType: p.productType || 'PER_ML',
      unitPrice: ((p.unitPrice || 0) / 100).toString(),
      unit: p.unit || 'ml',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      categoryId: form.categoryId,
      productType: form.productType,
      unitPrice: Math.round(Number(form.unitPrice) * 100),
      unit: form.unit || (form.productType === 'PER_ML' ? 'ml' : 'piece'),
    };
    try {
      if (editing) {
        const updated = await api.updateProduct(editing.id, payload);
        const next = products.map((p) => (p.id === updated.id ? { ...p, ...updated } : p));
        setProducts(next);
        await syncCache(next);
      } else {
        const created = await api.createProduct(payload);
        const next = [...products, created];
        setProducts(next);
        await syncCache(next);
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteProduct(deleteId);
      const next = products.filter((p) => p.id !== deleteId);
      setProducts(next);
      await syncCache(next);
      setDeleteId(null);
    } catch (err) {
      setError(err?.message || 'Delete failed');
      setDeleteId(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto pb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold text-charcoal">Products</h1>
          <p className="text-xs text-muted">
            {filtered.length} items
            {refreshing ? ' · updating…' : ''}
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5 text-sm py-2 px-3">
          <Plus size={16} /> Add
        </button>
      </div>

      <div className="mb-3 px-0 py-0">
        <div className="grid grid-cols-5 gap-1.5">
          {(Array.isArray(categories) ? categories : []).map((cat) => {
            const Icon = CATEGORY_ICON[cat.name] || Package;
            const active = categoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(cat.id)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-[10px] font-semibold transition-colors ${
                  active
                    ? 'bg-emerald text-white border-emerald'
                    : 'bg-white text-muted border-border'
                }`}
              >
                <Icon size={16} className={active ? 'text-gold' : 'text-emerald'} />
                <span className="truncate w-full text-center">{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          className="input pl-9"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : pageItems.length === 0 ? (
        <div className="card p-8 text-center text-muted text-sm">No products found</div>
      ) : (
        <>
          <div className="space-y-2">
            {pageItems.map((p) => (
              <div key={p.id} className="card flex items-center gap-3 p-3">
                <div className="w-10 h-10 rounded-xl bg-emerald/10 flex items-center justify-center text-emerald shrink-0">
                  <Package size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-sm">
                    {p?.name || '—'}
                    {p?.isActive === false && (
                      <span className="ml-1.5 text-[10px] font-semibold text-muted bg-ivory px-1.5 py-0.5 rounded">
                        inactive
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {p?.category?.name || '—'} · {p?.productType || ''} · {formatINR(p?.unitPrice)}
                    {p?.productType === 'PER_ML' ? '/ml' : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted active:bg-ivory"
                    aria-label="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(p.id)}
                    className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-red-500 active:bg-red-50"
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-border disabled:opacity-40"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span className="text-muted">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-border disabled:opacity-40"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4 space-y-3 shadow-xl max-h-[90vh] overflow-auto"
          >
            <h2 className="font-bold text-lg text-charcoal">
              {editing ? 'Edit product' : 'New product'}
            </h2>
            <input
              className="input"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <select
              className="input"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={form.productType}
              onChange={(e) =>
                setForm({
                  ...form,
                  productType: e.target.value,
                  unit: e.target.value === 'PER_ML' ? 'ml' : 'piece',
                })
              }
            >
              <option value="PER_ML">Per ml (Attar/Oud)</option>
              <option value="SPRAY">Spray</option>
              <option value="FIXED">Fixed price</option>
            </select>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              placeholder="Price (₹)"
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Unit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="flex-1 border border-border rounded-xl py-2.5"
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-primary flex-1">
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete product?"
        message="This permanently removes the product. If it was used on past bills, delete may be blocked."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
