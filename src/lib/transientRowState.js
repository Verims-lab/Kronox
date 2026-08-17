// Preserve the last sanitized rows when a background refresh fails.
// A successful empty response may still replace them with an actual empty set.
export function preserveSafeRowsOnTransientFailure(previousRows) {
  return previousRows;
}