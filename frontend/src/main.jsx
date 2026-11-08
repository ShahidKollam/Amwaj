import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { queryClient } from './lib/queryClient';
import { hydrateCatalogFromIdb } from './hooks/useCatalog';
import { useCartStore } from './store/cartStore';
import { startBillSyncListeners } from './lib/billSync';
import './index.css';

// Hydrate product cache + cart from IndexedDB before first paint where possible
hydrateCatalogFromIdb(queryClient).catch(console.error);
useCartStore.getState().hydrate().catch(console.error);
startBillSyncListeners();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
