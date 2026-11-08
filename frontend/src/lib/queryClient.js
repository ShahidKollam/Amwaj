import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60 * 24, // 24h — products/categories
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

export const queryKeys = {
  products: ['products'],
  categories: ['categories'],
  customers: (search) => ['customers', search || ''],
  history: (params) => ['history', params || {}],
  settings: ['settings'],
  salesReport: (params) => ['salesReport', params || {}],
};
