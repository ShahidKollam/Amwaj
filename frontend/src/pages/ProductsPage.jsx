import React, { useEffect, useState } from 'react';
import { api, formatINR } from '../services/api';
import { Plus, Package } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { cacheProducts, cacheCategories } from '../lib/db';

export default function ProductsPage() {
  const qc = useQueryClient();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    categoryId: '',
    productType: 'PER_ML',
    unitPrice: '',
    unit: 'ml',
  });

  const load = () => {
    setLoading(true);
    Promise.all([api.getProducts({ active: 'false' }), api.getCategories()])
      .then(([p, c]) => {
        setProducts(Array.isArray(p) ? p : []);
        setCategories(Array.isArray(c) ? c : []);
        if (Array.isArray(c) && c[0]) setForm((f) => ({ ...f, categoryId: c[0].id }));
      })
      .catch((err) => {
        console.error(err);
        setProducts([]);
        setCategories([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const created = await api.createProduct({
        ...form,
        unitPrice: Math.round(Number(form.unitPrice) * 100),
      });
      // Update TanStack + IndexedDB caches immediately
      qc.setQueryData(queryKeys.products, (old) => {
        const list = Array.isArray(old) ? old : [];
        return [...list, created];
      });
      const all = qc.getQueryData(queryKeys.products) || [];
      cacheProducts(all).catch(console.error);
      setShowForm(false);
      setForm({ name: '', categoryId: categories[0]?.id || '', productType: 'PER_ML', unitPrice: '', unit: 'ml' });
      load();
    } catch (err) {
      // Prefer inline UX over browser alert
      window.__amwajLastError = err.message;
      console.error(err);
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-charcoal">Products</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5 text-sm py-2 px-3">
          <Plus size={16} /> Add
        </button>
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : !Array.isArray(products) || products.length === 0 ? (
        <div className="card p-8 text-center text-muted text-sm">No products yet</div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="card flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-xl bg-emerald/10 flex items-center justify-center text-emerald">
                <Package size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p?.name || '—'}</div>
                <div className="text-xs text-muted">
                  {p?.category?.name || '—'} · {p?.productType || ''} · {formatINR(p?.unitPrice)}
                  {p?.productType === 'PER_ML' ? '/ml' : ''}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${p.isActive ? 'bg-emerald/10 text-emerald' : 'bg-gray-100 text-muted'}`}>
                {p.isActive ? 'Active' : 'Hidden'}
              </span>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-3xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-semibold text-lg">New Product</h3>
            <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select className="input" value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value, unit: e.target.value === 'PER_ML' ? 'ml' : 'piece' })}>
              <option value="PER_ML">Per ml (Attar/Oud)</option>
              <option value="SPRAY">Spray</option>
              <option value="FIXED">Fixed price</option>
            </select>
            <input className="input" type="number" step="0.01" placeholder="Price (₹)" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} required />
            <input className="input" placeholder="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-border rounded-xl py-2.5">Cancel</button>
              <button type="submit" className="btn-primary flex-1">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
