export const RELEASE_DEPLOYABILITY = {
  functionCount: 50,
  functionLimit: 50,
  expectedSdk: '0.8.34 exact',
  currentSdk: '^0.8.42',
  sdkStatus: 'Engelli',
  backendCompile: 'Manuel çalıştırma gerekli',
  deployment: 'Bu panelden yapılmaz',
};

export const RELEASE_HEALTH_GROUPS = [
  'A1 Görsel', 'A2 Durum', 'A3 Mobil', 'A4 Health kanıtı', 'B1 Bütünlük',
  'B2 Performans', 'B3 Soru QA', 'Online', 'Günlük Hedefler', 'Günlük Çark',
  'Solo Streak', 'Ekonomi', 'Güvenlik', 'Deployability',
].map((label) => ({ label, status: 'Koşum gerekli', proof: 'Otomatik sözleşme kontrolü' }));

export const RELEASE_CHECKLIST_GROUPS = [
  { title: 'Production / Base44 Deploy', proof: 'Harici', items: ['Base44 yayınlama tamamlandı', 'Backend fonksiyonları başarıyla deploy edildi', 'Deploy limit hatası oluşmadı', 'Codex608 üretimde göründü', 'Fonksiyon sayısı 50 sınırını aşmadı'] },
  { title: 'Real Device / WebView', proof: 'Manuel', items: ['Android gerçek cihaz smoke testi', 'iOS Safari / TestFlight / WebView smoke testi', '320 / 360 / 390 genişlik kanıtı', 'Safe-area / BottomNav / modal kanıtı', 'Düşük seviye Android akıcılık kontrolü'] },
  { title: 'Auth / Guest', proof: 'Manuel', items: ['Misafir giriş ve onboarding', 'Misafir Solo', 'Misafir Online', 'Bağlı hesap ve profil düzenleme', 'Misafirden bağlı hesaba geçiş'] },
  { title: 'Online / Multi-account', proof: 'Manuel', items: ['İki hesapla davet akışı', 'Rastgele eşleşme ve kodla katılma', 'Backend ortak deste doğrulaması', 'Kazanan +15 / kaybeden -6 sonucu', 'Yeniden bağlanma / iptal / zaman aşımı', 'Herkese açık yanıt gizlilik kontrolü'] },
  { title: 'Daily / Economy', proof: 'Manuel', items: ['Günlük Çark talebi', 'Günlük Hedef gerçek olayları', '7 günlük ödül 200 Elmas', 'Solo Streak +3 / +5 ödülleri', 'Mağaza Elmas harcamaları', 'Paralel tekrar / idempotency kanıtı'] },
  { title: 'Security / Privacy', proof: 'Harici', items: ['Özel oturum kanıtları ve iç kimlikler görünmüyor', 'VAPID üretim yapılandırması doğrulandı', 'VAPID özel anahtar değeri hiçbir çıktıda yok', 'RLS / çoklu hesap izolasyonu', 'Hesap silme akışı', 'Tam soru bankası herkese açık değil'] },
  { title: 'Content / QA', proof: 'Manuel', items: ['Kategori dağılımı incelendi', 'Tekrar riski incelendi', 'Yıl / zorluk kalitesi incelendi', 'Aktif soru hazırlığı kabul edildi', 'Manuel içerik onayı tamamlandı'] },
];

export const RELEASE_BLOCKERS = [
  'Üretim deploy kanıtı bekliyor', 'Gerçek cihaz / WebView kanıtı bekliyor',
  'RLS ve çoklu hesap kanıtı bekliyor', 'VAPID üretim provisioning kanıtı bekliyor',
  'Platform unique index kanıtı bekliyor', 'Package-lock Base44 çalışma alanında erişilebilir değil',
  'Frontend SDK ^0.8.42, mevcut deploy politikası 0.8.34 exact ile uyumsuz',
  'Full Health bu panel tarafından çalıştırılmaz ve canlı sonuç yoksa PASS gösterilmez',
];