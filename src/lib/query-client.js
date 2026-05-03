import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: 1500,
      staleTime: 5 * 60 * 1000,   // 5 dk — ağ isteklerini azalt
      gcTime: 30 * 60 * 1000,     // 30 dk bellekte tut
      networkMode: 'offlineFirst', // React Query offline-first modu
    },
  },
});