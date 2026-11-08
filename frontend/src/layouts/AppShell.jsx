import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { ShoppingCart, Package, Users, History, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Bill', icon: ShoppingCart, end: true },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const isBill = location.pathname === '/';

  return (
    <div className="min-h-screen bg-ivory flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 lg:w-64 flex-col bg-emerald text-white shrink-0">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gold/20 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
                <path d="M32 14c-2 6-6 10-10 14 4 2 8 4 10 8 2-4 6-6 10-8-4-4-8-8-10-14z" fill="#C69A50"/>
              </svg>
            </div>
            <div>
              <div className="font-bold text-lg leading-tight">Amwaj</div>
              <div className="text-gold text-xs font-medium">POS</div>
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
                  isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={20} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 text-sm text-white/70">
          {user?.name}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Mobile header (hidden on bill page for more space, or keep minimal) */}
        {!isBill && (
          <header className="md:hidden sticky top-0 z-20 bg-emerald text-white px-4 py-3 flex items-center justify-between safe-top">
            <div className="font-bold text-lg">Amwaj <span className="text-gold text-sm font-medium ml-1">POS</span></div>
            <div className="text-sm text-white/80 truncate max-w-[120px]">{user?.name}</div>
          </header>
        )}

        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-border flex justify-around items-center pt-2 pb-[calc(0.5rem+var(--safe-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 min-w-[56px] ${
                  isActive ? 'text-emerald' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-xl ${isActive ? 'bg-emerald/10' : ''}`}>
                    <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                  </div>
                  <span className="text-[11px] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
