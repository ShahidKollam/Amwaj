import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDayLabel(iso) {
  if (!iso) return 'All dates';
  const d = new Date(iso + 'T12:00:00');
  const today = todayISO();
  if (iso === today) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (iso === y.toISOString().slice(0, 10)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Professional single-day navigator.
 * @param {string|null} value - YYYY-MM-DD or null when allowAll
 * @param {(v: string|null) => void} onChange
 * @param {boolean} [allowAll=false] - Customers: null = all dates
 * @param {string} [hint] - small subtitle under the label
 */
export default function DayFilter({ value, onChange, allowAll = false, hint }) {
  const inputRef = useRef(null);
  const today = todayISO();
  const activeDate = value || (allowAll ? null : today);
  const atMax = activeDate != null && activeDate >= today;
  const label = formatDayLabel(activeDate);

  const shift = (delta) => {
    if (allowAll && !activeDate) {
      if (delta < 0) onChange(today);
      return;
    }
    const base = activeDate || today;
    const d = new Date(base + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    const next = d.toISOString().slice(0, 10);
    if (next > today) return;
    onChange(next);
  };

  return (
    <div className="rounded-2xl border border-border bg-white shadow-soft overflow-hidden mb-3">
      <div className="flex items-stretch">
        {/* Prev */}
        <button
          type="button"
          onClick={() => shift(-1)}
          className="w-12 shrink-0 flex items-center justify-center text-emerald border-r border-border active:bg-ivory"
          aria-label="Previous day"
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
        </button>

        {/* Center */}
        <button
          type="button"
          onClick={() => inputRef.current?.showPicker?.() || inputRef.current?.click()}
          className="flex-1 min-w-0 py-3 px-3 text-center active:bg-ivory/80"
        >
          <div className="flex items-center justify-center gap-1.5 text-charcoal">
            <Calendar size={15} className="text-emerald shrink-0" strokeWidth={2} />
            <span className="font-semibold text-sm tracking-tight">{label}</span>
          </div>
          <div className="text-[11px] text-muted mt-0.5 tabular-nums">
            {activeDate
              ? new Date(activeDate + 'T12:00:00').toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Tap to pick a day'}
          </div>
          {hint && <div className="text-[10px] text-muted/80 mt-0.5">{hint}</div>}
          <input
            ref={inputRef}
            type="date"
            value={activeDate || ''}
            max={today}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v ? v : allowAll ? null : today);
            }}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
        </button>

        {/* Next */}
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={atMax || (allowAll && !activeDate)}
          className="w-12 shrink-0 flex items-center justify-center text-emerald border-l border-border active:bg-ivory disabled:opacity-25 disabled:pointer-events-none"
          aria-label="Next day"
        >
          <ChevronRight size={20} strokeWidth={2.2} />
        </button>
      </div>

      {allowAll && activeDate && (
        <div className="border-t border-border px-3 py-2 flex justify-center bg-ivory/40">
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs font-semibold text-emerald px-3 py-1 rounded-lg active:bg-emerald/10"
          >
            Show all dates
          </button>
        </div>
      )}
    </div>
  );
}
