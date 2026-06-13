import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

function normalizeAdminAuthEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function adminAuthJson(payload, status = 200) {
  return Response.json(payload, { status });
}

function isActiveAdminRole(role) {
  const value = String(role || '').trim().toLowerCase();
  return value === 'owner' || value === 'admin';
}

function isActiveAdminStatus(status) {
  return String(status || '').trim().toLowerCase() === 'active';
}

const ADMIN_AUTH_FIELD_CANDIDATES = {
  email: ['email', 'Email', 'user_email', 'admin_email'],
  role: ['role', 'Role', 'user_role'],
  status: ['status', 'Status'],
};

function readAdminAuthField(row, candidates) {
  for (const field of candidates) {
    if (row && Object.prototype.hasOwnProperty.call(row, field)) {
      return { value: row[field], field };
    }
  }
  return { value: undefined, field: '' };
}

async function getAdminAuthorization(base44, user) {
  const email = normalizeAdminAuthEmail(user?.email);
  if (!email) return { isAdmin: false, row: null, role: '', status: '' };
  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) return { isAdmin: false, row: null, role: '', status: '' };

  let rows = [];
  for (const field of ADMIN_AUTH_FIELD_CANDIDATES.email) {
    const result = await adminEntity.filter({ [field]: email }, '-updated_at', 10).catch(() => []);
    if (Array.isArray(result) && result.length > 0) {
      rows = result;
      break;
    }
  }

  const active = (rows || []).map((candidate) => {
    const emailField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.email);
    const roleField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.role);
    const statusField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.status);
    return {
      candidate,
      email: normalizeAdminAuthEmail(emailField.value),
      role: String(roleField.value || '').trim().toLowerCase(),
      status: String(statusField.value || '').trim().toLowerCase(),
    };
  }).find((candidate) => candidate.email === email && isActiveAdminStatus(candidate.status) && isActiveAdminRole(candidate.role)) || null;

  return { isAdmin: Boolean(active?.candidate), row: active?.candidate || null, role: active?.role || '', status: active?.status || '' };
}

async function requireAdmin(base44) {
  try {
    const user = await base44.auth.me();
    if (!user?.email) return { response: adminAuthJson({ ok: false, error: 'Authentication required' }, 401) };
    const authorization = await getAdminAuthorization(base44, user);
    if (!authorization.isAdmin) return { response: adminAuthJson({ ok: false, error: 'Admin access required' }, 403) };
    return { user, admin: authorization.row, adminRole: authorization.role };
  } catch (_error) {
    return { response: adminAuthJson({ ok: false, error: 'Authentication required' }, 401) };
  }
}

function toAscii(str) {
  return str
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .replace(/→/g, '->').replace(/←/g, '<-')
    .replace(/—/g, '--').replace(/–/g, '-')
    .replace(/[^\x00-\xFF]/g, '-');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const auth = await requireAdmin(base44);
  if (auth.response) return auth.response;

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 595, H = 842;
  const MARGIN = 50;
  const CONTENT_W = W - MARGIN * 2;

  // Color palette
  const GOLD = rgb(0.8, 0.63, 0.15);
  const GOLD_DIM = rgb(0.6, 0.5, 0.2);
  const TEXT = rgb(0.9, 0.85, 0.7);
  const MUTED = rgb(0.65, 0.6, 0.5);
  const OK = rgb(0.4, 0.75, 0.4);
  const WARN = rgb(0.95, 0.6, 0.2);
  const DANGER = rgb(0.95, 0.45, 0.45);

  let page = pdfDoc.addPage([W, H]);
  let y = H - MARGIN;
  let pageNum = 1;

  function newPage() {
    page = pdfDoc.addPage([W, H]);
    pageNum++;
    y = H - MARGIN;
    page.drawText(`Kronox - Is Akisi Dokumani - Internal AI/Developer Briefing | Sayfa ${pageNum}`, {
      x: MARGIN, y: 15, size: 8, font: fontRegular, color: rgb(0.5, 0.5, 0.5)
    });
  }

  function checkY(needed = 20) {
    if (y < MARGIN + needed) newPage();
  }

  function drawText(text, { x = MARGIN, size = 10, font = fontRegular, color = TEXT, indent = 0 } = {}) {
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
    page.drawText(toAscii(text), { x: MARGIN + 8, y: y + 4, size: 14, font: fontBold, color: GOLD });
    y -= 28;
  }

  function drawHeading2(text) {
    y -= 8;
    checkY(22);
    page.drawText(toAscii(text), { x: MARGIN, y, size: 12, font: fontBold, color: GOLD });
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
    const bullet = level === 0 ? '*' : '-';
    checkY(14);
    page.drawText(bullet, { x: MARGIN + indent - 8, y, size: 9, font: fontBold, color: GOLD });
    drawText(text, { indent: indent, size: 9 });
  }

  function drawStep(num, title, desc) {
    y -= 4;
    checkY(40);
    page.drawCircle({ x: MARGIN + 10, y: y + 3, size: 9, color: rgb(0.15, 0.12, 0.04), borderColor: GOLD, borderWidth: 1.5 });
    page.drawText(String(num), { x: MARGIN + 7, y: y - 1, size: 8, font: fontBold, color: GOLD });
    page.drawText(toAscii(title), { x: MARGIN + 25, y, size: 10, font: fontBold, color: TEXT });
    y -= 14;
    if (desc) drawText(desc, { indent: 25, size: 9, color: MUTED });
  }

  function drawDivider() {
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + CONTENT_W, y }, thickness: 0.3, color: rgb(0.2, 0.18, 0.08) });
    y -= 8;
  }

  function microLabel(text, color) {
    y -= 4;
    checkY(14);
    page.drawText(toAscii(text), { x: MARGIN, y, size: 10, font: fontBold, color });
    y -= 14;
  }

  function aiBlock({ doList = [], dontList = [], files = [], tests = [], risk = 'Medium' }) {
    if (doList.length) { microLabel('DO:', OK); doList.forEach(d => drawBullet(d)); }
    if (dontList.length) { microLabel('DO NOT:', DANGER); dontList.forEach(d => drawBullet(d)); }
    if (files.length) { microLabel('FILES INVOLVED:', GOLD_DIM); files.forEach(f => drawBullet(f)); }
    if (tests.length) { microLabel('TEST AFTER CHANGE:', GOLD_DIM); tests.forEach(t => drawBullet(t)); }
    microLabel(`RISK: ${risk}`, risk === 'High' ? DANGER : (risk === 'Low' ? OK : WARN));
    y -= 4;
  }

  // ─── COVER PAGE ─────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.05, 0.04, 0.02) });
  page.drawRectangle({ x: 0, y: H / 2 - 80, width: W, height: 160, color: rgb(0.1, 0.08, 0.03) });

  page.drawText('KRONOX', { x: 180, y: H / 2 + 30, size: 48, font: fontBold, color: GOLD });
  page.drawText('Zaman Cizgisi Kart Oyunu', { x: 165, y: H / 2 + 8, size: 14, font: fontRegular, color: GOLD_DIM });
  page.drawLine({ start: { x: 150, y: H / 2 }, end: { x: W - 150, y: H / 2 }, thickness: 1, color: rgb(0.4, 0.3, 0.1) });
  page.drawText('IS AKISI & KULLANIM SENARYOLARI', { x: 115, y: H / 2 - 20, size: 13, font: fontBold, color: TEXT });
  page.drawText('Internal AI / Developer Briefing', { x: 175, y: H / 2 - 38, size: 11, font: fontBold, color: GOLD });
  page.drawText('Dokuman Versiyonu: 3.0', { x: 215, y: 80, size: 10, font: fontRegular, color: GOLD_DIM });
  page.drawText('Build: Codex040', { x: 240, y: 60, size: 10, font: fontRegular, color: GOLD_DIM });

  page.drawText('Kronox - Is Akisi Dokumani - Internal AI/Developer Briefing | Sayfa 1', {
    x: MARGIN, y: 15, size: 8, font: fontRegular, color: rgb(0.5, 0.5, 0.5)
  });

  // ─── 1. GENEL BAKIS ─────────────────────────────────────────────────────────
  newPage();
  y = H - MARGIN;

  drawHeading1('1. GENEL BAKIS');
  drawText('Kronox, oyuncularin sorularda gecen olay/eser/kesfin yilini kendi zaman cizgilerine dogru kronolojik sirayla yerlestirdigi rekabetci bir kart oyunudur. Bu dokuman, urunun GUNCEL kullanim akislarini, kullanim senaryolarini, QA, AI-asistanli gelistirme is akisini ve yeni ozellik / bug-fix akislarini detaylandirir.', { size: 10 });
  y -= 6;

  drawHeading2('1.1 Iki Birincil Mod');
  drawBullet('Solo Meydan Okuma -- Offline, tek oyunculu, kendi rekorunu kirma odakli.');
  drawBullet('Online Battle -- 2-4 oyunculu lobi tabanli gercek zamanli rekabet.');

  drawHeading2('1.2 Marka ve Terim Kurallari');
  drawBullet('Marka adi her yerde "Kronox". "kronos" yazimi YANLIS ve asla kullanilmaz.');
  drawBullet('Home aksiyonlari: "Solo Meydan Okuma" ve "Online Battle".');
  drawBullet('Eski "Solo Kapisma", "Online Kapisma", "HEMEN OYNA" terimleri LEGACY/REMOVED -- kullanilmaz.');
  drawBullet('PDF dosya adlari: kronox-teknik-dokuman.pdf, kronox-is-akisi.pdf.');

  drawHeading2('1.3 Bu Dokumandan Cikarilan Ozellikler');
  drawBullet('Eski lobi sohbeti (LobbyChat) -- REMOVED, sohbet UI tamamen kaldirildi.');
  drawBullet('Home "HEMEN OYNA" CTA -- REMOVED.');
  drawBullet('Eski cok-oyunculu yerel kurulum (PlayerSetup oyuncu sayisi) -- LEGACY, birincil akis degil.');
  drawBullet('Eski monolitik LobbyRoom dosyasi -- modullere ayrildi: useLobbyRoomState + LobbyCreateJoinPanel + WaitingRoomPanel.');

  // ─── 2. KULLANICI ROLLERI ───────────────────────────────────────────────────
  drawHeading1('2. KULLANICI ROLLERI');

  drawHeading2('2.1 Misafir (Giris Yapmamis)');
  drawBullet('Home, Solo Meydan Okuma ve ogretici erisilebilir.');
  drawBullet('Online Battle butonuna basinca login ekranina yonlendirilir.');
  drawBullet('Admin araclarina ve /test-suite\'e erisemez.');

  drawHeading2('2.2 Kayitli Kullanici');
  drawBullet('Tum Solo ve Online akislarina erisir.');
  drawBullet('Hesap silme, kisisel rekor (GameRecord) ve En Iyi 5 listesini gorur.');
  drawBullet('Soru/Test/Doc araclarina erisemez.');

  drawHeading2('2.3 Admin (AdminUser DB kaydi)');
  drawBullet('Settings > Admin Araclari menusu acilir.');
  drawBullet('Soru ekleyebilir / duzenleyebilir.');
  drawBullet('Teknik dokuman ve Is Akisi PDFlerini indirebilir.');
  drawBullet('Regression Test Panel calistirabilir.');
  drawBullet('Sadece admin /test-suite\'e UI ve sunucu seviyesinde erisebilir.');

  // ─── 3. ILK ACILIS / NAVIGASYON ────────────────────────────────────────────
  newPage();
  drawHeading1('3. ILK ACILIS VE NAVIGASYON');

  drawHeading2('3.1 Uygulama Acilisi');
  drawStep(1, 'SplashScreen', 'AuthProvider mount olur, base44.auth.me() arka planda calisir.');
  drawStep(2, 'Public Mode', 'Uygulama public oldugu icin giris yapmamis kullanicilar da Home\'a ulasir.');
  drawStep(3, 'Home Render', 'MainMenu 1080x1920 stage ile yuklenir; Solo Meydan Okuma / Online Battle kartlari ve ProfileBar gorunur.');

  drawHeading2('3.2 Navigasyon Bilesenleri');
  drawBullet('AppHeader: Home ve Game disindaki sayfalarda gorunur; geri tusu ve sayfa basligi.');
  drawBullet('BottomNav: Tum sayfalarda sabit; oyun sahnesinde minimal.');
  drawBullet('Sayfa gecisleri push/pop yonune gore yatay slide animasyonludur.');

  drawHeading2('3.3 Home Davranisi');
  drawBullet('Hicbir noktada vertical scroll YOK (fixed inset-0 + overflow-hidden).');
  drawBullet('Mobil dik: stage tam ekrani kaplar.');
  drawBullet('Desktop / tablet / landscape: stage 9:16 oranina sigdirilir (isWideStage).');
  drawBullet('Solo + Online kartlarinin width/height degerleri ESITTIR.');
  drawBullet('Profile / Settings ikonlari her kosulda erisilebilir kalir.');

  // ─── 4. SOLO IS AKISI ───────────────────────────────────────────────────────
  drawHeading1('4. OFFLINE SOLO IS AKISI');

  drawHeading2('4.1 Adim Adim');
  drawStep(1, 'Home', 'Kullanici "SOLO MEYDAN OKUMA" kartina basar -> /solo.');
  drawStep(2, 'Kategori Sec', 'SoloChallenge: genel, tarih, spor, sanat, bilim vb. kartlardan biri.');
  drawStep(3, 'Zorluk Sec', 'Kolay / orta / zor preset (tur suresi farkliligi).');
  drawStep(4, 'Oyna Butonu', '/game?mode=solo&category=...&difficulty=... rotasina yonlendirir.');
  drawStep(5, 'Soru Goruntule', 'QuestionCard aktiftir; gorsel/isitsel/muzik tipleri uygun loader ile render edilir.');
  drawStep(6, 'Yerlestir', 'Surukle-birak veya zone seciminden sonra CTA butonu.');
  drawStep(7, 'Geri Bildirim', 'FeedbackOverlay dogru/yanlis, gercek yil, fark badge.');
  drawStep(8, 'Yeni Soru', 'selectNextQuestion ile uygun soru gelir; oturum-ici tekrar YASAK, cross-game LRU tercih.');
  drawStep(9, 'Oyun Sonu', 'win_card_count kart kazanildiginda GameRecord.create + GameOver solo basari ekrani.');

  drawHeading2('4.2 Havuzu Tukenirse');
  drawBullet('Filtreden sonra yeterli soru kalmazsa kullaniciya ana menuye donmesi onerilir.');
  drawBullet('Hicbir noktada online state (Lobby) yazimi yapilmaz.');

  // ─── 5. ONLINE IS AKISI ─────────────────────────────────────────────────────
  newPage();
  drawHeading1('5. ONLINE BATTLE IS AKISI');

  drawHeading2('5.1 Lobi Olusturma (Host)');
  drawStep(1, 'Online Sec', 'Home > "ONLINE BATTLE" -> /lobby.');
  drawStep(2, 'Isim Gir', 'Misafir veya kayitli kullanici icin gorunur isim.');
  drawStep(3, 'Lobi Olustur', 'Lobby.create ile 6 hane benzersiz kod; status="waiting".');
  drawStep(4, 'Waiting Room', 'WaitingRoomPanel: ayarlar (kategori, yil araligi, sure, kazanma karti), kod kopyalama, oyuncu listesi.');
  drawStep(5, 'Oyunu Baslat', 'Host CTA -> buildInitialOnlineGameState (filtre+shuffle, kart dagitimi, ilk soru).');
  drawStep(6, 'Lobby Update', 'Tek update ile: players(cards), status="in_game", current_question_id, used_question_ids, current_player_index:0.');

  drawHeading2('5.2 Lobiye Katilma (Misafir)');
  drawStep(1, 'Kod Gir', 'LobbyCreateJoinPanel\'de kod ve isim girilir.');
  drawStep(2, 'findLobbyByCode', 'Service-role backend fonksiyonu lobiyi bulur ve oyuncuyu atomik olarak ekler.');
  drawStep(3, 'Waiting Room', 'Non-host olarak ayarlari salt-okunur izler.');
  drawStep(4, 'Otomatik Gecis', 'Host status="in_game" yazinca tum oyuncular /game\'e yonlendirilir.');

  drawHeading2('5.3 Oyun Ici Akis');
  drawStep(1, 'Sync', 'useLobbySync abone + polling ile Lobby\'i lobbyData state\'ine senkron tutar.');
  drawStep(2, 'Aktif Oyuncu', 'players[current_player_index] yerlestirebilir; digerleri SALT-OKUNUR gorur.');
  drawStep(3, 'Yerlestirme', 'doPlacement: optimistic local update -> updateLobbyGameState (3 retry + recovery).');
  drawStep(4, 'Tur Gecisi', 'getNextPlayerIndex %N rotasyonu; yeni soru selectNextQuestion ile.');
  drawStep(5, 'Kazanma', 'hasPlayerWon true -> status="finished", winner ve winner_email Lobby\'e yazilir.');
  drawStep(6, 'GameOver', 'Tum oyuncularda GameOver; kazanan zafer, digerleri kaybetme metni.');

  drawHeading2('5.4 2 / 3 / 4 Oyuncu');
  drawBullet('2 oyuncu: rotasyon 0<->1.');
  drawBullet('3 oyuncu: 0->1->2->0 ...');
  drawBullet('4 oyuncu: 0->1->2->3->0 ...');
  drawBullet('Tum durumlar Test Suite "sync" kategorisinde dogrulanir.');

  drawHeading2('5.5 Reconnect / Refresh');
  drawBullet('Refresh: useLobbySync Lobby.get yapar; route state\'e GUVENMEZ.');
  drawBullet('Subscription kopukluklarini polling fallback yakalar.');
  drawBullet('Sunucu finished lobi icin daha fazla guncelleme kabul etmez.');

  // ─── 6. ADMIN AKISLARI ─────────────────────────────────────────────────────
  newPage();
  drawHeading1('6. ADMIN AKISLARI');

  drawHeading2('6.1 Soru Yonetimi');
  drawStep(1, 'Settings > Admin Araclari', 'Soru Yonetimi alanini ac.');
  drawStep(2, 'Form Doldur', 'Soru metni, yil, kategori, tur (metin/gorsel/isitsel/muzik), opsiyonel media_url ve icon_url.');
  drawStep(3, 'Kaydet', 'Question entity\'sine yazilir (RLS: yalniz admin).');

  drawHeading2('6.2 Regression Test Panel');
  drawStep(1, 'Erisim', '/test-suite veya Settings > Admin Araclari > Regression Test Panel.');
  drawStep(2, 'Kategori Sec', '17 kategori arasinda filtreleme; veya tum testleri calistir.');
  drawStep(3, 'Calistir', 'PASS / FAIL / WARNING / SKIPPED sonuclari sayfada akar.');
  drawStep(4, 'Raporu Kopyala', '"Copy Report" tum sonuclar; "Copy Failed Only" yalniz FAIL/WARNING/SKIPPED.');

  drawHeading2('6.3 Dokuman Indirme');
  drawBullet('Settings > Admin Araclari > "Teknik Dokuman" -> kronox-teknik-dokuman.pdf.');
  drawBullet('Settings > Admin Araclari > "Is Akisi Dokumani" -> kronox-is-akisi.pdf.');
  drawBullet('Her iki fonksiyon unauthenticated kullanicilara 401, admin disindaki kullanicilara 403 doner.');

  drawHeading2('6.4 Erisim Kisitlamalari');
  drawBullet('isAdminUser disindaki kullanicilar /test-suite\'e gittiklerinde "ERISIM KORUMALI" ekrani gorur.');
  drawBullet('UI seviyesindeki engellemenin yaninda admin-only fonksiyonlar SERVER tarafinda da 403 verir.');

  // ─── 7. RELEASE CHECKLIST ─────────────────────────────────────────────────
  drawHeading1('7. RELEASE CHECKLIST');

  drawText('Her release oncesi bu listeyi sirayla uygula:', { size: 10 });
  drawStep(1, 'Test Simulation Calistir', '/test-suite -> TUM TESTLERI CALISTIR.');
  drawStep(2, 'Copy Failed Only', 'Sadece basarisiz/uyari testleri panoya al.');
  drawStep(3, 'Failures\'i Onar', 'AI Coder\'a kucuk patch isteklerine yapistir; gereksiz refactor yapma.');
  drawStep(4, 'Tekrar Calistir', 'Yesilden emin olana kadar; PASS hedefi.');
  drawStep(5, 'Mobil Home Kontrolu', 'Gercek mobil tarayicida Home: scroll YOK, Solo/Online kartlari clickable.');
  drawStep(6, 'Desktop Home Kontrolu', 'Genis tarayicida isWideStage devrede; kartlar tiklanabilir.');
  drawStep(7, '2-Cihaz Online Smoke Test', 'Bir host + bir guest ile lobi olustur, oynat.');
  drawStep(8, '3/4 Oyuncu Testi', 'Sadece multiplayer kod degistiyse 3 ve 4 oyuncuda rotation kontrolu.');
  drawStep(9, 'Build Marker', 'Codex### formati gorunur olmali; her release artis.');
  drawStep(10, 'Yayinla', 'Test ve manuel kontrol gectikten sonra publish.');

  // ─── 8. AI CODER WORKING RULES ─────────────────────────────────────────────
  newPage();
  drawHeading1('8. AI CODER CALISMA KURALLARI');

  drawBullet('Once KRONOX.md (urun/UX) ve CORE_PROMPT.md (muhendislik) dosyalarini oku.');
  drawBullet('Eski mimariyi varsayma. LobbyRoom monolit DEGIL; lobby chat YOK; HEMEN OYNA YOK.');
  drawBullet('Sohbeti yeniden eklemе; bu istek olmadan asla.');
  drawBullet('HEMEN OYNA CTA\'sini yeniden eklemе; bu istek olmadan asla.');
  drawBullet('Home 1080x1920 stage sistemini casually degistirmе.');
  drawBullet('Timeline / drag-drop kismina casually dokunmа.');
  drawBullet('Protected systems\'i degistirecek isteklerden once UYAR ve onay iste.');
  drawBullet('Her degisiklik sonunda: degisen dosyalarin listesi + Test sonuclari raporu.');
  drawBullet('Marka adi her yerde "Kronox". kronos / Kronos asla.');
  drawBullet('Yorum ve UI metinleri: aktif terimleri kullan ("Solo Meydan Okuma", "Online Battle").');

  // ─── 9. NEW FEATURE WORKFLOW ────────────────────────────────────────────────
  drawHeading1('9. YENI OZELLIK IS AKISI');

  drawStep(1, 'Etkilenen Sistemleri Tespit Et', 'Sayfa(lar), hook(lar), lib helper(lar), entity(ler), backend function(lar).');
  drawStep(2, 'Protected Systems Kontrolu', 'Teknik dokuman Bolum 16\'daki listeyi gec; etki varsa kucult.');
  drawStep(3, 'Minimal Patch Tasarla', 'En az dosya, en az satir. Yeni component klasoru acmadan once mevcudu genislet.');
  drawStep(4, 'Testleri Guncelle', 'Yeni davranis icin SimulationPanel/runTestSuite\'e en az 1-2 test ekle.');
  drawStep(5, 'Simulator Calistir', '/test-suite veya Settings > Regression Test Panel.');
  drawStep(6, 'Dokumani Guncelle', 'Mimari veya kullanici akisi degistiyse Teknik veya Is Akisi dokumanini gunecelle.');

  // ─── 10. BUG FIX WORKFLOW ───────────────────────────────────────────────────
  drawHeading1('10. BUG FIX IS AKISI');

  drawStep(1, 'Yeniden Uret', 'Hatayi adim adim yeniden uretin; gercek kullanici aksiyonlariyla.');
  drawStep(2, 'Modulu Bul', 'Hatanin oldugu ekran/hook/lib helper\'i tespit et.');
  drawStep(3, 'Minimal Fix', 'Sadece ihlali duzelt; gereksiz refactor yapma.');
  drawStep(4, 'Regression Test Ekle', 'Ayni hatanin geri donmemesi icin Test Suite\'e bir test ekle.');
  drawStep(5, 'Copy Failed Only', 'Once panele basarisizlari yapistirip onar; sonra tekrar kostur.');
  drawStep(6, 'Ilgisiz Degisiklik Yok', 'Yalnizca hata cevresindeki kod dokunulur; baska yere yayilma.');

  // ─── 11. UI CHANGE WORKFLOW ─────────────────────────────────────────────────
  newPage();
  drawHeading1('11. UI DEGISIKLIGI IS AKISI');

  drawHeading2('11.1 Home (1080x1920 stage)');
  drawBullet('Yeni eleman eklerken design-stage yuzdesini kullan; rastgele vh/vw nudge yapma.');
  drawBullet('No-scroll davranisini bozma (fixed inset-0 + overflow-hidden).');
  drawBullet('Solo/Online kart geometrisini kopyala-yapistir, kendi yuzden uretmeden.');
  drawBullet('Pointer-events kurallarini koru: dekoratif katmanlar none, kartlar auto.');
  drawBullet('Test Suite "home" kategorisi gecmeli (expected_card_coords, equal_card_size, desktop_stage_clickable, viewport_*).');

  drawHeading2('11.2 Gameplay (Game / Timeline / QuestionCard)');
  drawBullet('Onceligi netlik ve dokunmatik tepkide tut; "havaki kart efektleri" cazipse de mobilde performansi vurabilir.');
  drawBullet('Timeline ve drag-drop koordinat sistemine dokunmа.');
  drawBullet('Animasyon eklerken framer-motion ile spring stiffness 300 / damping 30 civari kalsin.');
  drawBullet('Lighthouse / fps duser mi diye dusuk RAM cihazinda dene.');

  // ─── 12. HATA AKISLARI ───────────────────────────────────────────────────────
  drawHeading1('12. HATA AKISLARI');

  drawHeading2('12.1 Soru Bulunamadi');
  drawBullet('Solo: kategori+zorluk+filtre sonrasi yeterli soru kalmadiysa kullaniciya nazikce ana menu onerilir.');
  drawBullet('Online: buildInitialOnlineGameState reason="not_enough_questions" donerse host hata gorur.');

  drawHeading2('12.2 Lobi Bulunamadi');
  drawBullet('findLobbyByCode found=false -> "Lobi bulunamadi"; tekrar deneme acik.');
  drawBullet('Lobi waiting disinda ise (joinable=false) katilim engellenir.');

  drawHeading2('12.3 Ag Hatasi / Subscription Kopmasi');
  drawBullet('useLobbySync polling fallback ile durumu kendi yenilemeyi dener.');
  drawBullet('useGameActions updateLobbyGameState retry (3 deneme, 1.2sn) + Lobby.get self-heal.');

  drawHeading2('12.4 Reddedilen Online Yazim');
  drawBullet('Sunucu reddederse istemci yerel state\'i DB\'den yeniden cekerek SENKRON KALIR.');

  drawHeading2('12.5 Auth Hatasi');
  drawBullet('Public mod: misafir devam edebilir.');
  drawBullet('Online butonu giris gerektirir; user yoksa redirectToLogin.');
  drawBullet('user_not_registered: UserNotRegisteredError ekrani.');

  drawHeading2('12.6 Medya Yuklenemedi');
  drawBullet('QuestionCard / QuestionMediaLoader fallback render eder.');
  drawBullet('Bozuk soruyu skipCurrentQuestion ile gec.');

  // ─── 13. OGRETICI ──────────────────────────────────────────────────────────
  drawHeading1('13. OGRETICI (TUTORIAL) AKISI');

  drawBullet('Settings > "Nasil Oynanir?" veya ilk kullanimda Home\'dan tetiklenir (lib/tutorialState.js).');
  drawBullet('Animasyonlu, dokunmatik dostu, adimli.');
  drawBullet('Adimlar: zaman cizgisi tanitimi, sururkleyerek yerlestirme, dogru/yanlis geri bildirim, kazanma kosulu, online lobi bilgisi.');
  drawBullet('"Atla" ve "Bitir" callbackleri tutorialSeen flag\'i ile localStorage\'a yazilir.');

  // ─── 14. KALDIRILMIS / LEGACY ───────────────────────────────────────────────
  newPage();
  drawHeading1('14. KALDIRILMIS VE LEGACY AKISLAR');

  drawText('Asagidaki ozellikler urunde ARTIK YOK veya pasif tutuluyor. Test Suite "removed" kategorisi bu kaldirmalari surekli denetler:', { size: 10 });
  drawBullet('Online lobi/oyun ici sohbet UI -- LobbyChat, mesaj input, unread indicator: hepsi UI\'dan kaldirildi.');
  drawBullet('Home "HEMEN OYNA" CTA -- birincil aksiyon olarak Solo Meydan Okuma / Online Battle kartlari yeterli.');
  drawBullet('Eski yerel multiplayer oyuncu sayisi secimi -- Solo Meydan Okuma tek-oyunculu yapilandirmaya yogunlasti.');
  drawBullet('Eski monolitik LobbyRoom -- split: useLobbyRoomState + LobbyCreateJoinPanel + WaitingRoomPanel.');
  drawBullet('Eski debug konsol overlay\'i (DebugConsole/DebugPanel) -- lib/debugLog.js gating ile yer degistirdi.');
  drawBullet('Eski QA bilesenleri (components/qa/*, QAHeader, MetricsBoard, SimulationResultCard, TestResultCard) -- yerini SimulationPanel aldi.');
  drawBullet('TimelineRuler -- kaldirildi; Timeline kendi hit-testini yapiyor.');
  drawBullet('LobbyMessage entity -- INACTIVE; UI baglantisi kesildi.');
  drawBullet('"kronos" / "Kronos" yazilimi -- YANLIS; tum dosya adlari ve metinler "Kronox" olmali.');

  // ─── 15. AI-READY BRIEF TEMPLATE ────────────────────────────────────────────
  drawHeading1('15. AI CODER\'A BRIEF SABLONU');

  drawText('AI Coder\'a ozellik/bug istegi gonderirken bu sabloni kullan. Bu sablon, ileride agent\'lar tarafindan da guvenle uygulanabilir.', { size: 9, color: MUTED });
  y -= 4;

  aiBlock({
    doList: [
      'GOAL: Tek cumlede ne degisecek.',
      'SCOPE: Hangi dosyalar.',
      'BEHAVIOR: Yeni davranis -- once / sonra.',
      'TESTS: Hangi Test Suite kategorisi gecmeli.',
    ],
    dontList: [
      'Protected systems\'i degistirmek.',
      'Kapsam disi dosyalara dokunmak.',
      'Removed/Legacy ozellikleri yeniden aktif etmek.',
    ],
    files: ['Tam yol verin: pages/..., components/..., hooks/..., lib/..., functions/...'],
    tests: ['Test Suite ilgili kategorileri', 'Manuel: Home no-scroll + clickability + ilgili UI'],
    risk: 'Medium',
  });

  // ─── 16. VERI AKISI ÖZETI ──────────────────────────────────────────────────
  newPage();
  drawHeading1('16. VERI AKISI OZETI');

  drawHeading2('16.1 Online');
  drawText('Aktif oyuncu hamlesi -> useGameActions.doPlacement -> optimistic local update -> base44.functions.invoke("updateLobbyGameState") -> sunucu dogrulamasi -> Lobby DB yazimi -> subscription event -> tum istemcilerde useLobbySync state guncellemesi.', { size: 9, color: OK });
  y -= 4;
  drawBullet('Optimistic update kullaniciya anlik tepki saglar.');
  drawBullet('Sunucu reddederse Lobby.get ile yerel state DB ile uyumlu hale getirilir.');
  drawBullet('updateLobbyGameState atomiktir: kart + tur gecisi + yeni soru tek adada.');

  drawHeading2('16.2 Solo');
  drawText('Kullanici hamlesi -> useGameActions.doPlacement (lobbyId yok) -> lokal state -> oyun bitince GameRecord.create (eger giris yapilmissa).', { size: 9, color: OK });
  y -= 4;
  drawBullet('Hicbir Lobby etkilesimi yok.');
  drawBullet('Cross-game tekrarsizlik questionHistory.js ile saglanir.');

  drawHeading2('16.3 Soru Secim Hiyerarsisi');
  drawBullet('Hard kural: oturum-ici used_question_ids icindeki sorular asla secilmez.');
  drawBullet('Tercih: aktif oyuncunun timeline\'inda halen olan yillarla denk sorular tercih edilmez.');
  drawBullet('Tercih: cross-game LRU history\'sinde olan sorular tercih edilmez.');
  drawBullet('Fallback: tercih kosullari gevsetilir, hard kural asla gevsetilmez.');

  // ─── 17. GELECEK GELISTIRMELER ─────────────────────────────────────────────
  drawHeading1('17. GELECEK GELISTIRMELER');

  drawBullet('Profil sayfasi (kismi hazir) -- GameRecord + AuthContext mevcut, /profile rotasi eklenebilir. RISK: Medium.');
  drawBullet('Skor / istatistik gecmisi -- GameRecord uzerinden aggregate. RISK: Medium.');
  drawBullet('Liderlik tablosu (HAZIR DEGIL) -- server-side trust yetersiz. RISK: High.');
  drawBullet('Ranked mod (HAZIR DEGIL) -- anomali tespiti ve anti-cheat eklenmeli. RISK: High.');
  drawBullet('Rematch -- Lobby reset + yeniden dagitim. RISK: Medium.');
  drawBullet('Push bildirimleri (sira / lobi cagrisi).');
  drawBullet('Kategori genisletmesi (muzik aktif, cografya/sinema vb. eklenebilir).');
  drawBullet('Soru onerme akisi (kullanicidan admin onayina).');

  // ─── 18. ARKA KAPAK ─────────────────────────────────────────────────────────
  newPage();
  y = H / 2 + 40;
  page.drawText('KRONOX', { x: MARGIN, y, size: 40, font: fontBold, color: GOLD });
  y -= 30;
  page.drawText(toAscii('Is Akisi Dokumani - Internal AI / Developer Briefing'), { x: MARGIN, y, size: 11, font: fontRegular, color: TEXT });
  y -= 18;
  page.drawText(toAscii('v3.0 - Build Codex040'), { x: MARGIN, y, size: 10, font: fontRegular, color: GOLD_DIM });
  y -= 14;
  page.drawText(toAscii('Cikti dosyasi: kronox-is-akisi.pdf'), { x: MARGIN, y, size: 10, font: fontRegular, color: GOLD_DIM });

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
