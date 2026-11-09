import React, { useEffect, useState, useCallback } from 'react';
import { api, formatINR } from '../services/api';
import { Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import DayFilter, { todayISO } from '../components/DayFilter';
import Modal from '../components/Modal';
import { getWhatsAppShareUrl } from '../utils/whatsapp';

const PAGE_SIZE = 20;

export default function HistoryPage() {
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(todayISO());
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [dayTotal, setDayTotal] = useState(0);
  const [dayCount, setDayCount] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getHistory({
        search: search.trim() || undefined,
        from: date,
        to: date,
        date,
        pageSize: 50,
      })
      .then((res) => {
        const list = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        setInvoices(list);
        setDayTotal(
          typeof res?.dayTotalPaise === 'number'
            ? res.dayTotalPaise
            : list.reduce((s, inv) => s + (inv.totalPaise || 0), 0)
        );
        setDayCount(
          typeof res?.dayBillCount === 'number' ? res.dayBillCount : list.length
        );
        setPage(0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, date]);

  useEffect(() => {
    const t = setTimeout(load, search ? 280 : 0); // debounce search
    return () => clearTimeout(t);
  }, [load, search]);

  const openInvoice = async (id) => {
    try {
      const inv = await api.getInvoice(id);
      setSelected(inv);
    } catch (e) {
      console.error(e);
    }
  };

  const pageItems = invoices.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));

  return (
    <div className="p-4 max-w-3xl mx-auto pb-6">
      <h1 className="text-xl font-bold text-charcoal mb-4">History</h1>

      <DayFilter value={date} onChange={setDate} hint="Bills for this day" />

      {/* Day summary */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="card p-3 text-center">
          <div className="text-lg font-bold text-emerald">{formatINR(dayTotal)}</div>
          <div className="text-[11px] text-muted">Day total</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-lg font-bold text-charcoal">{dayCount}</div>
          <div className="text-[11px] text-muted">Bills</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          className="input pl-10 py-2.5 text-sm"
          placeholder="Search invoice or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-16 animate-pulse bg-ivory" />
          ))}
        </div>
      ) : pageItems.length === 0 ? (
        <div className="card p-8 text-center text-muted text-sm">
          No bills on this date
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {pageItems.map((inv) => (
              <button
                key={inv.id}
                onClick={() => openInvoice(inv.id)}
                className="card w-full flex items-center gap-3 p-3 text-left active:scale-[0.99] transition-transform"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald/10 flex items-center justify-center text-emerald shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{inv.invoiceNumber}</div>
                  <div className="text-xs text-muted truncate">
                    {inv.customer?.name || 'Walk-in'} ·{' '}
                    {new Date(inv.createdAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="font-semibold text-emerald text-sm shrink-0">
                  {formatINR(inv.totalPaise)}
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-9 h-9 rounded-xl border border-border flex items-center justify-center disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-muted">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="w-9 h-9 rounded-xl border border-border flex items-center justify-center disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Invoice detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.invoiceNumber || 'Invoice'}
        footer={
          selected && (
            <a
              href={getWhatsAppShareUrl(selected, 'Amwaj')}
              target="_blank"
              rel="noreferrer"
              className="btn-primary w-full text-center block"
            >
              {selected.customer?.mobile ? 'Send on WhatsApp' : 'Share on WhatsApp'}
            </a>
          )
        }
      >
        {selected && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {new Date(selected.createdAt).toLocaleString('en-IN')}
            </p>
            {selected.customer && (
              <p className="text-sm">
                {selected.customer.name} · {selected.customer.mobile}
              </p>
            )}
            <div className="space-y-2 border-t border-border pt-3">
              {selected.items.map((it) => (
                <div key={it.id} className="flex justify-between text-sm">
                  <span>
                    {it.productName}
                    {it.productType === 'PER_ML' ? ` (${it.quantity} ml)` : ''}
                  </span>
                  <span className="font-medium">{formatINR(it.lineTotalPaise)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span>{formatINR(selected.subtotalPaise)}</span>
              </div>
              {selected.additionalPaise > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">Additional</span>
                  <span>{formatINR(selected.additionalPaise)}</span>
                </div>
              )}
              {selected.discountPaise > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">Discount</span>
                  <span>-{formatINR(selected.discountPaise)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1">
                <span>Total</span>
                <span className="text-emerald">{formatINR(selected.totalPaise)}</span>
              </div>
            </div>
            <div className="text-xs text-muted pt-1">
              Paid:{' '}
              {selected.payments
                ?.map((p) => `${p.method} ${formatINR(p.amountPaise)}`)
                .join(' + ')}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
