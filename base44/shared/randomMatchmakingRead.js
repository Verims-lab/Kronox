import { normalizeMatchmakingMode } from './randomMatchmakingPolicy.js';

const stableQueryKey = (query) => JSON.stringify(
  Object.entries(query || {}).sort(([left], [right]) => left.localeCompare(right)),
);

export const matchesExactMatchmakingFilter = (row, filter) => (
  Object.entries(filter || {}).every(([key, value]) => (
    key === 'mode'
      ? normalizeMatchmakingMode(row?.mode) === normalizeMatchmakingMode(value)
      : String(row?.[key] ?? '') === String(value ?? '')
  ))
);

const uniqueQueries = (queries) => {
  const seen = new Set();
  return queries.filter((query) => {
    const key = stableQueryKey(query);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const isPermissionFailure = (error) => {
  const status = Number(error?.status || error?.response?.status || 0);
  const message = String(error?.message || '').toLowerCase();
  return status === 401
    || status === 403
    || message.includes('permission')
    || message.includes('forbidden')
    || message.includes('unauthorized');
};

export async function readMatchmakingRows({
  entity,
  filter,
  scopedFallbackFilters = [],
  sort,
  limit,
  fallbackLimit = limit,
}) {
  let permissionDenied = false;
  const queries = uniqueQueries([filter, ...scopedFallbackFilters]);
  const attempts = [
    ...queries.map((query, index) => ({
      query,
      sort,
      strategy: index === 0 ? 'exact_filter_sorted' : 'scoped_filter_sorted',
    })),
    ...queries.map((query, index) => ({
      query,
      sort: undefined,
      strategy: index === 0 ? 'exact_filter_default_sort' : 'scoped_filter_default_sort',
    })),
  ];

  for (const attempt of attempts) {
    try {
      const rows = await entity.filter(attempt.query, attempt.sort, limit);
      if (Array.isArray(rows)) {
        return {
          rows: rows.filter((row) => matchesExactMatchmakingFilter(row, filter)),
          strategy: attempt.strategy,
        };
      }
    } catch (error) {
      permissionDenied = permissionDenied || isPermissionFailure(error);
      // Continue through bounded, backend-owned read strategies. A caller
      // still receives a classified failure when every strategy is rejected.
    }
  }

  const listAttempts = [
    { sort: '-created_date', strategy: 'bounded_list_sorted' },
    { sort: undefined, strategy: 'bounded_list_default_sort' },
  ];
  for (const attempt of listAttempts) {
    try {
      const rows = await entity.list(attempt.sort, fallbackLimit);
      if (Array.isArray(rows)) {
        return {
          rows: rows.filter((row) => matchesExactMatchmakingFilter(row, filter)),
          strategy: attempt.strategy,
        };
      }
    } catch (error) {
      permissionDenied = permissionDenied || isPermissionFailure(error);
      // The final failure below deliberately stays fail-closed.
    }
  }

  throw new Error(permissionDenied
    ? 'matchmaking_read_permission_denied'
    : 'matchmaking_read_unavailable');
}
