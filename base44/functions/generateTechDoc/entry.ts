import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

// Turkce karakterleri ASCII'ye donustur
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
    // KAPAK SAYFASI
    // ══════════════════════════════════════════════════════════════════════════
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: darkBg });
    page.drawRectangle({ x: marginL, y: H / 2 - 1, width: 120, height: 2, color: gold });

    page.drawText('KRONOX', { x: marginL, y: H / 2 + 90, size: 56, font: boldFont, color: gold });
    page.drawText(tr('Zaman Cizgisi Kart Oyunu'), { x: marginL, y: H / 2 + 50, size: 18, font, color: rgb(0.85, 0.85, 0.9) });
    page.drawText(tr('Teknik Mimari Dokumani'), { x: marginL, y: H / 2 + 24, size: 14, font, color: gray });

    page.drawText('v1.3', { x: marginL, y: H / 2 - 30, size: 11, font, color: gray });
    page.drawText('Mayis 2026', { x: marginL, y: H / 2 - 47, size: 11, font, color: gray });
    page.drawText('Platform: Base44 (React + Deno)', { x: marginL, y: H / 2 - 64, size: 11, font, color: gray });

    page.drawLine({ start: { x: marginL, y: 80 }, end: { x: W - marginR, y: 80 }, thickness: 0.5, color: gold, opacity: 0.3 });
    page.drawText('Proje ic kullanim', { x: marginL, y: 64, size: 9, font, color: gray });

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
      ['3.', 'Dosya & Klasor Yapisi'],
      ['4.', 'Veri Modeli (Entities)'],
      ['5.', 'Sayfa & Bilesen Mimarisi'],
      ['6.', 'Layout Bilesenleri'],
      ['7.', 'Oyun Mekanigi — Yerel Mod'],
      ['8.', 'Oyun Mekanigi — Cevrimici Mod'],
      ['9.', 'Backend Fonksiyonlar'],
      ['10.', 'Kimlik Dogrulama & Mobil (APK)'],
      ['11.', 'Landscape Modu Destegi'],
      ['12.', 'Test Suite (41 Senaryo)'],
      ['13.', 'Performans & UX Optimizasyonlari'],
      ['14.', 'Guvenlik & Erisim Kontrolu'],
      ['15.', 'Gelecek Gelistirme Onerileri'],
      ['8b.', 'Drag-and-Drop Mimarisi (Dokunmatik)'],
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
    drawText('Kronox, oyuncularin tarihi olaylari dogru kronolojik siraya yerlestirdigi bir kart oyunudur. Oyun yerel (ayni cihaz, birden fazla oyuncu) ve cevrimici (gercek zamanli lobi, WebSocket tabanli senkronizasyon) olmak uzere iki modda oynanabilir.');
    spacer();
    drawText('Temel hedefler:');
    bullet('Sezgisel ve hizli kurulum — oyuncular dakikalar icinde oyuna girebilmeli');
    bullet('Mobil-oncelikli tasarim — iOS ve Android native uygulamada calisabilir');
    bullet('Gercek zamanli cok oyunculu deneyim — lobi sistemi ile 2-4 oyuncu');
    bullet('Genisletilebilir soru havuzu — admin paneli uzerinden yeni soru ekleme');

    // ══════════════════════════════════════════════════════════════════════════
    // 2. TEKNOLOJI YIGINI
    // ══════════════════════════════════════════════════════════════════════════
    spacer(12);
    sectionTitle('2. Teknoloji Yigini');

    subTitle('Frontend');
    bullet('React 18 — Bilesen tabanli UI katmani');
    bullet('React Router DOM v6 — SPA yonlendirme');
    bullet('TanStack Query v5 — sunucu durumu yonetimi, onbellekleme');
    bullet('Framer Motion — animasyon ve gecis efektleri');
    bullet('Tailwind CSS — utility-first stil sistemi');
    bullet('Shadcn/UI — temel UI bilesenleri (Button, Input, Toast vb.)');
    bullet('Lucide React — ikon kutuphanesi');

    subTitle('Backend & Platform');
    bullet('Base44 Platform — BaaS (Backend-as-a-Service)');
    bullet('Deno Runtime — backend fonksiyonlar icin sunucu ortami');
    bullet('Gercek zamanli subscriptions — WebSocket tabanli entity dinleme');

    subTitle('Build & Deploy');
    bullet('Vite — gelistirme sunucusu ve uretim derleyici');
    bullet('React.lazy + Suspense — code splitting ile sayfa bazli yukleme');

    // ══════════════════════════════════════════════════════════════════════════
    // 3. DOSYA YAPISI
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('3. Dosya & Klasor Yapisi');
    codeBlock([
      'src/',
      '|-- pages/',
      '|   |-- PlayerSetup.jsx      # Ana ekran - oyun kurulum formu',
      '|   |-- LobbyRoom.jsx        # Cevrimici lobi (olustur/katil/bekle)',
      '|   |-- Game.jsx             # Oyun sahnesi (yerel + cevrimici)',
      '|   |-- SettingsPage.jsx     # Admin paneli & hesap ayarlari',
      '|   +-- TestSuite.jsx        # 41 senaryolu test paneli (admin)',
      '|-- components/',
      '|   |-- layout/',
      '|   |   |-- AppHeader.jsx    # Sabit ust baslik (geri/giris/ayarlar)',
      '|   |   +-- BottomNav.jsx    # Alt navigasyon cubugu (3 sekme)',
      '|   |-- game/',
      '|   |   |-- PlayerIndicator  # Aktif oyuncu gostergesi',
      '|   |   |-- Timeline         # Kart sirasi & birakma bolgesi (landscape destekli)',
      '|   |   |-- TimelineCard     # Tekil kart bileseni',
      '|   |   |-- DropZone         # Kartin yerlestirilecegi alan',
      '|   |   |-- QuestionCard     # Soruyu gosteren kart (landscape destekli)',
      '|   |   |-- TurnTimer        # Tur sayaci (SVG dairesel, landscape kucuk)',
      '|   |   |-- FeedbackOverlay  # Dogru/Yanlis animasyonu',
      '|   |   |-- GameOver         # Kazanma ekrani',
      '|   |   |-- SettingsModal    # Hesap ayarlari modal',
      '|   |   +-- SimulationPanel  # Gelistirici test paneli (42 senaryo)',
      '|   +-- lobby/',
      '|       +-- LobbyChat        # Lobi ici gercek zamanli sohbet',
      '|-- entities/',
      '|   |-- Question.json        # Soru semasi (RLS ile korunur)',
      '|   |-- Lobby.json           # Lobi semasi',
      '|   +-- LobbyMessage.json    # Sohbet mesaji semasi',
      '|-- functions/',
      '|   |-- simulateOnlineGame   # 42 senaryolu otomatik test suite',
      '|   |-- runTestSuite         # 41 senaryolu birim/kara kutu/perf/oynanabilirlik',
      '|   |-- generateTechDoc      # Teknik mimari PDF ureteci',
      '|   +-- generateWorkflowDoc  # Is akisi & use case PDF ureteci',
      '|-- hooks/',
      '|   +-- usePullToRefresh.js  # Mobil pull-to-refresh hook',
      '+-- lib/',
      '    |-- AuthContext.jsx       # Kimlik dogrulama baglami (APK login fix)',
      '    +-- query-client.js      # TanStack Query yapilandirmasi',
    ]);

    // ══════════════════════════════════════════════════════════════════════════
    // 4. VERİ MODELİ
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('4. Veri Modeli (Entities)');

    subTitle('Question');
    drawText('Oyundaki sorulari depolar. Yalnizca admin kullanicilar olusturabilir/duzenleyebilir, herkes okuyabilir.');
    spacer(4);
    codeBlock([
      'Alan          Tur       Aciklama',
      '------------------------------------------------------',
      'question      string    Soru metni (zorunlu)',
      'year          number    Dogru yil cevabi (zorunlu)',
      'category      enum      tarih|bilim|spor|sanat|teknoloji|genel',
      'type          enum      metin | gorsel | isitsel',
      'media_url     string    Gorsel veya ses dosyasi URL\'si',
    ]);
    spacer();

    subTitle('Lobby');
    drawText('Cevrimici oyun oturumlarini yonetir. Hem oda bilgilerini hem de aktif oyun durumunu icerir.');
    spacer(4);
    codeBlock([
      'Alan                   Tur     Aciklama',
      '-----------------------------------------------------------------',
      'code                   string  6 haneli benzersiz oda kodu',
      'host_email             string  Odayi acan oyuncunun emaili',
      'players                array   Oyuncu listesi (email, name, cards[])',
      'status                 enum    waiting|starting|in_game|finished',
      'winner                 string  Kazanan oyuncunun adi',
      'category               enum    karisik|tarih|bilim|spor|sanat',
      'year_start / year_end  number  Soru yil araligi',
      'turn_duration          number  Tur suresi (saniye, 0=suresiz)',
      'win_card_count         number  Kazanmak icin gereken kart sayisi',
      'current_player_index   number  Sirasi gelen oyuncunun indisi',
      'current_question_id    string  Aktif sorunun IDsi',
      'used_question_ids      array   Once kullanilan soru IDleri',
    ]);
    spacer();

    subTitle('LobbyMessage');
    drawText('Lobi ici sohbet ve sistem bildirimlerini depolar.');
    spacer(4);
    codeBlock([
      'Alan          Tur     Aciklama',
      '-----------------------------------------',
      'lobby_id      string  Ilgili lobi IDsi',
      'player_name   string  Mesaji gonderen oyuncu',
      'message       string  Mesaj icerigi',
      'type          enum    chat | system',
    ]);

    // ══════════════════════════════════════════════════════════════════════════
    // 5. MİMARİ
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('5. Sayfa & Bilesen Mimarisi');

    subTitle('PlayerSetup (/)');
    drawText('Ana giris ekrani. Yerel oyun icin oyuncu sayisi, isimler, kategori, yil araligi ve tur suresi secimi yapilir. Cevrimici lobi ekranina yonlendirme de buradan baslar.');
    spacer(6);

    subTitle('LobbyRoom (/lobby)');
    drawText('Cevrimici oyun oncesi lobi yonetim ekrani. Iki alt akisin yer aldigi sayfadir:');
    bullet('Lobi Olusturma: 6 haneli benzersiz kod uretilir, host oyuncuyu bekler.');
    bullet('Lobiye Katilma: Kod girilir, mevcut oturuma oyuncu eklenir.');
    drawText('WaitingRoom bileseni icinde host oyun ayarlarini degistirebilir. Tum oyuncular real-time subscription ile birbirini gorur. Host baslat butonuna basinca sorular dagitilir ve oyuncular /game\'e yonlendirilir.', { color: gray });
    spacer(6);

    subTitle('Game (/game)');
    drawText('Ana oyun sahnesi. Yerel ve cevrimici modlari ayni bilesen icinde yonetir:');
    bullet('Yerel mod: Tum state React icinde tutulur, DB yazimi yoktur.');
    bullet('Cevrimici mod: lobbyId uzerinden DB senkronizasyonu ve subscription.');
    drawText('Bilesen, lobbyData\'yi tek gercek kaynak olarak kullanir. handleConfirmPlacement kart ekleme + tur gecisini tek atomik DB yazmasiyla gerceklestirir.', { color: gray });
    spacer(6);

    subTitle('SettingsPage (/settings)');
    drawText('Hesap yonetimi ve admin araclari ekrani. Tum kullanicilar hesap silme islemini buradan yapabilir. Admin yetkisiyle ek araclar (PDF dokuman indirme, simulasyon paneli) goruntulenir.');
    spacer(6);

    // ══════════════════════════════════════════════════════════════════════════
    // 6. LAYOUT BİLEŞENLERİ
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('6. Layout Bilesenleri');

    subTitle('AppHeader');
    drawText('Tum sayfalarin ustunde sabit konumlanan baslik bileseni (z-index: 60). Rota bazli farkli gorunum saglar:');
    bullet('Ana sayfa (/): KRONOX logosu + giris yapilmamissa "GIRIS YAP" butonu, giris yapilmissa Ayarlar ikonu.');
    bullet('Alt sayfalar (/lobby, /game, /settings): Geri ok + KRONOX logosu.');
    bullet('Kimlik dogrulama base44.auth.me() ile yapilir; sonuc useState ile tutulur.');
    spacer(6);

    subTitle('BottomNav');
    drawText('Ekranin altinda sabit konumlanan 3 sekmeli navigasyon cubugu. Oyun ekraninda (/game) gizlenir.');
    bullet('Ana Sayfa (/) — Home ikonu');
    bullet('Cevrimici (/lobby) — Globe ikonu');
    bullet('Ayarlar (/settings) — Settings ikonu');
    drawText('env(safe-area-inset-bottom) ile iOS home indicator alani korunur.', { color: gray });

    // ══════════════════════════════════════════════════════════════════════════
    // 7. OYUN MEKANİĞİ YEREL
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('7. Oyun Mekanigi — Yerel Mod');
    drawText('Tum mantik istemci tarafinda calisir, ag baglantisi yalnizca soru yukleme icin gereklidir.');
    spacer();
    bullet('Baslangiçta her oyuncuya 2 kart dagitilir, Fisher-Yates karistirmasi ile soru secilir.');
    bullet('Her turda aktif oyuncuya bir soru gosterilir.');
    bullet('Oyuncu, kendi zaman cizgisinde uygun bolgeyi secer ve "Yerlestir" butonuna basar.');
    bullet('Yerlestirme dogruysa kart timeline\'a eklenir; yanlisSsa kart iptal edilir.');
    bullet('win_card_count kartina ulasan oyuncu kazanir.');
    bullet('Tur suresi dolunca (turn_duration > 0) sira otomatik gecer.');
    spacer();
    drawText('Yerlestirme dogrulugu kontrolu:');
    codeBlock([
      '// zone=0  : sorununun yili, ilk karttan kucuk veya esit olmali',
      '// zone=N  : sorunun yili, son karttan buyuk veya esit olmali',
      '// zone=i  : sortedCards[i-1].year <= questionYear <= sortedCards[i].year',
    ]);

    // ══════════════════════════════════════════════════════════════════════════
    // 8. ÇEVRİMİÇİ MOD
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('8. Oyun Mekanigi — Cevrimici Mod');

    subTitle('Baslatma Akisi');
    bullet('Host "Oyunu Baslat" dediginde Fisher-Yates ile karistirilan sorular dagitilir, Lobby.status = "starting" olur.');
    bullet('Host navigate.state icinde initialPlayers ve currentQuestionId ile /game\'e gider.');
    bullet('Diger oyuncular subscription uzerinden status="starting" eventi alir ve ayni sekilde navigate eder.');
    bullet('Subscription closure stale deger sorununa karsi useRef pattern kullanilir: userRef ve playerNameRef her guncellemede senkronize edilir.');
    spacer(6);

    subTitle('Senkronizasyon Stratejisi');
    bullet('Optimistic update: Kullanici hamlesi yapinca state hemen guncellenir, ardindan DB\'ye yazilir.');
    bullet('Atomik DB yazimi: handleConfirmPlacement, kart ekleme + tur gecisi + yeni soruyu TEK DB yazmasiyla gerceklestirir.');
    bullet('Retry mekanizmasi: DB yazimi basarisiz olursa 3 denemeye kadar 1.2sn aralikla yeniden denenir.');
    bullet('Subscription: Lobby entity\'si WebSocket uzerinden dinlenir; gelen event aninda lobbyData state\'ine uygulanir.');
    spacer(6);

    subTitle('Tur Gecis Mantiği');
    codeBlock([
      'handleConfirmPlacement()  [TEK ATOMIK ADIM]',
      '  1. Dogruluk kontrolu',
      '  2. Optimistic state guncelle (kart + nextIndex + nextQ)',
      '  3. Kazanma kontrolu',
      '  4. DB yazimi: players, used_question_ids, current_player_index,',
      '                current_question_id, status -- hepsi tek update()',
      '',
      'advanceTurn()  [sadece timer dolunca]',
      '  1. nextIndex = (currentIndex + 1) % playerCount',
      '  2. Yeni soru sec (Fisher-Yates havuzdan)',
      '  3. DB guncelle (current_player_index, current_question_id)',
    ]);
    spacer(6);

    subTitle('Lobi Ayarlari Debounce');
    drawText('WaitingRoom\'da host ayar butonlarina hizli basinca DB flood olusmasin diye 300ms debounce uygulanir. Ayrica lobby prop\'u degisince settings state\'i useEffect ile senkronize edilir (non-host okuma icin).');
    spacer(6);

    subTitle('Izleme & Bekleme');
    drawText('Sirasi gelmeyen oyuncular kart yerlestiremez (isMyTurn = false). Diger oyuncularin timelinelari read-only gosterilir. Kendi kartlari ise ayri bir blokta gorunur.');

    // ══════════════════════════════════════════════════════════════════════════
    // 8b. DRAG-AND-DROP MİMARİSİ
    // ══════════════════════════════════════════════════════════════════════════
    spacer(10);
    sectionTitle('8b. Drag-and-Drop Mimarisi (Dokunmatik)');

    subTitle('Koordinat Sistemi Ayrimi');
    drawText('Ghost kart (parmak takipci) ile timeline hit-testing farkli koordinat uzaylarinda calisir:');
    bullet('Ghost kart: viewport koordinati (clientX/Y) — position:fixed ile render edilir, scroll etkisinden bagimsizdir.');
    bullet('Drop zone hit-testi: world koordinati — viewportX - containerLeft + scrollLeft formulu ile hesaplanir.');
    drawText('Bu ayrim sayesinde kullanici timeline\'i ne kadar kaydirirsa kaydirsin kart birakmasi dogru bolgede gerceklesmektedir.', { color: gray });
    spacer(4);
    codeBlock([
      '// Viewport -> World donusumu (Timeline.jsx)',
      'const worldX = clientX - containerRect.left + scroll.scrollLeft;',
      '',
      '// Drop zone merkezi de world uzayinda hesaplanir:',
      'const elWorldCX = (elRect.left + elRect.right) / 2',
      '                  - containerRect.left + scroll.scrollLeft;',
    ]);
    spacer(4);

    subTitle('Auto-Scroll (Edge Scrolling)');
    bullet('Parmak timeline sol kenarina (<80px) veya sag kenarina (<80px) yaklasinca otomatik kayma baslar.');
    bullet('requestAnimationFrame dongusu ile 60fps akici kayma saglanir; scrollLeft += direction * 10 per frame.');
    bullet('Parmak kaldirilindiginda veya drag modu bittiginde cancelAnimationFrame ile durdurulur.');
    bullet('isDragMode false olunca useEffect cleanup ile RAF iptali garantilenir.');
    spacer(4);

    subTitle('Prop Akisi: QuestionCard -> GameLayout -> Timeline');
    codeBlock([
      'QuestionCard',
      '  onTouchStart  ==> setIsDragging(true)',
      '  onTouchMove   ==> setTouchDragPos({ x: clientX, y: clientY })',
      '  onTouchEnd    ==> setTouchDragEnd({ x, y }); setTouchDragPos(null)',
      '',
      'GameLayout (ghost kart burda render edilir)',
      '  touchDragPos  ==> fixed div: left=x-80, top=y-60  (viewport)',
      '',
      'Timeline',
      '  dragClientX   ==> getZoneAtClientX (world coords) + auto-scroll',
      '  dragEndEvent  ==> final drop zone tespiti ==> onPlaceCard(zone)',
    ]);
    spacer(4);

    subTitle('Kaldirildi: onExternalZoneChange');
    drawText('Onceki versiyonda GameLayout, Timeline\'dan aktif zone bilgisini geri almak icin onExternalZoneChange prop\'u kullaniyordu. Bu prop gereksiz karmasiklik olusturdugundan kaldirildi; ghost kart artik dogrudan touchDragPos ile viewport uzayinda konumlanir ve Timeline zone bilgisini sadece icinde tutar.');

    // ══════════════════════════════════════════════════════════════════════════
    // 9. BACKEND FONKSİYONLAR
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('9. Backend Fonksiyonlar');

    subTitle('simulateOnlineGame');
    drawText('42 farkli cevrimici oyun senaryosunu otomatik olarak calistiran test suitedir. Admin\'in SettingsPage > Araclar > "Online Simulasyonlar" uzerinden tetiklenir. user.role="admin" kontrolu zorunludur.');
    spacer(4);
    bullet('2 Oyuncu: normal akis, kazanma, gecikme, es zamanli yazim, chat, lobi silme');
    bullet('3 Oyuncu: tur sirasi, spectator engeli, tur suresi, soru yeniden kullanimi');
    bullet('4 Oyuncu: tam tur dongusu, P3 kazanma, tum ekranlar winner goruntusu');
    bullet('Veri Butunlugu: kart sayisi dogrulama, used_question_ids tekrarsizlik');
    bullet('Performans: 10 tur hiz testi, subscription gecikme olcumu');
    bullet('UI Gorunurluk: portrait/landscape gecis, soru karti render, timer gorunurlugu');
    bullet('Stabilite: soru havuzu tukenme, cok turlu oyun, baglanti kopuklugun kurtarma');
    spacer(6);

    subTitle('runTestSuite (YENİ)');
    drawText('41 senaryolu kapsamli test suite. Unit, Black Box, Fonksiyonel, Performans ve Oynanabilirlik kategorilerini icerir. /test-suite adresindeki TestSuite sayfasindan interaktif olarak calistirilab ilir. Yalnizca admin erisimlidir.');
    spacer(4);
    bullet('Unit (10): shuffle, kart yerlesim mantiği, yil/kategori filtresi, pickQuestion');
    bullet('Black Box (8): Lobby CRUD, LobbyMessage, gecersiz kod testi');
    bullet('Fonksiyonel (8): kart dagitimi, tur dongusu, kazanma, offline mod, ayar guncelleme');
    bullet('Performans (5): 500 soru yukleme, 10 lobi oluşturma, shuffle hizi, filtre suresi');
    bullet('Oynanabilirlik (10): oyuncu sayisi, kategori varligi, sure ayari, soru havuzu yeterliligi');
    spacer(6);

    subTitle('getDeezerPreview');
    drawText('Muzik sorusu kartlari icin Deezer API\'den canli preview URL\'i ceken proxy fonksiyondur. Onceki sistemde sabit media_url alanlari kullaniliyordu; suresi dolunca ses calamiyordu. Yeni mimaride QuestionCard her mount\'ta bu fonksiyonu cagirarak taze URL alir.');
    spacer(4);
    bullet('Giris: { query: "sarki adi sanatci adi" }');
    bullet('Cikis: { previewUrl: string | null }');
    bullet('Birincil arama basarisiz olursa daha genis terimle fallback arama yapilir.');
    bullet('URL alinaninda QuestionCard otomatik oynatmayi baslatir.');
    spacer(6);

    subTitle('generateTechDoc (Bu Dokuman)');
    drawText('Uygulamanin mimari ve teknik dokumani otomatik olarak PDF formatinda ureten backend fonksiyondur. pdf-lib kutuphanesi ile Deno uzerinde calisir. Admin yetkisi gerekmez.');
    spacer(6);

    subTitle('generateWorkflowDoc');
    drawText('Uygulamanin is akislari, kullanim senaryolari ve surec adimlarini PDF formatinda ureten fonksiyondur. user.role="admin" kontrolu ile korunur.');

    // ══════════════════════════════════════════════════════════════════════════
    // 10. KİMLİK DOĞRULAMA & MOBİL
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('10. Kimlik Dogrulama & Mobil (APK)');

    subTitle('AuthContext Yapisi');
    drawText('base44.auth.me() ile oturum durumu kontrol edilir. Hata tipleri:');
    bullet('auth_required: Giris gerekli → base44.auth.redirectToLogin() tetiklenir.');
    bullet('user_not_registered: Kayitli olmayan kullanici → UserNotRegisteredError ekrani.');
    bullet('unknown: Beklenmeyen hata → authError state\'ine atanir.');
    spacer(6);

    subTitle('APK (WebView) Google Login Duzeltmesi');
    drawText('Android WebView icinde Google OAuth yonlendirmesi ozel dikkat gerektirir:');
    bullet('Onceki surum: auth_required hatasi sessizce yutuluyordu; APK\'da giris calismiyor.');
    bullet('Duzeltme: auth_required hata tipi acikca yakalanip redirectToLogin() cagrisi yapildi.');
    bullet('App.jsx\'te authError.type === "auth_required" kontrolu ile login akisi yeniden devrede.');
    spacer(6);

    subTitle('Genel Auth Akisi');
    codeBlock([
      'AuthProvider mount -> base44.auth.me()',
      '  OK         -> user state set, uygulama render',
      '  auth_req   -> redirectToLogin(pathname)',
      '  not_reg    -> UserNotRegisteredError ekrani',
      '  unknown    -> authError state, fallback UI',
    ]);

    // ══════════════════════════════════════════════════════════════════════════
    // 11. LANDSCAPE MODU
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('11. Landscape Modu Destegi');

    subTitle('Tailwind Custom Screen');
    drawText('tailwind.config.js icinde "landscape" adli ozel bir screen tanimlanmistir:');
    codeBlock([
      'screens: {',
      '  landscape: {',
      '    raw: "(orientation: landscape) and (max-height: 600px)"',
      '  }',
      '}',
    ]);
    drawText('Bu sayede landscape: prefix\'i tum Tailwind siniflarinda kullanilabilir. Sadece telefon landscape modunda (max-height 600px) aktif olur; tablet/masaustu etkilenmez.');
    spacer(6);

    subTitle('Game.jsx Landscape Duzeni');
    drawText('Portrait modda dikey, landscape modda yatay 3-kolon duzeni aktif olur:');
    bullet('Sol kolon (landscape:w-52): PlayerIndicator + QuestionCard + Yerlestir butonu');
    bullet('Orta alan: Timeline (aktif oyuncunun kart sirasi)');
    bullet('Bazi UI elementleri landscape\'de kucultulur: TurnTimer, bosluklar, metin boyutu');
    bullet('Portrait moduna ozel bolumler landscape:hidden, landscape\'e ozel bolumler hidden landscape:flex ile gizlenir/gosterilir');
    spacer(6);

    subTitle('CSS Safe-Area');
    drawText('iOS/Android notch ve navigation bar icin env(safe-area-inset-*) degiskenleri tum sayfa ve header bilesenlerinde kullanilmaktadir. index.css body elementine padding olarak uygulanmistir.');

    // ══════════════════════════════════════════════════════════════════════════
    // 12. TEST SUITE
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('12. Test Suite (41 Senaryo)');

    drawText('Son yapilan degisiklikleri kapsamak uzere 5 kategoride 41 otomatik test yazilmistir. Tum testler /test-suite sayfasindan veya runTestSuite backend fonksiyonundan calistirilab ilir.');
    spacer(6);

    subTitle('Unit Testler (10)');
    bullet('UT-01: Lobby kodu 6 karakter olmali');
    bullet('UT-02: Question entity alan dogrulama');
    bullet('UT-03: Fisher-Yates shuffle calisma dogrulama');
    bullet('UT-04..06: Kart yerlesim mantiği (basa/ortaya/yanlis zone)');
    bullet('UT-07: Kazanma kosulu (win_card_count esigi)');
    bullet('UT-08..10: Yil filtresi, kategori filtresi, pickQuestion tekrarsizlik');
    spacer(4);

    subTitle('Black Box Testler (8)');
    bullet('BB-01: Lobby olusturma API');
    bullet('BB-02: Lobby kod ile filtreleme');
    bullet('BB-03: Oyuncu ekleme');
    bullet('BB-04: Status guncelleme');
    bullet('BB-05: Lobby silme');
    bullet('BB-06: Gecersiz kod → bos sonuc');
    bullet('BB-07: Question listesi erisimi');
    bullet('BB-08: LobbyMessage olusturma/okuma');
    spacer(4);

    subTitle('Fonksiyonel Testler (8)');
    bullet('FT-01: Oyun baslatma kart dagitim dogrulugu');
    bullet('FT-02..03: 2 ve 4 oyunculu tur sirasi dongusu');
    bullet('FT-04: Kazanma → status=finished yazimi');
    bullet('FT-05: Soru tekrar edilmemesi');
    bullet('FT-06: Offline mod minimum soru gereksinimi');
    bullet('FT-07: Lobi ayarlari guncelleme');
    bullet('FT-08: Yetkisiz erisim engeli');
    spacer(4);

    subTitle('Performans Testler (5)');
    bullet('PERF-01: 500 soru yukleme < 5sn');
    bullet('PERF-02: 10 lobi olusturma+silme < 10sn');
    bullet('PERF-03: 500 soruda Fisher-Yates < 50ms');
    bullet('PERF-04: Yil+kategori filtreleme < 10ms');
    bullet('PERF-05: LobbyMessage okuma < 2sn');
    spacer(4);

    subTitle('Oynanabilirlik Testler (10)');
    bullet('PLAY-01..02: 1 oyuncu ve minimum 3 soru offline');
    bullet('PLAY-03: 4 oyunculu lobby kurulumu');
    bullet('PLAY-04: Tum kategorilerde soru varligi');
    bullet('PLAY-05: Gecersiz yil alanlari kontrolu');
    bullet('PLAY-06: 1900-2020 araliginda minimum 20 soru');
    bullet('PLAY-07..08: Suresiz tur ve kazanma kart sayisi secenekleri');
    bullet('PLAY-09: Bos mesaj engeli');
    bullet('PLAY-10: Tur gecisi → yeni soru secimi');

    // ══════════════════════════════════════════════════════════════════════════
    // 13. PERFORMANS
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('13. Performans & UX Optimizasyonlari');

    bullet('React.lazy + Suspense: PlayerSetup, LobbyRoom, Game ve SettingsPage code-split edilmistir. Ilk yukleme boyutu kucultulur.');
    bullet('TanStack Query: Soru listesi onbellekte tutulur (staleTime=0 ile her oyunda taze). Gereksiz refetch onlenir.');
    bullet('useMemo: players, currentQuestion, questionPool ve usedQuestionIds her renderde yeniden hesaplanmaz.');
    bullet('useCallback: pickQuestion, advanceTurn, handleFeedbackDone stabil referanslar olarak tutulur.');
    bullet('Fisher-Yates shuffle: LobbyRoom handleStart\'ta ve Game pickQuestion\'da uniform rastgele dagilim saglar.');
    bullet('Debounce (300ms): WaitingRoom ayar butonlarina hizli basilinca DB flood onlenir.');
    bullet('useRef closure fix: Subscription icinde user ve playerName\'e useRef uzerinden erisilerek stale deger hatasi onlenir.');
    bullet('Atomik DB yazimi: handleConfirmPlacement, birden fazla alan degisimini tek update() cagrisiyla gonderir.');
    bullet('Pull-to-refresh: LobbyRoom ve LobbyChat\'te dokunmatik pull-to-refresh hook\'u ile mobil yenileme.');
    bullet('Safe-area padding: iOS notch ve Android navigation bar icin env(safe-area-inset-*) degiskenleri kullanilir.');
    bullet('AnimatePresence: Sayfa ve bilesen gecisleri spring/tween animasyonu ile yumusatilmistir.');

    // ══════════════════════════════════════════════════════════════════════════
    // 14. GÜVENLİK
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('14. Guvenlik & Erisim Kontrolu');

    subTitle('Soru Yonetimi (RLS)');
    drawText('Question entity\'si Row-Level Security (RLS) ile korunmaktadir:');
    codeBlock([
      'Okuma:     Herkes (giris yapmamis kullanicilar dahil)',
      'Olustur:   Yalnizca role="admin" kullanicilar',
      'Guncelle:  Yalnizca role="admin" kullanicilar',
      'Sil:       Yalnizca role="admin" kullanicilar',
    ]);
    spacer(6);

    subTitle('Backend Fonksiyon Guvenligi');
    bullet('simulateOnlineGame: user.role === "admin" kontrolu — yetkisiz erisimde 403 doner.');
    bullet('generateWorkflowDoc: user.role === "admin" veya sariverim@gmail.com kontrolu — 403 ile korunur.');
    bullet('generateTechDoc: Genel erisime acik (dokuman hassas veri icermez).');
    spacer(6);

    subTitle('Lobi Guvenligi');
    bullet('Lobi kodu 6 haneli rastgele alfanumerik dize (Math.random + toString(36)).');
    bullet('Oyun basladiginda status "in_game" olur; yeni katilim engellenir (filter: status="waiting").');
    bullet('Host lobbiyi kapatinca (delete) tum oyuncular baglantii kaybeder ve ana ekrana yonlendirilir.');

    // ══════════════════════════════════════════════════════════════════════════
    // 15. GELECEK
    // ══════════════════════════════════════════════════════════════════════════
    newPage();
    sectionTitle('15. Gelecek Gelistirme Onerileri');

    bullet('Gorselli & sesli sorular: media_url alani hazir; QuestionCard bileseni gorsel ve isitsel tiplerini destekliyor. Soru yukleme arayuzu eklenebilir.');
    bullet('Skor tablosu: Oyun sonrasi oyuncularin puanlari ve dogru/yanlis oranlari ile istatistik ekrani.');
    bullet('Gozlemci modu: Aktif oyuna katilmadan izleyebilen pasif baglanti.');
    bullet('Reconnect: Baglanti kopunca otomatik yeniden baglanma ve state recovery.');
    bullet('Soru yonetim paneli: Admin icin kapsamli soru ekleme/duzenleme arayuzu.');
    bullet('Turnuva modu: Cok turlu eleme sistemi, kalici skor tablosu.');
    bullet('Push bildirimler: Sira geldigi zaman uygulama arka plandayken bildirim.');
    bullet('Sesli efektler: Dogru/yanlis cevap ve kazanma animasyonlari icin ses efektleri.');

    // ══════════════════════════════════════════════════════════════════════════
    // ARKA KAPAK
    // ══════════════════════════════════════════════════════════════════════════
    page = pdfDoc.addPage([W, H]);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: darkBg });
    page.drawRectangle({ x: marginL, y: H / 2 - 1, width: 120, height: 2, color: gold });
    page.drawText('KRONOX', { x: marginL, y: H / 2 + 30, size: 40, font: boldFont, color: gold, opacity: 0.25 });
    page.drawText('2026 — Tum haklari saklidir', { x: marginL, y: H / 2 - 28, size: 10, font, color: gray });
    page.drawText('Base44 Platform uzerinde gelistirilmistir', { x: marginL, y: H / 2 - 46, size: 10, font, color: gray });

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