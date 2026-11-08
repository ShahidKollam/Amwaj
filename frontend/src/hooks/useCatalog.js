/**
 * Products & categories with IndexedDB cache + TanStack Query.
 * Shows cached data immediately; refreshes from backend in background.
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

function asArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

async function fetchProducts() {
  const raw = await api.getProducts();
  const data = asArray(raw);
  await cacheProducts(data).catch(console.error);
  return data;
}

async function fetchCategories() {
  const raw = await api.getCategories();
  const data = asArray(raw);
  await cacheCategories(data).catch(console.error);
  return data;
}

export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: fetchProducts,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 24 * 7,
  });
}

/** Load IndexedDB into Query cache on startup */
export async function hydrateCatalogFromIdb(qc) {
  try {
    const [products, categories] = await Promise.all([
      getCachedProducts(),
      getCachedCategories(),
    ]);
    const p = asArray(products);
    const c = asArray(categories);
    if (p.length) qc.setQueryData(queryKeys.products, p);
    if (c.length) qc.setQueryData(queryKeys.categories, c);
    return { products: p, categories: c };
  } catch (e) {
    console.error('IDB hydrate failed', e);
    return { products: [], categories: [] };
  }
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 24 * 7,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.createProduct(data),
    onSuccess: async (product) => {
      qc.setQueryData(queryKeys.products, (old) => {
        const list = asArray(old);
        return [...list, product];
      });
      const all = asArray(qc.getQueryData(queryKeys.products));
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
        const list = asArray(old);
        return list.map((p) => (p.id === product.id ? product : p));
      });
      const all = asArray(qc.getQueryData(queryKeys.products));
      await cacheProducts(all).catch(console.error);
    },
  });
}
