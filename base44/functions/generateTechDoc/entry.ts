import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

// Codex154 — Hardcoded admin email literal removed. Admin allowlist is now
// sourced from the KRONOX_ADMIN_EMAILS env/secret (comma-separated). Missing
// or empty config fails closed (403). See Health suite
// `admin_authorization_hardening` for the regression contract.
function authError(status, message) {
  return Response.json({ error: message }, { status });
}

function parseAdminAllowlist() {
  const raw = Deno.env.get('KRONOX_ADMIN_EMAILS');
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

async function requireGenerateTechDocAdmin(base44) {
  let user = null;
  try {
    user = await base44.auth.me();
  } catch {
    return { response: authError(401, 'Authentication required') };
  }

  if (!user?.email) {
    return { response: authError(401, 'Authentication required') };
  }

  const allowlist = parseAdminAllowlist();
  const callerEmail = String(user.email).trim().toLowerCase();
  const isAllowlisted = allowlist.length > 0 && allowlist.includes(callerEmail);

  if (user.role !== 'admin' && !isAllowlisted) {
    return { response: authError(403, 'Admin access required') };
  }

  return { user };
}

// Turkce karakterleri ASCII'ye donustur (Helvetica Latin-1 ile uyumlu)
function tr(text) {
  return text
    .replace(/\u0131/g, 'i').replace(/\u0130/g, 'I')
    .replace(/\u015f/g, 's').replace(/\u015e/g, 'S')
    .replace(/\u011f/g, 'g').replace(/\u011e/g, 'G')
    .replace(/\u00fc/g, 'u').replace(/\u00dc/g, 'U')
    .replace(/\u00f6/g, 'o').replace(/\u00d6/g, 'O')
    .replace(/\u00e7/g, 'c').replace(/\u00c7/g, 'C')
    .replace(/\u2192/g, '->').replace(/\u2190/g, '<-')
    .replace(/\u2014/g, '--').replace(/\u2013/g, '-')
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'")
    .replace(/\u201c/g, '"').replace(/\u201d/g, '"')
    .replace(/[^\x00-\xFF]/g, '-');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireGenerateTechDocAdmin(base44);
    if (auth.response) return auth.response;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const W = 595;
    const H = 842;
    const marginL = 50;
    const marginR = 50;
    const contentW = W - marginL - marginR;

    const black   = rgb(0.05, 0.05, 0.10);
    const gold    = rgb(0.78, 0.63, 0.15);
    const gray    = rgb(0.40, 0.40, 0.45);
    const danger  = rgb(0.70, 0.18, 0.18);
    const ok      = rgb(0.15, 0.45, 0.20);
    const darkBg  = rgb(0.08, 0.09, 0.14);
    const codeBg  = rgb(0.11, 0.12, 0.17);
    const codeText= rgb(0.70, 0.85, 0.95);

    let page = pdfDoc.addPage([W, H]);
    let y = H - 60;

    // ─── Helpers ──────────────────────────────────────────────────────────────
    const newPage = () => {
      page = pdfDoc.addPage([W, H]);
      y = H - 60;
      page.drawLine({ start: { x: marginL, y: H - 45 }, end: { x: W - marginR, y: H - 45 }, thickness: 0.5, color: gold, opacity: 0.4 });
      page.drawText(tr('Kronox - Teknik Mimari Dokumani - Internal AI/Developer Briefing'), { x: marginL, y: H - 38, size: 8, font, color: gray });
      page.drawText(`Sayfa ${pdfDoc.getPageCount()}`, { x: W - marginR - 40, y: H - 38, size: 8, font, color: gray });
    };

    const ensureSpace = (needed) => { if (y - needed < 70) newPage(); };

    const drawText = (raw, opts = {}) => {
      const text = tr(raw);
      const { size = 11, color: c = black, indent = 0, lineGap = 5, bold = false } = opts;
      const f = bold ? boldFont : font;
      const maxW = contentW - indent;
      const words = text.split(' ');
      let line = '';
      for (const word of words) {
        const tst = line ? line + ' ' + word : word;
        const tw = f.widthOfTextAtSize(tst, size);
        if (tw > maxW && line) {
          ensureSpace(size + lineGap + 4);
          page.drawText(line, { x: marginL + indent, y, size, font: f, color: c });
          y -= size + lineGap;
          line = word;
        } else {
          line = tst;
        }
      }
      if (line) {
        ensureSpace(size + lineGap + 4);
        page.drawText(line, { x: marginL + indent, y, size, font: f, color: c });
        y -= size + lineGap;
      }
    };

    const sectionTitle = (raw) => {
      y -= 10;
      ensureSpace(28);
      page.drawRectangle({ x: marginL - 4, y: y - 4, width: contentW + 8, height: 22, color: darkBg });
      page.drawLine({ start: { x: marginL - 4, y: y - 4 }, end: { x: marginL - 4, y: y + 18 }, thickness: 3, color: gold });
      page.drawText(tr(raw.toUpperCase()), { x: marginL + 6, y: y + 4, size: 12, font: boldFont, color: gold });
      y -= 30;
    };

    const subTitle = (raw) => {
      y -= 6;
      ensureSpace(20);
      page.drawText(tr('> ' + raw), { x: marginL, y, size: 11, font: boldFont, color: gold, opacity: 0.9 });
      y -= 18;
    };

    const microTitle = (raw, color = black) => {
      y -= 4;
      ensureSpace(16);
      page.drawText(tr(raw), { x: marginL, y, size: 10, font: boldFont, color });
      y -= 14;
    };

    const bullet = (raw, level = 0) => {
      const indent = 12 + level * 14;
      ensureSpace(14);
      page.drawText('*', { x: marginL + indent - 10, y, size: 10, font: boldFont, color: gold, opacity: 0.8 });
      drawText(raw, { size: 10, indent, color: black, lineGap: 3 });
    };

    const spacer = (h = 8) => { y -= h; };

    const codeBlock = (lines) => {
      const lineH = 13;
      const blockH = lines.length * lineH + 12;
      ensureSpace(blockH + 6);
      page.drawRectangle({ x: marginL - 2, y: y - blockH + lineH, width: contentW + 4, height: blockH, color: codeBg });
      for (const l of lines) {
        page.drawText(tr(l), { x: marginL + 6, y, size: 8.5, font, color: codeText });
        y -= lineH;
      }
      y -= 6;
    };

    // Standart blok: DO / DO NOT / FILES INVOLVED / TEST AFTER CHANGE / RISK
    const aiBlock = ({ doList = [], dontList = [], files = [], tests = [], risk = 'Medium' }) => {
      if (doList.length) {
        microTitle('DO:', ok);
        doList.forEach(d => bullet(d));
      }
      if (dontList.length) {
        microTitle('DO NOT:', danger);
        dontList.forEach(d => bullet(d));
      }
      if (files.length) {
        microTitle('FILES INVOLVED:');
        files.forEach(f => bullet(f));
      }
      if (tests.length) {
        microTitle('TEST AFTER CHANGE:');
        tests.forEach(t => bullet(t));
      }
      microTitle(`RISK: ${risk}`, risk === 'High' ? danger : (risk === 'Low' ? ok : gold));
      spacer(2);
    };

    // ══════════════════════════════════════════════════════════════════════════
    // KAPAK
    // ══════════════════════════════════════════════════════════════════════════
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: darkBg });
    page.drawRectangle({ x: marginL, y: H / 2 - 1, width: 120, height: 2, color: gold });

    page.drawText('KRONOX', { x: marginL, y: H / 2 + 90, size: 56, font: boldFont, color: gold });
    page.drawText(tr('Zaman Cizgisi Kart Oyunu'), { x: marginL, y: H / 2 + 50, size: 18, font, color: rgb(0.85, 0.85, 0.9) });
    page.drawText(tr('Teknik Mimari Dokumani'), { x: marginL, y: H / 2 + 24, size: 14, font, color: gray });
    page.drawText(tr('Internal AI / Developer Briefing'), { x: marginL, y: H / 2 + 4, size: 11, font, color: gold, opacity: 0.85 });

    page.drawText('v3.0', { x: marginL, y: H / 2 - 30, size: 11, font, color: gray });
    page.drawText('Build: Codex040', { x: marginL, y: H / 2 - 47, size: 11, font, color: gray });
    page.drawText('Platform: Base44 (React + Vite + Deno)', { x: marginL, y: H / 2 - 64, size: 11, font, color: gray });

    page.drawLine({ start: { x: marginL, y: 80 }, end: { x: W - marginR, y: 80 }, thickness: 0.5, color: gold, opacity: 0.3 });
    page.drawText(tr('Bu dokuman; bir AI Coder veya yeni gelistirici tarafindan projeyi guvenle'), { x: marginL, y: 66, size: 9, font, color: gray });
    page.drawText(tr('surdurmek icin tek referans olarak kullanilmak uzere hazirlanmistir.'), { x: marginL, y: 54, size: 9, font, color: gray });

    // ══════════════════════════════════════════════════════════════════════════
    // ICINDEKILER
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    y = H - 80;
    page.drawText(tr('ICINDEKILER'), { x: marginL, y, size: 18, font: boldFont, color: gold });
    y -= 30;

    const toc = [
      ['1.', 'Proje Genel Bakis'],
      ['2.', 'Teknoloji Yigini'],
      ['3.', 'Rota Haritasi & Sayfa Sorumluluklari'],
      ['4.', 'Modul Sorumluluklari (hooks / lib / components)'],
      ['5.', 'Veri Modeli (Base44 Entities)'],
      ['6.', 'Data Contracts (kontratlar)'],
      ['7.', 'Backend Fonksiyonlar'],
      ['8.', 'Home Ekrani Mimarisi (1080x1920 Stage)'],
      ['9.', 'Offline Solo Mimarisi'],
      ['10.', 'Online Multiplayer Mimarisi'],
      ['11.', 'Online State Otoritesi & Senkronizasyon'],
      ['12.', 'Sunucu Tarafi Dogrulama (Trust Boundary)'],
      ['13.', 'Drag-and-Drop & Timeline'],
      ['14.', 'Test Suite & Simulation Panel'],
      ['15.', 'Performans & Mobil WebView'],
      ['16.', 'Korunmasi Gereken Sistemler (pratik kurallar)'],
      ['17.', 'Kodu Guvenle Degistirme Rehberi'],
      ['18.', 'Yeni Ozellik Giris Noktalari (Profile/Score/...)'],
      ['19.', 'Bilinen Sinirlamalar'],
      ['20.', 'Terimler Sozlugu (aktif vs legacy)'],
    ];
    for (const [num, title] of toc) {
      ensureSpace(20);
      page.drawText(num, { x: marginL, y, size: 11, font: boldFont, color: gold });
      page.drawText(tr(title), { x: marginL + 28, y, size: 11, font, color: black });
      y -= 20;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 1. GENEL BAKIS
    // ══════════════════════════════════════════════════════════════════════════
    newPage(); y = H - 80;
    sectionTitle('1. Proje Genel Bakis');
    drawText('Kronox, oyuncularin sorularda gecen olay/eser/kesfin yilini kendi zaman cizgilerine dogru sirayla yerlestirdigi rekabetci bir kart oyunudur. Uygulama mobil-oncelikli (WebView/PWA) bir React + Vite + Base44 projesidir. Iki birincil mod vardir:');
    spacer(4);
    bullet('Solo Meydan Okuma (offline): Tek oyunculu, kendi rekorunu kirma odakli.');
    bullet('Online Battle: 2-4 oyunculu, lobi tabanli gercek zamanli rekabet.');
    spacer();
    drawText('Bu dokuman; mimariyi, modul sorumluluklarini, KORUNMASI GEREKEN sistemleri ve guvenle yeni ozellik eklemenin nasil yapilacagini AI Coder ve yeni gelistiriciler icin tek bir referansa indirger.', { color: gray });

    // ══════════════════════════════════════════════════════════════════════════
    // 2. TEKNOLOJI YIGINI
    // ══════════════════════════════════════════════════════════════════════════
    spacer(12);
    sectionTitle('2. Teknoloji Yigini');

    subTitle('Frontend');
    bullet('React 18 + Vite -- SPA, React.lazy + Suspense ile code-splitting');
    bullet('React Router DOM v6 -- sayfa rotalari, push/pop yon-duyarli gecisler');
    bullet('TanStack Query v5 -- gerektigi yerlerde async durum');
    bullet('Framer Motion -- sayfa, modal ve geri bildirim animasyonlari');
    bullet('Tailwind CSS + Shadcn/UI -- utility-first stil, accessible UI primitifleri');
    bullet('Lucide React -- ikon kutuphanesi (yalniz dogrulanmis ikonlar)');

    subTitle('Mobil & Platform');
    bullet('Base44 -- BaaS: entities, RLS, real-time subscriptions, OAuth, backend functions');
    bullet('Deno runtime -- backend fonksiyonlari (npm:/jsr: importlar, Deno.serve)');
    bullet('WebView/PWA wrapper -- iOS ve Android icin ayni React bundle');
    bullet('safe-area-inset-* + overscroll-behavior-none -- notch ve home indicator hassasiyetli');

    subTitle('Kisitlar');
    bullet('Mobil-oncelikli: butun layoutlar 360x740 ve uzeri mobil ile basliyor');
    bullet('Dusuk bandwidth ve memory varsayilir; animasyon ve subscription cleanup zorunludur');
    bullet('Yalnizca izinli paket listesi kullanilir (bkz. Base44 platform talimatlari)');

    // ══════════════════════════════════════════════════════════════════════════
    // 3. ROTA HARITASI
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('3. Rota Haritasi & Sayfa Sorumluluklari');
    codeBlock([
      'Rota                Bilesen              Rol',
      '------------------------------------------------------------------',
      '/                   MainMenu             Home/ana giris (1080x1920 stage)',
      '/solo               SoloChallenge        Solo kategori + zorluk secimi',
      '/setup              PlayerSetup          (LEGACY) tek-cihaz isim kurulumu',
      '/lobby              LobbyRoom            Online lobi olustur/katil + waiting room',
      '/game               Game                 Aktif oyun sahnesi (solo + online ayni shell)',
      '/settings           SettingsPage         Hesap ayarlari + admin araclari',
      '/test-suite         TestSuite            SimulationPanel host - admin-only',
    ]);
    spacer(6);
    drawText('App.jsx tek otoriter routerdir; tum sayfa importlari React.lazy ile bolunmustur. Sayfa gecisleri push/pop yonu hesaplanarak yatay slide animasyonu ile gerceklesir. Game ve Home rotalarinda AppHeader gizlenir; diger sayfalarda gosterilir. BottomNav her zaman aktif fakat /game sayfasinda sadelestirilir.');

    // ══════════════════════════════════════════════════════════════════════════
    // 4. MODUL SORUMLULUKLARI
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('4. Modul Sorumluluklari');

    subTitle('Pages');
    bullet('pages/MainMenu.jsx -- Home. 1080x1920 stage koordinat sistemi. Mode kartlari ("SOLO MEYDAN OKUMA" / "ONLINE BATTLE"), profil cubugu, ayarlar girisi. Hicbir scroll yok.');
    bullet('pages/SoloChallenge.jsx -- Kategori (genel/tarih/spor/sanat/bilim vb.) ve zorluk secimi. Secim sonrasi /game?mode=solo... ile yonlendirir.');
    bullet('pages/LobbyRoom.jsx -- INCE orkestrator. Identity ve form state useLobbyRoomState hook\'una; UI LobbyCreateJoinPanel + WaitingRoomPanel\'e devredilmistir.');
    bullet('pages/Game.jsx -- Solo ve online oyunun ortak shellidir. useGameState (ViewModel), useGameActions (domain), useLobbySync (online sync), useOfflineQuestions (solo) hooklarini birlestirir.');
    bullet('pages/SettingsPage.jsx -- Hesap silme, en iyi 5 rekor, ogretici, admin araclari (soru yonetimi, doc indirme, regresyon paneli).');
    bullet('pages/TestSuite.jsx -- Admin-only sayfa; SimulationPanel\'i barindirir. isAdminUser disindaki kullanicilar engellenir.');

    subTitle('Hooks');
    bullet('hooks/useGameState.js -- Tum oyun-sahnesi UI durumu (lobbyData, feedback, winner, drag, zone, timer key). Refler placement-lock ve toplam sure icin tutulur.');
    bullet('hooks/useGameActions.js -- Domain/use-case katmani. doPlacement, advanceTurn, skipCurrentQuestion ve pickQuestion. Online icinde tum DB yazimi updateLobbyGameState servis fonksiyonundan gecer.');
    bullet('hooks/useLobbySync.js -- Online oyunun TEK senkronizasyon otoritesi. Initial fetch, subscription ve poll fallback ile lobbyData\'yi gunceller.');
    bullet('hooks/useLobbyRoomState.js -- LobbyRoom sayfasi icin identity (user, playerName), form ve modal state.');
    bullet('hooks/useWaitingRoomSync.js -- Bekleme odasi icin subscription + polling fallback; status==="in_game" gecislerinde tum oyunculari /game\'e yonlendirir.');
    bullet('hooks/useOfflineQuestions.js -- Solo modda soru havuzunu yukler ve onbellekler (lib/questionCache.js ile birlikte calisir).');
    bullet('hooks/usePullToRefresh.js -- Mobil dokunmatik pull-to-refresh.');

    subTitle('Lib (saf yardimcilar)');
    bullet('lib/gameRules.js -- Saf kart kurali yardimcilari: isCorrectPlacement, getNextPlayerIndex, hasPlayerWon, getTimelineYears, selectNextQuestion, getQuestionSelectionPool.');
    bullet('lib/lobbyUtils.js -- normalizeCode, summarizePlayers, isHost, canJoinLobby, removePlayerByIdentity, buildLobbyStartPayload vb.');
    bullet('lib/onlineGameStart.js -- filterQuestionsForLobbySettings, shuffleQuestions ve buildInitialOnlineGameState. WaitingRoom oyunu baslatirken bu helperi cagirir.');
    bullet('lib/admin.js -- isAdminUser ve ADMIN_EMAIL. Admin kuralinin TEK kaynagidir; UI hicbir yerde manuel email kiyaslamasi yapmaz.');
    bullet('lib/AuthContext.jsx -- base44.auth.me / isAuthenticated, public settings yuklemesi, hata tiplemesi.');
    bullet('lib/NavigationStackContext.jsx -- Sayfa transition yonu (push/pop) yardimcisi.');
    bullet('lib/debugLog.js -- Production-gated debug log; release derlemelerinde sessizlestirilir.');
    bullet('lib/questionHistory.js, lib/questionCache.js -- Solo mod icin cross-game soru tekrarini onleyen kucuk LRU.');

    subTitle('Lobby Components');
    bullet('components/lobby/LobbyCreateJoinPanel.jsx -- Modlar arasinda secim, isim girisi, kod girisi, hata gosterimi.');
    bullet('components/lobby/WaitingRoomPanel.jsx -- Host/non-host bekleme odasi. Host buradan buildInitialOnlineGameState ile online oyunu baslatir.');

    subTitle('Game Components');
    bullet('components/game/GameLayout.jsx -- Oyun sahnesi shell: ust durum cubugu, TurnTimer, QuestionCard, Timeline, CTA buton.');
    bullet('components/game/Timeline.jsx + TimelineCard.jsx -- Aktif oyuncunun zaman cizgisi ve hit-test.');
    bullet('components/game/QuestionCard.jsx + QuestionMediaLoader.jsx -- Soru turlerini (metin/gorsel/isitsel/muzik) render eder; medya hatasinda fallback uretilir.');
    bullet('components/game/FeedbackOverlay.jsx -- Dogru/yanlis sonrasi animasyon, fark badge\'i, muzik reveal.');
    bullet('components/game/GameOver.jsx -- Kazanma/kaybetme ekrani; solo ve online icin farkli baslik/aciklama.');
    bullet('components/game/TurnTimer.jsx + GameOverTimer.jsx -- Tur sayaci ve toplam sure olcucusu.');
    bullet('components/game/SimulationPanel.jsx -- Test ve regresyon paneli (admin); kategorize testler, Copy Report / Copy Failed Only.');
    bullet('components/tutorial/KronoxTutorial.jsx -- Yeni oyuncu icin animasyonlu ogretici.');

    // ══════════════════════════════════════════════════════════════════════════
    // 5. VERI MODELI
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('5. Veri Modeli (Base44 Entities)');

    subTitle('Question');
    drawText('Oyun sorulari. Okuma herkese acik; create/update/delete sadece role="admin" kullanicilar (RLS).');
    codeBlock([
      'Alan        Tur     Aciklama',
      '------------------------------------------------------------',
      'question    string  Soru metni (zorunlu)',
      'year        number  Dogru cevap yili (zorunlu)',
      'category    enum    tarih|bilim|spor|sanat|teknoloji|genel',
      'type        enum    metin|gorsel|isitsel|muzik',
      'media_url   string  Gorsel veya ses URL (ilgili turler icin)',
      'icon_url    string  Karta ozel ikon URL',
      'difficulty  number  1=kolay, 2=orta, 3=zor',
    ]);
    spacer();

    subTitle('Lobby');
    drawText('Online oyunun TEK gercek kaynagi. RLS: yalnizca host veya katilimci okuyabilir/guncelleyebilir; admin tum lobileri gorebilir.');
    codeBlock([
      'Alan                   Tur     Aciklama',
      '------------------------------------------------------------------',
      'code                   string  6 hane benzersiz oda kodu',
      'host_email             string  Lobiyi acan kullanici email',
      'host_name              string  Host gorunen isim',
      'players                array   { email, name, ready, cards[] }',
      'status                 enum    waiting|starting|in_game|finished',
      'winner                 string  Kazanan oyuncu adi',
      'winner_email           string  Kazanan oyuncu email (perspektif icin)',
      'category               enum    karisik|tarih|bilim|spor|sanat',
      'year_start/year_end    number  Soru yil araligi',
      'turn_duration          number  Tur suresi (saniye)',
      'win_card_count         number  Kazanmak icin kart sayisi',
      'current_player_index   number  Sirasi gelen oyuncunun indisi',
      'current_question_id    string  Aktif sorunun id',
      'used_question_ids      array   Bu oyunda kullanilmis soru id\'leri',
    ]);
    spacer();

    subTitle('GameRecord');
    drawText('Solo mod kisisel rekor kaydi. Sadece sahip okuyabilir/silebilir; admin tumune erisebilir.');
    codeBlock([
      'Alan              Tur     Aciklama',
      '------------------------------------------------------',
      'user_email        string  Oyuncu emaili (created_by ile esit)',
      'player_name       string  Gosterim icin oyuncu adi',
      'duration_seconds  number  Oyun suresi (saniye)',
      'cards_won         number  Kazanilan kart sayisi',
      'win_card_count    number  Hedef kart sayisi',
      'category          string  Oyun kategorisi',
      'year_start/end    number  Yil araligi',
    ]);
    spacer();

    subTitle('LobbyMessage (LEGACY / INACTIVE)');
    drawText('Eski lobi sohbeti icin tutulan entity. Aktif UI tarafindan KULLANILMAZ; chat UI tamamen kaldirildi (Test Suite "removed" kategorisi). Yeni ozellikler bu entity\'ye yazmamali; ihtiyac varsa once yeniden tasarim yapilmalidir.', { color: gray });

    subTitle('User (Base44 built-in)');
    drawText('Yerlesik User entity. Admin yetkisi role=="admin" alanindan VEYA lib/admin.js ADMIN_EMAIL ile kontrol edilir. Manuel email kiyaslamasi yasaktir.');

    // ══════════════════════════════════════════════════════════════════════════
    // 6. DATA CONTRACTS
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('6. Data Contracts');

    drawText('Bu bolum her veri parcasi icin: sahip kim, hangi sistem yazar, ne asla mutate edilmez sorularinin cevabidir.', { color: gray });
    spacer(4);

    subTitle('Lobby.players');
    bullet('Sekil: dizi, sira AVN (anlamli). Her oge { email, name, ready, cards[] }.');
    bullet('Sahip: Lobby entity (DB) -- TEK yazici updateLobbyGameState ve buildInitialOnlineGameState\'ten gelen ilk dagitim update\'i.');
    bullet('Asla: istemci dogrudan Lobby.update ile players uzerinde keyfi degisiklik YAPMAZ; sira/email listesi degistirilemez.');

    subTitle('player.cards');
    bullet('Sekil: { id, year, question, type, media_url } objesi dizisi.');
    bullet('Sahip: Lobby.players[i].cards. Yazici: yalniz updateLobbyGameState; aktif oyuncuda +1 olabilir.');
    bullet('Asla: diger oyuncularin cards alanina yazma; toplam silme; kart icerigini sonradan duzeltme.');

    subTitle('current_player_index');
    bullet('Sahip: Lobby entity. Yazici: yalniz updateLobbyGameState.');
    bullet('Kural: yeni deger getNextPlayerIndex(prev, playerCount) sonucu olmali.');
    bullet('Asla: random veya istemcide rastgele atlama.');

    subTitle('current_question_id');
    bullet('Sahip: Lobby entity. Yazici: ilk dagitim (buildInitialOnlineGameState) ve updateLobbyGameState.');
    bullet('Kural: yeni soru used_question_ids icinde olmamali (yeni eklenen disinda); secim selectNextQuestion ile yapilir.');

    subTitle('used_question_ids');
    bullet('Sahip: Lobby entity. Yazici: yalniz updateLobbyGameState.');
    bullet('Kural (MUTLAK): yeni dizi eski diziyi TAMAMEN icermelidir (containsAllPreviousIds).');
    bullet('Asla: kucultme veya temizleme.');

    subTitle('winner / winner_email');
    bullet('Sahip: Lobby entity. Yazici: yalniz updateLobbyGameState (status=finished gecisiyle).');
    bullet('Kural: gercek bir oyuncuya isaret etmeli; hasPlayerWon kosulu saglanmali.');
    bullet('GameOver perspektif (win vs loss) bu alanlar uzerinden hesaplanir.');

    subTitle('Question / GameRecord');
    bullet('Question: yalniz admin yazar (RLS). Oyun kodu Question icerigini MUTATE ETMEZ -- snapshot olarak cards icine kopyalanir.');
    bullet('GameRecord: yalniz sahibi tarafindan create edilir; oyun bitiminde Solo modda. Aggregate icin yine yalniz sahibi okur.');

    // ══════════════════════════════════════════════════════════════════════════
    // 7. BACKEND FONKSIYONLAR
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('7. Backend Fonksiyonlar');

    subTitle('findLobbyByCode');
    drawText('Kod ile lobi bulur ve oyuncuyu listeye atomik olarak ekler. Service-role ile RLS\'i bypass eder cunku oyuncu henuz katilimci degildir. Retry destekli, yarisma kosullarina dayanikli.');
    bullet('Giris: { code, playerName }');
    bullet('Cikis: { found, joinable, joined, lobby, debug }');

    subTitle('updateLobbyGameState (online state otoritesi)');
    drawText('TUM online tur/kart yazimlarinin tek girisi. Sunucu tarafinda asagidaki kontrolleri yapar:');
    bullet('Auth: base44.auth.me() yoksa 401.');
    bullet('actorEmail current_player olmali.');
    bullet('Yeni used_question_ids eskileri TAMAMEN icermeli.');
    bullet('Oyuncu listesi eklenip cikartilamaz, sira degistirilemez.');
    bullet('Kart sayisi yalnizca aktif oyuncuda +1 olabilir; baska oyuncularin kartlari salt-okunur.');
    bullet('Yeni current_player_index getNextPlayerIndex sonucuyla esit olmali.');
    bullet('status=finished icin winner ve winner_email gercek bir oyuncu olmali.');

    subTitle('runTestSuite & simulateOnlineGame');
    drawText('Admin araclari. runTestSuite saf birim & senaryo testlerini sunucuda kosturur; simulateOnlineGame online akisi sahte oyuncularla bastan sona simule eder.');

    subTitle('generateTechDoc / generateWorkflowDoc');
    drawText('Bu PDFler. Settings > Admin Araclari uzerinden indirilir. Yalnizca admin (role=="admin" veya ADMIN_EMAIL) erisebilir. Cikti dosya adlari: "kronox-teknik-dokuman.pdf" ve "kronox-is-akisi.pdf".');

    subTitle('Diger');
    bullet('deleteAccount -- kullanici kendi hesabini sertce siler');
    bullet('getQuestions -- solo modda hizli toplu soru cekme');
    bullet('getDeezerPreview / searchSpotifyTrack / loadSpotifyMusicQuestions / populateSpotifyQuestions / seedMusicQuestions -- muzik tipi sorular icin yardimcilar');

    // ══════════════════════════════════════════════════════════════════════════
    // 8. HOME EKRANI
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('8. Home Ekrani Mimarisi (1080x1920 Stage)');

    drawText('Home, tek bir tasarim sahnesini (1080x1920 portrait) viewporta orantili olarak yerlestirir. Tum elementler bu sahneye gore YUZDE ile konumlanir; pixel kacirma yoktur.');
    spacer(6);

    subTitle('Stage stratejisi');
    bullet('Mobil: width=100dvw, height=100dvh -- 9:16\'ya yakin oranlarda dogal otururlar.');
    bullet('Genis ekran (desktop tarayici, tablet, landscape): isWideStage kosulu devreye girer ve sahne min(100dvw, 56.25dvh) x min(100dvh, 177.7778dvw) ile sinirli tutulur. Boylece kartlar tiklanabilir kalir.');
    bullet('Dis konteyner fixed inset-0 overflow-hidden ile scrollu kilitler; touchAction: manipulation pinch-zoom\'u onler.');

    subTitle('Pointer ve Z-ekseni kurallari');
    bullet('Dekoratif arka plan ve illustrasyon katmanlari pointerEvents: none, zIndex: 0 ile sirayla yerlesir.');
    bullet('Mode kartlari (Solo Meydan Okuma + Online Battle) absolute konumlanir, z-20 ve pointerEvents: auto ile tiklanabilirligi GARANTI edilir.');
    bullet('ProfileBar ve Ayarlar butonu kartlardan ust z katmanlarda yer alir.');

    subTitle('Mode kart geometri');
    codeBlock([
      'Solo / Online kart hizalamasi (% cinsinden, stage tabanli):',
      '  Solo:   left 13.314815% top 71.40625% w 33.981481% h 18.177083%',
      '  Online: left 52.703704% top 71.40625% w 33.981481% h 18.177083%',
      'Iki kartin width ve height degerleri ESITTIR.',
      'Metinler kart icinde top 64.8% - 85.2%, left 8%, right 8% bolgesinde kalir.',
    ]);

    subTitle('Neden casually refactor edilmemeli?');
    bullet('Test Suite (home kategorisi) bu yuzde sabitlerini ve clickable garantilerini dogrular.');
    bullet('Sahne 9:16\'dan uzaklasinca arka plan asset\'i ile kart konumlari arasindaki uyumu BU yuzdeler tutuyor.');
    bullet('Pixel-tabanli konuma donmek butun cihazlar arasinda hizalama kaybi yaratir.');

    // ══════════════════════════════════════════════════════════════════════════
    // 9. OFFLINE SOLO
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('9. Offline Solo Mimarisi');

    bullet('Akis: MainMenu -> /solo (SoloChallenge: kategori + zorluk) -> /game?mode=solo&...');
    bullet('Game.jsx solo modda lobbyId\'siz calisir, lobbyData yalnizca yerel state\'tedir.');
    bullet('useOfflineQuestions soru havuzunu yukler; secim kategoriye/zorluga gore lib/gameRules helperlari ile filtrelenir.');
    bullet('Tekrarsizlik: oturum-ici used_question_ids (SERT) + cross-game LRU history (questionHistory.js) + ayni oyuncunun timeline\'inda mevcut yillara denk soru TERCIH EDILMEZ.');
    bullet('Yerlestirme kurallari lib/gameRules\'a baglidir: isCorrectPlacement, hasPlayerWon (win_card_count).');
    bullet('Oyun bitince kazanan oyuncu icin GameRecord.create cagrilir (sadece authenticated). TopScores Settings\'te kullaniciya gosterilir.');
    bullet('SOLO MOD ONLINE STATE\'TEN TAMAMEN IZOLEDIR: useLobbySync ve updateLobbyGameState cagrilmaz.');

    // ══════════════════════════════════════════════════════════════════════════
    // 10. ONLINE MULTIPLAYER
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('10. Online Multiplayer Mimarisi');

    subTitle('Akis');
    codeBlock([
      'MainMenu (Online Battle) -> /lobby',
      '  LobbyCreateJoinPanel (isim + kod) -> Lobby.create veya findLobbyByCode',
      '-> WaitingRoomPanel (host: ayarlar; non-host: refresh)',
      '   Host "OYUNU BASLAT" -> buildInitialOnlineGameState(...)',
      '   -> Lobby.update({ players (kartlar dahil), status:"in_game",',
      '                    current_question_id, used_question_ids, current_player_index:0 })',
      '-> tum oyuncular subscription+poll ile status="in_game" gorur, /game\'e gider',
    ]);

    subTitle('Oyun ici dongu');
    bullet('useLobbySync (Game.jsx icinde) Lobby\'e abone olur; her event\'te lobbyData state\'i normalize edilerek guncellenir.');
    bullet('Aktif oyuncu (players[current_player_index]) kart yerlestirir. Diger oyuncular ayni sorunun spectator gorunumunu gorur, kart yerlestiremez.');
    bullet('useGameActions.doPlacement: yerleti dogrular, optimistic local state guncellemesi yapar, ardindan updateLobbyGameState\'i cagirir (3 deneme + recovery fetch).');
    bullet('Tur gecisi getNextPlayerIndex(currentIndex, playerCount) ile %N rotasyonludur; 2/3/4 oyuncu desteklenir.');
    bullet('Soru secimi yeni aktif oyuncunun timeline yillarini disarida birakacak sekilde tercih edilir (selectNextQuestion).');

    subTitle('Kazanma / kaybetme');
    bullet('hasPlayerWon true olunca host olsun olmasin status="finished" yazilir; winner ve winner_email Lobby uzerinde tutulur.');
    bullet('GameOver bileseni winner_email == current user.email ise zafer, aksi halde kaybetme metni gosterir.');
    bullet('Lobby finished olduktan sonra updateLobbyGameState daha fazla yazim kabul etmez.');

    subTitle('Reconnect / refresh');
    bullet('Refresh sirasinda useLobbySync ilk renderda Lobby.get yapar; durum DB\'den yeniden bootstrap edilir.');
    bullet('Route state yalnizca bootstrap icin kullanilir, HICBIR NOKTADA otorite degildir.');
    bullet('Subscription kopukluklarini polling fallback (useWaitingRoomSync ve useLobbySync) yakalar.');

    // ══════════════════════════════════════════════════════════════════════════
    // 11. STATE OTORITESI
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('11. Online State Otoritesi & Senkronizasyon');

    bullet('Lobby entity TEK gercek kaynaktir. Lokal state DB ile uyumsuzlasirsa kaynak DB\'dir.');
    bullet('useLobbySync oyun-ici sync\'in tek otoritesidir; baska sayfa veya component manuel Lobby.update yapmaz, hepsi updateLobbyGameState\'ten gecer.');
    bullet('Route state (navigate("/game", { state })) yalnizca first paint icin bootstrap saglar; senkronizasyona girildikten sonra silinmis varsayilir.');
    bullet('Yarisma kosullarina karsi: useGameActions retry + recoverLatestLobbyState (Lobby.get) ile self-heal yapar.');
    bullet('Subscription closure\'larinda stale kullanici verisi olmamasi icin useRef pattern lobby/playerName/user referanslarina uygulanir.');

    // ══════════════════════════════════════════════════════════════════════════
    // 12. SUNUCU DOGRULAMA
    // ══════════════════════════════════════════════════════════════════════════
    spacer(12);
    sectionTitle('12. Sunucu Tarafi Dogrulama (Trust Boundary)');

    drawText('updateLobbyGameState istemciye guvenmez ve asagidaki kurallari sunucuda zorlar:');
    bullet('Auth: base44.auth.me() yoksa 401.');
    bullet('VALID_STATUSES: status yalnizca starting/in_game/finished olabilir.');
    bullet('containsAllPreviousIds: yeni used_question_ids eskileri tamamen icermeli.');
    bullet('Oyuncu listesi: eklenmez, cikartilmaz, sira degismez.');
    bullet('Kart butunlugu: yalnizca current_player\'in cards uzunlugu +1.');
    bullet('current_player_index: getNextPlayerIndex sonucuna esit.');
    bullet('winnerIndex / winner_email: gercek bir oyuncu, hasPlayerWon true.');
    spacer(6);

    microTitle('Suanki guvenli yuzey', ok);
    bullet('Gunluk casual abuse engellenir; "tek tikla kazanma" istemci enjeksiyonlari sunucuda dusurulur.');
    microTitle('Henuz hazir olmayan kismi', danger);
    bullet('Anomali tabanli anti-cheat yok (timing heuristikleri, soru bilgisi sizintisi vb.).');
    bullet('Bu nedenle Online henuz ranked liderlik tablosu icin trust\'li sayilmaz.');

    // ══════════════════════════════════════════════════════════════════════════
    // 13. DRAG-AND-DROP
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('13. Drag-and-Drop & Timeline');

    bullet('Ghost kart viewport koordinatinda (position:fixed) takip eder; Timeline hit-test\'i world koordinatinda calisir (worldX = clientX - containerLeft + scrollLeft).');
    bullet('Edge auto-scroll: sol/sag 80px esiginde requestAnimationFrame ile 60fps kayma; isDragMode false oldugunda cleanup\'la durdurulur.');
    bullet('Saf yerlestirme dogrulamasi lib/gameRules.isCorrectPlacement ile yapilir; UI bu fonksiyonu HICBIR NOKTADA kopyalamaz.');
    bullet('Bu mimari KORUMALIDIR: koordinat uzaylarinin karistirilmasi kullanicinin kartlari yanlis bolgeye dusmesine yol acar.');

    // ══════════════════════════════════════════════════════════════════════════
    // 14. TEST SUITE
    // ══════════════════════════════════════════════════════════════════════════
    spacer(10);
    sectionTitle('14. Test Suite & Simulation Panel');

    bullet('Erisim: /test-suite VEYA Settings -> Admin Araclari -> Regression Test Panel. isAdminUser disindaki kullanicilar engellenir.');
    bullet('Kategoriler: smoke, architecture, home, offline, lobby, sync, gameover, questions, media, admin, tutorial, records, performance, stability, exceptional, removed, release.');
    bullet('Sonuc tipleri: PASS / FAIL / WARNING / SKIPPED. Skipped, deterministik calistirilamayan ya da harici E2E gerektiren senaryolar icindir.');
    bullet('Eylemler: "TUM TESTLERI CALISTIR", kategori filtreleme, "Copy Report" (tum sonuclar JSON), "Copy Failed Only" (yalniz FAIL/WARNING/SKIPPED -- AI Coder\'a yapistirmak icin).');
    bullet('Yorum: FAIL hemen onarilmali; WARNING hizla incelenmeli; SKIPPED yalniz manuel test/E2E gerektiriyorsa kabul.');

    // ══════════════════════════════════════════════════════════════════════════
    // 15. PERFORMANS
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('15. Performans & Mobil WebView');

    bullet('Lazy loading: tum sayfalar React.lazy ile bolunur; SplashScreen ortak fallback.');
    bullet('Animasyon kurali: AnimatePresence mode="wait" ile sayfa gecisleri tek seferlik; ic animasyonlar mobilde ucuza tutulur.');
    bullet('Timer/interval cleanup: useGameActions schedule timeout\'lari Set icinde tutar, unmount\'ta tum window.clearTimeout cagrilir.');
    bullet('Subscription cleanup: useLobbySync ve useWaitingRoomSync sayfa terk edildikten sonra poll/setInterval birakmaz.');
    bullet('Audio cleanup: muzik sorulari oncesinde onceki Audio nesneleri pause+src=null ile bos birakilir.');
    bullet('Production debug gating: console.log yerine lib/debugLog.js kullanilir; release derlemelerinde sessizlestirilir.');
    bullet('Risk alanlari: cok hizli host tiklamalari, 4 oyuncuda subscription gecikme tepe noktalari, dusuk RAM cihazlarda muzik decode.');

    // ══════════════════════════════════════════════════════════════════════════
    // 16. KORUNMALI -- PRATIK KURALLAR
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('16. Korunmasi Gereken Sistemler -- Pratik Kurallar');

    subTitle('A. Timeline hit-testing');
    drawText('Neden kirilgan: viewport vs world koordinatlari kolayca karistirilir.');
    aiBlock({
      doList: [
        'Hit-test her zaman world coord ile yapilmali (containerLeft + scrollLeft).',
        'Ghost kart her zaman viewport coord (position:fixed) ile takip etmeli.',
      ],
      dontList: [
        'Hit-test\'te direct clientX kullanmak (scroll varken yanlis bolge secer).',
        'Ghost karti scroll konteyneri icine yerlestirmek.',
      ],
      files: ['components/game/Timeline.jsx', 'components/game/GameLayout.jsx', 'components/game/QuestionCard.jsx'],
      tests: ['Test Suite -> offline, sync, stability kategorileri', 'Manuel: timeline ortasinda surukle-birak'],
      risk: 'High',
    });

    subTitle('B. Drag/drop ghost card');
    aiBlock({
      doList: [
        'Touch start/move/end olaylari aktif aktarilmali; passive listener kullanma.',
        'Kart birakma isPlacingRef ile kilitlenir (500ms).',
      ],
      dontList: [
        'Yeni libdaki drag-drop kutuphanesi eklemek (mevcut sistemi degistirmeden).',
        'Touch event bubbling\'ini bozmak.',
      ],
      files: ['components/game/QuestionCard.jsx', 'components/game/GameLayout.jsx', 'components/game/Timeline.jsx'],
      tests: ['Test Suite -> offline, stability', 'Manuel: 3 ust uste hizli yerlestirme'],
      risk: 'High',
    });

    subTitle('C. gameRules placement logic');
    aiBlock({
      doList: [
        'Yerlestirme dogrulugu icin yalniz lib/gameRules.isCorrectPlacement cagir.',
        'Yeni oyun modu gelirse helperi parametre ile genislet, kopyalama.',
      ],
      dontList: [
        'isCorrectPlacement\'i UI icinde yeniden yazmak.',
        'hasPlayerWon esigini inline degistirmek.',
      ],
      files: ['lib/gameRules.js', 'hooks/useGameActions.js', 'functions/updateLobbyGameState'],
      tests: ['Test Suite -> sync, offline, lobby', 'runTestSuite saf unit'],
      risk: 'High',
    });

    subTitle('D. useLobbySync subscription + polling fallback');
    aiBlock({
      doList: [
        'Subscription unsubscribe useEffect cleanup\'inda mutlaka cagrilmali.',
        'Polling interval window.clearInterval ile temizlenmeli.',
      ],
      dontList: [
        'Lobby.update\'i bu hook DISINDA manuel cagirmak.',
        'Route state\'i (navigate({state})) otorite gibi kullanmak.',
      ],
      files: ['hooks/useLobbySync.js', 'hooks/useWaitingRoomSync.js', 'pages/Game.jsx'],
      tests: ['Test Suite -> lobby (subscription_cleanup_preserved, polling_fallback_preserved)', 'Manuel 2-cihaz refresh testi'],
      risk: 'High',
    });

    subTitle('E. Home 1080x1920 stage');
    aiBlock({
      doList: [
        'Yeni eleman eklerken sahnenin yuzdesini koru.',
        'isWideStage kosulunu kullan; vh/vw nudge ekleme.',
      ],
      dontList: [
        'Solo/Online kart yuzdelerini elle "duzeltmek".',
        'document.body.style.overflow degistirmek.',
      ],
      files: ['pages/MainMenu.jsx', 'index.css'],
      tests: ['Test Suite -> home (expected_card_coords, equal_card_size, desktop_stage_clickable, viewport_*)', 'Mobil tarayicida scroll yok kontrolu'],
      risk: 'Medium',
    });

    subTitle('F. updateLobbyGameState validation');
    aiBlock({
      doList: [
        'Yeni alan eklendiginde validateGameStateUpdate listesine ekle.',
        'Reddedilen update sonrasi istemci Lobby.get ile self-heal yapsin.',
      ],
      dontList: [
        'used_question_ids\'i kucultmek.',
        'Oyuncu listesini eklemek/cikarmak/siralamak.',
      ],
      files: ['functions/updateLobbyGameState', 'hooks/useGameActions.js', 'hooks/useLobbySync.js'],
      tests: ['Test Suite -> exceptional (server_reject_*)', 'simulateOnlineGame'],
      risk: 'High',
    });

    subTitle('G. Lobby entity contract');
    aiBlock({
      doList: ['Yeni alan eklemeden once data contracts bolumunu okuyun.'],
      dontList: ['Var olan alanlarin anlamini degistirmek.', 'Ek alanlari sessizce ekleyip server validation\'i kosturmadan release etmek.'],
      files: ['entities/Lobby.json', 'lib/lobbyUtils.js', 'lib/onlineGameStart.js', 'functions/updateLobbyGameState'],
      tests: ['Test Suite -> architecture, lobby, sync'],
      risk: 'High',
    });

    subTitle('H. Media fallback rendering');
    aiBlock({
      doList: [
        'Medya hatasinda kullaniciya bos ekran gosterme; QuestionMediaLoader fallback\'ini kullan.',
        'Hatali soruyu skipCurrentQuestion ile gec.',
      ],
      dontList: [
        'media_url null kontrolsuz oynatmak (audio crash).',
        'Sessizce yutmak (logsuz).',
      ],
      files: ['components/game/QuestionCard.jsx', 'components/game/QuestionMediaLoader.jsx', 'hooks/useGameActions.js (skipCurrentQuestion)'],
      tests: ['Test Suite -> media kategorisi', 'Manuel: bozuk url ile soru'],
      risk: 'Medium',
    });

    // ══════════════════════════════════════════════════════════════════════════
    // 17. GUVENLE DEGISTIRME REHBERI
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('17. Kodu Guvenle Degistirme Rehberi');

    subTitle('Smallest possible patch');
    bullet('Bir istegi en az dosya ve en az satira indir; gereksiz refactor yapma.');
    bullet('Yeni component klasoru acmadan once mevcut bir component genisletilebilir mi diye bak.');

    subTitle('Asla casually degistirme');
    bullet('Protected systems (Bolum 16) listesindeki hicbir sey "side effect olmadan" degismez.');
    bullet('useLobbySync ve gameRules helper imzalari urune yayilmistir; degisiklik en az 5 dosyada test gerektirir.');

    subTitle('Degisiklik sonrasi her zaman');
    bullet('Test Simulation calistir (/test-suite veya Settings).');
    bullet('"Copy Failed Only" ile basarisiz testleri AI Coder\'a yapistir.');
    bullet('Mobil tarayicida en az Home + Solo + Online lobi acilis kontrolu.');

    subTitle('Behavior-preserving refactor onceligi');
    bullet('Davranisi koruyan refactorlar test suite gecmeli (PASS).');
    bullet('Davranis degisecekse aciklamasi commit/PR mesajinda olmali.');

    subTitle('AI Coder\'a brief verme');
    bullet('"Sadece su dosyalar degisecek" listesi ver.');
    bullet('"Su sistemler degisemez" listesi ver (protected).');
    bullet('"Test sonucu nasil olmali" net belirt.');

    // ══════════════════════════════════════════════════════════════════════════
    // 18. YENI OZELLIK GIRIS NOKTALARI
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('18. Yeni Ozellik Giris Noktalari');

    subTitle('Profile sayfasi');
    aiBlock({
      doList: [
        'Yeni rota /profile App.jsx\'e ekle, lazy import.',
        'Veri GameRecord uzerinden aggregate; AuthContext\'ten user al.',
        'BottomNav\'a yeni sekme eklenmeli (mevcut 3 sekme ile uyum).',
      ],
      dontList: [
        'Lobby uzerinden istatistik tutmak (anlik state\'tir, gecmis yok).',
        'Mobile Home stage geometrisini degistirmek.',
      ],
      files: ['pages/Profile.jsx (yeni)', 'App.jsx', 'components/layout/BottomNav.jsx', 'entities/GameRecord.json'],
      tests: ['Test Suite -> smoke (profile route)', 'records kategorisini genislet'],
      risk: 'Medium',
    });

    subTitle('Scoring (puanlama)');
    aiBlock({
      doList: [
        'lib/scoring.js olustur; tum puan hesaplamasi orada saf fonksiyonlar.',
        'GameRecord\'a opsiyonel "score" alani ekle (geri uyumlu).',
        'Solo bitiminde scoring.computeFinalScore(...) cagrilsin.',
      ],
      dontList: [
        'Online sonrasi clientten skoru DB\'ye yazmak (trust yok).',
        'Puanlamayi GameOver UI icine inline yazmak (test edilemez).',
      ],
      files: ['lib/scoring.js (yeni)', 'hooks/useGameActions.js', 'entities/GameRecord.json'],
      tests: ['Saf unit testler lib/scoring.js icin', 'Test Suite -> records'],
      risk: 'Medium',
    });

    subTitle('Leaderboard');
    aiBlock({
      doList: [
        'Once sunucu trust boundary\'sini guclendir (bkz. Bolum 19).',
        'Sadece dogrulanmis Lobby.status=finished kayitlarini aggregate et.',
      ],
      dontList: [
        'Suanki Lobby uzerinden global leaderboard yayinlamak.',
        'Anti-cheat yokken ranked publish etmek.',
      ],
      files: ['functions/leaderboardAggregate (yeni - server)', 'pages/Leaderboard.jsx (yeni)'],
      tests: ['Sunucu reddetme yuzeyi genislemeli', 'Test Suite -> exceptional server_reject_*'],
      risk: 'High',
    });

    subTitle('Rematch');
    aiBlock({
      doList: [
        'Mevcut Lobby uzerinde reset: status="waiting", winner=null, winner_email=null, used_question_ids=[], current_player_index=0.',
        'Yeniden dagitim icin buildInitialOnlineGameState\'i tekrar cagir.',
        'Sunucu yeni bir "rematch" eyleminin geçerli bir tahriklenmesi olarak tanitilmali.',
      ],
      dontList: [
        'Yeni bir Lobby acmak (kod degisir, oyuncular kaybeder).',
        'players cards alanini istemcide elle silmek.',
      ],
      files: ['components/game/GameOver.jsx (rematch CTA)', 'lib/onlineGameStart.js', 'functions/updateLobbyGameState'],
      tests: ['Test Suite -> sync, lobby', 'simulateOnlineGame icine rematch akisi'],
      risk: 'Medium',
    });

    subTitle('Ranked mode');
    aiBlock({
      doList: [
        'Once anomali tespiti / timing heuristikleri eklenmeli.',
        'Skor sistemi ve leaderboard stabil olmali.',
      ],
      dontList: ['Anti-cheat yokken ranked publish etmek.'],
      files: ['Multiple -- buyuk feature, hazirlik gerekli'],
      tests: ['Genis E2E ve sunucu testleri gerekecek'],
      risk: 'High',
    });

    // ══════════════════════════════════════════════════════════════════════════
    // 19. BILINEN SINIRLAMALAR
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('19. Bilinen Sinirlamalar');

    bullet('Ranked/leaderboard guvenilir rekabet icin HAZIR DEGIL.');
    bullet('Anti-cheat / anomaly detection yok (timing, soru bilgisi sizintisi).');
    bullet('Online trust gelistirildi ancak ranked seviyesi icin yetersiz.');
    bullet('Bazi testler deterministik simulasyondur; tam E2E (gercek 2 cihaz) degil.');
    bullet('Android/iOS WebView gercek-cihaz dokunmatik QA hala manuel yapilmali.');
    bullet('Cok dusuk RAM cihazlarda muzik decode + animasyonlar duraksayabilir.');
    bullet('Subscription kopukluklarinda polling fallback devreye girer; idealden gec gorunum mumkun.');

    // ══════════════════════════════════════════════════════════════════════════
    // 20. TERIMLER SOZLUGU
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('20. Terimler Sozlugu (Aktif vs Legacy)');

    codeBlock([
      'Terim                       Durum         Notlar',
      '------------------------------------------------------------------',
      'Kronox                      AKTIF         Marka adi - tek dogru yazim',
      'Solo Meydan Okuma           AKTIF         Home Solo kartinin metni',
      'Online Battle               AKTIF         Home Online kartinin metni',
      '"Solo Kapisma"              LEGACY        Eski metin - kullanma',
      '"Online Kapisma"            LEGACY        Eski metin - kullanma',
      'HEMEN OYNA                  REMOVED       Home CTA kaldirildi',
      'Local multiplayer setup     REMOVED       Eski player-count ekrani',
      'LobbyChat                   REMOVED       Sohbet UI yok',
      'LobbyMessage entity         INACTIVE      Korunur ama yazilmaz',
      'PlayerSetup sayfasi         LEGACY        /setup -- birincil akis degil',
      'kronos / Kronos             YANLIS        Yanlis yazim, asla kullanma',
    ]);
    spacer(6);
    drawText('Kural: PDF, UI, kod, commit ve dokumantasyonda her yerde "Kronox" yazimi kullanilir. Cikti dosya adlari sabittir: kronox-teknik-dokuman.pdf ve kronox-is-akisi.pdf.', { color: gray });

    // ══════════════════════════════════════════════════════════════════════════
    // ARKA KAPAK
    // ══════════════════════════════════════════════════════════════════════════
    page = pdfDoc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: darkBg });
    page.drawRectangle({ x: marginL, y: H / 2 - 1, width: 120, height: 2, color: gold });
    page.drawText('KRONOX', { x: marginL, y: H / 2 + 30, size: 40, font: boldFont, color: gold, opacity: 0.25 });
    page.drawText(tr('Base44 Platform uzerinde gelistirilmistir'), { x: marginL, y: H / 2 - 28, size: 10, font, color: gray });
    page.drawText(tr('Teknik mimari belgesi - Internal AI / Developer Briefing'), { x: marginL, y: H / 2 - 46, size: 10, font, color: gray });
    page.drawText(tr('v3.0 - Build Codex040'), { x: marginL, y: H / 2 - 64, size: 10, font, color: gray });

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=kronox-teknik-dokuman.pdf',
      },
    });
  } catch (error) {
    console.error('[generateTechDoc] failed', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});