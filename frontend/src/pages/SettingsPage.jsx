import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, formatINR } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, BarChart3, Store, ChevronRight, ChevronLeft,
  User, Users, KeyRound, Calendar, Download, FileSpreadsheet, FileText, ChevronDown,
} from 'lucide-react';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function BackHeader({ title, onBack }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <button
        type="button"
        onClick={onBack}
        className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted active:bg-ivory"
      >
        <ChevronLeft size={18} />
      </button>
      <h2 className="text-lg font-bold text-charcoal">{title}</h2>
    </div>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isOwner = user?.role === 'OWNER';

  /** Escape text for safe insertion into print HTML */
  const escapeHtml = (value) => {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const [section, setSection] = useState(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [staffPwdOpen, setStaffPwdOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [report, setReport] = useState(null);
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [toast, setToast] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: '', username: '', password: '' });
  const [editStaff, setEditStaff] = useState(null); // { id, name, password, isActive }
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  const menu = [
    { id: 'shop', label: 'Shop Profile', desc: 'Name, address, invoice prefix', icon: Store },
    ...(isOwner
      ? [{ id: 'reports', label: 'Reports', desc: 'Sales by date range', icon: BarChart3 }]
      : []),
    ...(isOwner
      ? [{ id: 'staff', label: 'Staff accounts', desc: 'Create & edit staff', icon: Users }]
      : []),
    {
      id: 'account',
      label: 'Account',
      desc: 'Change password & sign out',
      icon: User,
    },
  ];

  useEffect(() => {
    api.getSettings().then(setSettings).catch(console.error);
  }, []);

  // Bottom/side Settings tab while already in a sub-section → back to menu
  useEffect(() => {
    if (location.state?.settingsHome) {
      setSection(null);
      setPwdOpen(false);
    }
  }, [location.state?.settingsHome]);

  useEffect(() => {
    if (section !== 'reports' || !isOwner) return;
    setLoadingReport(true);
    api
      .getSalesReport({ from: fromDate, to: toDate })
      .then(setReport)
      .catch((err) => {
        console.error(err);
        setReport(null);
        setToast(err.message || 'Could not load report');
        setTimeout(() => setToast(''), 3000);
      })
      .finally(() => setLoadingReport(false));
  }, [section, fromDate, toDate, isOwner]);

  useEffect(() => {
    if (section !== 'staff' || !isOwner) return;
    api
      .getUsers()
      .then((list) => setStaffList(Array.isArray(list) ? list : []))
      .catch(console.error);
  }, [section, isOwner]);

  const saveShop = async () => {
    setSaving(true);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      setToast('Saved');
      setTimeout(() => setToast(''), 2000);
    } catch (err) {
      setToast(err.message || 'Save failed');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const createStaff = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const created = await api.createStaff(staffForm);
      setStaffList((prev) => [...prev, created]);
      setStaffForm({ name: '', username: '', password: '' });
      setToast('Staff account created');
      setTimeout(() => setToast(''), 2000);
    } catch (err) {
      setToast(err.message || 'Could not create staff');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setBusy(false);
    }
  };

  const saveStaffEdit = async (e) => {
    e.preventDefault();
    if (!editStaff?.id) return;
    setBusy(true);
    try {
      const payload = {
        name: editStaff.name,
        isActive: editStaff.isActive,
      };
      if (editStaff.password && editStaff.password.length >= 4) {
        payload.password = editStaff.password;
      }
      const updated = await api.updateStaff(editStaff.id, payload);
      setStaffList((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditStaff(null);
      setToast('Staff updated');
      setTimeout(() => setToast(''), 2000);
    } catch (err) {
      setToast(err.message || 'Could not update staff');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirm) {
      setToast('New passwords do not match');
      setTimeout(() => setToast(''), 3000);
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(pwdForm.currentPassword, pwdForm.newPassword);
      setPwdForm({ currentPassword: '', newPassword: '', confirm: '' });
      setToast('Password updated');
      setTimeout(() => setToast(''), 2000);
    } catch (err) {
      setToast(err.message || 'Could not change password');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setBusy(false);
    }
  };


  const paiseToNum = (p) => (Number(p) || 0) / 100;

  /** Excel-friendly CSV (opens cleanly in Excel / Sheets) */
  const downloadReportExcel = () => {
    if (!report) return;
    const rows = [];
    rows.push(['Amwaj POS — Sales Report']);
    rows.push(['From', fromDate, 'To', toDate]);
    rows.push([]);
    rows.push(['Summary']);
    rows.push(['Total sales (₹)', paiseToNum(report.totalSalesPaise)]);
    rows.push(['Bills', report.billCount ?? 0]);
    rows.push(['Average bill (₹)', paiseToNum(report.averageBillPaise)]);
    rows.push(['Cash (₹)', paiseToNum(report.byPaymentMethod?.CASH)]);
    rows.push(['UPI (₹)', paiseToNum(report.byPaymentMethod?.UPI)]);
    if (report.totalCostPaise != null) {
      rows.push(['Est. cost (₹)', paiseToNum(report.totalCostPaise)]);
    }
    if (report.totalProfitPaise != null) {
      rows.push(['Est. profit (₹)', paiseToNum(report.totalProfitPaise)]);
    }
    rows.push([]);
    rows.push(['Top items']);
    rows.push(['Item', 'Qty', 'Sales (₹)']);
    (report.topItems || []).forEach((it) => {
      rows.push([
        it.productName || it.name || '—',
        Number(it.quantity) || it.qty || 0,
        paiseToNum(it.salesPaise ?? it.lineTotalPaise ?? it.totalPaise ?? it.revenue),
      ]);
    });
    rows.push([]);
    rows.push(['Top customers']);
    rows.push(['Customer', 'Mobile', 'Bills', 'Sales (₹)']);
    (report.topCustomers || []).forEach((c) => {
      rows.push([
        c.name || 'Walk-in',
        c.mobile || '',
        c.billCount ?? 0,
        paiseToNum(c.revenue),
      ]);
    });
    const escape = (c) => {
      const s = c == null ? '' : String(c);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const csv = rows.map((r) => r.map(escape).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amwaj-report-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** Printable PDF via browser print dialog */
  const downloadReportPdf = () => {
    if (!report) return;
    const shop = settings?.shopName || 'Amwaj';
    const top = (report.topItems || [])
      .map(
        (it) =>
          `<tr><td>${escapeHtml(it.productName || it.name || '—')}</td><td style="text-align:right">${
            Number(it.quantity) || it.qty || 0
          }</td><td style="text-align:right">${escapeHtml(formatINR(
            it.salesPaise ?? it.lineTotalPaise ?? it.totalPaise ?? it.revenue
          ))}</td></tr>`
      )
      .join('');
    const topCust = (report.topCustomers || [])
      .map(
        (c) =>
          `<tr><td>${escapeHtml(c.name || 'Walk-in')}${
            c.mobile ? ` <span style="color:#888;font-size:11px">${escapeHtml(c.mobile)}</span>` : ''
          }</td><td style="text-align:right">${c.billCount ?? 0}</td><td style="text-align:right">${escapeHtml(formatINR(
            c.revenue
          ))}</td></tr>`
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Sales Report</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;padding:24px;max-width:720px;margin:0 auto}
  h1{font-size:20px;margin:0 0 4px;color:#064B3C}
  .meta{color:#666;font-size:12px;margin-bottom:20px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
  .card{border:1px solid #e5e0d8;border-radius:12px;padding:12px}
  .label{font-size:10px;text-transform:uppercase;color:#888;font-weight:600}
  .val{font-size:18px;font-weight:700;margin-top:4px;color:#064B3C}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}
  th{font-size:10px;text-transform:uppercase;color:#888}
  @media print{body{padding:0} .no-print{display:none}}
</style></head><body>
  <h1>${escapeHtml(shop)} — Sales Report</h1>
  <div class="meta">${escapeHtml(fromDate)} → ${escapeHtml(toDate)}</div>
  <div class="grid">
    <div class="card"><div class="label">Total sales</div><div class="val">${formatINR(report.totalSalesPaise)}</div></div>
    <div class="card"><div class="label">Bills</div><div class="val">${report.billCount ?? 0}</div></div>
    <div class="card"><div class="label">Average bill</div><div class="val">${formatINR(report.averageBillPaise)}</div></div>
    <div class="card"><div class="label">Cash / UPI</div><div class="val" style="font-size:14px">${formatINR(report.byPaymentMethod?.CASH || 0)} · ${formatINR(report.byPaymentMethod?.UPI || 0)}</div></div>
    ${
      report.totalProfitPaise != null
        ? `<div class="card"><div class="label">Est. cost</div><div class="val">${formatINR(report.totalCostPaise)}</div></div>
    <div class="card"><div class="label">Est. profit</div><div class="val">${formatINR(report.totalProfitPaise)}</div></div>`
        : ''
    }
  </div>
  <h2 style="font-size:14px;margin:0 0 8px">Top items</h2>
  <table><thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Sales</th></tr></thead>
  <tbody>${top || '<tr><td colspan="3">No items</td></tr>'}</tbody></table>
  <h2 style="font-size:14px;margin:20px 0 8px">Top customers</h2>
  <table><thead><tr><th>Customer</th><th style="text-align:right">Bills</th><th style="text-align:right">Sales</th></tr></thead>
  <tbody>${topCust || '<tr><td colspan="3">No customers</td></tr>'}</tbody></table>
  <p class="meta no-print" style="margin-top:24px">Use Print → Save as PDF</p>
  <script>window.onload=function(){window.print()}</script>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
      setToast('Allow pop-ups to download PDF');
      setTimeout(() => setToast(''), 3000);
      return;
    }
    w.document.write(html);
    w.document.close();
  };

    const setPreset = (preset) => {
    const today = todayISO();
    if (preset === 'today') {
      setFromDate(today);
      setToDate(today);
    } else if (preset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setFromDate(d.toISOString().slice(0, 10));
      setToDate(today);
    } else if (preset === 'month') {
      const d = new Date();
      d.setDate(1);
      setFromDate(d.toISOString().slice(0, 10));
      setToDate(today);
    }
  };

  // ── Menu ───────────────────────────────────────────────
  if (!section) {
    return (
      <div className="p-4 max-w-lg mx-auto pb-6">
        <h1 className="text-xl font-bold text-charcoal mb-1">Settings</h1>
        <p className="text-sm text-muted mb-5">Choose a section</p>
        <div className="space-y-2">
          {menu.map(({ id, label, desc, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className="card w-full flex items-center gap-3 p-4 text-left active:scale-[0.99] transition-transform"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald/10 flex items-center justify-center text-emerald shrink-0">
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-charcoal text-sm">{label}</div>
                <div className="text-xs text-muted truncate">{desc}</div>
              </div>
              <ChevronRight size={18} className="text-muted shrink-0" />
            </button>
          ))}
        </div>
        {toast && (
          <p className="mt-4 text-center text-sm text-emerald font-medium">{toast}</p>
        )}
      </div>
    );
  }

  // ── Shop ───────────────────────────────────────────────
  if (section === 'shop') {
    return (
      <div className="p-4 max-w-lg mx-auto pb-6">
        <BackHeader title="Shop Profile" onBack={() => setSection(null)} />
        {settings ? (
          <div className="card p-4 space-y-3">
            <div>
              <label className="text-xs text-muted font-medium">Shop name</label>
              <input
                className="input mt-1 py-2.5 text-sm"
                value={settings.shopName || ''}
                onChange={(e) => setSettings({ ...settings, shopName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted font-medium">Address</label>
              <input
                className="input mt-1 py-2.5 text-sm"
                value={settings.address || ''}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted font-medium">Phone</label>
              <input
                className="input mt-1 py-2.5 text-sm"
                value={settings.phone || ''}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted font-medium">Invoice prefix</label>
              <input
                className="input mt-1 py-2.5 text-sm"
                value={settings.invoicePrefix || ''}
                onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
              />
            </div>
            <button type="button" onClick={saveShop} disabled={saving} className="btn-primary w-full py-2.5 text-sm">
              {saving ? 'Saving…' : 'Save'}
            </button>
            {toast && <p className="text-center text-sm text-emerald font-medium">{toast}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </div>
    );
  }

  // ── Reports (owner only) ───────────────────────────────
  if (section === 'reports') {
    if (!isOwner) {
      return (
        <div className="p-4 max-w-lg mx-auto">
          <BackHeader title="Reports" onBack={() => setSection(null)} />
          <p className="text-sm text-muted">Reports are only available to the owner.</p>
        </div>
      );
    }
    return (
      <div className="p-4 max-w-lg mx-auto pb-6">
        <BackHeader title="Reports" onBack={() => setSection(null)} />

        {/* Date range */}
        <div className="card p-3 mb-3 space-y-3">
          <div className="flex gap-2">
            {['today', 'week', 'month'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className="flex-1 text-xs font-semibold py-2 rounded-xl border border-border text-charcoal active:bg-ivory capitalize"
              >
                {p === 'today' ? 'Today' : p === 'week' ? '7 days' : 'This month'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted font-semibold flex items-center gap-1">
                <Calendar size={11} /> From
              </label>
              <input
                type="date"
                className="input mt-1 py-2 text-sm"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-muted font-semibold flex items-center gap-1">
                <Calendar size={11} /> To
              </label>
              <input
                type="date"
                className="input mt-1 py-2 text-sm"
                value={toDate}
                min={fromDate}
                max={todayISO()}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {report && !loadingReport && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={downloadReportExcel}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-white py-2.5 text-xs font-semibold text-charcoal active:bg-ivory shadow-soft"
            >
              <FileSpreadsheet size={15} className="text-emerald" />
              Excel (CSV)
            </button>
            <button
              type="button"
              onClick={downloadReportPdf}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-white py-2.5 text-xs font-semibold text-charcoal active:bg-ivory shadow-soft"
            >
              <FileText size={15} className="text-gold-dark" />
              PDF
            </button>
          </div>
        )}

        {loadingReport ? (
          <p className="text-sm text-muted text-center py-8">Loading report…</p>
        ) : report ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="card p-3 text-center">
                <p className="text-[10px] uppercase text-muted font-semibold">Total sales</p>
                <p className="text-xl font-bold text-emerald mt-1">
                  {formatINR(report.totalSalesPaise)}
                </p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-[10px] uppercase text-muted font-semibold">Bills</p>
                <p className="text-xl font-bold text-charcoal mt-1">{report.billCount}</p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-[10px] uppercase text-muted font-semibold">Avg bill</p>
                <p className="text-lg font-bold text-charcoal mt-1">
                  {formatINR(report.averageBillPaise)}
                </p>
              </div>
              <div className="card p-3 text-center">
                <p className="text-[10px] uppercase text-muted font-semibold">Cash / UPI</p>
                <p className="text-xs font-semibold text-charcoal mt-1.5 leading-relaxed">
                  {formatINR(report.byPaymentMethod?.CASH || 0)}
                  <br />
                  {formatINR(report.byPaymentMethod?.UPI || 0)}
                </p>
              </div>
            </div>

            {/* P&L — owner only; based on purchase rate snapped at sale */}
            {(report.costKnown || report.totalProfitPaise != null) && (
              <div className="grid grid-cols-2 gap-2">
                <div className="card p-3 text-center">
                  <p className="text-[10px] uppercase text-muted font-semibold">Est. cost</p>
                  <p className="text-lg font-bold text-charcoal mt-1">
                    {report.totalCostPaise != null
                      ? formatINR(report.totalCostPaise)
                      : '—'}
                  </p>
                </div>
                <div className="card p-3 text-center">
                  <p className="text-[10px] uppercase text-muted font-semibold">Est. profit</p>
                  <p
                    className={`text-lg font-bold mt-1 ${
                      (report.totalProfitPaise || 0) >= 0 ? 'text-emerald' : 'text-red-600'
                    }`}
                  >
                    {report.totalProfitPaise != null
                      ? formatINR(report.totalProfitPaise)
                      : '—'}
                  </p>
                </div>
              </div>
            )}
            {!report.costKnown && (
              <p className="text-[11px] text-muted text-center px-2">
                Set purchase rates on products to see cost &amp; profit. Profit uses cost at the time of each sale.
              </p>
            )}

            {(report.topItems || []).length > 0 && (
              <div className="card p-3">
                <p className="text-[10px] uppercase text-muted font-semibold mb-2">Top items</p>
                <div className="space-y-2">
                  {report.topItems.slice(0, 8).map((it) => (
                    <div key={it.name} className="flex justify-between gap-2 text-sm">
                      <span className="truncate text-charcoal min-w-0">
                        {it.name}
                        {it.profitPaise != null && (
                          <span className="block text-[10px] text-muted font-normal">
                            profit {formatINR(it.profitPaise)}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-semibold text-emerald">
                        {formatINR(it.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(report.topCustomers || []).length > 0 && (
              <div className="card p-3">
                <p className="text-[10px] uppercase text-muted font-semibold mb-2">Top customers</p>
                <div className="space-y-2">
                  {report.topCustomers.slice(0, 8).map((c) => (
                    <div
                      key={c.customerId || c.name}
                      className="flex justify-between gap-2 text-sm"
                    >
                      <span className="truncate text-charcoal min-w-0">
                        {c.name}
                        <span className="block text-[10px] text-muted font-normal">
                          {c.mobile ? `${c.mobile} · ` : ''}
                          {c.billCount} bill{c.billCount === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold text-emerald">
                        {formatINR(c.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card p-8 text-center text-muted text-sm">No data for this range</div>
        )}
        {toast && <p className="mt-3 text-center text-sm text-red-600">{toast}</p>}
      </div>
    );
  }

  // ── Staff (owner only) ─────────────────────────────────
  if (section === 'staff') {
    if (!isOwner) {
      return (
        <div className="p-4 max-w-lg mx-auto">
          <BackHeader title="Staff" onBack={() => setSection(null)} />
          <p className="text-sm text-muted">Only the owner can manage staff.</p>
        </div>
      );
    }
    return (
      <div className="p-4 max-w-lg mx-auto pb-6">
        <BackHeader title="Staff accounts" onBack={() => setSection(null)} />

        <form onSubmit={createStaff} className="card p-4 space-y-3 mb-4">
          <p className="text-sm font-semibold text-charcoal">Create staff</p>
          <input
            className="input py-2.5 text-sm"
            placeholder="Display name"
            value={staffForm.name}
            onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
            required
          />
          <input
            className="input py-2.5 text-sm"
            placeholder="Username"
            value={staffForm.username}
            onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value })}
            required
            autoCapitalize="none"
          />
          <input
            className="input py-2.5 text-sm"
            type="password"
            placeholder="Password"
            value={staffForm.password}
            onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
            required
            minLength={4}
          />
          <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 text-sm">
            {busy ? 'Creating…' : 'Create staff login'}
          </button>
        </form>

        <div className="space-y-2">
          <p className="text-xs text-muted font-semibold uppercase tracking-wide px-1">Accounts</p>
          {staffList.map((u) => (
            <div key={u.id} className="card p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald/10 flex items-center justify-center text-emerald font-bold text-sm">
                  {(u.name || u.username || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{u.name}</div>
                  <div className="text-xs text-muted">
                    @{u.username} · {u.role}
                    {u.isActive === false ? ' · Inactive' : ''}
                  </div>
                </div>
                {u.role !== 'OWNER' && (
                  <button
                    type="button"
                    onClick={() => {
                      setStaffPwdOpen(false)
                      setEditStaff({
                        id: u.id,
                        name: u.name || '',
                        password: '',
                        isActive: u.isActive !== false,
                      })
                    }}
                    className="text-xs font-medium text-emerald px-2 py-1 rounded-lg border border-emerald/30"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editStaff?.id === u.id && (
                <form onSubmit={saveStaffEdit} className="mt-3 pt-3 border-t border-border space-y-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1 block">
                      Display name
                    </label>
                    <input
                      className="input py-2 text-sm"
                      placeholder="Display name"
                      value={editStaff.name}
                      onChange={(e) => setEditStaff({ ...editStaff, name: e.target.value })}
                      required
                    />
                  </div>

                  {/* Same open/close pattern as Account → Change password */}
                  <div className="rounded-xl border border-border overflow-hidden bg-ivory/40">
                    <button
                      type="button"
                      onClick={() => setStaffPwdOpen((o) => !o)}
                      className="w-full flex items-center gap-3 p-3 text-left active:bg-ivory"
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald/10 flex items-center justify-center text-emerald shrink-0">
                        <KeyRound size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-charcoal">Change password</div>
                        <div className="text-[11px] text-muted">
                          {staffPwdOpen ? 'Hide form' : 'Tap to set a new password (optional)'}
                        </div>
                      </div>
                      <ChevronDown
                        size={18}
                        className={`text-muted shrink-0 transition-transform ${staffPwdOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {staffPwdOpen && (
                      <div className="px-3 pb-3 space-y-2 border-t border-border pt-3">
                        <label className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1 block">
                          New password
                        </label>
                        <input
                          className="input py-2 text-sm"
                          type="password"
                          placeholder="Leave blank to keep current"
                          value={editStaff.password}
                          onChange={(e) => setEditStaff({ ...editStaff, password: e.target.value })}
                          minLength={4}
                          autoComplete="new-password"
                        />
                      </div>
                    )}
                  </div>

                  <label className="flex items-center gap-2 text-sm text-charcoal">
                    <input
                      type="checkbox"
                      checked={editStaff.isActive}
                      onChange={(e) => setEditStaff({ ...editStaff, isActive: e.target.checked })}
                    />
                    Active (can log in)
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy} className="btn-primary flex-1 py-2 text-sm">
                      {busy ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditStaff(null)
                        setStaffPwdOpen(false)
                      }}
                      className="flex-1 py-2 text-sm rounded-xl border border-border"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
          {staffList.length === 0 && (
            <p className="text-sm text-muted text-center py-4">No accounts loaded</p>
          )}
        </div>
        {toast && <p className="mt-3 text-center text-sm text-emerald font-medium">{toast}</p>}
      </div>
    );
  }

  // ── Account ────────────────────────────────────────────
  if (section === 'account') {
    return (
      <div className="p-4 max-w-lg mx-auto pb-6">
        <BackHeader title="Account" onBack={() => setSection(null)} />

        <div className="card p-4 mb-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald/10 flex items-center justify-center text-emerald font-bold text-lg">
            {(user?.name || 'A')[0].toUpperCase()}
          </div>
          <div>
            <div className="font-semibold">{user?.name}</div>
            <div className="text-sm text-muted">
              {user?.role} · @{user?.username}
            </div>
          </div>
        </div>

        <div className="card overflow-hidden mb-3 p-0">
          <button
            type="button"
            onClick={() => setPwdOpen((o) => !o)}
            className="w-full flex items-center gap-3 p-4 text-left active:bg-ivory/80"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald/10 flex items-center justify-center text-emerald shrink-0">
              <KeyRound size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-charcoal">Change password</div>
              <div className="text-[11px] text-muted">
                {pwdOpen ? 'Hide form' : 'Tap to open · same for admin & staff'}
              </div>
            </div>
            <ChevronDown
              size={18}
              className={`text-muted shrink-0 transition-transform ${pwdOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {pwdOpen && (
            <form
              onSubmit={changePassword}
              className="px-4 pb-4 space-y-3 border-t border-border pt-3"
            >
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1 block">
                  Current password
                </label>
                <input
                  className="input py-2.5 text-sm"
                  type="password"
                  placeholder="Current password"
                  value={pwdForm.currentPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1 block">
                  New password
                </label>
                <input
                  className="input py-2.5 text-sm"
                  type="password"
                  placeholder="At least 4 characters"
                  value={pwdForm.newPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                  required
                  minLength={4}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1 block">
                  Confirm new password
                </label>
                <input
                  className="input py-2.5 text-sm"
                  type="password"
                  placeholder="Confirm new password"
                  value={pwdForm.confirm}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })}
                  required
                  minLength={4}
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 text-sm">
                {busy ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>

        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 text-red-600 font-medium border border-red-200 rounded-xl py-3 active:bg-red-50"
        >
          <LogOut size={16} /> Sign out
        </button>
        {toast && <p className="mt-3 text-center text-sm text-emerald font-medium">{toast}</p>}
      </div>
    );
  }

  return null;
}
