import React, { useEffect, useState } from 'react';
import { api, formatINR } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, BarChart3, Store, ChevronRight, ChevronLeft,
  User, Shield
} from 'lucide-react';

const MENU = [
  { id: 'shop', label: 'Shop Profile', desc: 'Name, address, invoice prefix', icon: Store },
  { id: 'reports', label: 'Reports', desc: 'Sales totals & top items', icon: BarChart3 },
  { id: 'account', label: 'Account', desc: 'Logged-in staff & sign out', icon: User },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [section, setSection] = useState(null); // null = menu list
  const [settings, setSettings] = useState(null);
  const [report, setReport] = useState(null);
  const [reportDate, setReportDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    api.getSettings().then(setSettings).catch(console.error);
  }, []);

  useEffect(() => {
    if (section !== 'reports') return;
    setLoadingReport(true);
    api.getSalesReport({ from: reportDate, to: reportDate })
      .then(setReport)
      .catch(console.error)
      .finally(() => setLoadingReport(false));
  }, [section, reportDate]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      setToast('Saved successfully');
      setTimeout(() => setToast(''), 2000);
    } catch (err) {
      setToast(err.message || 'Save failed');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  // ── Menu list ──────────────────────────────────────────
  if (!section) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-charcoal mb-1">Settings</h1>
        <p className="text-sm text-muted mb-5">Choose a section</p>

        <div className="space-y-2">
          {MENU.map(({ id, label, desc, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className="card w-full flex items-center gap-3 p-4 text-left active:scale-[0.99] transition-transform"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald/10 flex items-center justify-center text-emerald shrink-0">
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-charcoal">{label}</div>
                <div className="text-xs text-muted truncate">{desc}</div>
              </div>
              <ChevronRight size={18} className="text-muted shrink-0" />
            </button>
          ))}
        </div>

        <div className="mt-8 text-center text-xs text-muted flex items-center justify-center gap-1.5">
          <Shield size={12} />
          Internal staff access only · Amwaj POS
        </div>
      </div>
    );
  }

  // ── Shared back header ─────────────────────────────────
  const BackHeader = ({ title }) => (
    <div className="flex items-center gap-2 mb-5">
      <button
        onClick={() => setSection(null)}
        className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted active:bg-ivory"
      >
        <ChevronLeft size={18} />
      </button>
      <h1 className="text-xl font-bold text-charcoal">{title}</h1>
    </div>
  );

  // ── Shop Profile ───────────────────────────────────────
  if (section === 'shop') {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <BackHeader title="Shop Profile" />
        {settings ? (
          <div className="card p-4 space-y-3">
            <div>
              <label className="text-xs text-muted font-medium">Shop Name</label>
              <input
                className="input mt-1"
                value={settings.shopName || ''}
                onChange={(e) => setSettings({ ...settings, shopName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted font-medium">Address</label>
              <input
                className="input mt-1"
                value={settings.address || ''}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted font-medium">Phone</label>
              <input
                className="input mt-1"
                value={settings.phone || ''}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted font-medium">Invoice Prefix</label>
              <input
                className="input mt-1"
                value={settings.invoicePrefix || ''}
                onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
              />
            </div>
            <button onClick={save} disabled={saving} className="btn-primary w-full mt-2">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {toast && (
              <p className="text-center text-sm text-emerald font-medium pt-2">{toast}</p>
            )}
          </div>
        ) : (
          <div className="card p-8 text-center text-muted text-sm">Loading…</div>
        )}
      </div>
    );
  }

  // ── Reports ────────────────────────────────────────────
  if (section === 'reports') {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <BackHeader title="Reports" />

        <div className="mb-4">
          <label className="text-xs text-muted font-medium">Date</label>
          <input
            type="date"
            className="input mt-1"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            max={todayISO()}
          />
        </div>

        {loadingReport ? (
          <div className="card p-8 text-center text-muted text-sm">Loading report…</div>
        ) : report ? (
          <div className="card p-4 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-muted text-sm">Total Sales</span>
              <span className="text-2xl font-bold text-emerald">{formatINR(report.totalSalesPaise)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div className="bg-ivory rounded-xl p-3 text-center">
                <div className="text-lg font-semibold">{report.billCount}</div>
                <div className="text-xs text-muted">Bills</div>
              </div>
              <div className="bg-ivory rounded-xl p-3 text-center">
                <div className="text-lg font-semibold">{formatINR(report.averageBillPaise)}</div>
                <div className="text-xs text-muted">Avg Bill</div>
              </div>
            </div>
            <div className="pt-2 border-t border-border space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Cash</span>
                <span className="font-medium">{formatINR(report.byPaymentMethod?.CASH || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">UPI</span>
                <span className="font-medium">{formatINR(report.byPaymentMethod?.UPI || 0)}</span>
              </div>
            </div>
            {report.topItems?.length > 0 && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted font-medium mb-2">Top items</p>
                {report.topItems.slice(0, 8).map((it) => (
                  <div key={it.name} className="flex justify-between text-sm py-1">
                    <span className="truncate pr-2">{it.name}</span>
                    <span className="text-muted shrink-0">{formatINR(it.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="card p-8 text-center text-muted text-sm">No data for this date</div>
        )}
      </div>
    );
  }

  // ── Account ────────────────────────────────────────────
  if (section === 'account') {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <BackHeader title="Account" />
        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald/10 flex items-center justify-center text-emerald font-bold text-lg">
              {(user?.name || 'A')[0].toUpperCase()}
            </div>
            <div>
              <div className="font-semibold">{user?.name}</div>
              <div className="text-sm text-muted">{user?.role} · @{user?.username}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 text-red-600 font-medium border border-red-200 rounded-xl py-3 active:bg-red-50"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return null;
}
