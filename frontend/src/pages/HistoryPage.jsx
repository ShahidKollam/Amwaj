import React, { useEffect, useState } from 'react';
import { api, formatINR } from '../services/api';
import { Search, FileText } from 'lucide-react';

export default function HistoryPage() {
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.getHistory({ search })
      .then(setInvoices)
      .finally(() => setLoading(false));
  }, [search]);

  const openInvoice = async (id) => {
    const inv = await api.getInvoice(id);
    setSelected(inv);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-charcoal mb-4">History</h1>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          className="input pl-10"
          placeholder="Search invoice or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : invoices.length === 0 ? (
        <p className="text-muted text-center py-8">No invoices yet</p>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <button
              key={inv.id}
              onClick={() => openInvoice(inv.id)}
              className="card w-full flex items-center gap-3 p-3 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald/10 flex items-center justify-center text-emerald">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{inv.invoiceNumber}</div>
                <div className="text-xs text-muted">
                  {inv.customer?.name || 'Walk-in'} · {new Date(inv.createdAt).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="font-semibold text-emerald">{formatINR(inv.totalPaise)}</div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg">{selected.invoiceNumber}</h3>
                <p className="text-sm text-muted">{new Date(selected.createdAt).toLocaleString('en-IN')}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted">Close</button>
            </div>
            {selected.customer && (
              <p className="text-sm mb-3">{selected.customer.name} · {selected.customer.mobile}</p>
            )}
            <div className="space-y-2 border-t border-border pt-3">
              {selected.items.map((it) => (
                <div key={it.id} className="flex justify-between text-sm">
                  <span>
                    {it.productName}
                    {it.productType === 'PER_ML' ? ` (${it.quantity} ml)` : ''}
                  </span>
                  <span>{formatINR(it.lineTotalPaise)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border mt-3 pt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{formatINR(selected.subtotalPaise)}</span></div>
              {selected.additionalPaise > 0 && (
                <div className="flex justify-between"><span className="text-muted">Additional</span><span>{formatINR(selected.additionalPaise)}</span></div>
              )}
              {selected.discountPaise > 0 && (
                <div className="flex justify-between"><span className="text-muted">Discount</span><span>-{formatINR(selected.discountPaise)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base pt-1">
                <span>Total</span>
                <span className="text-emerald">{formatINR(selected.totalPaise)}</span>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted">
              Paid: {selected.payments.map((p) => `${p.method} ${formatINR(p.amountPaise)}`).join(' + ')}
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `*Amwaj Invoice ${selected.invoiceNumber}*\nTotal: ${formatINR(selected.totalPaise)}\nThank you!`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary w-full mt-4 text-center block"
            >
              Share on WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
