import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Plus, Minus, Trash2, UserPlus, Droplet, Package,
  SprayCan, Box, MoreHorizontal, Check
} from 'lucide-react';
import { api, formatINR } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CATEGORY_ICONS = {
  Attar: Droplet,
  Oud: Package,
  Spray: SprayCan,
  Bakhoor: Box,
  Accessories: Package,
  More: MoreHorizontal,
};

function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

function fromPaise(paise) {
  return (paise || 0) / 100;
}

export default function BillPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [additional, setAdditional] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [cash, setCash] = useState('');
  const [upi, setUpi] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  useEffect(() => {
    Promise.all([api.getCategories(), api.getProducts()])
      .then(([cats, prods]) => {
        setCategories(cats);
        setProducts(prods);
        if (cats.length) setActiveCategory(cats[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCategory) list = list.filter((p) => p.categoryId === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCategory, search]);

  const subtotalPaise = useMemo(
    () => cart.reduce((s, item) => s + item.lineTotalPaise, 0),
    [cart]
  );
  const additionalPaise = toPaise(additional);
  const discountPaise = toPaise(discount);
  const totalPaise = Math.max(0, subtotalPaise + additionalPaise - discountPaise);

  const addProduct = (product) => {
    if (product.productType === 'PER_ML') {
      // Default 3 ml, user can change
      const qty = 3;
      const lineTotal = Math.round(qty * product.unitPrice);
      setCart((prev) => [
        ...prev,
        {
          key: `${product.id}-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          productType: product.productType,
          unit: product.unit,
          quantity: qty,
          unitPricePaise: product.unitPrice,
          lineTotalPaise: lineTotal,
          discountPaise: 0,
        },
      ]);
    } else if (product.productType === 'SPRAY') {
      setCart((prev) => [
        ...prev,
        {
          key: `${product.id}-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          productType: 'SPRAY',
          unit: 'piece',
          quantity: 1,
          unitPricePaise: product.unitPrice,
          lineTotalPaise: product.unitPrice,
          discountPaise: 0,
          sprayBottleMl: 100,
          sprayOilMl: 60,
        },
      ]);
    } else {
      setCart((prev) => [
        ...prev,
        {
          key: `${product.id}-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          productType: product.productType,
          unit: product.unit,
          quantity: 1,
          unitPricePaise: product.unitPrice,
          lineTotalPaise: product.unitPrice,
          discountPaise: 0,
        },
      ]);
    }
  };

  const updateQty = (key, delta) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        let qty = item.quantity + delta;
        if (item.productType === 'PER_ML') {
          qty = Math.max(0.5, Math.round(qty * 2) / 2); // 0.5 steps
        } else {
          qty = Math.max(1, Math.round(qty));
        }
        const lineTotal = Math.round(qty * item.unitPricePaise) - (item.discountPaise || 0);
        return { ...item, quantity: qty, lineTotalPaise: Math.max(0, lineTotal) };
      })
    );
  };

  const setItemQty = (key, value) => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    setCart((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const qty = item.productType === 'PER_ML' ? num : Math.round(num);
        const lineTotal = Math.round(qty * item.unitPricePaise) - (item.discountPaise || 0);
        return { ...item, quantity: qty, lineTotalPaise: Math.max(0, lineTotal) };
      })
    );
  };

  const removeItem = (key) => {
    setCart((prev) => prev.filter((i) => i.key !== key));
  };

  const clearCart = () => {
    if (cart.length && window.confirm('Clear all items from this bill?')) {
      setCart([]);
      setAdditional(0);
      setDiscount(0);
      setCash('');
      setUpi('');
      setCustomer(null);
    }
  };

  const handleComplete = async () => {
    if (!cart.length) return;
    const cashPaise = toPaise(cash || 0);
    const upiPaise = toPaise(upi || 0);
    if (cashPaise + upiPaise !== totalPaise) {
      alert(`Payments must equal total ${formatINR(totalPaise)}. Current: ${formatINR(cashPaise + upiPaise)}`);
      return;
    }
    if (cashPaise + upiPaise === 0) {
      alert('Enter payment amounts');
      return;
    }

    const payments = [];
    if (cashPaise > 0) payments.push({ method: 'CASH', amountPaise: cashPaise });
    if (upiPaise > 0) payments.push({ method: 'UPI', amountPaise: upiPaise });

    setSubmitting(true);
    try {
      const invoice = await api.completeBill({
        customerId: customer?.id || null,
        items: cart.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productType: item.productType,
          unit: item.unit,
          quantity: item.quantity,
          unitPricePaise: item.unitPricePaise,
          discountPaise: item.discountPaise || 0,
          sprayBottleMl: item.sprayBottleMl || null,
          sprayOilMl: item.sprayOilMl || null,
        })),
        additionalPaise,
        discountPaise,
        payments,
      });
      setCompletedInvoice(invoice);
      setCart([]);
      setAdditional(0);
      setDiscount(0);
      setCash('');
      setUpi('');
      setCustomer(null);
    } catch (err) {
      alert(err.message || 'Failed to complete bill');
    } finally {
      setSubmitting(false);
    }
  };

  if (completedInvoice) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="card p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald/10 flex items-center justify-center mx-auto mb-4">
            <Check className="text-emerald" size={28} />
          </div>
          <h2 className="text-xl font-bold text-charcoal">Bill Completed</h2>
          <p className="text-muted mt-1">{completedInvoice.invoiceNumber}</p>
          <p className="text-2xl font-bold text-emerald mt-4">
            {formatINR(completedInvoice.totalPaise)}
          </p>
          <div className="mt-6 space-y-2 text-left text-sm">
            {completedInvoice.items.map((it) => (
              <div key={it.id} className="flex justify-between">
                <span>
                  {it.productName}
                  {it.productType === 'PER_ML' ? ` · ${it.quantity} ml` : ''}
                </span>
                <span>{formatINR(it.lineTotalPaise)}</span>
              </div>
            ))}
          </div>
          <button
            className="btn-primary w-full mt-8"
            onClick={() => setCompletedInvoice(null)}
          >
            New Bill
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        Loading products…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full md:flex-row md:h-[calc(100vh-0px)]">
      {/* Left / main: products */}
      <div className="flex-1 flex flex-col min-h-0 md:border-r border-border">
        {/* Header */}
        <div className="bg-emerald text-white px-4 pt-4 pb-3 md:rounded-none">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
                  <path d="M32 14c-2 6-6 10-10 14 4 2 8 4 10 8 2-4 6-6 10-8-4-4-8-8-10-14z" fill="#C69A50"/>
                </svg>
              </div>
              <div>
                <span className="font-bold text-lg">Amwaj</span>
                <span className="ml-1.5 text-xs bg-gold text-emerald-dark font-semibold px-1.5 py-0.5 rounded">POS</span>
              </div>
            </div>
            <div className="text-sm text-white/80 truncate max-w-[100px]">{user?.name}</div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">New Bill</h1>
              <p className="text-white/70 text-xs">Add products and create a bill</p>
            </div>
            <button
              onClick={() => setShowCustomerModal(true)}
              className="flex items-center gap-1.5 bg-gold text-emerald-dark text-sm font-semibold px-3 py-2 rounded-xl"
            >
              <UserPlus size={16} />
              {customer ? customer.name.split(' ')[0] : 'Customer'}
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="px-3 py-3 overflow-x-auto no-scrollbar">
          <div className="flex gap-2">
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.name] || Package;
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex flex-col items-center gap-1 min-w-[68px] px-2 py-2 rounded-2xl transition-colors ${
                    active
                      ? 'bg-emerald text-white'
                      : 'bg-white border border-border text-muted'
                  }`}
                >
                  <Icon size={20} strokeWidth={2} />
                  <span className="text-[11px] font-medium">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              className="input pl-10 py-2.5 text-sm"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {filteredProducts.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">No products found</p>
          ) : (
            filteredProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 bg-white rounded-2xl border border-border px-3 py-3"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald/10 flex items-center justify-center text-emerald shrink-0">
                  {p.productType === 'PER_ML' ? (
                    <Droplet size={18} />
                  ) : p.productType === 'SPRAY' ? (
                    <SprayCan size={18} />
                  ) : (
                    <Package size={18} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-charcoal truncate">{p.name}</div>
                  <div className="text-sm text-muted">
                    {p.productType === 'PER_ML'
                      ? `${formatINR(p.unitPrice)} / ml`
                      : formatINR(p.unitPrice)}
                  </div>
                </div>
                <button
                  onClick={() => addProduct(p)}
                  className="shrink-0 flex items-center gap-1 text-sm font-semibold text-emerald border border-emerald/30 rounded-xl px-3 py-1.5 active:bg-emerald/5"
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div className="bg-white border-t md:border-t-0 md:w-[360px] lg:w-[400px] flex flex-col shrink-0 max-h-[45vh] md:max-h-none md:h-full">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-charcoal">
            <ShoppingCartIcon />
            Bill Items ({cart.length})
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-muted text-sm flex items-center gap-1">
              <Trash2 size={14} /> Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
          {cart.length === 0 ? (
            <p className="text-center text-muted text-sm py-6">Add products to start a bill</p>
          ) : (
            cart.map((item) => (
              <div key={item.key} className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-lg bg-emerald/10 flex items-center justify-center text-emerald shrink-0 mt-0.5">
                  {item.productType === 'PER_ML' ? <Droplet size={16} /> : <Package size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.productName}</div>
                  <div className="text-xs text-muted">
                    {item.productType === 'PER_ML'
                      ? `${item.quantity} ml × ${formatINR(item.unitPricePaise)} / ml`
                      : item.productType === 'SPRAY' && item.sprayBottleMl
                      ? `${item.sprayBottleMl} ml (Oil: ${item.sprayOilMl} ml)`
                      : `${item.quantity} × ${formatINR(item.unitPricePaise)}`}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => updateQty(item.key, item.productType === 'PER_ML' ? -1 : -1)}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      step={item.productType === 'PER_ML' ? 0.5 : 1}
                      value={item.quantity}
                      onChange={(e) => setItemQty(item.key, e.target.value)}
                      className="w-14 text-center text-sm border border-border rounded-lg py-1"
                    />
                    <button
                      onClick={() => updateQty(item.key, item.productType === 'PER_ML' ? 1 : 1)}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center"
                    >
                      <Plus size={14} />
                    </button>
                    <span className="ml-auto font-semibold text-sm">
                      {formatINR(item.lineTotalPaise)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals + pay */}
        <div className="border-t border-border px-4 py-3 space-y-2 bg-ivory/50">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Subtotal</span>
            <span>{formatINR(subtotalPaise)}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-muted">Additional Charges</span>
            <input
              type="number"
              min="0"
              step="1"
              value={additional || ''}
              onChange={(e) => setAdditional(e.target.value)}
              className="w-24 text-right border border-border rounded-lg px-2 py-1 text-sm"
              placeholder="0"
            />
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-muted">Discount</span>
            <input
              type="number"
              min="0"
              step="1"
              value={discount || ''}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-24 text-right border border-border rounded-lg px-2 py-1 text-sm"
              placeholder="0"
            />
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="font-semibold">Total Payable</span>
            <span className="text-xl font-bold text-emerald">{formatINR(totalPaise)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <div>
              <label className="text-xs text-muted">Cash</label>
              <input
                type="number"
                min="0"
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                className="input py-2 text-sm"
                placeholder="₹0"
              />
            </div>
            <div>
              <label className="text-xs text-muted">UPI</label>
              <input
                type="number"
                min="0"
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                className="input py-2 text-sm"
                placeholder="₹0"
              />
            </div>
          </div>

          <button
            onClick={handleComplete}
            disabled={!cart.length || submitting}
            className="btn-primary w-full mt-2 flex items-center justify-center gap-2"
          >
            <Check size={18} />
            {submitting ? 'Processing…' : 'Complete Bill'}
          </button>
        </div>
      </div>

      {/* Simple customer modal placeholder */}
      {showCustomerModal && (
        <CustomerQuickSelect
          onClose={() => setShowCustomerModal(false)}
          onSelect={(c) => {
            setCustomer(c);
            setShowCustomerModal(false);
          }}
        />
      )}
    </div>
  );
}

function ShoppingCartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function CustomerQuickSelect({ onClose, onSelect }) {
  const [search, setSearch] = useState('');
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');

  useEffect(() => {
    api.getCustomers(search).then(setList).catch(console.error);
  }, [search]);

  const create = async () => {
    if (!name.trim() || !mobile.trim()) return;
    try {
      const c = await api.createCustomer({ name: name.trim(), mobile: mobile.trim() });
      onSelect(c);
    } catch (err) {
      if (err.message.includes('already exists')) {
        // try to fetch
        const existing = await api.getCustomers(mobile);
        if (existing[0]) onSelect(existing[0]);
      } else alert(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="font-semibold">Select Customer</h3>
          <button onClick={onClose} className="text-muted text-sm">Close</button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <input
            className="input"
            placeholder="Search by name or mobile"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {list.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-ivory text-sm"
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-muted text-xs">{c.mobile}</div>
              </button>
            ))}
          </div>
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-xs text-muted font-medium">Or create new</p>
            <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            <button onClick={create} className="btn-primary w-full text-sm py-2.5">Create & Select</button>
          </div>
          <button
            onClick={() => onSelect(null)}
            className="w-full text-center text-sm text-muted py-2"
          >
            Continue as Walk-in
          </button>
        </div>
      </div>
    </div>
  );
}
