/**
 * Online Game category taxonomy — single source of truth.
 *
 * Codex078: this module is the ONLY place where the Online Game's six
 * question categories are defined. UI, lobby selection, future question
 * generation, content tools, prompt scaffolding, Health Simulator contracts,
 * and analytics must read from here. Do NOT duplicate these ids, labels,
 * descriptions, or boundary rules anywhere else.
 *
 * Stability contract:
 *   - The `id` field is the stable key. Do NOT rename casually.
 *     Existing data, lobby selection state, analytics, and Health Simulator
 *     cases may reference these ids.
 *   - `label`, `description`, `timeRange`, `contentScope`, `examples`, and
 *     `boundaryRules` are evolvable copy. Update them here when product
 *     guidance changes — not in scattered UI files.
 *
 * What this module is NOT:
 *   - It is NOT the Question entity's `category` enum. The Question entity
 *     currently stores legacy ids (tarih, bilim, spor, sanat, teknoloji,
 *     genel, muzik). Mapping/migration to these Online ids is a separate
 *     content-data task and is intentionally out of scope here.
 *   - It is NOT a gameplay/multiplayer/RLS contract. Lobby authority logic
 *     is untouched.
 */

export const ONLINE_CATEGORIES = [
  {
    id: 'flashback',
    label: 'FLASHBACK',
    description:
      "1980'den günümüze toplumsal hafızada yer etmiş güncel tarih olayları, büyük gündemler, teknolojik ve sosyal kırılmalar.",
    timeRange: '1980-present',
    contentScope: ['modern history', 'public memory', 'social change', 'tech & social shifts'],
    examples: [
      { event: 'Berlin Duvarı’nın yıkılması', year: 1989 },
      { event: 'Türkiye’de ilk özel televizyon kanalı Star 1’in yayın hayatına başlaması', year: 1990 },
      { event: '17 Ağustos Marmara Depremi', year: 1999 },
      { event: 'iPhone’un ilk kez tanıtılması', year: 2007 },
      { event: 'COVID-19’un pandemi ilan edilmesi', year: 2020 },
    ],
  },
  {
    id: 'kult',
    label: 'KÜLT',
    description:
      'Sinema, dizi, müzik, TV ve kalıcı pop kültür ikonları.',
    timeRange: 'pop-culture-era',
    contentScope: ['film', 'tv', 'music', 'celebrity', 'iconic works'],
    examples: [
      { event: 'Star Wars: A New Hope filminin vizyona girmesi', year: 1977 },
      { event: 'Michael Jackson’ın Thriller albümünün yayımlanması', year: 1982 },
      { event: 'The Simpsons dizisinin başlaması', year: 1989 },
      { event: 'Friends dizisinin ilk bölümünün yayınlanması', year: 1994 },
      { event: 'Game of Thrones dizisinin başlaması', year: 2011 },
    ],
  },
  {
    id: 'viral',
    label: 'VIRAL',
    description:
      'İnternet, sosyal medya, meme, dijital platformlar, teknoloji kültürü ve çevrimiçi akımlar.',
    timeRange: 'internet-era',
    contentScope: ['internet', 'social media', 'memes', 'platforms', 'online trends'],
    examples: [
      { event: 'YouTube’un kurulması', year: 2005 },
      { event: 'Twitter’ın kullanıma açılması', year: 2006 },
      { event: 'Instagram’ın yayınlanması', year: 2010 },
      { event: 'Gangnam Style’ın küresel viral olması', year: 2012 },
      { event: 'TikTok’un Musical.ly ile birleşerek küresel büyümesi', year: 2018 },
    ],
  },
  {
    id: 'arena',
    label: 'ARENA',
    description:
      'Spor tarihindeki unutulmaz maçlar, turnuvalar, rekorlar, şampiyonluklar ve spor ikonları.',
    timeRange: 'sports-history',
    contentScope: ['sports events', 'tournaments', 'records', 'championships', 'athletes'],
    examples: [
      { event: 'Maradona’nın “Tanrı’nın Eli” golünü attığı Dünya Kupası maçı', year: 1986 },
      { event: 'Galatasaray’ın UEFA Kupası’nı kazanması', year: 2000 },
      { event: 'Türkiye A Milli Futbol Takımı’nın Dünya Kupası üçüncüsü olması', year: 2002 },
      { event: 'Usain Bolt’un Pekin Olimpiyatları’nda 100 metre dünya rekoru kırması', year: 2008 },
      { event: 'Arjantin’in Messi ile Dünya Kupası’nı kazanması', year: 2022 },
    ],
  },
  {
    id: 'level_up',
    label: 'LEVEL UP',
    description:
      'Video oyunları, konsollar, oyun stüdyoları, e-spor ve gaming kültürü.',
    timeRange: 'gaming-era',
    contentScope: ['video games', 'consoles', 'game studios', 'esports', 'gaming culture'],
    examples: [
      { event: 'Super Mario Bros.’un NES için çıkması', year: 1985 },
      { event: 'PlayStation’ın Japonya’da piyasaya çıkması', year: 1994 },
      { event: 'Pokémon Red ve Green’in Japonya’da çıkması', year: 1996 },
      { event: 'Minecraft’ın tam sürümünün yayınlanması', year: 2011 },
      { event: 'Fortnite Battle Royale’in yayınlanması', year: 2017 },
    ],
  },
  {
    id: 'chronicle',
    label: 'CHRONICLE',
    description:
      'Milattan sonra başlayan genel tarih, dünya olayları, keşifler, icatlar, bilimsel dönüm noktaları ve klasik genel kültür.',
    timeRange: 'AD/CE-history',
    contentScope: [
      'general history',
      'world events',
      'discoveries',
      'inventions',
      'scientific milestones',
      'classical general knowledge',
    ],
    examples: [
      { event: 'Batı Roma İmparatorluğu’nun yıkılması', year: 476 },
      { event: 'İstanbul’un fethi', year: 1453 },
      { event: 'Kolomb’un Amerika kıtasına ulaşması', year: 1492 },
      { event: 'Fransız Devrimi’nin başlaması', year: 1789 },
      { event: 'Ay’a ilk insanlı iniş', year: 1969 },
    ],
  },
];

/**
 * Category boundary rules — documented in one place so content generation,
 * admin guidance, and Health Simulator contracts share the same definitions.
 */
export const ONLINE_CATEGORY_BOUNDARY_RULES = [
  {
    id: 'flashback_vs_chronicle',
    summary: 'Flashback vs Chronicle',
    rule:
      'Flashback is for 1980–present events that live in modern public memory. Chronicle is for broader historical/general knowledge starting from AD/CE history. If the event is recent and remembered as modern public memory, prefer Flashback. If it is classical history or broad general knowledge, prefer Chronicle.',
  },
  {
    id: 'kult_vs_viral',
    summary: 'Kült vs Viral',
    rule:
      'Kült is for lasting pop culture (movies, TV, music, celebrities, iconic works). Viral is for internet/social media/digital culture (memes, platforms, online trends, viral moments). If it became famous mainly through cinema/TV/music legacy, use Kült. If it became famous mainly through internet/social media spread, use Viral.',
  },
  {
    id: 'viral_vs_level_up',
    summary: 'Viral vs Level Up',
    rule:
      'Viral is for digital/internet culture broadly. Level Up is specifically for video games, consoles, esports, game studios, and gaming culture. If the question is about a game release, console, studio, esports event, or gaming milestone, use Level Up. If it is about a meme, social platform, online challenge, app, or internet trend, use Viral.',
  },
  {
    id: 'arena_vs_flashback',
    summary: 'Arena vs Flashback',
    rule:
      'Arena is always for sports events, tournaments, championships, athletes, and records. Even if the event is recent and widely remembered, use Arena if the core subject is sport.',
  },
  {
    id: 'chronicle_fallback',
    summary: 'Chronicle as fallback',
    rule:
      'Chronicle should not become a dumping ground for everything. Use Chronicle for historical, scientific, invention, discovery, civilization, empire, political, and general knowledge events that do not fit the other categories.',
  },
];

/**
 * Style requirements for every Online question. Centralized so future
 * prompt-generation and content review reference the same rules.
 */
export const ONLINE_QUESTION_STYLE_REQUIREMENTS = [
  'Clear event — the question describes one well-defined event.',
  'Year-answerable — the correct answer is a single year, no ranges.',
  'Not too obscure for casual players unless explicitly marked hard.',
  'No ambiguous dates — avoid events where multiple plausible years exist.',
  'Category must match the event’s core identity per the boundary rules.',
];

/* -------------------------------------------------------------------------
 *  Lookup helpers — keep consumers free of inline id lists.
 * ------------------------------------------------------------------------- */

export const ONLINE_CATEGORY_IDS = ONLINE_CATEGORIES.map((c) => c.id);

const BY_ID = Object.fromEntries(ONLINE_CATEGORIES.map((c) => [c.id, c]));

export function getOnlineCategoryById(id) {
  return BY_ID[id] || null;
}

export function isValidOnlineCategoryId(id) {
  return Object.prototype.hasOwnProperty.call(BY_ID, id);
}