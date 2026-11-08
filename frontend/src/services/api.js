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
    // Avoid browser/HTTP cache 304 with empty body breaking JSON parse
    cache: 'no-store',
  });

  // Session expired — clear storage so next load goes to login
  if (res.status === 401 && !path.includes('/auth/login')) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  const data = await res.json().catch(() => ({}));
  // res.ok is false for 304; empty body would also fail JSON — treat as error
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
  deleteProduct: (id) =>
    request(`/products/${id}`, { method: 'DELETE' }),

  getCustomers: async (params) => {
    // Accept string search, object params, or nothing
    // Returns array for simple callers (Bill customer picker)
    const query =
      typeof params === 'string'
        ? { search: params, pageSize: 50 }
        : params && typeof params === 'object'
          ? params
          : {};
    const q = new URLSearchParams(
      Object.fromEntries(
        Object.entries(query).filter(([, v]) => v != null && v !== '')
      )
    ).toString();
    const data = await request(`/customers${q ? `?${q}` : ''}`);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  },
  /** Full paginated customers payload for Customers page */
  getCustomersPage: async (params = {}) => {
    const safe = params && typeof params === 'object' ? params : {};
    const q = new URLSearchParams(
      Object.fromEntries(
        Object.entries(safe).filter(([, v]) => v != null && v !== '')
      )
    ).toString();
    const data = await request(`/customers${q ? `?${q}` : ''}`);
    if (Array.isArray(data)) {
      return { items: data, total: data.length, page: 1, pageSize: data.length, totalPages: 1 };
    }
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      total: data?.total ?? 0,
      page: data?.page ?? 1,
      pageSize: data?.pageSize ?? 20,
      totalPages: data?.totalPages ?? 1,
    };
  },
  getCustomer: (id) => request(`/customers/${id}`),
  createCustomer: (data) =>
    request('/customers', { method: 'POST', body: JSON.stringify(data) }),

  completeBill: (data) =>
    request('/billing/complete', { method: 'POST', body: JSON.stringify(data) }),
  getHistory: async (params = {}) => {
    const safe = params && typeof params === 'object' ? params : {};
    const q = new URLSearchParams(
      Object.fromEntries(
        Object.entries(safe).filter(([, v]) => v != null && v !== '')
      )
    ).toString();
    const data = await request(`/billing/history${q ? `?${q}` : ''}`);
    // Normalize paginated or array response for callers
    if (Array.isArray(data)) {
      return { items: data, total: data.length, dayTotalPaise: 0, dayBillCount: data.length };
    }
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      total: data?.total ?? 0,
      page: data?.page ?? 1,
      pageSize: data?.pageSize ?? 20,
      totalPages: data?.totalPages ?? 1,
      dayTotalPaise: data?.dayTotalPaise ?? 0,
      dayBillCount: data?.dayBillCount ?? 0,
    };
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
