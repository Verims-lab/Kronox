import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

// Türkçe karakterleri ASCII'ye dönüştür (Helvetica Latin-1 ile uyumlu)
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
    .replace(/[^\x00-\xFF]/g, '?');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

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
      page.drawText(tr('KRONOX — Teknik Dokuman'), { x: marginL, y: H - 38, size: 8, font, color: gray });
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
        const test = line ? line + ' ' + word : word;
        const tw = f.widthOfTextAtSize(test, size);
        if (tw > maxW && line) {
          ensureSpace(size + lineGap + 4);
          page.drawText(line, { x: marginL + indent, y, size, font: f, color: c });
          y -= size + lineGap;
          line = word;
        } else {
          line = test;
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

    // ══════════════════════════════════════════════════════════════════════════
    // KAPAK
    // ══════════════════════════════════════════════════════════════════════════
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: darkBg });
    page.drawRectangle({ x: marginL, y: H / 2 - 1, width: 120, height: 2, color: gold });

    page.drawText('KRONOX', { x: marginL, y: H / 2 + 90, size: 56, font: boldFont, color: gold });
    page.drawText(tr('Zaman Cizgisi Kart Oyunu'), { x: marginL, y: H / 2 + 50, size: 18, font, color: rgb(0.85, 0.85, 0.9) });
    page.drawText(tr('Teknik Mimari Dokumani'), { x: marginL, y: H / 2 + 24, size: 14, font, color: gray });

    page.drawText('v2.0', { x: marginL, y: H / 2 - 30, size: 11, font, color: gray });
    page.drawText('Build: Codex038', { x: marginL, y: H / 2 - 47, size: 11, font, color: gray });
    page.drawText('Platform: Base44 (React + Vite + Deno)', { x: marginL, y: H / 2 - 64, size: 11, font, color: gray });

    page.drawLine({ start: { x: marginL, y: 80 }, end: { x: W - marginR, y: 80 }, thickness: 0.5, color: gold, opacity: 0.3 });
    page.drawText('Proje ic kullanim - AI Coder ve gelistirici brifingi', { x: marginL, y: 64, size: 9, font, color: gray });

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
      ['6.', 'Backend Fonksiyonlar'],
      ['7.', 'Home Ekrani Mimarisi (1080x1920 Stage)'],
      ['8.', 'Offline Solo Mimarisi'],
      ['9.', 'Online Multiplayer Mimarisi'],
      ['10.', 'Online State Otoritesi & Senkronizasyon'],
      ['11.', 'Sunucu Tarafi Dogrulama (Trust Boundary)'],
      ['12.', 'Drag-and-Drop & Timeline'],
      ['13.', 'Test Suite & Simulation Panel'],
      ['14.', 'Performans & Mobil WebView'],
      ['15.', 'Korunmasi Gereken Sistemler'],
      ['16.', 'Gelecek Ozellik Hazirligi'],
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
    drawText('Kronox, oyuncularin sorularda gecen olay/eser/olayin yilini kendi zaman cizgilerine dogru sirayla yerlestirdigi rekabetci bir kart oyunudur. Uygulama, mobil-oncelikli (WebView/PWA) tasarlanmis bir React + Vite + Base44 projesidir. Iki birincil mod vardir:');
    spacer(4);
    bullet('Solo (offline): Tek oyunculu, sade ve hizli — kendi rekorunu kirma odakli.');
    bullet('Online Battle: 2-4 oyunculu, gercek zamanli lobi tabanli rekabet.');
    spacer();
    drawText('Bu dokuman; mimariyi, modul sorumluluklarini ve KORUNMASI GEREKEN sistemleri AI Coder ve yeni gelistiriciler icin tek bir referansa indirger.', { color: gray });

    // ══════════════════════════════════════════════════════════════════════════
    // 2. TEKNOLOJI YIGINI
    // ══════════════════════════════════════════════════════════════════════════
    spacer(12);
    sectionTitle('2. Teknoloji Yigini');

    subTitle('Frontend');
    bullet('React 18 + Vite — SPA, code-splitting (React.lazy + Suspense)');
    bullet('React Router DOM v6 — sayfa rotalari ve push/pop yon-duyarli transitionlar');
    bullet('TanStack Query v5 — yalin async durum yonetimi (gerektiginde)');
    bullet('Framer Motion — sayfa, modal ve geri bildirim animasyonlari');
    bullet('Tailwind CSS + Shadcn/UI — utility-first stil, accessible UI primitifleri');
    bullet('Lucide React — ikon kutuphanesi (yalniz dogrulanmis ikonlar)');

    subTitle('Mobil & Platform');
    bullet('Base44 — BaaS: entities, RLS, real-time subscriptions, OAuth, backend functions');
    bullet('Deno runtime — backend fonksiyonlari (npm:/jsr: importlar, Deno.serve)');
    bullet('WebView/PWA wrapper — iOS ve Android icin ayni React bundle');
    bullet('safe-area-inset-* + overscroll-behavior-none — notch ve home indicator hassasiyetli');

    subTitle('Kisitlar');
    bullet('Mobil-oncelikli: butun layoutlar 360x740 ve uzeri mobil ile basliyor');
    bullet('Bandwidth ve memory dusuk varsayilir; animasyon ve subscription cleanup zorunludur');
    bullet('Sadece izinli paket listesi kullanilir (bkz. base44 platform talimatlari)');

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
      '/setup              PlayerSetup          (legacy/yardimci) tek-cihaz isim kurulumu',
      '/lobby              LobbyRoom            Online lobi olustur/katil + waiting room',
      '/game               Game                 Aktif oyun sahnesi (solo + online ayni shell)',
      '/settings           SettingsPage        Hesap ayarlari + admin araclari',
      '/test-suite         TestSuite           SimulationPanel host - admin-only',
    ]);
    spacer(6);
    drawText('App.jsx tek otoriter routerdir; tum sayfa importlari React.lazy ile bolunmustur. Sayfa gecisleri push/pop yonu hesaplanarak yatay slide animasyonu ile gerceklesir. Game ve Home rotalarinda AppHeader gizlenir; diger sayfalarda gosterilir. BottomNav her zaman aktif fakat /game sayfasinda sadelestirilir.');

    // ══════════════════════════════════════════════════════════════════════════
    // 4. MODUL SORUMLULUKLARI
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('4. Modul Sorumluluklari');

    subTitle('Pages');
    bullet('pages/MainMenu.jsx — Home. 1080x1920 stage koordinat sistemi. Mode kartlari (Solo / Online), profil cubugu, ayarlar girisi. Hicbir scroll yok.');
    bullet('pages/SoloChallenge.jsx — Kategori (genel/tarih/spor/sanat/bilim vb.) ve zorluk secimi. Secim sonrasi /game?mode=solo... ile yonlendirir.');
    bullet('pages/LobbyRoom.jsx — INCE orkestrator. Identity ve form state useLobbyRoomState hook\'una, UI ise LobbyCreateJoinPanel + WaitingRoomPanel\'e devredilmistir.');
    bullet('pages/Game.jsx — Solo ve online oyunun ortak shellidir. useGameState (ViewModel), useGameActions (domain), useLobbySync (online sync), useOfflineQuestions (solo) hooklarini birlestirir.');
    bullet('pages/SettingsPage.jsx — Hesap silme, lider tablosu, ogretici, admin araclari (soru yonetimi, doc indirme, regresyon paneli).');
    bullet('pages/TestSuite.jsx — Admin-only sayfa; SimulationPanel\'i barindirir. isAdminUser disindaki kullanicilar engellenir.');

    subTitle('Hooks');
    bullet('hooks/useGameState.js — Tum oyun-sahnesi UI durumu (lobbyData, feedback, winner, drag, zone, timer key). Refler placement-lock ve toplam sure icin tutulur.');
    bullet('hooks/useGameActions.js — Domain/use-case katmani. doPlacement, advanceTurn, skipCurrentQuestion ve pickQuestion. Online icinde tum DB yazimi updateLobbyGameState servis fonksiyonundan gecer.');
    bullet('hooks/useLobbySync.js — Online oyunun TEK senkronizasyon otoritesi. Initial fetch, subscription ve poll fallback ile lobbyData\'yi gunceller.');
    bullet('hooks/useLobbyRoomState.js — LobbyRoom sayfasi icin identity (user, playerName), form ve modal state\'i tutar.');
    bullet('hooks/useWaitingRoomSync.js — Bekleme odasi icin subscription + polling fallback; status==="in_game" gecislerinde tum oyunculari /game\'e yonlendirir.');
    bullet('hooks/useOfflineQuestions.js — Solo modda soru havuzunu yukler ve onbellekler (lib/questionCache.js ile birlikte calisir).');
    bullet('hooks/usePullToRefresh.js — Mobil dokunmatik pull-to-refresh.');

    subTitle('Lib (saf yardimcilar)');
    bullet('lib/gameRules.js — Saf kart kurali yardimcilari: isCorrectPlacement, getNextPlayerIndex, hasPlayerWon, getTimelineYears, selectNextQuestion, getQuestionSelectionPool.');
    bullet('lib/lobbyUtils.js — normalizeCode, summarizePlayers, isHost, canJoinLobby, removePlayerByIdentity, buildLobbyStartPayload vb. Lobby ile ilgili saf domain yardimcilari.');
    bullet('lib/onlineGameStart.js — filterQuestionsForLobbySettings, shuffleQuestions ve buildInitialOnlineGameState. WaitingRoom oyunu baslatirken bu helperi cagirir.');
    bullet('lib/admin.js — isAdminUser ve ADMIN_EMAIL. Admin kuralinin TEK kaynagidir; UI hicbir yerde manuel email kiyaslamasi yapmaz.');
    bullet('lib/AuthContext.jsx — base44.auth.me / isAuthenticated ile genel auth state\'i, public settings yuklemesi, hata tiplemesi.');
    bullet('lib/NavigationStackContext.jsx — Sayfa transition yonu (push/pop) icin yardimci.');
    bullet('lib/debugLog.js — Production-gated debug log; release derlemelerinde sessizlestirilir.');
    bullet('lib/questionHistory.js, lib/questionCache.js — Solo mod icin cross-game soru tekrarini onleyen kucuk LRU.');

    subTitle('Lobby Components');
    bullet('components/lobby/LobbyCreateJoinPanel.jsx — Modlar arasinda secim, isim girisi, kod girisi, hata gosterimi.');
    bullet('components/lobby/WaitingRoomPanel.jsx — Host/non-host bekleme odasi. Host buradan buildInitialOnlineGameState ile online oyunu baslatir.');

    subTitle('Game Components');
    bullet('components/game/GameLayout.jsx — Oyun sahnesi shell: ust durum cubugu, TurnTimer, QuestionCard, Timeline, CTA buton.');
    bullet('components/game/Timeline.jsx + TimelineCard.jsx — Aktif oyuncunun zaman cizgisi ve hit-test.');
    bullet('components/game/QuestionCard.jsx + QuestionMediaLoader.jsx — Soru turlerini (metin/gorsel/isitsel/muzik) render eder.');
    bullet('components/game/FeedbackOverlay.jsx — Dogru/yanlis sonrasi animasyon, fark badge\'i, muzik reveal.');
    bullet('components/game/GameOver.jsx — Kazanma/kaybetme ekrani; solo ve online icin farkli baslik/aciklama.');
    bullet('components/game/TurnTimer.jsx + GameOverTimer.jsx — Tur sayaci ve toplam sure olcucusu.');
    bullet('components/game/SimulationPanel.jsx — Test ve regresyon paneli (admin); kategorize testler, Copy Report / Copy Failed Only.');
    bullet('components/tutorial/KronoxTutorial.jsx — Yeni oyuncu icin animasyonlu, 5-6 adimli ogretici.');

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
      'media_url   string  Gorsel veya ses URL (gerekli turler icin)',
      'icon_url    string  Karta ozel ikon URL\'si',
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
      'current_question_id    string  Aktif sorunun id\'si',
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

    subTitle('LobbyMessage (legacy / pasif)');
    drawText('Eski lobi sohbeti icin tutulan entity. Aktif UI tarafindan KULLANILMAZ; saglik nedeniyle entity korunur ancak chat/UI tamamen kaldirildi (bkz. Test Suite "removed" kategorisi).', { color: gray });

    subTitle('User (built-in)');
    drawText('Base44 yerlesik User entity. Admin yetkisi role=="admin" alanindan veya lib/admin.js ADMIN_EMAIL ile kontrol edilir.');

    // ══════════════════════════════════════════════════════════════════════════
    // 6. BACKEND FONKSIYONLAR
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('6. Backend Fonksiyonlar');

    subTitle('findLobbyByCode');
    drawText('Kod ile lobi bulur ve oyuncuyu listeye atomik olarak ekler. Service-role ile RLS\'i bypass eder cunku oyuncu henuz katilimci degildir. Retry destekli, yarisma kosullarina dayanikli.');
    bullet('Giris: { code, playerName }');
    bullet('Cikis: { found, joinable, joined, lobby, debug }');

    subTitle('updateLobbyGameState (online state otoritesi)');
    drawText('TUM online tur/kart yazimlarinin tek girisi. Sunucu tarafinda gelisleri reddedebilir:');
    bullet('Authenticated user yoksa 401 doner');
    bullet('actorEmail current_player olmali');
    bullet('Yeni used_question_ids eskileri TAMAMINI icermeli (kucultulemez)');
    bullet('Oyuncu sirasi/sayisi/email listesi degistirilemez');
    bullet('Kart sayisi yalnizca aktif oyuncuda +1 olabilir; baska oyuncularin kartlari salt-okunur');
    bullet('Yeni current_player_index getNextPlayerIndex sonucuyla esit olmalidir');
    bullet('status=finished icin winner ve winner_email gercek bir oyuncu olmali');

    subTitle('runTestSuite & simulateOnlineGame');
    drawText('Admin araclari. runTestSuite saf birim & senaryo testlerini sunucuda kosturur; simulateOnlineGame online akisi sahte oyuncularla bastan sona simule eder.');

    subTitle('generateTechDoc / generateWorkflowDoc');
    drawText('Bu PDFler. Settings > Admin Araclari uzerinden indirilir. Yalnizca admin (role=="admin" veya sariverim@gmail.com) erisebilir.');

    subTitle('Diger');
    bullet('deleteAccount — kullanici kendi hesabini sertce siler');
    bullet('getQuestions — solo modda hizli toplu soru cekme uctan-uca optimizasyonu');
    bullet('getDeezerPreview / searchSpotifyTrack / loadSpotifyMusicQuestions / populateSpotifyQuestions / seedMusicQuestions — muzik tipi sorular icin yardimcilar');

    // ══════════════════════════════════════════════════════════════════════════
    // 7. HOME EKRANI
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('7. Home Ekrani Mimarisi (1080x1920 Stage)');

    drawText('Home, tek bir tasarim sahnesini (1080x1920 portrait) viewporta orantili olarak yerlestirir. Tum elementler bu sahneye gore YUZDE ile konumlanir; pixel kacirma yoktur.');
    spacer(6);

    subTitle('Stage stratejisi');
    bullet('Mobil: width=100dvw, height=100dvh — 9:16\'ya yakin oranlarda dogal otururlar.');
    bullet('Genis ekran (desktop tarayici, tablet, landscape): isWideStage kosulu devreye girer ve sahne min(100dvw, 56.25dvh) x min(100dvh, 177.7778dvw) ile sınırlı tutulur. Boylece kartlar tiklanabilir kalir.');
    bullet('Dis konteyner fixed inset-0 overflow-hidden ile scrollu kilitler; touchAction: manipulation pinch-zoom\'u onler.');

    subTitle('Pointer ve Z-ekseni kurallari');
    bullet('Dekoratif arka plan ve illustrasyon katmanlari pointerEvents: none, zIndex: 0 ile sirayla yerlesir.');
    bullet('Mode kartlari (Solo + Online) absolute konumlanir, z-20 ve pointerEvents: auto ile tiklanabilirligi GARANTI edilir.');
    bullet('Profil cubugu (ProfileBar) ve Ayarlar butonu kartlardan ust z katmanlarda yer alir.');

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
    bullet('Mobilde sahne 9:16\'dan uzaklasinca arka plan asset\'i ile kart konumlari arasindaki uyumu bu yuzdeler tutuyor.');
    bullet('Pixel-tabanli konuma donmek butun cihazlar arasinda hizalama kaybi yaratir.');

    // ══════════════════════════════════════════════════════════════════════════
    // 8. OFFLINE SOLO
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('8. Offline Solo Mimarisi');

    bullet('Akis: MainMenu -> /solo (SoloChallenge: kategori + zorluk) -> /game?mode=solo&...');
    bullet('Game.jsx solo modda lobbyId\'siz calisir, lobbyData yalnizca yerel state\'tedir.');
    bullet('useOfflineQuestions soru havuzunu yukler; sectim kategoriye/zorluga gore lib/gameRules helperlari ile filtrelenir.');
    bullet('Tekrarsizlik: oturum-ici used_question_ids (sert kural) + cross-game LRU history (questionHistory.js) + ayni oyuncunun timeline\'inda mevcut yillara denk soru tercih edilmez.');
    bullet('Yerlestirme kurallari lib/gameRules\'a baglidir: isCorrectPlacement, hasPlayerWon (win_card_count).');
    bullet('Oyun bitince kazanan oyuncu icin GameRecord.create cagrilir (sadece authenticated). TopScores Settings\'te kullaniciya gosterilir.');
    bullet('SOLO MOD ONLINE STATE\'TEN TAMAMEN IZOLEDIR: useLobbySync ve updateLobbyGameState cagrilmaz.');

    // ══════════════════════════════════════════════════════════════════════════
    // 9. ONLINE MULTIPLAYER
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('9. Online Multiplayer Mimarisi');

    subTitle('Akis');
    codeBlock([
      'MainMenu (Online) -> /lobby',
      '  LobbyCreateJoinPanel (isim + kod) -> Lobby.create veya findLobbyByCode',
      '-> WaitingRoomPanel (host: ayarlar; non-host: ready/refresh)',
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

    subTitle('Reconnect / refresh varsayimlari');
    bullet('Refresh sirasinda useLobbySync ilk renderda Lobby.get yapar; durum DB\'den yeniden bootstrap edilir.');
    bullet('Route state yalnizca bootstrap icin kullanilir, hicbir noktada otorite degildir.');
    bullet('Subscription kopukluklarini polling fallback (useWaitingRoomSync ve useLobbySync) yakalar.');

    // ══════════════════════════════════════════════════════════════════════════
    // 10. STATE OTORITESI
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('10. Online State Otoritesi & Senkronizasyon');

    bullet('Lobby entity TEK gercek kaynaktir. Lokal state DB ile uyumsuzlasirsa kaynak DB\'dir.');
    bullet('useLobbySync oyun-ici sync\'in tek otoritesidir; baska sayfa veya component manuel Lobby.update yapmaz, hepsi updateLobbyGameState\'ten gecer.');
    bullet('Route state (navigate("/game", { state })) yalnizca first paint icin bootstrap saglar; senkronizasyona girildikten sonra silinmis varsayilir.');
    bullet('Yarisma kosullarina karsi: useGameActions retry + recoverLatestLobbyState (Lobby.get) ile self-heal yapar.');
    bullet('Subscription closure\'larinda stale kullanici verisi olmamasi icin useRef pattern lobby/playerName/user referanslarina uygulanir.');

    // ══════════════════════════════════════════════════════════════════════════
    // 11. SUNUCU DOGRULAMA
    // ══════════════════════════════════════════════════════════════════════════
    spacer(12);
    sectionTitle('11. Sunucu Tarafi Dogrulama (Trust Boundary)');

    drawText('updateLobbyGameState istemciye guvenmez ve asagidaki kurallari sunucuda zorlar:');
    bullet('Auth: base44.auth.me() yoksa 401.');
    bullet('VALID_STATUSES kontrolu: status yalnizca starting/in_game/finished olabilir.');
    bullet('containsAllPreviousIds: yeni used_question_ids eskileri tamamen icermeli.');
    bullet('Oyuncu listesi: ne eklenebilir ne cikartilabilir, sira degistirilemez.');
    bullet('Kart bütünlügü: yalnizca current_player\'in cards uzunlugu +1 olabilir.');
    bullet('current_player_index gecmesi: getNextPlayerIndex sonucuna esit olmalidir.');
    bullet('winnerIndex / winner_email: gercek bir oyuncu olmali; hasPlayerWon kosulunu saglamali.');
    spacer(6);

    subTitle('Suanki guvenli yuzey');
    bullet('Gunluk casual abuse engellenir; "tek tikla kazanma" istemci enjeksiyonlari sunucuda dusurulur.');
    spacer(4);
    subTitle('Henuz hazir olmayan kismi');
    bullet('Anomali tabanli anti-cheat yok (zamanlama heuristikleri, soru bilgisi sizintisi vb.).');
    bullet('Bu nedenle Online henuz sirali/ranked liderlik tablosu icin "trust"-li sayilmaz.');

    // ══════════════════════════════════════════════════════════════════════════
    // 12. DRAG-AND-DROP
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('12. Drag-and-Drop & Timeline');

    bullet('Ghost kart viewport koordinatinda (position:fixed) takip eder; Timeline hit-test\'i world koordinatinda calisir (worldX = clientX - containerLeft + scrollLeft).');
    bullet('Edge auto-scroll: sol/sag 80px esiginde requestAnimationFrame ile 60fps kayma; isDragMode false oldugunda cleanup\'la durdurulur.');
    bullet('Saf yerlestirme dogrulamasi lib/gameRules.isCorrectPlacement ile yapilir; UI bu fonksiyonu hicbir noktada kopyalamaz.');
    bullet('Bu mimari KORUMALIDIR: koordinat uzaylarinin karistirilmasi kullanicinin kartlari yanlis bolgeye dusmesine yol acar.');

    // ══════════════════════════════════════════════════════════════════════════
    // 13. TEST SUITE
    // ══════════════════════════════════════════════════════════════════════════
    spacer(10);
    sectionTitle('13. Test Suite & Simulation Panel');

    bullet('Erisim: /test-suite rotasi VEYA Settings -> Admin Araclari -> Regresyon Test Paneli. isAdminUser disindaki kullanicilar engellenir ve ERISIM KORUMALI ekrani gosterilir.');
    bullet('Kategoriler: smoke, architecture, home, offline, lobby, sync, gameover, questions, media, admin, tutorial, records, performance, stability, exceptional, removed, release.');
    bullet('Test sonuc tipleri: PASS / FAIL / WARNING / SKIPPED. Skipped, deterministik calistirilamayan ya da harici E2E gerektiren senaryolar icindir.');
    bullet('Eylemler: "TUM TESTLERI CALISTIR", kategori bazli "FILTRELE", "Copy Report" (tum sonuclar JSON), "Copy Failed Only" (yalnizca FAIL/WARNING/SKIPPED).');
    bullet('Test Suite TUM ASAGIDAKILERI KORUR: rota varligi, Home kart koordinatlari ve clickability, server-side reddetme yuzeyi, kaldirilmis ozelliklerin import edilmedigi, build marker formati (Codex###).');
    bullet('Yorum kilavuzu: FAIL hemen onarilmali. WARNING hizla incelenmeli. SKIPPED yalniz manuel test/E2E gerektiriyorsa kabul.');

    // ══════════════════════════════════════════════════════════════════════════
    // 14. PERFORMANS
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('14. Performans & Mobil WebView');

    bullet('Lazy loading: tum sayfalar React.lazy ile bolunur; SplashScreen ortak fallback olarak kullanilir.');
    bullet('Animasyon kurali: AnimatePresence mode="wait" ile sayfa gecisleri tek seferlik; ic component animasyonlari mobilde "spring stiffness 300 / damping 30" benzeri ucuza tutulur.');
    bullet('Timer/interval cleanup: useGameActions schedule timeout\'lari Set icinde tutar, unmount\'ta tum window.clearTimeout cagrilir; subscription unsubscribe\'lari useEffect\'in cleanup\'inda CALIS.');
    bullet('Subscription cleanup: useLobbySync ve useWaitingRoomSync sayfa terk edildikten sonra hicbir poll/setInterval birakmaz.');
    bullet('Audio cleanup: muzik sorulari oncesinde onceki Audio nesneleri pause+src=null ile bos birakilir.');
    bullet('Production debug gating: tum console.log yerine lib/debugLog.js kullanilir; release derlemelerinde sessizlestirilir. Test Suite "release" kategorisi bunu denetler.');
    bullet('Bilinen risk alanlari: cok hizli host tiklamalari, 4 oyuncuda subscription gecikme tepe noktalari, ve cok dusuk RAM cihazlarda muzik decode.');

    // ══════════════════════════════════════════════════════════════════════════
    // 15. KORUNMALI
    // ══════════════════════════════════════════════════════════════════════════
    spacer(12);
    sectionTitle('15. Korunmasi Gereken Sistemler');

    bullet('Timeline hit-testing (Timeline.jsx world-coord matematigi).');
    bullet('Drag/drop ghost-kart vs hit-test koordinat ayrimi.');
    bullet('lib/gameRules — placement dogrulamasi, hasPlayerWon, getNextPlayerIndex, selectNextQuestion.');
    bullet('useLobbySync subscription + polling fallback duzeni.');
    bullet('Home 1080x1920 stage koordinat sistemi ve isWideStage kosulu.');
    bullet('updateLobbyGameState sunucu dogrulama yuzeyi.');
    bullet('Lobby entity contract\'i (players, current_player_index, current_question_id, used_question_ids, winner_email).');
    bullet('Build marker formati Codex### — Test Suite\'in release kategorisi bunu kontrol eder.');

    // ══════════════════════════════════════════════════════════════════════════
    // 16. GELECEK HAZIRLIK
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('16. Gelecek Ozellik Hazirligi');

    codeBlock([
      'Ozellik                Durum            Notlar',
      '-------------------------------------------------------------',
      'Profil sayfasi         Kismi hazir      GameRecord + AuthContext mevcut',
      'Skor sistemi           Hazirlik var     GameRecord uzerine eklenir',
      'Liderlik tablosu       HAZIR DEGIL      Sunucu trust\'i yetersiz, anti-cheat yok',
      'Ranked mod             HAZIR DEGIL      Anomali tespiti gerekli',
      'Rematch                Kucuk gelistirme Lobby.status reset + yeni dagitim',
      'Istatistik gecmisi     Hazirlik var     GameRecord uzerinden aggregate',
      'Anti-cheat / anomaly   Yok              Server-side timing heuristikleri eklenmeli',
    ]);
    spacer(6);
    drawText('Bu rapor, AI Coder veya yeni gelistiriciye onceki dokumandan tum farkliliklari (Home stage sistemine gecis, useLobbySync otoritesi, updateLobbyGameState dogrulama yuzeyi, removed chat/QA bilesenleri, Test Suite kategori genislemesi, debug log gating) en tepe seviyeden anlatmak icin yaziLmistir.', { color: gray });

    // ══════════════════════════════════════════════════════════════════════════
    // ARKA KAPAK
    // ══════════════════════════════════════════════════════════════════════════
    page = pdfDoc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: darkBg });
    page.drawRectangle({ x: marginL, y: H / 2 - 1, width: 120, height: 2, color: gold });
    page.drawText('KRONOX', { x: marginL, y: H / 2 + 30, size: 40, font: boldFont, color: gold, opacity: 0.25 });
    page.drawText('Base44 Platform uzerinde gelistirilmistir', { x: marginL, y: H / 2 - 28, size: 10, font, color: gray });
    page.drawText('Teknik mimari belgesi - ic kullanim', { x: marginL, y: H / 2 - 46, size: 10, font, color: gray });

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=kronox-teknik-dokuman.pdf',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});