import React, { useEffect, useState } from 'react';
import { api, formatINR } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LogOut, BarChart3 } from 'lucide-react';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState(null);
  const [report, setReport] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(console.error);
    api.getSalesReport().then(setReport).catch(console.error);
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      alert('Saved');
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-charcoal">Settings</h1>

      <section className="card p-4">
        <h2 className="font-semibold mb-3">Shop Profile</h2>
        {settings ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted">Shop Name</label>
              <input
                className="input"
                value={settings.shopName || ''}
                onChange={(e) => setSettings({ ...settings, shopName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted">Address</label>
              <input
                className="input"
                value={settings.address || ''}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted">Phone</label>
              <input
                className="input"
                value={settings.phone || ''}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted">Invoice Prefix</label>
              <input
                className="input"
                value={settings.invoicePrefix || ''}
                onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
              />
            </div>
            <button onClick={save} disabled={saving} className="btn-primary w-full">
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        ) : (
          <p className="text-muted">Loading…</p>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <BarChart3 size={18} /> Reports
        </h2>
        {report ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Total Sales</span>
              <span className="font-semibold text-emerald">{formatINR(report.totalSalesPaise)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Bills</span>
              <span>{report.billCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Average Bill</span>
              <span>{formatINR(report.averageBillPaise)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Cash</span>
              <span>{formatINR(report.byPaymentMethod?.CASH || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">UPI</span>
              <span>{formatINR(report.byPaymentMethod?.UPI || 0)}</span>
            </div>
            {report.topItems?.length > 0 && (
              <div className="pt-3 border-t border-border">
                <p className="text-muted text-xs mb-2">Top items</p>
                {report.topItems.slice(0, 5).map((it) => (
                  <div key={it.name} className="flex justify-between text-xs py-0.5">
                    <span className="truncate">{it.name}</span>
                    <span>{formatINR(it.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted text-sm">No data yet</p>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-semibold mb-2">Account</h2>
        <p className="text-sm text-muted mb-3">{user?.name} ({user?.role})</p>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-red-600 text-sm font-medium"
        >
          <LogOut size={16} /> Sign out
        </button>
      </section>
    </div>
  );
}
