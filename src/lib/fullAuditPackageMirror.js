// Runtime mirror for docs/KRONOX_FULL_AUDIT_PACKAGE_1.md.
//
// Why a JS mirror?
//   Vite's `?raw` import cannot reach Markdown files outside of `src/` on this
//   host — importing `../../../docs/*.md?raw` fails Vite/Base44 import analysis
//   with "invalid JS syntax ... .md?raw". This mirror keeps the Health Center
//   `combined_p1_p2_audit_static_contracts` static-contract tokens importable
//   from inside /src. Keep it in sync with the canonical doc.

export const FULL_AUDIT_PACKAGE_DOC = `# Kronox Full Audit Package 1

Status: current index / redirect, Codex417.

This package consolidates the P1/P2 combined audit outcomes:

- Admin route hardening: configured \`function.jsonc\` manifests stay the
  published source; /admin uses a route-level UX guard that waits for AdminUser
  status before mounting admin tools.
- getQuestions candidate fetch is bounded to 96 * 3 = 288 rows per active
  category/query variant before projection.
- Dependency cleanup result: unused direct Stripe, Three, React Leaflet,
  React Quill, Moment, jsPDF, html2canvas, and Lodash packages were removed;
  recharts and embla-carousel-react are retained because UI primitives need them.
- iOS wrapper, physical Apple parity, economy parallel race, and mobile visual
  proofs remain manual release gates and are not proven by static Health alone.
`;