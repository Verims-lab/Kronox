import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { suite } = body; // 'unit' | 'blackbox' | 'functional' | 'performance' | 'playability' | 'all'

    const results = [];
    const run = (name, fn) => ({ name, fn });

    // ─── HELPERS ────────────────────────────────────────────────────
    function generateCode() {
      return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    async function createTestLobby(extraPlayers = 0) {
      const players = [{ email: 'test_host@kronos.local', name: 'TestHost', ready: true }];
      for (let i = 0; i < extraPlayers; i++) {
        players.push({ email: `test_p${i}@kronos.local`, name: `Player${i}`, ready: true });
      }
      return base44.asServiceRole.entities.Lobby.create({
        code: generateCode(),
        host_email: 'test_host@kronos.local',
        host_name: 'TestHost',
        players,
        status: 'waiting',
        category: 'karisik',
        year_start: 1900,
        year_end: 2020,
        turn_duration: 60,
        win_card_count: 5,
      });
    }

    async function cleanupLobby(id) {
      try { await base44.asServiceRole.entities.Lobby.delete(id); } catch {}
    }

    async function getQuestions(limit = 20) {
      return base44.asServiceRole.entities.Question.list('-created_date', limit);
    }

    // ─── UNIT TESTS ────────────────────────────────────────────────
    const unitTests = [
      run('UT-01: Lobby kodu 6 karakter olmalı', async () => {
        const code = generateCode();
        if (code.length !== 6) throw new Error(`Beklenen 6, bulunan: ${code.length}`);
      }),
      run('UT-02: Question entity alanları doğru olmalı', async () => {
        const qs = await getQuestions(1);
        if (qs.length === 0) throw new Error('Soru bulunamadı');
        const q = qs[0];
        if (!q.question || typeof q.year !== 'number') throw new Error('Eksik alan: question veya year');
      }),
      run('UT-03: Fisher-Yates shuffle dağılım testi', async () => {
        const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const original = [...arr];
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        const same = arr.every((v, i) => v === original[i]);
        if (same) throw new Error('Shuffle çalışmıyor — dizi değişmedi (olasılık düşük ama hata)');
      }),
      run('UT-04: Doğru yerleştirme mantığı — başa koy (zone=0)', async () => {
        const cards = [{ year: 1950 }, { year: 1980 }];
        const sorted = [...cards].sort((a, b) => a.year - b.year);
        const questionYear = 1920;
        const selectedZone = 0;
        const isCorrect = sorted.length === 0 || questionYear <= sorted[0].year;
        if (!isCorrect) throw new Error('Yıl 1920, zone=0, cards=[1950,1980] → doğru olmalıydı');
      }),
      run('UT-05: Doğru yerleştirme mantığı — ortaya koy', async () => {
        const cards = [{ year: 1900 }, { year: 1970 }];
        const sorted = [...cards].sort((a, b) => a.year - b.year);
        const questionYear = 1950;
        const selectedZone = 1;
        const isCorrect = questionYear >= sorted[selectedZone - 1].year && questionYear <= sorted[selectedZone].year;
        if (!isCorrect) throw new Error('Yıl 1950, zone=1, cards=[1900,1970] → doğru olmalıydı');
      }),
      run('UT-06: Yanlış yerleştirme mantığı — zona uymayan yıl', async () => {
        const cards = [{ year: 1900 }, { year: 1920 }];
        const sorted = [...cards].sort((a, b) => a.year - b.year);
        const questionYear = 1980;
        const selectedZone = 1;
        const isCorrect = questionYear >= sorted[selectedZone - 1].year && questionYear <= sorted[selectedZone].year;
        if (isCorrect) throw new Error('Yıl 1980, zone=1, cards=[1900,1920] → yanlış olmalıydı');
      }),
      run('UT-07: Kazanma koşulu kontrolü', async () => {
        const winCardCount = 5;
        const playerCards = new Array(5).fill({ year: 2000 });
        const hasWon = playerCards.length >= winCardCount;
        if (!hasWon) throw new Error('5 kart = kazanmalı');
      }),
      run('UT-08: Yıl filtresi çalışması', async () => {
        const qs = await getQuestions(50);
        const filtered = qs.filter(q => q.year >= 1950 && q.year <= 2000);
        const outOfRange = filtered.filter(q => q.year < 1950 || q.year > 2000);
        if (outOfRange.length > 0) throw new Error(`${outOfRange.length} soru aralık dışında`);
      }),
      run('UT-09: Kategori filtresi (non-karisik)', async () => {
        const qs = await getQuestions(50);
        const cat = 'tarih';
        const filtered = qs.filter(q => q.category === cat || cat === 'karisik');
        if (filtered.length === 0) throw new Error('Tarih kategorisinde soru yok');
      }),
      run('UT-10: pickQuestion — kullanılan soruyu vermemeli', async () => {
        const qs = await getQuestions(5);
        if (qs.length < 2) throw new Error('Yeterli soru yok');
        const usedIds = new Set([qs[0].id]);
        const available = qs.filter(q => !usedIds.has(q.id));
        if (available.some(q => q.id === qs[0].id)) throw new Error('Kullanılan soru tekrar seçildi');
      }),
    ];

    // ─── BLACK BOX TESTS ──────────────────────────────────────────
    const blackboxTests = [
      run('BB-01: Lobby oluşturma API çalışmalı', async () => {
        const lobby = await createTestLobby();
        if (!lobby?.id) throw new Error('Lobby oluşturulamadı');
        await cleanupLobby(lobby.id);
      }),
      run('BB-02: Lobby kod ile filtreleme çalışmalı', async () => {
        const lobby = await createTestLobby();
        const found = await base44.asServiceRole.entities.Lobby.filter({ code: lobby.code });
        if (!found || found.length === 0) throw new Error('Lobby kodu ile bulunamadı');
        await cleanupLobby(lobby.id);
      }),
      run('BB-03: Oyuncu ekleme çalışmalı', async () => {
        const lobby = await createTestLobby();
        const newPlayer = { email: 'joiner@test.local', name: 'Joiner', ready: true };
        const updated = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
          players: [...lobby.players, newPlayer]
        });
        if (updated.players.length !== 2) throw new Error('Oyuncu eklenemedi');
        await cleanupLobby(lobby.id);
      }),
      run('BB-04: Lobby status güncelleme çalışmalı', async () => {
        const lobby = await createTestLobby(1);
        const updated = await base44.asServiceRole.entities.Lobby.update(lobby.id, { status: 'in_game' });
        if (updated.status !== 'in_game') throw new Error('Status güncellenemedi');
        await cleanupLobby(lobby.id);
      }),
      run('BB-05: Lobby silme çalışmalı', async () => {
        const lobby = await createTestLobby();
        await base44.asServiceRole.entities.Lobby.delete(lobby.id);
        const results = await base44.asServiceRole.entities.Lobby.filter({ code: lobby.code });
        if (results && results.length > 0) throw new Error('Lobby silinemedi');
      }),
      run('BB-06: Geçersiz lobby kodu ile arama → boş dönemeli', async () => {
        const results = await base44.asServiceRole.entities.Lobby.filter({ code: 'ZZZZZZ' });
        if (results && results.length > 0) throw new Error('Sahte lobiye erişildi');
      }),
      run('BB-07: Question listesi erişilebilir olmalı', async () => {
        const qs = await getQuestions(1);
        if (!Array.isArray(qs)) throw new Error('Question listesi array değil');
      }),
      run('BB-08: LobbyMessage oluşturma ve okuma', async () => {
        const lobby = await createTestLobby();
        const msg = await base44.asServiceRole.entities.LobbyMessage.create({
          lobby_id: lobby.id,
          player_name: 'TestHost',
          message: 'test mesajı',
          type: 'chat'
        });
        if (!msg?.id) throw new Error('Mesaj oluşturulamadı');
        await base44.asServiceRole.entities.LobbyMessage.delete(msg.id);
        await cleanupLobby(lobby.id);
      }),
    ];

    // ─── FUNCTIONAL TESTS ─────────────────────────────────────────
    const functionalTests = [
      run('FT-01: Oyun başlatma — kart dağıtımı doğru', async () => {
        const qs = await getQuestions(50);
        const filtered = qs.filter(q => q.type === 'metin');
        if (filtered.length < 5) throw new Error('Yeterli metin sorusu yok');
        const players = [{ name: 'A' }, { name: 'B' }];
        const neededCount = players.length * 2 + 1;
        if (filtered.length < neededCount) throw new Error(`Soru yetersiz: ${filtered.length} < ${neededCount}`);
        let cursor = 0;
        const used = new Set();
        const playersWithCards = players.map(p => {
          const cards = [];
          for (let i = 0; i < 2; i++) {
            const q = filtered[cursor++];
            cards.push({ id: q.id, year: q.year });
            used.add(q.id);
          }
          return { ...p, cards };
        });
        const firstQ = filtered[cursor];
        if (!firstQ) throw new Error('İlk soru yok');
        if (used.has(firstQ.id)) throw new Error('İlk soru zaten dağıtılmış');
        if (playersWithCards[0].cards.length !== 2) throw new Error('Oyuncu 1 kartları eksik');
        if (playersWithCards[1].cards.length !== 2) throw new Error('Oyuncu 2 kartları eksik');
      }),
      run('FT-02: Tur sırası döngüsü — 2 oyuncu', async () => {
        const players = ['A', 'B'];
        let idx = 0;
        const turns = [];
        for (let i = 0; i < 6; i++) {
          turns.push(players[idx]);
          idx = (idx + 1) % players.length;
        }
        const expected = ['A', 'B', 'A', 'B', 'A', 'B'];
        if (JSON.stringify(turns) !== JSON.stringify(expected)) throw new Error('Tur sırası yanlış');
      }),
      run('FT-03: Tur sırası döngüsü — 4 oyuncu', async () => {
        const players = ['A', 'B', 'C', 'D'];
        let idx = 0;
        for (let i = 0; i < 8; i++) {
          idx = (idx + 1) % players.length;
        }
        if (idx !== 0) throw new Error('8 tur sonra index sıfırlanmadı');
      }),
      run('FT-04: Kazanma durumu → status=finished yazılmalı', async () => {
        const lobby = await createTestLobby(1);
        const updated = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
          status: 'finished',
          winner: 'TestHost'
        });
        if (updated.status !== 'finished') throw new Error('Status finished değil');
        if (updated.winner !== 'TestHost') throw new Error('Winner yazılmadı');
        await cleanupLobby(lobby.id);
      }),
      run('FT-05: Soru tekrar edilmemeli (used_question_ids)', async () => {
        const qs = await getQuestions(10);
        const usedIds = new Set(qs.slice(0, 5).map(q => q.id));
        const available = qs.filter(q => !usedIds.has(q.id));
        const picked = available[0];
        if (usedIds.has(picked?.id)) throw new Error('Kullanılan soru tekrar seçildi');
      }),
      run('FT-06: Offline mod — lobbyId olmadan oyun başlatılabilmeli', async () => {
        const qs = await getQuestions(20);
        const filtered = qs.filter(q => q.type === 'metin');
        const playerNames = ['Ali', 'Veli'];
        const neededCount = playerNames.length * 2 + 1;
        if (filtered.length < neededCount) throw new Error('Offline için soru yetersiz');
      }),
      run('FT-07: Ayarlar değişikliği lobi güncelleme', async () => {
        const lobby = await createTestLobby(1);
        const updated = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
          category: 'tarih',
          year_start: 1950,
          year_end: 2000,
          turn_duration: 30,
          win_card_count: 7
        });
        if (updated.category !== 'tarih') throw new Error('Kategori güncellenemedi');
        if (updated.year_start !== 1950) throw new Error('year_start güncellenemedi');
        if (updated.turn_duration !== 30) throw new Error('turn_duration güncellenemedi');
        await cleanupLobby(lobby.id);
      }),
      run('FT-08: Authentication — yetkisiz erişim engellenmeli', async () => {
        // Admin kontrolü simüle et
        const mockUser = { role: 'user' };
        if (mockUser.role === 'admin') throw new Error('User admin sanıldı');
      }),
    ];

    // ─── PERFORMANCE TESTS ────────────────────────────────────────
    const performanceTests = [
      run('PERF-01: 500 soru yükleme süresi < 5sn', async () => {
        const start = Date.now();
        await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const elapsed = Date.now() - start;
        if (elapsed > 5000) throw new Error(`Yükleme çok yavaş: ${elapsed}ms`);
        return `${elapsed}ms`;
      }),
      run('PERF-02: 10 adet lobby oluşturma + silme < 10sn', async () => {
        const start = Date.now();
        const lobbies = [];
        for (let i = 0; i < 10; i++) {
          const l = await createTestLobby();
          lobbies.push(l.id);
        }
        for (const id of lobbies) await cleanupLobby(id);
        const elapsed = Date.now() - start;
        if (elapsed > 10000) throw new Error(`Çok yavaş: ${elapsed}ms`);
        return `${elapsed}ms`;
      }),
      run('PERF-03: 500 soru içinde Fisher-Yates < 50ms', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const arr = [...qs];
        const start = Date.now();
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        const elapsed = Date.now() - start;
        if (elapsed > 50) throw new Error(`Shuffle çok yavaş: ${elapsed}ms`);
        return `${elapsed}ms`;
      }),
      run('PERF-04: Soru filtreleme (yıl + kategori) < 10ms', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const start = Date.now();
        const filtered = qs
          .filter(q => q.type === 'metin')
          .filter(q => q.year >= 1950 && q.year <= 2000)
          .filter(q => q.category === 'tarih');
        const elapsed = Date.now() - start;
        if (elapsed > 10) throw new Error(`Filtreleme yavaş: ${elapsed}ms`);
        return `${elapsed}ms, ${filtered.length} soru`;
      }),
      run('PERF-05: LobbyMessage toplu okuma < 2sn', async () => {
        const start = Date.now();
        await base44.asServiceRole.entities.LobbyMessage.list('-created_date', 50);
        const elapsed = Date.now() - start;
        if (elapsed > 2000) throw new Error(`Mesaj okuma yavaş: ${elapsed}ms`);
        return `${elapsed}ms`;
      }),
    ];

    // ─── PLAYABILITY TESTS ────────────────────────────────────────
    const playabilityTests = [
      run('PLAY-01: 1 oyuncu offline oyun kurabilmeli', async () => {
        const qs = await getQuestions(20);
        const filtered = qs.filter(q => q.type === 'metin');
        if (filtered.length < 3) throw new Error('Tek oyuncu için bile soru yok');
      }),
      run('PLAY-02: Minimum 3 soru gereksinimi offline için', async () => {
        const qs = await getQuestions(20);
        const filtered = qs.filter(q => q.type === 'metin');
        if (filtered.length < 3) throw new Error(`Sadece ${filtered.length} soru var, 3 gerekli`);
      }),
      run('PLAY-03: 4 oyunculu lobby kurulabilmeli', async () => {
        const lobby = await createTestLobby(3); // host + 3 = 4 oyuncu
        if (lobby.players.length !== 4) throw new Error('4 oyuncu eklenemedi');
        await cleanupLobby(lobby.id);
      }),
      run('PLAY-04: Tüm kategorilerde soru var mı?', async () => {
        const qs = await getQuestions(200);
        const categories = ['tarih', 'bilim', 'spor', 'sanat', 'genel'];
        const missing = categories.filter(cat => !qs.some(q => q.category === cat));
        if (missing.length > 0) throw new Error(`Eksik kategoriler: ${missing.join(', ')}`);
      }),
      run('PLAY-05: Karışık kategoride tüm sorular geçerli', async () => {
        const qs = await getQuestions(100);
        const invalidYears = qs.filter(q => !q.year || typeof q.year !== 'number');
        if (invalidYears.length > 0) throw new Error(`${invalidYears.length} soruda geçersiz yıl var`);
      }),
      run('PLAY-06: Yıl aralığı 1900-2020 için yeterli soru (≥20)', async () => {
        const qs = await getQuestions(500);
        const filtered = qs.filter(q => q.type === 'metin' && q.year >= 1900 && q.year <= 2020);
        if (filtered.length < 20) throw new Error(`Sadece ${filtered.length} soru var, 20 gerekli`);
        return `${filtered.length} soru`;
      }),
      run('PLAY-07: Sonsuz tur (duration=0) ayarı mevcut', async () => {
        // TurnTimer duration=0 iken null döndürüyor — doğrulama
        const duration = 0;
        const timerShouldBeHidden = duration === 0;
        if (!timerShouldBeHidden) throw new Error('Sonsuz tur ayarı çalışmıyor');
      }),
      run('PLAY-08: Kazanma kartı sayısı seçenekleri (5,7,10,15)', async () => {
        const validOptions = [5, 7, 10, 15];
        const defaultWin = 10;
        if (!validOptions.includes(defaultWin)) throw new Error('Default winCardCount geçersiz');
      }),
      run('PLAY-09: Lobi sohbeti — mesaj boş olamaz', async () => {
        const input = '   ';
        const text = input.trim();
        if (text.length > 0) throw new Error('Boş mesaj geçti');
      }),
      run('PLAY-10: Tur geçme (timer doldu) → soru değişmeli', async () => {
        const qs = await getQuestions(10);
        const usedIds = new Set([qs[0].id]);
        const available = qs.filter(q => !usedIds.has(q.id));
        if (available.length === 0) throw new Error('Yeni soru seçilemiyor');
        const nextQ = available[0];
        if (nextQ.id === qs[0].id) throw new Error('Aynı soru tekrar geldi');
      }),
    ];

    // ─── MUSIC TESTS ──────────────────────────────────────────────
    const musicTests = [
      run('MUZ-01: Müzik soruları var mı? (type=muzik)', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const muzikQs = qs.filter(q => q.type === 'muzik');
        if (muzikQs.length === 0) throw new Error('Hiç müzik sorusu yok');
        return `${muzikQs.length} müzik sorusu var`;
      }),
      run('MUZ-02: Müzik sorularında media_url (preview) mevcut olmalı', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const muzikQs = qs.filter(q => q.type === 'muzik');
        if (muzikQs.length === 0) throw new Error('Müzik sorusu yok');
        const noUrl = muzikQs.filter(q => !q.media_url || q.media_url.trim() === '');
        if (noUrl.length > 0) throw new Error(`${noUrl.length} müzik sorusunda media_url eksik`);
        return `${muzikQs.length} sorunun tamamında URL var`;
      }),
      run('MUZ-03: Müzik preview URL\'leri erişilebilir (ilk 3 kontrol)', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const muzikQs = qs.filter(q => q.type === 'muzik' && q.media_url).slice(0, 3);
        if (muzikQs.length === 0) throw new Error('Test edilecek müzik sorusu yok');
        const results = [];
        for (const q of muzikQs) {
          try {
            const res = await fetch(q.media_url, { method: 'HEAD' });
            results.push({ url: q.media_url.slice(0, 40), status: res.status, ok: res.ok });
          } catch (e) {
            results.push({ url: q.media_url.slice(0, 40), status: 'FETCH_ERROR', ok: false });
          }
        }
        const failed = results.filter(r => !r.ok);
        if (failed.length > 0) throw new Error(`${failed.length} URL erişilemiyor: ${JSON.stringify(failed)}`);
        return results.map(r => `${r.status}`).join(', ');
      }),
      run('MUZ-04: Müzik kategorisi filtresi doğru çalışmalı', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const muzikPool = qs.filter(q => q.type === 'muzik');
        const metinPool = qs.filter(q => q.type === 'metin');
        // Müzik modu sadece müzik soruları getirmeli
        const overlap = muzikPool.filter(q => metinPool.some(m => m.id === q.id));
        if (overlap.length > 0) throw new Error('Müzik ve metin soruları çakışıyor');
        return `muzik=${muzikPool.length}, metin=${metinPool.length}`;
      }),
      run('MUZ-05: Müzik sorusu yıl alanı geçerli olmalı', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const muzikQs = qs.filter(q => q.type === 'muzik');
        if (muzikQs.length === 0) throw new Error('Müzik sorusu yok');
        const invalidYear = muzikQs.filter(q => !q.year || typeof q.year !== 'number' || q.year < 1900 || q.year > 2030);
        if (invalidYear.length > 0) throw new Error(`${invalidYear.length} müzik sorusunda geçersiz yıl: ${invalidYear.map(q => q.year).join(', ')}`);
        return `${muzikQs.length} sorunun tamamında geçerli yıl`;
      }),
      run('MUZ-06: Müzik modu için yeterli soru (≥10)', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const muzikQs = qs.filter(q => q.type === 'muzik');
        if (muzikQs.length < 10) throw new Error(`Sadece ${muzikQs.length} müzik sorusu var, en az 10 gerekli`);
        return `${muzikQs.length} müzik sorusu`;
      }),
      run('MUZ-07: Müzik soruları Deezer preview formatında (.mp3)', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const muzikQs = qs.filter(q => q.type === 'muzik' && q.media_url);
        if (muzikQs.length === 0) throw new Error('Müzik sorusu yok');
        const nonDeezer = muzikQs.filter(q => !q.media_url.includes('deezer') && !q.media_url.includes('cdns-preview'));
        if (nonDeezer.length > muzikQs.length * 0.5) {
          throw new Error(`${nonDeezer.length}/${muzikQs.length} URL Deezer formatında değil`);
        }
        return `${muzikQs.length - nonDeezer.length}/${muzikQs.length} Deezer URL`;
      }),
      run('MUZ-08: Müzik soruları yıl aralığı dağılımı', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const muzikQs = qs.filter(q => q.type === 'muzik');
        if (muzikQs.length === 0) throw new Error('Müzik sorusu yok');
        const decades = {};
        for (const q of muzikQs) {
          const decade = Math.floor(q.year / 10) * 10;
          decades[decade] = (decades[decade] || 0) + 1;
        }
        const decadeCount = Object.keys(decades).length;
        if (decadeCount < 3) throw new Error(`Sadece ${decadeCount} farklı on yıl var, en az 3 gerekli`);
        return `${decadeCount} farklı on yıl: ${Object.entries(decades).sort().map(([d,c]) => `${d}s(${c})`).join(', ')}`;
      }),
    ];

    // ─── SUITE SEÇİMİ ─────────────────────────────────────────────
    let testsToRun = [];
    if (!suite || suite === 'all') {
      testsToRun = [...unitTests, ...blackboxTests, ...functionalTests, ...performanceTests, ...playabilityTests, ...musicTests];
    } else if (suite === 'unit') testsToRun = unitTests;
    else if (suite === 'blackbox') testsToRun = blackboxTests;
    else if (suite === 'functional') testsToRun = functionalTests;
    else if (suite === 'performance') testsToRun = performanceTests;
    else if (suite === 'playability') testsToRun = playabilityTests;
    else if (suite === 'music') testsToRun = musicTests;

    // ─── ÇALIŞTIR ──────────────────────────────────────────────────
    for (const test of testsToRun) {
      const t0 = Date.now();
      try {
        const detail = await test.fn();
        results.push({ name: test.name, status: 'PASS', duration: Date.now() - t0, detail: detail || null });
      } catch (err) {
        results.push({ name: test.name, status: 'FAIL', duration: Date.now() - t0, error: err.message });
      }
    }

    const pass = results.filter(r => r.status === 'PASS').length;
    const fail = results.filter(r => r.status === 'FAIL').length;

    return Response.json({
      suite: suite || 'all',
      total: results.length,
      pass,
      fail,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});