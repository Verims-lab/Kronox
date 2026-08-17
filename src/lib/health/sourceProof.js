export function sourceText(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { return ''; }
}

export function auditSourceContracts(contracts = []) {
  return contracts.flatMap(({ file, source, required = [], forbidden = [] }) => {
    const text = sourceText(source);
    const missing = required.filter((token) => !text.includes(token));
    const presentForbidden = forbidden.filter((token) => text.includes(token));
    return missing.length || presentForbidden.length
      ? [{ file, missing, forbidden: presentForbidden }]
      : [];
  });
}

export function findRenderedSensitiveKeyHits(source, keys = []) {
  const text = sourceText(source);
  return keys.filter((key) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [
      new RegExp(`>\\s*\\{[^<}]*${escaped}[^<}]*\\}\\s*<`, 'i'),
      new RegExp(`(?:aria|data)-[\\w-]+=\\{[^}]*${escaped}`, 'i'),
      new RegExp(`console\\.(?:log|warn|error)\\([^)]*${escaped}`, 'i'),
    ].some((pattern) => pattern.test(text));
  });
}

export function extractConstArrayLabels(source, constName) {
  const text = sourceText(source);
  const match = text.match(new RegExp(`const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!match) return [];
  return Array.from(match[1].matchAll(/label:\s*['"]([^'"]+)['"]/g), (item) => item[1]);
}