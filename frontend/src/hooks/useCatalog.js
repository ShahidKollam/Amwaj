/**
 * Products & categories with IndexedDB cache + TanStack Query.
 * Shows cached data immediately; refreshes in background.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import {
  getCachedProducts,
  getCachedCategories,
  cacheProducts,
  cacheCategories,
} from '../lib/db';
import { queryKeys } from '../lib/queryClient';

async function fetchProducts() {
  const data = await api.getProducts();
  await cacheProducts(data).catch(console.error);
  return data;
}

async function fetchCategories() {
  const data = await api.getCategories();
  await cacheCategories(data).catch(console.error);
  return data;
}

export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: fetchProducts,
    placeholderData: () => undefined,
    initialData: () => undefined,
    // Hydrate from IndexedDB once, then keep in Query cache
  });
}

/** Load IndexedDB into Query cache on startup */
export async function hydrateCatalogFromIdb(qc) {
  try {
    const [products, categories] = await Promise.all([
      getCachedProducts(),
      getCachedCategories(),
    ]);
    if (products?.length) {
      qc.setQueryData(queryKeys.products, products);
    }
    if (categories?.length) {
      qc.setQueryData(queryKeys.categories, categories);
    }
    return { products, categories };
  } catch (e) {
    console.error('IDB hydrate failed', e);
    return { products: [], categories: [] };
  }
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: fetchCategories,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.createProduct(data),
    onSuccess: async (product) => {
      qc.setQueryData(queryKeys.products, (old) => {
        const list = Array.isArray(old) ? old : [];
        return [...list, product];
      });
      const all = qc.getQueryData(queryKeys.products) || [];
      await cacheProducts(all).catch(console.error);
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.updateProduct(id, data),
    onSuccess: async (product) => {
      qc.setQueryData(queryKeys.products, (old) => {
        const list = Array.isArray(old) ? old : [];
        return list.map((p) => (p.id === product.id ? product : p));
      });
      const all = qc.getQueryData(queryKeys.products) || [];
      await cacheProducts(all).catch(console.error);
    },
  });
}
