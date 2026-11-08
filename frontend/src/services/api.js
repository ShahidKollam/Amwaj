const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
const TOKEN_KEY = 'amwaj_token';
const USER_KEY = 'amwaj_user';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
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

  // Session expired — clear storage so next load goes to login
  if (res.status === 401 && !path.includes('/auth/login')) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

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

  getCustomers: (params = {}) => {
    // support legacy string search or object params
    const query = typeof params === 'string' ? { search: params } : params;
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(query).filter(([, v]) => v != null && v !== ''))
    ).toString();
    return request(`/customers${q ? `?${q}` : ''}`);
  },
  getCustomer: (id) => request(`/customers/${id}`),
  createCustomer: (data) =>
    request('/customers', { method: 'POST', body: JSON.stringify(data) }),

  completeBill: (data) =>
    request('/billing/complete', { method: 'POST', body: JSON.stringify(data) }),
  getHistory: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
    ).toString();
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
