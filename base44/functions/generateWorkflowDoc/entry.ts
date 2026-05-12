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
  page.drawText('Dokuman Versiyonu: 1.3', { x: 215, y: 80, size: 10, font: fontRegular, color: rgb(0.4, 0.35, 0.2) });
  page.drawText('Hazirlanma: Mayis 2026', { x: 210, y: 60, size: 10, font: fontRegular, color: rgb(0.4, 0.35, 0.2) });

  page.drawText('Kronox - Is Akisi Dokumani | Sayfa 1', {
    x: MARGIN, y: 15, size: 8, font: fontRegular, color: rgb(0.5, 0.5, 0.5)
  });

  // ─── PAGE 2: GENEL BAKIS ────────────────────────────────────────────────────
  newPage();
  y = H - MARGIN;

  drawHeading1('1. GENEL BAKIS');
  drawText('Kronox, oyuncularin tarihsel olaylari dogru kronolojik siralama ile zaman cetvellerine yerlestirdigi rekabetci bir kart oyunudur. Bu dokuman, uygulamanin kullanim senaryolarini, is akislarini ve oyun surec adimlarini detayli olarak aciklamaktadir.', { size: 10 });
  y -= 8;

  drawHeading2('1.1 Temel Kavramlar');
  drawBullet('Soru Karti: Bir tarihsel olayi ve dogru yilini iceren kart birimidir.');
  drawBullet('Zaman Cetveli: Her oyuncunun kartlarini kronolojik sirada dizerek olusturdugu kisisel serit.');
  drawBullet('Tur: Bir oyuncunun aktif oldugu ve kart yerlestirme islemi gerceklestirdigi zaman dilimi.');
  drawBullet('Lobi: Cevrimici oyun icin oyuncularin bir araya geldigi sanal oda.');
  drawBullet('Hata Payi: Kartlar sirala yanlis yerlestirilirse tur gecilir, kart kazanilmaz.');
  y -= 8;

  drawHeading2('1.2 Oyunun Amaci');
  drawText('Belirlenen kazanma karti sayisina (varsayilan: 10) ilk ulasan oyuncu oyunu kazanir. Kazanmak icin dogru yil tahminleri yaparak kart birikimi saglanmasi gerekir.', { size: 10 });
  y -= 8;

  drawHeading2('1.3 Desteklenen Modlar');
  drawBullet('Tek Cihaz Modu: 1-4 oyuncu tek bir cihaz uzerinde sirasyla oynar.');
  drawBullet('Cevrimici Mod: Her oyuncu kendi cihazindan lobiye katilir, gercek zamanli senkronizasyon saglanir.');

  // ─── PAGE: KULLANICI ROLLERI ─────────────────────────────────────────────────
  y -= 12;
  drawHeading1('2. KULLANICI ROLLERI VE YETKILER');

  drawHeading2('2.1 Misafir Oyuncu (Kayitsiz)');
  drawBullet('Tek cihaz modunda oyun baslatabilir.');
  drawBullet('Lobiye katilabilir ve olusturabilir (gecici e-posta ile).');
  drawBullet('Soru yonetimi ve admin paneline erisemez.');
  drawBullet('Hesap bilgileri saklanmaz, oturum gecicidir.');

  y -= 6;
  drawHeading2('2.2 Kayitli Kullanici');
  drawBullet('Misafir haklarinin tamamina sahiptir.');
  drawBullet('Oturum kapatilana kadar bilgiler korunur.');
  drawBullet('Hesap silme islemi yapabilir.');

  y -= 6;
  drawHeading2('2.3 Admin');
  drawBullet('Tum kullanici yetkilerine ek olarak:');
  drawBullet('Soru ekleyebilir, duzenleyebilir, silebilir.', 1);
  drawBullet('Teknik ve is akisi dokumanlarini indirebilir.', 1);
  drawBullet('Online oyun simülasyonlari calistirabilir.', 1);
  drawBullet('Ayarlar paneline erisebilir.', 1);

  // ─── PAGE: TEK CIHAZ IS AKISI ────────────────────────────────────────────────
  drawDivider();
  drawHeading1('3. TEK CIHAZ OYUN IS AKISI');

  drawHeading2('3.1 Oyun Kurulum Akisi');
  drawStep(1, 'Ana Ekran', 'Oyuncu sayisi (1-4), kategori, yil araligi ve tur suresi secilir.');
  drawStep(2, 'Oyuncu Isimleri', 'Her oyuncu icin isim girilir (bos birakma durumunda "Oyuncu N" atanir).');
  drawStep(3, 'Oyun Baslat', 'Sistem soru havuzundan filtreler, her oyuncuya 2 baslangic karti dagitir ve ilk soruyu belirler.');
  drawStep(4, 'Oyun Ekrani', 'Aktif oyuncunun zaman cetveli gosterilir, soru karti ekrana gelir.');

  y -= 6;
  drawHeading2('3.2 Tur Akisi (Her Oyuncu icin Tekrar)');
  drawStep(1, 'Soru Goruntuleme', 'Mevcut soru karti tum oyunculara gosterilir.');
  drawStep(2, 'Yer Secimi', 'Aktif oyuncu, soruyu zaman cetvelindeki iki kart arasina yerlestirmek icin bir bolge secer.');
  drawStep(3, 'Onayla', '"YERLESTIR" butonuna basilir.');
  drawStep(4, 'Sonuc Kontrolu', 'Sistem sorunun yilini kontrol eder: dogru ise kart kazanilir, yanlis ise kart kazanilmaz.');
  drawStep(5, 'Geri Bildirim', 'Animasyonlu dogru/yanlis ekrani gosterilir, gercek yil aciklanir.');
  drawStep(6, 'Tur Gecisi', 'Siradaki oyuncuya gecilir, yeni soru cekilir.');

  y -= 6;
  drawHeading2('3.3 Kazanma Kosulu');
  drawText('Bir oyuncunun kart sayisi "kazanma karti sayisi" esigine ulastiginda oyun sona erer. Kazanan oyuncu animasyonlu ekranda gosterilir. Ana sayfaya donme secenegi sunulur.', { size: 10 });

  y -= 6;
  drawHeading2('3.4 Sure Bitti Akisi');
  drawStep(1, 'Tur Suresi Doldu', 'Zamanlayici sifira ulasir.');
  drawStep(2, 'Otomatik Gecis', 'Kart kazanilmadan siradaki oyuncuya gecilir.');
  drawStep(3, 'Yeni Soru', 'Kullanilmamis sorulardan yeni soru secilir.');

  // ─── CEVRIMICI MOD ──────────────────────────────────────────────────────────
  newPage();
  y = H - MARGIN;

  drawHeading1('4. CEVRIMICI OYUN IS AKISI');

  drawHeading2('4.1 Lobi Olusturma (Host)');
  drawStep(1, 'Lobi Olustur', 'Host isim girer, "Lobi Olustur" butonuna basar.');
  drawStep(2, 'Lobi Kodu Uretilir', '6 karakterli benzersiz kod otomatik olusturulur.');
  drawStep(3, 'Bekleme Odasi', 'Host lobi kodunu diger oyunculara iletir.');
  drawStep(4, 'Ayarlar', 'Host; kategori, yil araligi, tur suresi ve kazanma kart sayisini duzenleyebilir.');
  drawStep(5, 'Oyun Baslat', 'En az 2 oyuncu hazir oldugunda host "Oyunu Baslatir".');

  y -= 6;
  drawHeading2('4.2 Lobiye Katilma (Misafir Oyuncu)');
  drawStep(1, 'Lobi Katil', 'Oyuncu isim girer ve 6 haneli lobi kodunu yazar.');
  drawStep(2, 'Katilim Dogrulamasi', 'Sistem aktif lobi arar; bulursa oyuncuyu ekler, bulamazsa hata gosterir.');
  drawStep(3, 'Bekleme', 'Host oyunu baslatana kadar lobi ekraninda oyunculari gorur.');
  drawStep(4, 'Otomatik Gecis', 'Host baslattiktan sonra tum oyuncular oyun ekranina yonlendirilir.');

  y -= 6;
  drawHeading2('4.3 Cevrimici Oyun Akisi');
  drawStep(1, 'Gercek Zamanli Senkronizasyon', 'Tum oyuncular ayni lobi kaydini izler; degisiklikler aninda yansir.');
  drawStep(2, 'Tur Sirasi', 'Sadece sirasi gelen oyuncu kart yerlestirebilir; digerleri izler.');
  drawStep(3, 'Kart Yerlesimi', 'Aktif oyuncu secer, onaylar; sonuc tum ekranlara yansiir.');
  drawStep(4, 'Tur Gecisi', 'Siradaki oyuncuya gecilir, yeni soru cikar; tum oyuncular guncellenir.');
  drawStep(5, 'Kazanma', 'Bir oyuncu esige ulasinca lobi "finished" durumuna gecer, tum oyuncular kazanan ekranini gorur.');

  y -= 6;
  drawHeading2('4.4 Lobi Sohbeti');
  drawBullet('Tum oyuncular lobi bekleme ekraninda ve oyun icinde (sag panel) sohbet edebilir.');
  drawBullet('Mesajlar gercek zamanli abonelik ile guncellenir; pull-to-refresh ile manuel yenileme de desteklenir.');
  drawBullet('LobbyMessage entity\'sine yazilir; lobby_id ile filtrele, 50 mesaj limiti.');

  y -= 6;
  drawHeading2('4.5 Lobi Ayarlari (Host)');
  drawBullet('Host kategori, yil araligi, tur suresi ve kazanma kart sayisini WaitingRoom icerisinden degistirebilir.');
  drawBullet('Hizli tiklama flood\'unu onlemek icin DB yazmalari 300ms debounce ile bekletilir.');
  drawBullet('Non-host oyuncular ayarlari useEffect araciligiyla subscription\'dan okur (read-only).');

  y -= 6;
  drawHeading2('4.6 Baglanti Kopuklugu Yonetimi');
  drawBullet('Oyuncu yeniden baglandiginda lobi durumunu DB\'den direkt ceker (base44.entities.Lobby.get).');
  drawBullet('Subscription closure icinde useRef pattern ile stale user/playerName degerleri onlenir.');
  drawBullet('Kritik DB yazma islemleri 3 deneme ile yeniden denenir (1.2sn aralikla).');

  // ─── SORU YONETIMI ──────────────────────────────────────────────────────────
  newPage();
  y = H - MARGIN;

  drawHeading1('5. SORU YONETIMI IS AKISI (ADMIN)');

  drawHeading2('5.1 Soru Ekleme');
  drawStep(1, 'Admin Paneli', 'Admin, uygulama icerisindeki soru yonetim ekranina erisir.');
  drawStep(2, 'Soru Formu', 'Soru metni, dogru yil, kategori ve tur (metin/gorsel/isitsel) girilir.');
  drawStep(3, 'Medya Ekleme', 'Gorsel veya isitsel soru turu icin medya URL eklenir.');
  drawStep(4, 'Kaydet', 'Soru veritabanina kaydedilir; anlik olarak oyun havuzuna eklenir.');

  drawHeading2('5.2 Soru Filtreleme ve Havuz Mantigi');
  drawBullet('Oyun baslamadan once soru havuzu kategori ve yil araligi ile filtrelenir.');
  drawBullet('Kullanilmis sorular "used_question_ids" listesinde tutulur, tekrar cekilmez.');
  drawBullet('Havuz tukendikten sonra ayni soru yeniden cikmaz; "Soru bulunamadi" uyarisi gorulur.');

  drawHeading2('5.3 Soru Turleri');
  drawBullet('Metin (metin): Yalnizca yazili soru. Aktif oyun modunda tam desteklenmektedir.');
  drawBullet('Gorsel (gorsel): Soru metnine ek gorsel icerik. QuestionCard bileseni gorsel turleri render edebilir; media_url zorunludur.');
  drawBullet('Isitsel (isitsel): Ses dosyasi iceren soru. QuestionCard audio player ile destekler; media_url zorunludur.');

  y -= 6;
  drawHeading2('5.4 Soru Yetki Kontrolu (RLS)');
  drawBullet('Okuma: Herkese acik (giris gerektirmez) — oyuncularin sorulari cekmesi icin.');
  drawBullet('Olusturma / Guncelleme / Silme: Yalnizca role="admin" kullanicilar.');

  // ─── USE CASE SENARYOLARI ────────────────────────────────────────────────────
  drawHeading1('6. KULLANIM SENARYOLARI (USE CASES)');

  drawHeading2('UC-01: Tek Oyunculu Pratik');
  drawBullet('Kullanici: Oyuncu 1 kisi secip kendi zaman cetveli akisini pratik yapar.');
  drawBullet('Akis: Oyuncu sayisi 1 → isim gir → kategori sec → Oyna → sorulari dogru yerlestirir → skor hedefler.');

  y -= 4;
  drawHeading2('UC-02: Arkadas Grubu Yerel Oyun');
  drawBullet('Kullanici: 2-4 arkadas tek cihaz etrafinda toplanir.');
  drawBullet('Akis: 4 oyuncu sec → isimler girilir → kategori tarih, sure 30sn → sirayla oynanir → ilk 10 kart kazanan bitirer.');

  y -= 4;
  drawHeading2('UC-03: Uzak Arkadaslarla Cevrimici Oyun');
  drawBullet('Kullanici: 2-4 kisi farkli cihazlardan oynar.');
  drawBullet('Akis: Host lobi olusturur → kodu paylasiir → diger oyuncular katilir → ayarlar yapilir → oyun baslar → gercek zamanli oynanir.');

  y -= 4;
  drawHeading2('UC-04: Admin Soru Ekleme');
  drawBullet('Kullanici: Uygulama yoneticisi.');
  drawBullet('Akis: Admin giris yapar → Soru Yonetimi → Yeni Soru Ekle → metin/yil/kategori gir → Kaydet → aninda havuza eklenir.');

  y -= 4;
  drawHeading2('UC-05: Dokuman Indirme');
  drawBullet('Kullanici: Admin.');
  drawBullet('Akis: Ayarlar → Admin Araclari → "Teknik Dokumani Indir" veya "Is Akisi Dokumanini Indir" → PDF olarak cihaza indirilir.');

  y -= 4;
  drawHeading2('UC-06: Online Simulasyon Testleri (42 Senaryo)');
  drawBullet('Kullanici: Admin.');
  drawBullet('Akis: Ayarlar → Admin Araclari → "Online Simulasyonlar" → 42 senaryodan birini veya tamamini sec → sistem otomatik lobi olusturur, oynar, temizler → PASS/FAIL raporu goruntulenir.');
  drawBullet('Senaryo gruplari: 2/3/4 oyuncu akislari, veri butunlugu, performans, UI gorunurluk, stabilite.', 1);

  y -= 4;
  drawHeading2('UC-07: Test Suite Calistirma (41 Senaryo)');
  drawBullet('Kullanici: Admin.');
  drawBullet('Akis: Tarayicida /test-suite → Suite sec → "TESTLERI CALISTIR" → sonuclari goruntule.');
  drawBullet('5 kategori: Unit, Black Box, Fonksiyonel, Performans, Oynanabilirlik.', 1);

  y -= 4;
  drawHeading2('UC-08: Landscape Modda Oyun');
  drawBullet('Kullanici: Mobil oyuncu.');
  drawBullet('Akis: Telefonu yatay cevir → Oyun 3 kolonlu landscape duzenine gecer → Sol: soru + buton, Orta: timeline, hicbir sey kaybolmaz.');

  y -= 4;
  drawHeading2('UC-09: APK\'da Google ile Giris');
  drawBullet('Kullanici: Android APK kullanicisi.');
  drawBullet('Akis: Uygulama acar → auth_required hatasi → WebView icinde Google OAuth sayfasina yonlendirilir → Giris tamamlanir → Ana ekrana donus.');

  // ─── VERI AKISI ─────────────────────────────────────────────────────────────
  newPage();
  y = H - MARGIN;

  drawHeading1('7. VERI AKISI DIAGRAMI (METIN)');

  drawHeading2('7.1 Cevrimici Oyun Veri Akisi');
  drawText('Host Aksi → lobbyData optimistic guncelle → DB yazimi (tek atomik update) → Subscription Event → Diger Oyuncular', { size: 9, color: rgb(0.6, 0.8, 0.6) });
  y -= 8;
  drawBullet('Atomik DB yazimi: kart ekleme + tur gecisi + yeni soru TEK update() cagrisiyla gonderilir.');
  drawBullet('Subscription: Diger tum oyuncular guncellemeyi WebSocket uzerinden aninda alir.');
  drawBullet('Optimistic Update: Aktif oyuncu ekrani DB yanitini beklemeden anlinda guncellenir.');
  drawBullet('useRef Closure Fix: Subscription icinde user ve playerName icin useRef kullanilir; stale deger hatasi onlenir.');

  y -= 6;
  drawHeading2('7.2 Soru Secim Akisi');
  drawText('Filtrele (kategori + yil) → Kullanilmis IDs cikar → Karistirir (Fisher-Yates) → Ilk Elemaani Al', { size: 9, color: rgb(0.6, 0.8, 0.6) });
  y -= 8;
  drawBullet('Fisher-Yates karistirma ile gercek rastlantisallik saglanir.');
  drawBullet('Havuz bittiyse yeni soru gelmez, mevcut soru devam eder.');

  y -= 6;
  drawHeading2('7.3 Kart Yerlesim Dogrulama Akisi');
  drawText('Secilen Bolge + Sirali Karti Listesi + Soru Yili → Sinir Kontrolu → Dogru/Yanlis', { size: 9, color: rgb(0.6, 0.8, 0.6) });
  y -= 8;
  drawBullet('Bolge 0 (en sol): Soru yili ilk karttan kucuk olmali.');
  drawBullet('Bolge N (en sag): Soru yili son karttan buyuk olmali.');
  drawBullet('Ara Bolge K: Soru yili [K-1]. kart ile K. kart arasinda olmali.');

  // ─── HATA AKISLARI ───────────────────────────────────────────────────────────
  drawHeading1('8. HATA YONETIMI AKISLARI');

  drawHeading2('8.1 Soru Bulunamadi');
  drawBullet('Tetikleyici: Sec kategori + yil filtresi sonucu 0 soru kalir.');
  drawBullet('Akis: Hata mesaji gosterilir → Oyun baslamaz → Ayarlar degistirmesi beklenir.');

  drawHeading2('8.2 Lobi Bulunamadi');
  drawBullet('Tetikleyici: Yanlis veya eski kod girilir.');
  drawBullet('Akis: "Lobi bulunamadi veya zaten basladi" hatasi gosterilir → Tekrar deneme secenegi.');

  drawHeading2('8.3 Baglanti Hatasi');
  drawBullet('Tetikleyici: Network kopuklugu veya API hatasi.');
  drawBullet('Akis: DB yazma islemleri 3 kez yeniden denenir (1.2sn aralikla).');
  drawBullet('3. denemede de basarisiz olursa pending write kilidi kaldirilir, kullaniciya etki goruntulenmez (sessiz hata).');

  drawHeading2('8.4 Lobi Silinmesi');
  drawBullet('Tetikleyici: Host lobiden ayrilir (delete tetikler).');
  drawBullet('Akis: Subscription "delete" eventi alir → Tum oyuncular bildirim alir → Lobi ekrani kapanir.');

  // ─── APK & AUTH IS AKISI ─────────────────────────────────────────────────────
  newPage();
  y = H - MARGIN;

  drawHeading1('9. MOBIL (APK) & KIMLIK DOGRULAMA IS AKISI');

  drawHeading2('9.1 Genel Auth Akisi');
  drawStep(1, 'Uygulama Acilisi', 'AuthProvider mount olur, base44.auth.me() cagrilir.');
  drawStep(2, 'Basarili Giris', 'Kullanici bilgileri state\'e kaydedilir, uygulama render edilir.');
  drawStep(3, 'auth_required Hatasi', 'base44.auth.redirectToLogin(pathname) tetiklenir, login sayfasina yonlendirilir.');
  drawStep(4, 'user_not_registered', 'UserNotRegisteredError ekrani gosterilir.');
  drawStep(5, 'Beklenmeyen Hata', 'authError state\'e atanir, fallback UI render edilir.');
  y -= 6;

  drawHeading2('9.2 APK (Android WebView) Google Login Duzeltmesi');
  drawBullet('Sorun: Onceki surumde auth_required hatasi sessizce yutuluyordu; APK\'da Google giris calismiyordu.');
  drawBullet('Cozum: AuthContext ve App.jsx\'te auth_required tipi acikca yakalanip redirectToLogin cagrisi yeniden devreye alindi.');
  drawBullet('Etki: Web ve APK ortamlarinda Google OAuth yonlendirmesi duzgun calisir.');
  y -= 6;

  drawHeading2('9.3 Misafir (Giris Yapmamiş) Oyuncu Akisi');
  drawStep(1, 'Giris Yok', 'Kullanici login yapmadan uygulamaya girer.');
  drawStep(2, 'Tek Cihaz Oyun', 'Sorular cekilebilir (okuma herkese acik), oyun oynanabilir.');
  drawStep(3, 'Cevrimici Oyun', 'Gecici e-posta (guest_TIMESTAMP@kronox.local) ile lobi olusturulabilir/katilabilir.');
  drawStep(4, 'Kisitlamalar', 'Admin paneline, soru yonetimine erisim engellenir.');

  // ─── LANDSCAPE IS AKISI ─────────────────────────────────────────────────────
  y -= 8;
  drawHeading1('10. LANDSCAPE MOD IS AKISI');

  drawHeading2('10.1 Ekran Yonlendirmesi Algilama');
  drawBullet('Tailwind landscape: screen tanimlanmistir: (orientation: landscape) and (max-height: 600px).');
  drawBullet('Telefon yatay cevirildiginde (max-height 600px alti) landscape: prefix\'li siniflar aktif olur.');
  drawBullet('Tablet ve masaustu bilgisayarlar bu kosulu saglamaz, normal duzen goruntulenir.');
  y -= 6;

  drawHeading2('10.2 Oyun Ekrani Landscape Duzeni');
  drawStep(1, 'Sol Kolon (w-52)', 'PlayerIndicator (oyuncu sirasi), QuestionCard ve Yerlestir butonu gosterilir.');
  drawStep(2, 'Orta Alan', 'Aktif oyuncunun kart zaman cetveli gosterilir (tam genislik).');
  drawStep(3, 'Kucultme', 'TurnTimer, bosluklar ve bazi yazi boyutlari kucultulur (landscape:text-sm vb.).');
  drawStep(4, 'Portrait Gizleme', 'Kart + buton blogu (portrait\'e ozel) landscape:hidden ile gizlenir.');
  y -= 6;

  drawHeading2('10.3 Safe-Area Padding');
  drawBullet('iOS notch ve Android navigation bar icin env(safe-area-inset-*) kullanilir.');
  drawBullet('index.css body elementinde padding olarak tanimlanidir.');
  drawBullet('Oyun ve lobi sayfalari inline style ile safe-area padding\'e sahiptir.');

  // ─── TEST SUITE IS AKISI ──────────────────────────────────────────────────────
  y -= 8;
  drawHeading1('11. TEST SUITE IS AKISI (41 SENARYO)');

  drawHeading2('11.1 Erisim');
  drawStep(1, 'Giris', 'Admin olarak giris yap.');
  drawStep(2, 'Navigasyon', 'Tarayicida /test-suite adresine git veya Ayarlar > Admin Araclari.');
  drawStep(3, 'Suite Sec', 'Unit / Black Box / Fonksiyonel / Performans / Oynanabilirlik veya Tum Testler.');
  drawStep(4, 'Calistir', '"TESTLERI CALISTIR" butonuna tikla.');
  drawStep(5, 'Sonuc', 'Her test icin PASS/FAIL, sure ve detay goruntulenir. Ozet istatistik ust kisimda yer alir.');
  y -= 6;

  drawHeading2('11.2 Test Kategorileri ve Amaci');
  drawBullet('Unit (10 test): Izole mantik — shuffle, kart yerlesim, filtre, pickQuestion.');
  drawBullet('Black Box (8 test): API/DB davranisi — lobi CRUD, mesaj, gecersiz islemler.');
  drawBullet('Fonksiyonel (8 test): Oyun kurallari — kart dagitimi, tur dongusu, kazanma.');
  drawBullet('Performans (5 test): Hiz & kapasite — 500 soru, 10 lobi, shuffle suresi.');
  drawBullet('Oynanabilirlik (10 test): Kullanici deneyimi — kategori varlik, soru yeterliligi, sure secenekleri.');

  // ─── DRAG AND DROP IS AKISI ──────────────────────────────────────────────────
  newPage();
  y = H - MARGIN;

  drawHeading1('12. DOKUNMATIK SURU-BIRAK IS AKISI');

  drawHeading2('12.1 Kullanici Perspektifinden Akis');
  drawStep(1, 'Soruyu Tut', 'Kullanici soru kartina parmaginı bastırır (onTouchStart).');
  drawStep(2, 'Surukle', 'Parmak hareket ederken ghost kart parmagi takip eder (viewport coords).');
  drawStep(3, 'Timeline Uzerinden Gec', 'Timeline aktif drop zone\'u altin rengi ile vurgular.');
  drawStep(4, 'Birak', 'Parmak kaldirilinca en yakin zone hesaplanir ve onPlaceCard tetiklenir.');
  drawStep(5, 'Sonuc', 'Dogru zone ise kart timeline\'a eklenir; yanlisSsa red animasyonu gosterilir.');
  y -= 8;

  drawHeading2('12.2 Koordinat Uzaylari');
  drawBullet('Ghost kart: viewport koordinati (position:fixed) — scroll etkisinden bagimsiz parmak takibi.');
  drawBullet('Drop zone hit-testi: world koordinati = clientX - containerLeft + scrollLeft.');
  drawBullet('Bu ayrım sayesinde timeline ne kadar kaydirılmis olursa olsun kart doğru bölgeye düser.');
  y -= 6;

  drawHeading2('12.3 Otomatik Kayma (Edge Scrolling)');
  drawBullet('Parmak timeline sol (<80px) veya sag (<80px) kenarina yaklasinca otomatik kayma baslar.');
  drawBullet('requestAnimationFrame dongusu ile akici 60fps kayma saglanir.');
  drawBullet('Parmak kaldirilinca veya drag bittikce cancelAnimationFrame ile durdurulur.');
  y -= 6;

  drawHeading2('12.4 Muzik Onizleme (Deezer)');
  drawBullet('Muzik sorusu kartlari her mount\'ta getDeezerPreview fonksiyonunu cagirir.');
  drawBullet('Sarki adi + sanatci adi ile Deezer API aranir; 30 saniyelik preview URL alinir.');
  drawBullet('URL hazir olunca QuestionCard otomatik olarak sesi caldirir.');
  drawBullet('Onceki sabit media_url yonteminin aksine link asla "suresi dolmaz" sorununa ugramaz.');

  // ─── GELECEK GELISTIRMELER ────────────────────────────────────────────────────
  drawHeading1('13. GELECEK GELISTIRMELER');

  drawBullet('Gorsel ve isitsel soru turlerinin aktif oyun havuzuna dahil edilmesi (altyapi hazir).');
  drawBullet('Oyuncu puanlama ve istatistik gecmisi: dogru/yanlis orani, ortalama sure.');
  drawBullet('Reconnect / state recovery: Baglanti kopunca otomatik yeniden baglanma.');
  drawBullet('Turnuva modu: Eleme usulu cok turlu rekabet, kalici skor tablosu.');
  drawBullet('Kategori genisletmesi: Muzik, cografya, edebiyat, sinema vb.');
  drawBullet('Soru onerme sistemi: Kayitli kullanicilar soru onerebilir, admin onaylar.');
  drawBullet('Push bildirimler: Sira geldigi zaman uygulama arka plandayken bildirim.');
  drawBullet('Lokalizasyon: Ingilizce ve diger dil destegi.');
  drawBullet('Mobil uygulama: iOS ve Android native yayin (React kodu aynen kullanilir).');
  drawBullet('Spektator modu: Aktif lobiye izleyici olarak katilma.');

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