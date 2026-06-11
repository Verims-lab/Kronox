import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';

const SUPPORT_EMAIL = 'sariverim@gmail.com';
const UPDATED_AT = '11 Haziran 2026';

const sections = [
  {
    title: '1. Giriş',
    body: [
      'Kronox, kullanıcı gizliliğine önem veren bir mobil/web/PWA oyun deneyimidir. Bu Gizlilik Politikası; Kronox web sitesi, PWA ve iOS uygulaması üzerinden sunulan oyun, profil, arkadaş, bildirim, ekonomi ve yönetim özellikleri için geçerlidir.',
      'Kronox’u kullanarak bu politikada açıklanan veri işleme uygulamalarını kabul etmiş olursunuz. App Store gizlilik beyanları da bu sayfadaki açıklamalarla tutarlı olmalıdır.',
    ],
  },
  {
    title: '2. Topladığımız Bilgiler',
    body: [
      'Hesap ve profil bilgileri: e-posta adresi, görünen ad/kullanıcı adı, profil kimliği, avatar veya baş harf gibi profil görünümü bilgileri.',
      'Oynanış bilgileri: Solo ve Online oyun ilerlemesi, seviyeler, Kronox Puan, liderlik tablosu kayıtları, doğru/yanlış cevaplar, soru gösterim ve deneme olayları, oyun geçmişi ve istatistikler.',
      'Sosyal ve davet bilgileri: arkadaş istekleri, arkadaşlık kayıtları, oyun davetleri, lobi katılım bilgileri ve davet durumları.',
      'Tercihler: seçilen kategori/ilgi alanları, öğretici akışı ve bildirim tercihleri.',
      'Ekonomi bilgileri: Elmas bakiyesi, Günlük Çark sonuçları, Günlük Görev ilerleme ve ödül alma durumu, Joker Çantası bakiyeleri, JokerTransaction kayıtları ve Mağaza’da Elmas ile yapılan joker satın alımları.',
      'Teknik bilgiler: cihaz/tarayıcı türü, web/PWA/iOS ortamı, temel hata ve tanılama kayıtları, yerel önbellek durumu ve bildirimler etkinleştirildiyse push abonelik uç noktası/verileri.',
    ],
  },
  {
    title: '3. Bilgileri Nasıl Kullanıyoruz',
    body: [
      'Hesap açma, oturum yönetimi, profil görüntüleme ve kullanıcıya ait oyun verilerini göstermek için.',
      'Solo/Online ilerlemeyi, liderlik tablosunu, arkadaş/davet akışlarını, Günlük Çark, Günlük Görev, Mağaza, Elmas ve Joker özelliklerini çalıştırmak için.',
      'İsteğe bağlı bildirimler etkinleştirildiyse oyun davetleri veya uygulama içi oyun bildirimleri göndermek için.',
      'Soru dengesi, kategori dağılımı, zorluk ve oynanış adaletini analiz etmek; hata ayıklama, güvenlik, kötüye kullanım önleme ve hizmet kalitesini iyileştirmek için.',
    ],
  },
  {
    title: '4. Bildirimler',
    body: [
      'Push bildirimleri isteğe bağlıdır. Bildirim izni verirseniz Kronox, oyun davetleri veya oyunla ilgili bildirimleri iletmek için push abonelik verilerini kullanabilir.',
      'Bildirimleri tarayıcı, cihaz, işletim sistemi veya uygulama içi tercihlerin desteklediği alanlardan kapatabilirsiniz. VAPID/push abonelik verileri bildirim iletimi dışında reklam amacıyla kullanılmaz.',
    ],
  },
  {
    title: '5. Çocuklar ve Yaş',
    body: [
      'Kronox genel bir oyun deneyimidir ve çocuklara özel bir uygulama kategorisi olarak sunulduğu iddia edilmez. Gereksiz hassas çocuk verisi bilerek toplanmaz.',
      'Bir ebeveyn veya veli, çocuğa ait verilerin silinmesi veya incelenmesi gerektiğini düşünüyorsa destek e-posta adresinden bizimle iletişime geçebilir.',
    ],
  },
  {
    title: '6. Verilerin Paylaşımı',
    body: [
      'Kronox şu anda kişisel verileri üçüncü taraf reklam amacıyla satmaz.',
      'Uygulamanın çalışması için gerekli barındırma, backend, kimlik doğrulama, bildirim, hata ayıklama ve uygulama mağazası altyapı sağlayıcıları verileri işleyebilir.',
      'Yasal yükümlülükler, güvenlik, dolandırıcılık/kötüye kullanım önleme veya haklarımızı koruma gerektirdiğinde sınırlı veri paylaşımı yapılabilir.',
    ],
  },
  {
    title: '7. Çerezler, Yerel Depolama ve Önbellek',
    body: [
      'Kronox; oturum, tercih, oyun durumu, soru önbelleği, çevrimdışı dayanıklılık ve performans için local storage, IndexedDB/cache veya benzeri yerel cihaz depolama teknolojilerini kullanabilir.',
      'Soru önbelleği, ilk yükleme ve bağlantı sorunlarında oyunun daha dayanıklı çalışmasına yardımcı olur. Yerel veriler cihaz veya tarayıcı ayarlarından temizlenebilir.',
    ],
  },
  {
    title: '8. Veri Saklama',
    body: [
      'Veriler, hesap ve uygulama işleyişi için gerekli olduğu sürece saklanır. Oynanış geçmişi, ekonomi kayıtları, liderlik tablosu ve denetim kayıtları bütünlük, güvenlik, hata ayıklama, hile/kötüye kullanım önleme veya yasal yükümlülükler için daha uzun süre tutulabilir.',
      'Hesap silme talebi işlendiğinde mümkün olan kullanıcı verileri silinir veya anonimleştirilir. Bazı denetim ve bütünlük kayıtları, güvenlik ve oyun ekonomisi doğruluğu için sınırlı şekilde saklanabilir.',
    ],
  },
  {
    title: '9. Kullanıcı Hakları',
    body: [
      'Verilerinize erişim, düzeltme veya silme talebinde bulunabilirsiniz. Uygulamada hesap silme akışı varsa bu akışı kullanabilir veya destek e-posta adresinden bizimle iletişime geçebilirsiniz.',
      'Kimliğinizi doğrulamak ve hesabınızı korumak için bazı taleplerde ek bilgi isteyebiliriz.',
    ],
  },
  {
    title: '10. Güvenlik',
    body: [
      'Kronox, verileri korumak için makul teknik ve organizasyonel önlemler uygular. Admin araçları yalnızca yetkili aktif admin/owner hesapları için sınırlandırılır.',
      'Bununla birlikte hiçbir sistem yüzde yüz güvenli değildir. Şüpheli bir durum fark ederseniz lütfen destek adresinden bize bildirin.',
    ],
  },
  {
    title: '11. Üçüncü Taraf Hizmetler',
    body: [
      'Kronox; uygulamayı çalıştırmak için altyapı, barındırma, backend, kimlik doğrulama, uygulama mağazası, push bildirim altyapısı ve hata/tanılama hizmet sağlayıcılarından yararlanabilir.',
      'Bu hizmet sağlayıcıları verileri yalnızca uygulamanın sunulması, güvenliği ve bakımı için işleyebilir. Kronox’ta gerçek para ile satın alma, üçüncü taraf reklam takibi veya veri satışı şu anda ürün kapsamı değildir.',
    ],
  },
  {
    title: '12. Uluslararası Aktarım',
    body: [
      'Kullandığımız altyapı sağlayıcılarına bağlı olarak veriler, bulunduğunuz ülke dışındaki sunucularda işlenebilir veya saklanabilir. Bu durumda makul güvenlik önlemleri uygulanır.',
    ],
  },
  {
    title: '13. Değişiklikler',
    body: [
      'Bu Gizlilik Politikası zaman zaman güncellenebilir. En güncel sürüm her zaman https://kronoxgame.com/privacy adresinde yayımlanır.',
      'Kronox’un veri toplama veya kullanma şekli değişirse bu politika ve App Store gizlilik bilgileri uyumlu şekilde güncellenmelidir.',
    ],
  },
  {
    title: '14. İletişim',
    body: [
      'Gizlilik, veri erişimi, düzeltme, silme veya destek talepleri için bizimle e-posta üzerinden iletişime geçebilirsiniz.',
    ],
  },
];

export default function PrivacyPolicy() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = 'Kronox uygulamasının gizlilik politikası, veri kullanımı, bildirimler ve kullanıcı hakları hakkında bilgiler.';
    document.title = 'Kronox Gizlilik Politikası';

    let meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute('content') || '';
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description);

    return () => {
      document.title = previousTitle;
      if (meta) meta.setAttribute('content', previousDescription);
    };
  }, []);

  return (
    <main
      className="min-h-screen bg-background text-foreground"
      style={{
        minHeight: '100dvh',
        paddingTop: 'calc(1.25rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(ellipse at 50% 0%, rgba(34,211,238,0.16), transparent 46%), linear-gradient(180deg, #050b1c 0%, #08142f 54%, #03060f 100%)',
      }}
    >
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <Link
          to="/"
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 font-inter text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Ana Sayfa
        </Link>

        <header className="py-8 sm:py-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span className="font-inter text-xs font-bold uppercase tracking-wider">Kronox</span>
          </div>
          <h1 className="font-cinzel text-3xl font-black tracking-wide text-foreground sm:text-4xl">
            Gizlilik Politikası
          </h1>
          <p className="mt-3 max-w-2xl font-inter text-sm leading-7 text-muted-foreground sm:text-base">
            Son güncelleme: <strong className="text-foreground">{UPDATED_AT}</strong>. Bu sayfa Kronox’un hangi verileri topladığını,
            bu verileri nasıl kullandığını ve kullanıcıların hangi haklara sahip olduğunu açıklar.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 font-inter text-sm font-bold text-primary hover:bg-primary/15"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {SUPPORT_EMAIL}
          </a>
        </header>

        <article className="rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-2 shadow-2xl shadow-black/20 sm:px-8">
          {sections.map((section, index) => (
            <section
              key={section.title}
              className={index === sections.length - 1 ? 'py-6' : 'border-b border-white/10 py-6'}
            >
              <h2 className="font-cinzel text-lg font-bold text-foreground sm:text-xl">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="font-inter text-sm leading-7 text-muted-foreground sm:text-[15px]">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
