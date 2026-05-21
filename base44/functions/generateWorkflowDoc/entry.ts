import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

function toAscii(str) {
  return str
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .replace(/→/g, '->').replace(/←/g, '<-')
    .replace(/[^\x00-\xFF]/g, '?');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || (user.role !== 'admin' && user.email !== 'sariverim@gmail.com')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 595, H = 842;
  const MARGIN = 50;
  const CONTENT_W = W - MARGIN * 2;

  let page = pdfDoc.addPage([W, H]);
  let y = H - MARGIN;
  let pageNum = 1;

  function newPage() {
    page = pdfDoc.addPage([W, H]);
    pageNum++;
    y = H - MARGIN;
    page.drawText(`Kronox - Is Akisi Dokumani | Sayfa ${pageNum}`, {
      x: MARGIN, y: 15, size: 8, font: fontRegular, color: rgb(0.5, 0.5, 0.5)
    });
  }

  function checkY(needed = 20) {
    if (y < MARGIN + needed) newPage();
  }

  function drawText(text, { x = MARGIN, size = 10, font = fontRegular, color = rgb(0.9, 0.85, 0.7), indent = 0 } = {}) {
    const words = toAscii(text).split(' ');
    let line = '';
    const maxW = CONTENT_W - indent;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      const testW = font.widthOfTextAtSize(test, size);
      if (testW > maxW && line) {
        checkY(size + 4);
        page.drawText(line, { x: x + indent, y, size, font, color });
        y -= size + 4;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      checkY(size + 4);
      page.drawText(line, { x: x + indent, y, size, font, color });
      y -= size + 4;
    }
  }

  function drawHeading1(text) {
    y -= 10;
    checkY(30);
    page.drawRectangle({ x: MARGIN, y: y - 6, width: CONTENT_W, height: 26, color: rgb(0.12, 0.1, 0.06) });
    page.drawText(toAscii(text), { x: MARGIN + 8, y: y + 4, size: 14, font: fontBold, color: rgb(0.8, 0.63, 0.15) });
    y -= 28;
  }

  function drawHeading2(text) {
    y -= 8;
    checkY(22);
    page.drawText(toAscii(text), { x: MARGIN, y, size: 12, font: fontBold, color: rgb(0.8, 0.63, 0.15) });
    y -= 16;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.5, color: rgb(0.3, 0.25, 0.1) });
    y -= 6;
  }

  function drawHeading3(text) {
    y -= 6;
    checkY(16);
    page.drawText(toAscii(text), { x: MARGIN, y, size: 11, font: fontBold, color: rgb(0.7, 0.55, 0.1) });
    y -= 16;
  }

  function drawBullet(text, level = 0) {
    const indent = 12 + level * 16;
    const bullet = level === 0 ? '•' : '-';
    checkY(14);
    page.drawText(bullet, { x: MARGIN + indent - 8, y, size: 9, font: fontBold, color: rgb(0.8, 0.63, 0.15) });
    drawText(text, { indent: indent, size: 9 });
  }

  function drawStep(num, title, desc) {
    y -= 4;
    checkY(40);
    page.drawCircle({ x: MARGIN + 10, y: y + 3, size: 9, color: rgb(0.15, 0.12, 0.04), borderColor: rgb(0.8, 0.63, 0.15), borderWidth: 1.5 });
    page.drawText(String(num), { x: MARGIN + 7, y: y - 1, size: 8, font: fontBold, color: rgb(0.8, 0.63, 0.15) });
    page.drawText(toAscii(title), { x: MARGIN + 25, y, size: 10, font: fontBold, color: rgb(0.9, 0.85, 0.7) });
    y -= 14;
    if (desc) drawText(desc, { indent: 25, size: 9, color: rgb(0.65, 0.6, 0.5) });
  }

  function drawDivider() {
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.3, color: rgb(0.2, 0.18, 0.08) });
    y -= 8;
  }

  // ─── COVER PAGE ─────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.05, 0.04, 0.02) });
  page.drawRectangle({ x: 0, y: H / 2 - 80, width: W, height: 160, color: rgb(0.1, 0.08, 0.03) });

  page.drawText('KRONOX', { x: 180, y: H / 2 + 30, size: 48, font: fontBold, color: rgb(0.8, 0.63, 0.15) });
  page.drawText('Zaman Cizgisi Kart Oyunu', { x: 165, y: H / 2 + 8, size: 14, font: fontRegular, color: rgb(0.6, 0.5, 0.2) });
  page.drawLine({ start: { x: 150, y: H / 2 }, end: { x: W - 150, y: H / 2 }, thickness: 1, color: rgb(0.4, 0.3, 0.1) });
  page.drawText('IS AKISI & KULLANIM SENARYOLARI', { x: 115, y: H / 2 - 20, size: 13, font: fontBold, color: rgb(0.9, 0.85, 0.7) });
  page.drawText('Dokuman Versiyonu: 2.0', { x: 215, y: 80, size: 10, font: fontRegular, color: rgb(0.4, 0.35, 0.2) });
  page.drawText('Build: Codex038', { x: 240, y: 60, size: 10, font: fontRegular, color: rgb(0.4, 0.35, 0.2) });

  page.drawText('Kronox - Is Akisi Dokumani | Sayfa 1', {
    x: MARGIN, y: 15, size: 8, font: fontRegular, color: rgb(0.5, 0.5, 0.5)
  });

  // ─── 1. GENEL BAKIS ─────────────────────────────────────────────────────────
  newPage();
  y = H - MARGIN;

  drawHeading1('1. GENEL BAKIS');
  drawText('Kronox, oyuncularin sorularda gecen olay/eser/kesfin yilini kendi zaman cizgilerine dogru kronolojik sirayla yerlestirdigi rekabetci bir kart oyunudur. Bu dokuman, urunun GUNCEL kullanim akislarini, kullanim senaryolarini ve QA / AI-asistanli gelistirme is akisini detaylandirir.', { size: 10 });
  y -= 8;

  drawHeading2('1.1 Iki Birincil Mod');
  drawBullet('Solo Challenge — Offline, tek oyunculu, kendi en iyi rekorunu kirma odakli.');
  drawBullet('Online Battle — 2-4 oyunculu lobi tabanli gercek zamanli rekabet.');
  y -= 6;

  drawHeading2('1.2 Ana Hedef');
  drawText('Belirlenen kazanma karti sayisina ilk ulasan oyuncu oyunu kazanir. Solo modda oyuncu kendi best-time / kart sayisi rekorunu hedefler.', { size: 10 });
  y -= 6;

  drawHeading2('1.3 Bu Dokumandan Cikarilan Ozellikler');
  drawBullet('Eski lobi sohbeti (LobbyChat) ARTIK aktif degil; sohbet UI tamamen kaldirildi.');
  drawBullet('Home ekranindaki eski "HEMEN OYNA" CTA butonu kaldirildi; Solo + Online iki birincil aksiyon kalmistir.');
  drawBullet('Eski cok-oyunculu yerel kurulum (PlayerSetup oyuncu sayisi secimi) artik birincil akis degil; Solo Challenge tek oyunculu odaklidir.');
  drawBullet('Eski monolitik LobbyRoom dosyasi modullere ayrildi: useLobbyRoomState + LobbyCreateJoinPanel + WaitingRoomPanel.');

  // ─── 2. KULLANICI ROLLERI ───────────────────────────────────────────────────
  drawHeading1('2. KULLANICI ROLLERI');

  drawHeading2('2.1 Misafir (Giris Yapmamis)');
  drawBullet('Home, Solo Challenge ve ogretici (tutorial) erisilebilir.');
  drawBullet('Online lobi olusturma/katilma butonuna basinca login ekranina yonlendirilir.');
  drawBullet('Admin araclarina ve /test-suite\'e erisemez.');

  drawHeading2('2.2 Kayitli Kullanici');
  drawBullet('Tum Solo ve Online akislarina erisir.');
  drawBullet('Hesap silme, kisisel rekor (GameRecord) ve TopScores gorebilir.');
  drawBullet('Soru/Test/Doc araclarina erisemez.');

  drawHeading2('2.3 Admin (role="admin" veya sariverim@gmail.com)');
  drawBullet('Settings > Admin Araclari menusu acilir.');
  drawBullet('Soru ekleyebilir / duzenleyebilir.');
  drawBullet('Teknik dokuman ve is akisi PDFlerini indirebilir.');
  drawBullet('Regresyon Test Paneli (SimulationPanel) calistirabilir.');
  drawBullet('Sadece admin /test-suite rotasini gorebilir (UI taraflitir; isAdminUser ile kontrol edilir).');

  // ─── 3. ILK ACILIS / NAVIGASYON ────────────────────────────────────────────
  newPage();
  drawHeading1('3. ILK ACILIS VE NAVIGASYON');

  drawHeading2('3.1 Uygulama Acilisi');
  drawStep(1, 'SplashScreen', 'AuthProvider mount olur, base44.auth.me() arka planda calisir.');
  drawStep(2, 'Public Mode', 'Uygulama public oldugu icin giris yapmamis kullanicilar da Home\'a ulasir.');
  drawStep(3, 'Home Render', 'MainMenu 1080x1920 stage ile yuklenir; Solo / Online kartlari ve ProfileBar gorunur.');

  drawHeading2('3.2 Navigasyon Bilesenleri');
  drawBullet('AppHeader: Home ve Game disindaki sayfalarda gorunur; geri tusu ve sayfa basligi.');
  drawBullet('BottomNav: Tum sayfalarda sabit, oyun sahnesinde minimal.');
  drawBullet('Sayfa gecisleri push/pop yonune gore yatay slide animasyonludur.');

  drawHeading2('3.3 Home Davranisi');
  drawBullet('Hicbir noktada vertical scroll YOK (fixed inset-0 + overflow-hidden).');
  drawBullet('Mobil dik: stage tam ekranı kaplar.');
  drawBullet('Desktop / tablet / landscape: stage 9:16 oranina sigdirilir; arka plan ve kartlar orantili buyur/kucuk.');
  drawBullet('Solo + Online kartlarinin width/height degerleri esittir; ikisi de pointer-events bakimindan ust z katmandadir.');
  drawBullet('Profile / Settings ikonlari her kosulda erisilebilir kalir.');

  // ─── 4. SOLO IS AKISI ───────────────────────────────────────────────────────
  drawHeading1('4. OFFLINE SOLO IS AKISI');

  drawHeading2('4.1 Adim Adim');
  drawStep(1, 'Home', 'Kullanici "SOLO KAPISMA" kartina basar -> /solo.');
  drawStep(2, 'Kategori Sec', 'SoloChallenge: genel, tarih, spor, sanat, bilim vb. kartlardan biri secilir.');
  drawStep(3, 'Zorluk Sec', 'Kolay / orta / zor preset (tur suresi farkliligi).');
  drawStep(4, 'Oyna Butonu', '/game?mode=solo&category=...&difficulty=... rotasina yonlendirir.');
  drawStep(5, 'Soru Goruntule', 'QuestionCard aktiftir; gorsel/isitsel/muzik tipleri uygun loader ile render edilir.');
  drawStep(6, 'Yerlestir', 'Surukle-birak veya zone seciminden sonra CTA butonu ile yerlestirme yapilir.');
  drawStep(7, 'Geri Bildirim', 'FeedbackOverlay dogru/yanlis sonucu, gercek yili ve farki gosterir.');
  drawStep(8, 'Yeni Soru', 'selectNextQuestion ile gelecek aktif oyuncuya uygun soru gelir; oturum-ici tekrar yasaktir, cross-game LRU tercih yapar.');
  drawStep(9, 'Oyun Sonu', 'win_card_count kart kazanildiginda GameRecord.create cagrilir ve GameOver ekrani solo basarisi olarak gosterilir.');

  drawHeading2('4.2 Solo Havuzu Tukenirse');
  drawBullet('Filtreden sonra yeterli soru kalmazsa kullaniciya nazikce ana menuye donmesi onerilir.');
  drawBullet('Hicbir noktada online state\'e (Lobby) yazim yapilmaz.');

  // ─── 5. ONLINE IS AKISI ─────────────────────────────────────────────────────
  newPage();
  drawHeading1('5. ONLINE BATTLE IS AKISI');

  drawHeading2('5.1 Lobi Olusturma (Host)');
  drawStep(1, 'Online Sec', 'Home > "ONLINE KAPISMA" -> /lobby.');
  drawStep(2, 'Isim Gir', 'Misafir veya kayitli kullanici icin gorunur isim.');
  drawStep(3, 'Lobi Olustur', 'Lobby.create ile 6 hane benzersiz kod uretilir; status="waiting".');
  drawStep(4, 'Waiting Room', 'WaitingRoomPanel: host ayarlari (kategori, yil araligi, sure, kazanma karti), kod kopyalama, oyuncu listesi.');
  drawStep(5, 'Oyunu Baslat', 'Host CTA -> buildInitialOnlineGameState (questions filtre+shuffle, baslangic kart dagitimi, ilk soru secimi).');
  drawStep(6, 'Lobby Update', 'Tek update ile: players(cards), status="in_game", current_question_id, used_question_ids, current_player_index:0.');

  drawHeading2('5.2 Lobiye Katilma (Misafir)');
  drawStep(1, 'Kod Gir', 'LobbyCreateJoinPanel\'de kod ve isim girilir.');
  drawStep(2, 'findLobbyByCode', 'Service-role backend fonksiyonu lobiyi bulur ve oyuncuyu atomik olarak ekler (yarisma kosullarina karsi retry).');
  drawStep(3, 'Waiting Room', 'Non-host olarak ayarlari salt-okunur izler; subscription ile lobby degisikliklerini takip eder.');
  drawStep(4, 'Otomatik Gecis', 'Host status="in_game" yazinca tum oyuncular /game\'e yonlendirilir.');

  drawHeading2('5.3 Oyun Ici Akis');
  drawStep(1, 'Sync', 'useLobbySync abone + polling ile Lobby\'i lobbyData state\'ine senkron tutar.');
  drawStep(2, 'Aktif Oyuncu', 'players[current_player_index] yerlestirebilir; digerleri ayni soruyu SALT-OKUNUR gorur.');
  drawStep(3, 'Yerlestirme', 'doPlacement: optimistic local update -> updateLobbyGameState backend fonksiyonu (3 retry + recovery).');
  drawStep(4, 'Tur Gecisi', 'getNextPlayerIndex %N rotasyonu; yeni soru selectNextQuestion ile aktif oyuncunun timeline yillarini disarida tutar.');
  drawStep(5, 'Kazanma', 'hasPlayerWon true -> status="finished", winner ve winner_email Lobby\'e yazilir.');
  drawStep(6, 'GameOver', 'Tum oyuncularda GameOver acilir. Kazanan icin zafer metni, kaybedenler icin kaybetme metni gosterilir.');

  drawHeading2('5.4 2 / 3 / 4 Oyuncu Davranisi');
  drawBullet('2 oyuncu: rotasyon 0<->1.');
  drawBullet('3 oyuncu: 0->1->2->0 ...');
  drawBullet('4 oyuncu: 0->1->2->3->0 ...');
  drawBullet('Tum durumlar Test Suite "sync" kategorisinde dogrulanir.');

  drawHeading2('5.5 Reconnect / Refresh');
  drawBullet('Refresh: useLobbySync Lobby.get yapar; route state\'e guvenmez.');
  drawBullet('Subscription kopukluklarini polling fallback yakalar; kullaniciya gorunur "kopuk" durum yansimaz.');
  drawBullet('Sunucu finished lobi icin daha fazla guncelleme kabul etmez.');

  // ─── 6. ADMIN AKISLARI ─────────────────────────────────────────────────────
  newPage();
  drawHeading1('6. ADMIN AKISLARI');

  drawHeading2('6.1 Soru Yonetimi');
  drawStep(1, 'Settings > Admin Araclari', 'Soru Yonetimi kartina tikla.');
  drawStep(2, 'Form Doldur', 'Soru metni, yil, kategori, tur (metin/gorsel/isitsel/muzik), opsiyonel media_url ve icon_url.');
  drawStep(3, 'Kaydet', 'Question entity\'sine yazilir (RLS: yalniz admin).');

  drawHeading2('6.2 Test Suite');
  drawStep(1, 'Erisim', '/test-suite veya Settings > Admin Araclari > Regresyon Test Paneli.');
  drawStep(2, 'Kategori Sec', '17 kategori arasinda filtreleme; veya tum testleri calistir.');
  drawStep(3, 'Calistir', 'PASS / FAIL / WARNING / SKIPPED sonuclari sayfada gerceğe yakin zamanli akar.');
  drawStep(4, 'Raporu Kopyala', '"Copy Report" tum sonuclar; "Copy Failed Only" yalniz FAIL/WARNING/SKIPPED — AI Coder\'a hizla yapistirma icin.');

  drawHeading2('6.3 Dokuman Indirme');
  drawBullet('Settings > Admin Araclari > "Teknik Dokumani Indir" — generateTechDoc PDF.');
  drawBullet('Settings > Admin Araclari > "Is Akisi Dokumanini Indir" — generateWorkflowDoc PDF.');
  drawBullet('Her iki fonksiyon da admin disindaki kullanicilara 403 doner.');

  drawHeading2('6.4 Erisim Kisitlamalari');
  drawBullet('isAdminUser disindaki kullanicilar /test-suite\'e gittiklerinde "ERISIM KORUMALI" ekrani gorur; /settings sayfasina yonlendirilirler.');
  drawBullet('UI seviyesindeki bu engellemenin yaninda admin-only fonksiyonlar SERVER tarafinda da 403 verir.');

  // ─── 7. QA / RELEASE IS AKISI ──────────────────────────────────────────────
  drawHeading1('7. QA / RELEASE VALIDATION IS AKISI');

  drawText('Her release oncesi onerilen sira:', { size: 10 });
  drawStep(1, 'Test Simulasyonunu Calistir', '/test-suite -> "TUM TESTLERI CALISTIR".');
  drawStep(2, 'Copy Failed Only', 'Sadece basarisiz/uyari testleri panoya al.');
  drawStep(3, 'Onarim', 'AI Coder\'a verilen patch isteklerine yapistir; kuçuk patch tarzinda gonder.');
  drawStep(4, 'Tekrar Calistir', 'Yesilden emin olana kadar.');
  drawStep(5, 'Home Manuel Kontrol', 'Mobil tarayicida Home: scroll YOK, Solo/Online kartlari clickable, ProfileBar gorunur.');
  drawStep(6, 'Online Iki Cihaz Testi', 'Gerekiyorsa 2 cihazli (veya gizli mod sekme + ana profil) duo testi.');
  drawStep(7, 'Build Marker', 'Codex### formati gorunur olmali; her release ile artis.');
  drawStep(8, 'Yayinla', 'Test ve manuel kontrol gectikten sonra publish.');

  // ─── 8. AI-ASISTANLI GELISTIRME ─────────────────────────────────────────────
  newPage();
  drawHeading1('8. AI-ASISTANLI GELISTIRME IS AKISI');

  drawHeading2('8.1 Dokuman Hiyerarsisi');
  drawBullet('KRONOX.md (urun/UX kaynagi) — emosyonel/UX ilkeleri.');
  drawBullet('CORE_PROMPT.md (muhendislik rehberi) — kucuk patch tarzi, ne degistirilmez listesi.');
  drawBullet('Teknik Dokuman (bu PDF) ve Is Akisi Dokumani (bu PDF) — projeyi yeni AI/gelistiriciye anlatan referans.');

  drawHeading2('8.2 Korumali Sistemler (KOLAY KIRILIR)');
  drawBullet('Timeline hit-testing (Timeline.jsx) — viewport vs world coord ayrimi.');
  drawBullet('Drag/drop ghost-kart mekanigi.');
  drawBullet('lib/gameRules — placement & winner kurallari.');
  drawBullet('useLobbySync subscription+polling fallback.');
  drawBullet('Home 1080x1920 stage; isWideStage genis ekran kosulu.');
  drawBullet('updateLobbyGameState server validation yuzeyi.');
  drawBullet('Lobby entity contracti.');

  drawHeading2('8.3 Tercih Edilen Patch Tarzi');
  drawBullet('Tek hedefli, kucuk diff\'ler; gereksiz refactor yok.');
  drawBullet('Build markeri (Codex###) her gercek code commit\'inde artirilir.');
  drawBullet('AI Coder\'a brief: SADECE NE DEGISECEK + NE DEGISMEYECEK; korumali listeden ozellikle bahset.');
  drawBullet('Test Suite degisiklikten sonra kosulur; kirildiysa AI Coder\'a Copy Failed Only ile cevap verilir.');

  // ─── 9. HATA AKISLARI ───────────────────────────────────────────────────────
  drawHeading1('9. HATA AKISLARI');

  drawHeading2('9.1 Soru Bulunamadi');
  drawBullet('Solo: kategori+zorluk+filtre sonrasi yeterli soru kalmadiysa kullaniciya ana menuye donus onerilir.');
  drawBullet('Online: WaitingRoom oyunu baslatmaya calisirken buildInitialOnlineGameState reason="not_enough_questions" donerse host hata gorur.');

  drawHeading2('9.2 Lobi Bulunamadi');
  drawBullet('findLobbyByCode found=false donerse kullaniciya "Lobi bulunamadi" gosterilir; tekrar deneme acik.');
  drawBullet('Lobi waiting disinda ise (joinable=false) katilim engellenir.');

  drawHeading2('9.3 Ag Hatasi / Subscription Kopmasi');
  drawBullet('useLobbySync polling fallback ile durumu kendi yenilemeyi dener.');
  drawBullet('useGameActions updateLobbyGameState retry (3 deneme, 1.2sn) + recoverLatestLobbyState (Lobby.get) self-heal.');

  drawHeading2('9.4 Reddedilen Online Yazim');
  drawBullet('Sunucu reddederse istemci yerel state\'i DB\'den yeniden cekerek SENKRON KALIR; oyuncuya "rolled back" hissi olusmaz, sira gercek state\'e doner.');

  drawHeading2('9.5 Auth Hatasi');
  drawBullet('Public mod: misafir devam edebilir.');
  drawBullet('Online butonu giris gerektirir; user yoksa redirectToLogin tetiklenir.');
  drawBullet('user_not_registered: UserNotRegisteredError ekrani.');

  // ─── 10. OGRETICI ──────────────────────────────────────────────────────────
  drawHeading1('10. OGRETICI (TUTORIAL) AKISI');

  drawBullet('Settings > "Nasil Oynanir?" veya ilk kullanimda Home\'dan tetiklenir (lib/tutorialState.js gore).');
  drawBullet('5-6 adimli, animasyonlu, dokunmatik dostu.');
  drawBullet('Adimlar: zaman cizgisi tanitimi, surukleyerek yerlestirme, dogru/yanlis geri bildirim, kazanma kosulu, online lobi bilgisi.');
  drawBullet('"Atla" ve "Bitir" callbackleri tutorialSeen flag\'i ile localStorage\'a yazilir.');

  // ─── 11. KALDIRILMIS / LEGACY ───────────────────────────────────────────────
  newPage();
  drawHeading1('11. KALDIRILMIS VE LEGACY AKISLAR');

  drawText('Asagidaki ozellikler urunde ARTIK YOK veya pasif tutuluyor. Test Suite "removed" kategorisi bu kaldirmalari surekli denetler:', { size: 10 });
  y -= 4;
  drawBullet('Online lobi/oyun ici sohbet UI — LobbyChat, mesaj input, unread indicator: hepsi UI\'dan kaldirildi.');
  drawBullet('Home "HEMEN OYNA" CTA — birincil aksiyon olarak Solo/Online kartlari yeterli.');
  drawBullet('Eski yerel multiplayer oyuncu sayisi secimi — Solo Challenge tek-oyunculu yapilandirmaya yogunlasti.');
  drawBullet('Eski monolitik LobbyRoom — split: useLobbyRoomState + LobbyCreateJoinPanel + WaitingRoomPanel.');
  drawBullet('Eski debug konsol overlay\'i (DebugConsole/DebugPanel) — production debug log gating ile yer degistirdi (lib/debugLog.js).');
  drawBullet('Eski QA bilesenleri (components/qa/*, QAHeader, MetricsBoard, SimulationResultCard, TestResultCard) — yerini tek bir SimulationPanel aldi.');
  drawBullet('TimelineRuler — kaldirildi; Timeline kendi hit-testini yapiyor.');
  drawBullet('LobbyMessage entity — kayitli; UI baglantisi kesildi; geriye donuk yedeklilik icin tutuluyor.');

  // ─── 12. VERI AKISI ÖZETI ──────────────────────────────────────────────────
  drawHeading1('12. VERI AKISI OZETI');

  drawHeading2('12.1 Online');
  drawText('Aktif oyuncu hamlesi -> useGameActions.doPlacement -> optimistic local update -> base44.functions.invoke("updateLobbyGameState") -> sunucu dogrulamasi -> Lobby DB yazimi -> subscription event -> tum istemcilerde useLobbySync state guncellemesi.', { size: 9, color: rgb(0.65, 0.78, 0.65) });
  y -= 4;
  drawBullet('Optimistic update kullaniciya anlik tepki saglar.');
  drawBullet('Sunucu reddederse Lobby.get ile yerel state DB ile uyumlu hale getirilir.');
  drawBullet('updateLobbyGameState atomiktir: kart + tur gecisi + yeni soru tek ada.');

  drawHeading2('12.2 Solo');
  drawText('Kullanici hamlesi -> useGameActions.doPlacement (lobbyId yok) -> lokal state -> oyun bitince GameRecord.create (eger giris yapilmissa).', { size: 9, color: rgb(0.65, 0.78, 0.65) });
  y -= 4;
  drawBullet('Hicbir Lobby etkilesimi yok.');
  drawBullet('Cross-game tekrarsizlik questionHistory.js ile saglanir.');

  drawHeading2('12.3 Soru Secim Hiyerarsisi');
  drawBullet('Hard kural: oturum-ici used_question_ids icindeki sorular asla secilmez.');
  drawBullet('Tercih: aktif oyuncunun timeline\'inda halen olan yillarla denk sorular tercih edilmez.');
  drawBullet('Tercih: cross-game LRU history\'sinde olan sorular tercih edilmez.');
  drawBullet('Fallback: tercih kosullari gevsetilir, hard kural asla gevsetilmez.');

  // ─── 13. GELECEK ────────────────────────────────────────────────────────────
  drawHeading1('13. GELECEK GELISTIRMELER');

  drawBullet('Profil sayfasi (yarim hazir) — kullanici istatistikleri ve gecmis.');
  drawBullet('Skor / istatistik gecmisi — GameRecord uzerinden aggregate.');
  drawBullet('Liderlik tablosu (HAZIR DEGIL) — server-side trust yetersiz.');
  drawBullet('Ranked mod (HAZIR DEGIL) — anomali tespiti ve anti-cheat eklenmeli.');
  drawBullet('Rematch — kucuk Lobby reset ve yeni dagitim ile yapilabilir.');
  drawBullet('Push bildirimleri (sira / lobi cagrisi).');
  drawBullet('Kategori genisletmesi (muzik, cografya, sinema vb.).');
  drawBullet('Soru onerme akisi (kullanicidan admin onayina).');

  // ─── FINALIZE ───────────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=kronox-is-akisi.pdf',
    },
  });
});