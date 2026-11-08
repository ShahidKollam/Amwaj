import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AppShell from './layouts/AppShell';
import BillPage from './pages/BillPage';
import ProductsPage from './pages/ProductsPage';
import CustomersPage from './pages/CustomersPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';

/** Prevent one page crash from wiping the whole app to a white screen */
class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Page crash:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 max-w-md mx-auto text-center">
          <p className="font-semibold text-charcoal mb-2">Something went wrong on this page</p>
          <p className="text-sm text-muted mb-4">{this.state.error.message || 'Unknown error'}</p>
          <button
            className="btn-primary px-4 py-2"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ivory">
        <div className="text-emerald font-medium">Loading Amwaj…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function withBoundary(Page) {
  return function Wrapped() {
    return (
      <PageErrorBoundary>
        <Page />
      </PageErrorBoundary>
    );
  };
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={React.createElement(withBoundary(BillPage))} />
        <Route path="products" element={React.createElement(withBoundary(ProductsPage))} />
        <Route path="customers" element={React.createElement(withBoundary(CustomersPage))} />
        <Route path="history" element={React.createElement(withBoundary(HistoryPage))} />
        <Route path="settings" element={React.createElement(withBoundary(SettingsPage))} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
