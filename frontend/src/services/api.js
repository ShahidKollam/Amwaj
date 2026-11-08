const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

function getToken() {
  return localStorage.getItem('amwaj_token');
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: () => request('/auth/me'),

  getCategories: () => request('/products/categories'),
  getProducts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/products${q ? `?${q}` : ''}`);
  },
  createProduct: (data) =>
    request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) =>
    request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  getCustomers: (search) =>
    request(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getCustomer: (id) => request(`/customers/${id}`),
  createCustomer: (data) =>
    request('/customers', { method: 'POST', body: JSON.stringify(data) }),

  completeBill: (data) =>
    request('/billing/complete', { method: 'POST', body: JSON.stringify(data) }),
  getHistory: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/billing/history${q ? `?${q}` : ''}`);
  },
  getInvoice: (id) => request(`/billing/${id}`),

  getSettings: () => request('/settings'),
  updateSettings: (data) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getSalesReport: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/settings/reports/sales${q ? `?${q}` : ''}`);
  },
};

export function formatINR(paise) {
  const rupees = (paise || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
}
