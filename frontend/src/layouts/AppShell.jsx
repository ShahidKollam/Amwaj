import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { ShoppingCart, Package, Users, History, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Bill', icon: ShoppingCart, end: true },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function AmwajMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M32 14c-2 6-6 10-10 14 4 2 8 4 10 8 2-4 6-6 10-8-4-4-8-8-10-14z"
        fill="#C69A50"
      />
    </svg>
  );
}

export default function AppShell() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-ivory flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 lg:w-64 flex-col bg-emerald text-white shrink-0">
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gold/20 flex items-center justify-center ring-1 ring-gold/30">
              <AmwajMark size={20} />
            </div>
            <div>
              <div className="font-bold text-lg leading-tight tracking-tight">Amwaj</div>
              <div className="text-gold text-[11px] font-semibold tracking-wide uppercase">POS</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={20} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 text-sm text-white/70 truncate">
          {user?.name}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Mobile header — always visible across the app */}
        <header className="md:hidden sticky top-0 z-40 bg-emerald text-white px-4 py-2.5 flex items-center justify-between safe-top shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gold/20 flex items-center justify-center ring-1 ring-gold/25 shrink-0">
              <AmwajMark size={16} />
            </div>
            <div className="leading-none">
              <span className="font-bold text-[15px] tracking-tight">Amwaj</span>
              <span className="ml-1.5 text-[9px] bg-gold text-emerald-dark font-bold px-1.5 py-0.5 rounded align-middle">
                POS
              </span>
            </div>
          </div>
          <div className="text-[11px] text-white/80 truncate max-w-[110px] font-medium">
            {user?.name}
          </div>
        </header>

        <main className="flex-1 overflow-auto pb-20 md:pb-0 min-h-0">
          <Outlet />
        </main>

        {/* Mobile bottom nav — always visible */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-border flex justify-around items-center pt-1.5 pb-[calc(0.4rem+var(--safe-bottom))] shadow-[0_-4px_24px_rgba(6,75,60,0.06)]">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-1.5 py-1 min-w-[52px] ${
                  isActive ? 'text-emerald' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`p-1 rounded-xl transition-colors ${
                      isActive ? 'bg-emerald/10' : ''
                    }`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
                  </div>
                  <span className="text-[10px] font-semibold tracking-wide">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
