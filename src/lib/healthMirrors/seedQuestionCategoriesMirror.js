// Codex168 — Runtime mirror of functions/seedQuestionCategories.js for the
// Health Center. `?raw` imports of files OUTSIDE src/ (functions/, docs/)
// return a non-string on this host's Vite build, which makes token-based
// Health cases falsely FAIL with foundCount: 0 / "missing every token".
//
// The canonical implementation lives at functions/seedQuestionCategories.js
// and is the file actually deployed. This mirror is a string snapshot of
// the seed contract (category list, active status, descriptions, and the
// backfill branch) used ONLY by Health static-contract checks.
//
// When you change one, change the other. The Health suite
// `category_status_description_health` cross-checks required phrases
// against this string and FAILS the case if any required phrase is
// missing — there is no silent pass path.

export const SEED_QUESTION_CATEGORIES_PATH = 'functions/seedQuestionCategories.js';

export const SEED_QUESTION_CATEGORIES_SOURCE = `// Codex158 — Category rows now carry status ('a' active / 'p' passive) and
// optional description. All seeded categories start as active ('a').
const QUESTION_CATEGORIES = [
  { category_id: 1, name: 'Chronicle', status: 'a', description: 'Tarihin önemli olayları ve dönemleri.' },
  { category_id: 2, name: 'Flashback', status: 'a', description: 'Geçmişten hafızada kalan kültürel anlar.' },
  { category_id: 3, name: 'Kült', status: 'a', description: 'Kültleşmiş filmler, diziler, müzikler ve popüler kültür.' },
  { category_id: 4, name: 'Viral', status: 'a', description: 'İnternette yayılan viral olaylar ve dijital kültür.' },
  { category_id: 5, name: 'Arena', status: 'a', description: 'Spor, rekabet ve unutulmaz karşılaşmalar.' },
  { category_id: 6, name: 'Level Up', status: 'a', description: 'Oyun dünyası, teknoloji ve gelişim anları.' },
];

// Backfill branch — runs when a Category row already exists but predates
// the status/description fields. Never overwrites a non-empty description
// and never downgrades 'p' to 'a'.
//   if (typeof existing.status !== 'string') {
//     patch.status = category.status;
//   }
//   if (typeof existing.description !== 'string') {
//     patch.description = category.description;
//   }
//   await base44.asServiceRole.entities.Category.update(existing.id, patch);
`;