import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { Search, User, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const PAGE_SIZE = 20;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(iso) {
  if (!iso) return 'All dates';
  const d = new Date(iso + 'T12:00:00');
  const today = todayISO();
  if (iso === today) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === yesterday.toISOString().slice(0, 10)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // null = all dates; otherwise YYYY-MM-DD (joined date)
  const [date, setDate] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .getCustomersPage({
        search: search.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
        date: date || undefined,
      })
      .then((res) => {
        setCustomers(Array.isArray(res?.items) ? res.items : []);
        setTotal(res?.total ?? 0);
        setTotalPages(Math.max(1, res?.totalPages ?? 1));
      })
      .catch((err) => {
        console.error(err);
        setCustomers([]);
        setError(err?.message || 'Could not load customers');
      })
      .finally(() => setLoading(false));
  }, [search, page, date]);

  useEffect(() => {
    const t = setTimeout(load, search ? 280 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  useEffect(() => {
    setPage(1);
  }, [search, date]);

  const shiftDate = (delta) => {
    if (!date) {
      // Start from today when entering date mode
      if (delta < 0) setDate(todayISO());
      return;
    }
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    const next = d.toISOString().slice(0, 10);
    if (next > todayISO()) return;
    setDate(next);
  };

  return (
    <div className="p-4 max-w-3xl mx-auto pb-6">
      <h1 className="text-xl font-bold text-charcoal mb-1">Customers</h1>
      <p className="text-sm text-muted mb-3">{total} total</p>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          className="input pl-10 py-2.5 text-sm"
          placeholder="Search name or mobile…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Date navigator — same pattern as History */}
      <div className="card p-3 mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => shiftDate(-1)}
          className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted active:bg-ivory"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center">
          <div className="font-semibold text-charcoal text-sm">{formatDateLabel(date)}</div>
          <label className="inline-flex items-center gap-1 text-xs text-muted mt-0.5 cursor-pointer">
            <Calendar size={12} />
            <input
              type="date"
              value={date || ''}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value || null)}
              className="bg-transparent text-xs text-muted border-0 p-0 focus:outline-none"
            />
          </label>
          {date && (
            <button
              type="button"
              onClick={() => setDate(null)}
              className="block mx-auto mt-1 text-[11px] font-semibold text-emerald"
            >
              Show all dates
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => shiftDate(1)}
          disabled={!date || date >= todayISO()}
          className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted active:bg-ivory disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
          {error}
          <button type="button" onClick={load} className="ml-2 underline font-medium">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-14 animate-pulse bg-ivory" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="card p-8 text-center text-muted text-sm">
          {search || date ? 'No matching customers' : 'No customers yet'}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {customers.map((c) => (
              <div key={c?.id || c?.mobile} className="card flex items-center gap-3 p-3">
                <div className="w-10 h-10 rounded-full bg-emerald/10 flex items-center justify-center text-emerald shrink-0">
                  <User size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{c?.name || '—'}</div>
                  <div className="text-xs text-muted">
                    {c?.mobile || ''}
                    {c?.createdAt
                      ? ` · ${new Date(c.createdAt).toLocaleDateString('en-IN')}`
                      : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="w-9 h-9 rounded-xl border border-border flex items-center justify-center disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-muted">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="w-9 h-9 rounded-xl border border-border flex items-center justify-center disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
