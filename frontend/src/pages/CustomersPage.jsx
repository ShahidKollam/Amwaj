import React, { useEffect, useState } from 'react';
import { api, formatINR } from '../services/api';
import { Search, User } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getCustomers(search)
      .then(setCustomers)
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-charcoal mb-4">Customers</h1>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          className="input pl-10"
          placeholder="Search name or mobile…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : customers.length === 0 ? (
        <p className="text-muted text-center py-8">No customers yet</p>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <div key={c.id} className="card flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-full bg-emerald/10 flex items-center justify-center text-emerald">
                <User size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-muted">{c.mobile}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
