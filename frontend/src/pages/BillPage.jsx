import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Plus, Minus, Trash2, UserPlus, ChevronUp, ChevronDown,
  Check, Banknote, Smartphone, ArrowLeft, X,
  Droplet, Package, SprayCan, Flame, Box
} from 'lucide-react';
import { api, formatINR } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal, { ConfirmModal } from '../components/Modal';
import { useProducts, useCategories } from '../hooks/useCatalog';
import { useCartStore } from '../store/cartStore';
import { completeBillSafe } from '../lib/billSync';

const CATEGORY_ICON = {
  Attar: Droplet,
  Oud: Package,
  Spray: SprayCan,
  Bakhoor: Flame,
  Accessories: Box,
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
  const [confirmClear, setConfirmClear] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Mobile flow: browse | review
  const [view, setView] = useState('browse');
  const [billExpanded, setBillExpanded] = useState(false);
  const cartHydrated = useRef(false);

  // Catalog from TanStack Query + IndexedDB (instant cache, background refresh)
  const productsQuery = useProducts();
  const categoriesQuery = useCategories();

  useEffect(() => {
    if (Array.isArray(productsQuery.data)) setProducts(productsQuery.data);
    if (Array.isArray(categoriesQuery.data)) {
      setCategories(categoriesQuery.data);
      setActiveCategory((prev) => prev || categoriesQuery.data[0]?.id || null);
    }
    if (!productsQuery.isLoading && !categoriesQuery.isLoading) setLoading(false);
    if (productsQuery.data || categoriesQuery.data) setLoading(false);
  }, [productsQuery.data, categoriesQuery.data, productsQuery.isLoading, categoriesQuery.isLoading]);

  // Restore unfinished bill from IndexedDB once
  useEffect(() => {
    const unsub = useCartStore.subscribe(() => {});
    const tryHydrate = () => {
      const s = useCartStore.getState();
      if (!s.hydrated || cartHydrated.current) return;
      cartHydrated.current = true;
      if (s.items && s.items.length) {
        setCart(s.items);
        setCustomer(s.customer);
        setAdditional(s.additional || 0);
        setDiscount(s.discount || 0);
        setCash(s.cash || '');
        setUpi(s.upi || '');
      }
    };
    tryHydrate();
    const id = setInterval(() => {
      if (useCartStore.getState().hydrated) {
        tryHydrate();
        clearInterval(id);
      }
    }, 50);
    return () => {
      clearInterval(id);
      unsub();
    };
  }, []);

  // Persist cart changes to IndexedDB
  useEffect(() => {
    if (!cartHydrated.current && cart.length === 0) return;
    useCartStore.getState().replaceCart({
      items: cart,
      customer,
      additional,
      discount,
      cash,
      upi,
    });
  }, [cart, customer, additional, discount, cash, upi]);

  const filteredProducts = useMemo(() => {
    let list = Array.isArray(products) ? products : [];
    if (activeCategory) list = list.filter((p) => p?.categoryId === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => (p?.name || '').toLowerCase().includes(q));
    }
    return list;
  }, [products, activeCategory, search]);

  const subtotalPaise = useMemo(
    () => (Array.isArray(cart) ? cart : []).reduce((s, item) => s + (item?.lineTotalPaise || 0), 0),
    [cart]
  );
  const additionalPaise = toPaise(additional);
  const discountPaise = toPaise(discount);
  const totalPaise = Math.max(0, subtotalPaise + additionalPaise - discountPaise);

  const addProduct = (product) => {
    if (product.productType === 'PER_ML') {
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
      prev
        .map((item) => {
          if (item.key !== key) return item;
          let qty = item.quantity + delta;
          if (item.productType === 'PER_ML') {
            qty = Math.max(0, Math.round(qty * 2) / 2);
          } else {
            qty = Math.max(0, Math.round(qty));
          }
          if (qty <= 0) return null;
          const lineTotal = Math.round(qty * item.unitPricePaise) - (item.discountPaise || 0);
          return { ...item, quantity: qty, lineTotalPaise: Math.max(0, lineTotal) };
        })
        .filter(Boolean)
    );
  };

  const setItemQty = (key, value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.key !== key) return item;
          if (num <= 0) return null;
          const qty = item.productType === 'PER_ML' ? num : Math.round(num);
          const lineTotal = Math.round(qty * item.unitPricePaise) - (item.discountPaise || 0);
          return { ...item, quantity: qty, lineTotalPaise: Math.max(0, lineTotal) };
        })
        .filter(Boolean)
    );
  };

  const removeItem = (key) => {
    setCart((prev) => prev.filter((i) => i.key !== key));
  };

  const doClearCart = () => {
    setCart([]);
    setAdditional(0);
    setDiscount(0);
    setCash('');
    setUpi('');
    setCustomer(null);
    setBillExpanded(false);
    setView('browse');
    useCartStore.getState().clearCart();
  };

  const payFullCash = () => {
    setCash(fromPaise(totalPaise).toString());
    setUpi('');
  };
  const payFullUpi = () => {
    setUpi(fromPaise(totalPaise).toString());
    setCash('');
  };
  const payRemainingCash = () => {
    const rem = Math.max(0, totalPaise - toPaise(upi || 0));
    setCash(fromPaise(rem).toString());
  };
  const payRemainingUpi = () => {
    const rem = Math.max(0, totalPaise - toPaise(cash || 0));
    setUpi(fromPaise(rem).toString());
  };

  const handleComplete = async () => {
    if (!cart.length) return;
    const cashPaise = toPaise(cash || 0);
    const upiPaise = toPaise(upi || 0);
    if (cashPaise + upiPaise === 0) {
      setErrorMsg('Enter payment amounts (Cash or UPI)');
      return;
    }
    if (cashPaise + upiPaise !== totalPaise) {
      setErrorMsg(
        `Payments must equal total ${formatINR(totalPaise)}. Now: ${formatINR(cashPaise + upiPaise)}`
      );
      return;
    }

    const payments = [];
    if (cashPaise > 0) payments.push({ method: 'CASH', amountPaise: cashPaise });
    if (upiPaise > 0) payments.push({ method: 'UPI', amountPaise: upiPaise });

    setSubmitting(true);
    try {
      const payload = {
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
      };
      const result = await completeBillSafe(payload);
      if (result.ok && result.invoice) {
        setCompletedInvoice(result.invoice);
        setCart([]);
        setAdditional(0);
        setDiscount(0);
        setCash('');
        setUpi('');
        setCustomer(null);
        setBillExpanded(false);
        setView('browse');
        await useCartStore.getState().clearCart();
      } else if (result.pending) {
        setErrorMsg(result.message || 'Bill saved offline and will sync when online.');
        // Keep cart until staff confirms; optional: clear and show pending
        setCart([]);
        setAdditional(0);
        setDiscount(0);
        setCash('');
        setUpi('');
        setCustomer(null);
        setBillExpanded(false);
        setView('browse');
        await useCartStore.getState().clearCart();
      } else {
        setErrorMsg(result.error || result.message || 'Failed to complete bill');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to complete bill');
    } finally {
      setSubmitting(false);
    }
  };

  const startNewBill = () => {
    setCompletedInvoice(null);
    setView('browse');
  };

  // ── Completed invoice (stays inside AppShell header + bottom nav) ──
  if (completedInvoice) {
    return (
      <div className="bg-ivory px-3 pt-3 pb-6 max-w-lg mx-auto">
        <div className="rounded-2xl bg-white border border-border shadow-soft overflow-hidden">
          <div className="bg-emerald px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-white/70 text-[11px] font-medium uppercase tracking-wide">Receipt</p>
              <p className="text-white font-semibold text-sm">{completedInvoice.invoiceNumber}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
              <Check className="text-gold" size={20} strokeWidth={2.5} />
            </div>
          </div>
          <div className="px-4 pt-4 pb-2 text-center border-b border-border">
            <p className="text-[11px] text-muted font-medium">Total paid</p>
            <p className="text-2xl font-bold text-emerald tracking-tight mt-0.5">
              {formatINR(completedInvoice.totalPaise)}
            </p>
            {completedInvoice.customer && (
              <p className="text-xs text-muted mt-1.5">
                {completedInvoice.customer?.name}
                {completedInvoice.customer?.mobile ? ` · ${completedInvoice.customer.mobile}` : ''}
              </p>
            )}
          </div>
          <div className="px-4 py-3 space-y-1.5 max-h-48 overflow-y-auto">
            {(completedInvoice.items || []).map((it) => (
              <div key={it.id || it.productName} className="flex justify-between gap-2 text-sm">
                <span className="truncate text-charcoal">
                  {it.productName}
                  {it.productType === 'PER_ML' ? ` · ${it.quantity} ml` : ''}
                </span>
                <span className="shrink-0 font-semibold text-charcoal">
                  {formatINR(it.lineTotalPaise)}
                </span>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 bg-ivory/80 border-t border-border text-[11px] text-muted">
            Paid:{' '}
            <span className="text-charcoal font-medium">
              {(completedInvoice.payments || [])
                .map((p) => `${p.method} ${formatINR(p.amountPaise)}`)
                .join(' + ') || '—'}
            </span>
          </div>
          <div className="p-3 space-y-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `*Amwaj Invoice ${completedInvoice.invoiceNumber}
Total: ${formatINR(completedInvoice.totalPaise)}
Thank you!`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary w-full text-center text-sm py-2.5 block"
            >
              Share on WhatsApp
            </a>
            <button
              onClick={startNewBill}
              className="w-full py-2.5 rounded-xl border border-border text-sm font-semibold text-charcoal active:bg-ivory"
            >
              New Bill
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted text-sm">
        Loading products…
      </div>
    );
  }

  // ── Mobile Review Bill screen ──────────────────────────
  if (view === 'review') {
    return (
      <div className="min-h-full bg-ivory flex flex-col md:hidden">
        <header className="bg-white border-b border-border px-3 py-2.5 flex items-center gap-3 sticky top-0 z-20">
          <button
            onClick={() => setView('browse')}
            className="w-9 h-9 rounded-xl bg-ivory border border-border flex items-center justify-center text-charcoal"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-semibold text-sm text-charcoal">Review Bill</h1>
            <p className="text-[11px] text-muted">{cart.length} items</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">
          {/* Customer */}
          <button
            onClick={() => setShowCustomerModal(true)}
            className="card w-full flex items-center gap-3 p-3.5 text-left"
          >
            <div className="w-10 h-10 rounded-full bg-emerald/10 flex items-center justify-center text-emerald">
              <UserPlus size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">
                {customer ? customer.name : 'Walk-in customer'}
              </div>
              <div className="text-xs text-muted">
                {customer ? customer.mobile : 'Tap to select or add'}
              </div>
            </div>
          </button>

          {/* Items */}
          <div className="card divide-y divide-border">
            {cart.map((item) => (
              <div key={item.key} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.productName}</div>
                  <div className="text-xs text-muted">
                    {item.productType === 'PER_ML'
                      ? `${item.quantity} ml × ${formatINR(item.unitPricePaise)}`
                      : `${item.quantity} × ${formatINR(item.unitPricePaise)}`}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
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
                    className="w-12 text-center text-sm border border-border rounded-lg py-1"
                  />
                  <button
                    onClick={() => updateQty(item.key, 1)}
                    className="w-7 h-7 rounded-lg border border-border flex items-center justify-center"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <span className="font-semibold text-sm w-16 text-right shrink-0">
                  {formatINR(item.lineTotalPaise)}
                </span>
              </div>
            ))}
          </div>

          {/* Charges */}
          <div className="card p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span>{formatINR(subtotalPaise)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-muted">Additional</span>
              <input
                type="number"
                min="0"
                value={additional || ''}
                onChange={(e) => setAdditional(e.target.value)}
                className="w-24 text-right border border-border rounded-lg px-2 py-1.5 text-sm"
                placeholder="0"
              />
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-muted">Discount</span>
              <input
                type="number"
                min="0"
                value={discount || ''}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-24 text-right border border-border rounded-lg px-2 py-1.5 text-sm"
                placeholder="0"
              />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <span className="font-semibold">Total Payable</span>
              <span className="text-xl font-bold text-emerald">{formatINR(totalPaise)}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="card p-4 space-y-3">
            <p className="text-sm font-semibold text-charcoal">Payment</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={payFullCash}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border border-emerald/30 text-emerald bg-emerald/5"
              >
                <Banknote size={14} /> Full Cash
              </button>
              <button
                type="button"
                onClick={payFullUpi}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border border-gold/40 text-gold-dark bg-gold/10"
              >
                <Smartphone size={14} /> Full UPI
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between mb-0.5">
                  <label className="text-xs text-muted">Cash</label>
                  {toPaise(upi || 0) > 0 && toPaise(upi || 0) < totalPaise && (
                    <button type="button" onClick={payRemainingCash} className="text-[10px] text-emerald font-medium">
                      Fill rest
                    </button>
                  )}
                </div>
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
                <div className="flex justify-between mb-0.5">
                  <label className="text-xs text-muted">UPI</label>
                  {toPaise(cash || 0) > 0 && toPaise(cash || 0) < totalPaise && (
                    <button type="button" onClick={payRemainingUpi} className="text-[10px] text-emerald font-medium">
                      Fill rest
                    </button>
                  )}
                </div>
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
            <div className="text-center text-xs text-muted">
              {(() => {
                const paid = toPaise(cash || 0) + toPaise(upi || 0);
                const diff = totalPaise - paid;
                if (paid === 0) return 'Tap Full Cash or Full UPI';
                if (diff === 0) return <span className="text-emerald font-medium">✓ Exact amount</span>;
                if (diff > 0) return <span className="text-amber-600">Remaining {formatINR(diff)}</span>;
                return <span className="text-red-500">Over by {formatINR(-diff)}</span>;
              })()}
            </div>
          </div>

          <button
            onClick={handleComplete}
            disabled={!cart.length || submitting}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3.5"
          >
            <Check size={18} />
            {submitting ? 'Processing…' : 'Complete Bill'}
          </button>
        </div>

        <CustomerAndModals
          showCustomerModal={showCustomerModal}
          setShowCustomerModal={setShowCustomerModal}
          setCustomer={setCustomer}
          confirmClear={confirmClear}
          setConfirmClear={setConfirmClear}
          doClearCart={doClearCart}
          errorMsg={errorMsg}
          setErrorMsg={setErrorMsg}
        />
      </div>
    );
  }

  // ── Main browse (mobile + desktop) ─────────────────────
  return (
    <div className="flex flex-col h-full md:flex-row md:h-[calc(100vh-0px)]">
      {/* ── Product catalog ── */}
      <div className="flex-1 flex flex-col min-h-0 md:border-r border-border">
                {/* Bill toolbar — global Amwaj header lives in AppShell */}
        <div className="bg-white border-b border-border px-3 py-2.5 shrink-0 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-charcoal leading-tight">New Bill</h1>
            <p className="text-[11px] text-muted">Select products</p>
          </div>
          <button
            onClick={() => setShowCustomerModal(true)}
            className="flex items-center gap-1.5 bg-emerald text-white text-xs font-semibold px-3 py-2 rounded-xl shrink-0 active:bg-emerald-dark"
          >
            <UserPlus size={14} />
            {customer ? (customer.name || '').split(' ')[0] : 'Customer'}
          </button>
        </div>

        {/* Categories — compact icon chips */}
        <div className="px-3 py-2 overflow-x-auto no-scrollbar shrink-0 bg-ivory/80">
          <div className="flex gap-1.5">
            {(Array.isArray(categories) ? categories : []).map((cat) => {
              const active = activeCategory === cat.id;
              const Icon = CATEGORY_ICON[cat.name] || Package;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-emerald text-white shadow-sm'
                      : 'bg-white border border-border text-muted'

                  }`}
                >
                  <Icon size={12} strokeWidth={2.2} className={active ? 'text-gold' : 'text-emerald/70'} />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

{/* Search */}
        <div className="px-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              className="input pl-9 py-2 text-sm"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Product grid — 2 cols on mobile, list on desktop */}
        <div className="flex-1 overflow-y-auto px-3 pb-28 md:pb-4">
          {filteredProducts.length === 0 ? (
            <p className="text-center text-muted text-sm py-10">No products found</p>
          ) : (
            <>
              {/* Mobile: compact 2-column grid */}
              <div className="grid grid-cols-2 gap-1.5 md:hidden">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="bg-white rounded-xl border border-border px-2.5 py-2 text-left active:scale-[0.98] transition-transform flex items-center gap-1.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[13px] text-charcoal leading-tight truncate">
                        {p?.name || 'Product'}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5 truncate">
                        {p?.productType === 'PER_ML'
                          ? `${formatINR(p?.unitPrice)}/ml`
                          : formatINR(p?.unitPrice)}
                      </div>
                    </div>
                    <span className="w-6 h-6 rounded-full bg-emerald text-white flex items-center justify-center shrink-0">
                      <Plus size={12} strokeWidth={2.5} />
                    </span>
                  </button>
                ))}
              </div>

              {/* Desktop: list rows */}
              <div className="hidden md:block space-y-2">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 bg-white rounded-2xl border border-border px-3 py-3"
                  >
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
                      className="shrink-0 w-9 h-9 rounded-full bg-emerald text-white flex items-center justify-center active:bg-emerald-dark"
                    >
                      <Plus size={18} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Desktop cart panel (unchanged structure) ── */}
      <div className="hidden md:flex bg-white md:w-[360px] lg:w-[400px] flex-col shrink-0 border-l border-border h-full">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="font-semibold text-charcoal text-sm">
            Bill Items ({cart.length})
          </div>
          {cart.length > 0 && (
            <button onClick={() => setConfirmClear(true)} className="text-muted text-sm flex items-center gap-1">
              <Trash2 size={14} /> Clear
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
          {cart.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">Add products to start a bill</p>
          ) : (
            cart.map((item) => (
              <CartLine
                key={item.key}
                item={item}
                updateQty={updateQty}
                setItemQty={setItemQty}
                removeItem={removeItem}
              />
            ))
          )}
        </div>
        <DesktopPayFooter
          cart={cart}
          subtotalPaise={subtotalPaise}
          additional={additional}
          setAdditional={setAdditional}
          discount={discount}
          setDiscount={setDiscount}
          totalPaise={totalPaise}
          cash={cash}
          setCash={setCash}
          upi={upi}
          setUpi={setUpi}
          payFullCash={payFullCash}
          payFullUpi={payFullUpi}
          payRemainingCash={payRemainingCash}
          payRemainingUpi={payRemainingUpi}
          handleComplete={handleComplete}
          submitting={submitting}
        />
      </div>

      {/* ── Mobile fixed bottom bill bar ── */}
      <div className="md:hidden fixed bottom-[calc(3.5rem+var(--safe-bottom))] inset-x-0 z-30 pointer-events-none">
        {/* Expanded sheet */}
        {billExpanded && cart.length > 0 && (
          <div className="pointer-events-auto bg-white rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.12)] border-t border-border max-h-[75vh] flex flex-col animate-sheet-up">
            <button
              onClick={() => setBillExpanded(false)}
              className="flex items-center justify-center gap-1 pt-2.5 pb-1 text-muted"
            >
              <div className="w-10 h-1 rounded-full bg-border" />
            </button>
            <div className="px-4 pb-2 flex items-center justify-between">
              <span className="font-semibold text-sm">Bill Items ({cart.length})</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmClear(true)}
                  className="text-xs text-muted flex items-center gap-1"
                >
                  <Trash2 size={12} /> Clear
                </button>
                <button
                  onClick={() => setBillExpanded(false)}
                  className="text-xs text-emerald font-medium flex items-center gap-0.5"
                >
                  Collapse <ChevronDown size={14} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 space-y-1 min-h-0 max-h-[45vh]">
              {cart.map((item) => (
                <CartLine
                  key={item.key}
                  item={item}
                  updateQty={updateQty}
                  setItemQty={setItemQty}
                  removeItem={removeItem}
                  compact
                />
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-border space-y-1.5 shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted">{cart.length} items</span>
                <span className="font-bold text-emerald text-sm">{formatINR(totalPaise)}</span>
              </div>
              <button
                onClick={() => {
                  setBillExpanded(false);
                  setView('review');
                }}
                className="btn-primary w-full py-2.5 text-sm"
              >
                Review Bill →
              </button>
            </div>
          </div>
        )}

        {/* Collapsed bar — margin above bottom nav, compact controls */}
        {!billExpanded && (
          <div className="pointer-events-auto mx-3 mb-3">
            <div className="bg-white rounded-2xl shadow-card border border-border px-3 py-2 flex items-center gap-2.5">
              {cart.length === 0 ? (
                <div className="flex-1 text-xs text-muted text-center py-1">
                  Add products to start
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setBillExpanded(true)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="text-[11px] text-muted flex items-center gap-1">
                      Bill items ({cart.length})
                      <ChevronUp size={12} />
                    </div>
                    <div className="font-bold text-emerald text-sm leading-tight">
                      {formatINR(totalPaise)}
                    </div>
                  </button>
                  <button
                    onClick={() => setView('review')}
                    className="shrink-0 bg-emerald text-white text-xs font-semibold px-3.5 py-2 rounded-xl active:bg-emerald-dark"
                  >
                    Review Bill →
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <CustomerAndModals
        showCustomerModal={showCustomerModal}
        setShowCustomerModal={setShowCustomerModal}
        setCustomer={setCustomer}
        confirmClear={confirmClear}
        setConfirmClear={setConfirmClear}
        doClearCart={doClearCart}
        errorMsg={errorMsg}
        setErrorMsg={setErrorMsg}
      />
    </div>
  );
}

/* ── Shared cart line ───────────────────────────────────── */
function CartLine({ item, updateQty, setItemQty, removeItem, compact }) {
  return (
    <div className={`flex gap-2 items-start ${compact ? 'py-2 border-b border-border last:border-0' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{item.productName}</div>
        <div className="text-[11px] text-muted">
          {item.productType === 'PER_ML'
            ? `${item.quantity} ml × ${formatINR(item.unitPricePaise)}/ml`
            : item.productType === 'SPRAY' && item.sprayBottleMl
            ? `${item.sprayBottleMl} ml (Oil: ${item.sprayOilMl} ml)`
            : `${item.quantity} × ${formatINR(item.unitPricePaise)}`}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <button
            onClick={() => updateQty(item.key, -1)}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center"
          >
            <Minus size={13} />
          </button>
          <input
            type="number"
            step={item.productType === 'PER_ML' ? 0.5 : 1}
            value={item.quantity}
            onChange={(e) => setItemQty(item.key, e.target.value)}
            className="w-12 text-center text-sm border border-border rounded-lg py-0.5"
          />
          <button
            onClick={() => updateQty(item.key, 1)}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={() => removeItem(item.key)}
            className="ml-1 w-7 h-7 rounded-lg text-muted flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <span className="font-semibold text-sm shrink-0 pt-0.5">
        {formatINR(item.lineTotalPaise)}
      </span>
    </div>
  );
}

/* ── Desktop payment footer ─────────────────────────────── */
function DesktopPayFooter({
  cart, subtotalPaise, additional, setAdditional, discount, setDiscount,
  totalPaise, cash, setCash, upi, setUpi, payFullCash, payFullUpi,
  payRemainingCash, payRemainingUpi, handleComplete, submitting,
}) {
  return (
    <div className="border-t border-border px-4 py-3 space-y-2 bg-ivory/50">
      <div className="flex justify-between text-sm">
        <span className="text-muted">Subtotal</span>
        <span>{formatINR(subtotalPaise)}</span>
      </div>
      <div className="flex justify-between text-sm items-center">
        <span className="text-muted">Additional</span>
        <input
          type="number" min="0" value={additional || ''}
          onChange={(e) => setAdditional(e.target.value)}
          className="w-24 text-right border border-border rounded-lg px-2 py-1 text-sm"
          placeholder="0"
        />
      </div>
      <div className="flex justify-between text-sm items-center">
        <span className="text-muted">Discount</span>
        <input
          type="number" min="0" value={discount || ''}
          onChange={(e) => setDiscount(e.target.value)}
          className="w-24 text-right border border-border rounded-lg px-2 py-1 text-sm"
          placeholder="0"
        />
      </div>
      <div className="flex justify-between items-center pt-1">
        <span className="font-semibold">Total Payable</span>
        <span className="text-xl font-bold text-emerald">{formatINR(totalPaise)}</span>
      </div>
      {cart.length > 0 && totalPaise > 0 && (
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={payFullCash}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl border border-emerald/30 text-emerald bg-emerald/5">
            <Banknote size={14} /> Full Cash
          </button>
          <button type="button" onClick={payFullUpi}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl border border-gold/40 text-gold-dark bg-gold/10">
            <Smartphone size={14} /> Full UPI
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="flex justify-between mb-0.5">
            <label className="text-xs text-muted">Cash</label>
            {toPaise(upi || 0) > 0 && toPaise(upi || 0) < totalPaise && (
              <button type="button" onClick={payRemainingCash} className="text-[10px] text-emerald font-medium">Fill rest</button>
            )}
          </div>
          <input type="number" min="0" value={cash} onChange={(e) => setCash(e.target.value)}
            className="input py-2 text-sm" placeholder="₹0" />
        </div>
        <div>
          <div className="flex justify-between mb-0.5">
            <label className="text-xs text-muted">UPI</label>
            {toPaise(cash || 0) > 0 && toPaise(cash || 0) < totalPaise && (
              <button type="button" onClick={payRemainingUpi} className="text-[10px] text-emerald font-medium">Fill rest</button>
            )}
          </div>
          <input type="number" min="0" value={upi} onChange={(e) => setUpi(e.target.value)}
            className="input py-2 text-sm" placeholder="₹0" />
        </div>
      </div>
      <button onClick={handleComplete} disabled={!cart.length || submitting}
        className="btn-primary w-full mt-1 flex items-center justify-center gap-2">
        <Check size={18} />
        {submitting ? 'Processing…' : 'Complete Bill'}
      </button>
    </div>
  );
}

/* ── Shared modals ──────────────────────────────────────── */
function CustomerAndModals({
  showCustomerModal, setShowCustomerModal, setCustomer,
  confirmClear, setConfirmClear, doClearCart, errorMsg, setErrorMsg,
}) {
  return (
    <>
      {showCustomerModal && (
        <CustomerQuickSelect
          onClose={() => setShowCustomerModal(false)}
          onSelect={(c) => {
            setCustomer(c);
            setShowCustomerModal(false);
          }}
        />
      )}
      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={doClearCart}
        title="Clear bill?"
        message="All items, discount and payments will be removed."
        confirmLabel="Clear"
        danger
      />
      <Modal
        open={!!errorMsg}
        onClose={() => setErrorMsg('')}
        title="Notice"
        size="sm"
        footer={
          <button onClick={() => setErrorMsg('')} className="btn-primary w-full">OK</button>
        }
      >
        <p className="text-sm text-muted">{errorMsg}</p>
      </Modal>
    </>
  );
}

function CustomerQuickSelect({ onClose, onSelect }) {
  const [search, setSearch] = useState('');
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api.getCustomers(search).then(setList).catch(console.error);
    }, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [search]);

  const create = async () => {
    if (!name.trim() || !mobile.trim()) {
      setErr('Name and mobile are required');
      return;
    }
    try {
      const c = await api.createCustomer({ name: name.trim(), mobile: mobile.trim() });
      onSelect(c);
    } catch (error) {
      if (error.message?.includes('already exists')) {
        const existing = await api.getCustomers(mobile);
        if (existing[0]) onSelect(existing[0]);
        else setErr(error.message);
      } else {
        setErr(error.message || 'Could not create customer');
      }
    }
  };

  return (
    <Modal open onClose={onClose} title="Select Customer">
      <div className="space-y-3">
        <input
          className="input py-2.5 text-sm"
          placeholder="Search by name or mobile"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="space-y-1 max-h-36 overflow-y-auto">
          {list.length === 0 ? (
            <p className="text-xs text-muted text-center py-3">No customers found</p>
          ) : (
            list.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className="w-full text-left px-3 py-2.5 rounded-xl active:bg-ivory text-sm"
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-muted text-xs">{c.mobile}</div>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs text-muted font-medium">Or create new</p>
          <input className="input py-2.5 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input py-2.5 text-sm" placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" />
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button onClick={create} className="btn-primary w-full text-sm py-2.5">Create & Select</button>
        </div>
        <button onClick={() => onSelect(null)} className="w-full text-center text-sm text-muted py-2">
          Continue as Walk-in
        </button>
      </div>
    </Modal>
  );
}
