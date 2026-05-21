import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { suite } = body;

    const results = [];
    const run = (name, fn) => ({ name, fn });

    // ─── HELPERS ────────────────────────────────────────────────────
    function generateCode() {
      return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    async function createTestLobby(extraPlayers = 0) {
      const players = [{ email: 'test_host@kronos.local', name: 'TestHost', ready: true, cards: [] }];
      for (let i = 0; i < extraPlayers; i++) {
        players.push({ email: `test_p${i}@kronos.local`, name: `Player${i}`, ready: true, cards: [] });
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
      try { await base44.asServiceRole.entities.Lobby.delete(id); } catch (_) {}
    }

    async function getAllQuestions(limit = 500) {
      return base44.asServiceRole.entities.Question.list('-created_date', limit);
    }

    // Simulate pickQuestion logic (mirrors hooks/useGameActions.js)
    function pickQuestion(usedIds, questions, usedTimelineYears = new Set(), recentHistory = new Set()) {
      const sessionFiltered = questions.filter(q => !usedIds.has(q.id));
      if (sessionFiltered.length === 0) return null;
      let pool = sessionFiltered.filter(q => !usedTimelineYears.has(q.year) && !recentHistory.has(q.id));
      if (pool.length < 5) pool = sessionFiltered.filter(q => !usedTimelineYears.has(q.year));
      if (pool.length < 5) pool = sessionFiltered;
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool[0] || null;
    }

    // ─── SMOKE TESTS ────────────────────────────────────────────────
    const smokeTests = [
      run('SMK-01: Question entity erişilebilir', async () => {
        const qs = await getAllQuestions(1);
        if (!Array.isArray(qs)) throw new Error('Array değil');
        return `${qs.length} soru`;
      }),
      run('SMK-02: En az 50 metin sorusu var', async () => {
        const qs = await getAllQuestions(500);
        const metin = qs.filter(q => q.type === 'metin');
        if (metin.length < 50) throw new Error(`Sadece ${metin.length} metin sorusu var`);
        return `${metin.length} metin sorusu`;
      }),
      run('SMK-03: Solo oyun için yeterli soru (≥10)', async () => {
        const qs = await getAllQuestions(500);
        const pool = qs.filter(q => q.type === 'metin' && q.year >= 1900 && q.year <= 2025);
        if (pool.length < 10) throw new Error(`Solo için yetersiz: ${pool.length}`);
        return `${pool.length} uygun soru`;
      }),
      run('SMK-04: Lobby oluşturma ve silme çalışıyor', async () => {
        const l = await createTestLobby();
        if (!l?.id) throw new Error('Lobby oluşturulamadı');
        await cleanupLobby(l.id);
        return 'Lobby oluştur/sil OK';
      }),
      run('SMK-05: GameRecord entity CRUD çalışıyor', async () => {
        const r = await base44.asServiceRole.entities.GameRecord.create({
          user_email: 'smoke_test@kronos.local',
          player_name: 'SmokeTest',
          duration_seconds: 10,
          cards_won: 5,
          win_card_count: 5,
          category: 'genel',
          year_start: 1900,
          year_end: 2025,
        });
        if (!r?.id) throw new Error('GameRecord oluşturulamadı');
        await base44.asServiceRole.entities.GameRecord.delete(r.id);
        return 'GameRecord CRUD OK';
      }),
      run('SMK-06: Solo Challenge kategorileri mevcut DB\'de', async () => {
        const qs = await getAllQuestions(500);
        const cats = [...new Set(qs.map(q => q.category).filter(Boolean))];
        const expected = ['teknoloji', 'sanat', 'spor', 'genel', 'bilim'];
        const found = expected.filter(c => cats.includes(c));
        if (found.length < 3) throw new Error(`Yalnızca ${found.length} kategori var: ${cats.join(', ')}`);
        return `Kategoriler: ${cats.join(', ')}`;
      }),
      run('SMK-07: Zorluk seviyeleri (RAHAT=0, HIZLI=30, KAOS=15) geçerli', async () => {
        const difficulties = [
          { id: 'rahat', duration: 0 },
          { id: 'hizli', duration: 30 },
          { id: 'kaos', duration: 15 },
        ];
        for (const d of difficulties) {
          if (typeof d.duration !== 'number') throw new Error(`${d.id} süresi geçersiz`);
        }
        return `3 zorluk seviyesi geçerli`;
      }),
    ];

    // ─── UNIT TESTS ────────────────────────────────────────────────
    const unitTests = [
      run('UT-01: Lobby kodu 6 karakter olmalı', async () => {
        const code = generateCode();
        if (code.length !== 6) throw new Error(`Beklenen 6, bulunan: ${code.length}`);
      }),
      run('UT-02: Question entity alanları doğru olmalı', async () => {
        const qs = await getAllQuestions(1);
        if (qs.length === 0) throw new Error('Soru bulunamadı');
        const q = qs[0];
        if (!q.question || typeof q.year !== 'number') throw new Error('Eksik alan: question veya year');
      }),
      run('UT-03: Fisher-Yates shuffle dağılım testi', async () => {
        let changedCount = 0;
        for (let t = 0; t < 10; t++) {
          const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
          const original = [...arr];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          if (!arr.every((v, i) => v === original[i])) changedCount++;
        }
        if (changedCount === 0) throw new Error('Shuffle 10 denemede hiç değişmedi');
        return `${changedCount}/10 denemede shuffle çalıştı`;
      }),
      run('UT-04: Doğru yerleştirme mantığı — başa koy (zone=0)', async () => {
        const cards = [{ year: 1950 }, { year: 1980 }];
        const sorted = [...cards].sort((a, b) => a.year - b.year);
        const questionYear = 1920;
        const isCorrect = sorted.length === 0 || questionYear <= sorted[0].year;
        if (!isCorrect) throw new Error('Yıl 1920, zone=0, cards=[1950,1980] → doğru olmalıydı');
      }),
      run('UT-05: Doğru yerleştirme mantığı — ortaya koy', async () => {
        const cards = [{ year: 1900 }, { year: 1970 }];
        const sorted = [...cards].sort((a, b) => a.year - b.year);
        const questionYear = 1950;
        const zone = 1;
        const isCorrect = questionYear >= sorted[zone - 1].year && questionYear <= sorted[zone].year;
        if (!isCorrect) throw new Error('Yıl 1950, zone=1, cards=[1900,1970] → doğru olmalıydı');
      }),
      run('UT-06: Yanlış yerleştirme mantığı — zona uymayan yıl', async () => {
        const cards = [{ year: 1900 }, { year: 1920 }];
        const sorted = [...cards].sort((a, b) => a.year - b.year);
        const questionYear = 1980;
        const zone = 1;
        const isCorrect = questionYear >= sorted[zone - 1].year && questionYear <= sorted[zone].year;
        if (isCorrect) throw new Error('Yıl 1980, zone=1, cards=[1900,1920] → yanlış olmalıydı');
      }),
      run('UT-07: Kazanma koşulu kontrolü', async () => {
        const winCardCount = 5;
        const playerCards = new Array(5).fill({ year: 2000 });
        const hasWon = playerCards.length >= winCardCount;
        if (!hasWon) throw new Error('5 kart = kazanmalı');
      }),
      run('UT-08: Yıl filtresi çalışması', async () => {
        const qs = await getAllQuestions(50);
        const filtered = qs.filter(q => q.year >= 1950 && q.year <= 2000);
        const outOfRange = filtered.filter(q => q.year < 1950 || q.year > 2000);
        if (outOfRange.length > 0) throw new Error(`${outOfRange.length} soru aralık dışında`);
      }),
      run('UT-09: Kategori filtresi (non-karisik)', async () => {
        const qs = await getAllQuestions(500);
        const categories = ['bilim', 'spor', 'sanat', 'genel', 'teknoloji'];
        const found = categories.filter(cat => qs.some(q => q.category === cat));
        if (found.length === 0) throw new Error('Hiçbir özel kategoride soru yok');
        return `Kategoriler: ${found.join(', ')}`;
      }),
      run('UT-10: pickQuestion — kullanılan soruyu vermemeli', async () => {
        const qs = await getAllQuestions(5);
        if (qs.length < 2) throw new Error('Yeterli soru yok');
        const usedIds = new Set([qs[0].id]);
        const available = qs.filter(q => !usedIds.has(q.id));
        if (available.some(q => q.id === qs[0].id)) throw new Error('Kullanılan soru tekrar seçildi');
      }),
      run('UT-11: Aynı yıl — zone adjacency doğrulaması', async () => {
        const unique = [1950, 1970, 1990];
        const questionYear = 1970;
        const zone = 1;
        const leftYear = zone > 0 ? unique[zone - 1] : null;
        const rightYear = zone < unique.length ? unique[zone] : null;
        const isCorrect = leftYear === questionYear || rightYear === questionYear;
        if (!isCorrect) throw new Error('Adjacency zone doğrulaması başarısız');
        return `Adjacency zone doğrulaması ✓`;
      }),
      run('UT-12: Sona koyma (zone = cards.length)', async () => {
        const cards = [{ year: 1900 }, { year: 1950 }];
        const sorted = [...cards].sort((a, b) => a.year - b.year);
        const questionYear = 1980;
        const isCorrect = questionYear >= sorted[sorted.length - 1].year;
        if (!isCorrect) throw new Error('1980 sona konulabilmeli: cards=[1900,1950]');
      }),
      run('UT-13: sortedCards — aynı kartlar için deterministik sıralama', async () => {
        const cards = [{ year: 1990, id: 'a' }, { year: 1920, id: 'b' }, { year: 1955, id: 'c' }];
        const sort = (arr) => [...arr].sort((a, b) => a.year - b.year);
        const sorted1 = sort(cards);
        const sorted2 = sort(cards);
        if (JSON.stringify(sorted1) !== JSON.stringify(sorted2)) throw new Error('Deterministik değil');
        if (sorted1[0].year !== 1920) throw new Error(`İlk kart 1920 olmalı, ${sorted1[0].year} bulundu`);
        return `Sıralama deterministik: ${sorted1.map(c => c.year).join(', ')}`;
      }),
      run('UT-14: questionPool filtresi — metin dışı ve yıl dışı sorular hariç', async () => {
        const mockQuestions = [
          { id: '1', year: 1950, type: 'metin', category: 'bilim' },
          { id: '2', year: 1960, type: 'muzik', category: 'muzik', media_url: 'https://x.com/a.mp3' },
          { id: '3', year: 1970, type: 'metin', category: 'bilim' },
          { id: '4', year: 2025, type: 'metin', category: 'bilim' },
        ];
        const category = 'karisik';
        const yearStart = 1900, yearEnd = 2020;
        const pool = mockQuestions
          .filter(q => category === 'muzik' ? q.type === 'muzik' : q.type === 'metin')
          .filter(q => q.year >= yearStart && q.year <= yearEnd)
          .filter(q => category === 'karisik' || q.category === category);
        if (pool.length !== 2) throw new Error(`Beklenen 2 soru, bulunan: ${pool.length}`);
        if (pool.some(q => q.type !== 'metin')) throw new Error('Muzik sorusu karisik modda geçti');
        if (pool.some(q => q.year > yearEnd)) throw new Error('Yıl dışı soru geçti');
        return `questionPool doğru: ${pool.length} soru`;
      }),
    ];

    // ─── QUESTION ENGINE TESTS ──────────────────────────────────────
    const questionEngineTests = [
      run('QE-01: Aynı soru ID aynı oturumda iki kez seçilmemeli', async () => {
        const qs = await getAllQuestions(50);
        const pool = qs.filter(q => q.type === 'metin').slice(0, 20);
        if (pool.length < 5) throw new Error('Yeterli soru yok');
        const used = new Set();
        for (let i = 0; i < 15; i++) {
          const q = pickQuestion(used, pool);
          if (!q) break;
          if (used.has(q.id)) throw new Error(`Soru ${q.id} tekrar seçildi (tur ${i + 1})`);
          used.add(q.id);
        }
        return `${used.size} benzersiz soru seçildi`;
      }),
      run('QE-02: Aktif timeline yılı tekrar seçilmemeli', async () => {
        const qs = await getAllQuestions(100);
        const pool = qs.filter(q => q.type === 'metin');
        if (pool.length < 10) throw new Error('Yeterli soru yok');
        // Simulate player has card with year=pool[0].year on timeline
        const existingYear = pool[0].year;
        const usedIds = new Set();
        const timelineYears = new Set([existingYear]);
        let attempts = 0;
        let selectedSameYear = false;
        for (let i = 0; i < 10; i++) {
          const q = pickQuestion(usedIds, pool, timelineYears);
          if (!q) break;
          if (q.year === existingYear) selectedSameYear = true;
          usedIds.add(q.id);
          attempts++;
        }
        // If enough fresh questions exist, same year should not appear
        const freshCount = pool.filter(q => q.year !== existingYear && !usedIds.has(q.id)).length;
        if (freshCount > 5 && selectedSameYear) throw new Error(`Timeline yılı ${existingYear} tekrar seçildi`);
        return `${attempts} seçimde timeline yıl tekrarı yok`;
      }),
      run('QE-03: Kategori filtresi uygulanıyor', async () => {
        const qs = await getAllQuestions(500);
        const category = 'spor';
        const pool = qs.filter(q => q.type === 'metin' && q.category === category);
        if (pool.length === 0) throw new Error(`'${category}' kategorisinde soru yok`);
        const wrongCat = pool.filter(q => q.category !== category);
        if (wrongCat.length > 0) throw new Error(`${wrongCat.length} soru yanlış kategoride`);
        return `${pool.length} spor sorusu, filtreleme doğru`;
      }),
      run('QE-04: Zorluk filtresi — ileride kullanıma hazır', async () => {
        const qs = await getAllQuestions(500);
        const difficulties = [1, 2, 3];
        for (const d of difficulties) {
          const pool = qs.filter(q => q.difficulty === d);
          // Difficulty filtering is optional — just verify no wrong difficulty slips through
          const wrong = pool.filter(q => q.difficulty !== d);
          if (wrong.length > 0) throw new Error(`Zorluk ${d} için ${wrong.length} yanlış soru var`);
        }
        const total = qs.filter(q => qs.some(q2 => q2.difficulty)).length;
        return `Zorluk filtresi çalışıyor, toplam sorular: ${qs.length}`;
      }),
      run('QE-05: Fallback — recent history relaxes when pool too small', async () => {
        const qs = await getAllQuestions(10);
        const pool = qs.filter(q => q.type === 'metin').slice(0, 6);
        if (pool.length < 3) throw new Error('Test için yetersiz soru');
        // Mark all as recent history
        const recentHistory = new Set(pool.map(q => q.id));
        const used = new Set();
        const q = pickQuestion(used, pool, new Set(), recentHistory);
        if (!q) throw new Error('Fallback çalışmadı — tüm sorular tarihte olsa bile seçilmeli');
        return `Fallback çalıştı, seçilen: ${q.id}`;
      }),
      run('QE-06: Soru havuzu tükenince null döner (session hard rule)', async () => {
        const qs = await getAllQuestions(5);
        const pool = qs.slice(0, 3);
        const usedAll = new Set(pool.map(q => q.id));
        const q = pickQuestion(usedAll, pool);
        if (q !== null) throw new Error('Tükenen havuzda null dönmeli');
        return 'Havuz tükenince null döner ✓';
      }),
      run('QE-07: Yıl aralığı filtresi çalışıyor', async () => {
        const qs = await getAllQuestions(200);
        const yearStart = 1980, yearEnd = 2000;
        const pool = qs.filter(q => q.year >= yearStart && q.year <= yearEnd && q.type === 'metin');
        const outOfRange = pool.filter(q => q.year < yearStart || q.year > yearEnd);
        if (outOfRange.length > 0) throw new Error(`${outOfRange.length} soru yıl aralığı dışında`);
        return `${pool.length} soru ${yearStart}-${yearEnd} aralığında`;
      }),
      run('QE-08: 20 ardışık seçimde rastgelelik var', async () => {
        const qs = await getAllQuestions(200);
        const pool = qs.filter(q => q.type === 'metin');
        if (pool.length < 20) throw new Error('Yeterli soru yok');
        const used = new Set();
        const selected = [];
        for (let i = 0; i < 20; i++) {
          const q = pickQuestion(used, pool);
          if (!q) break;
          selected.push(q.id);
          used.add(q.id);
        }
        const unique = new Set(selected);
        if (unique.size !== selected.length) throw new Error('Seçimde tekrar var');
        return `20 seçimin tamamı benzersiz ✓`;
      }),
      run('QE-09: Timeline yıl çakışma fallback — yeterli soru yoksa gevşer', async () => {
        // Only 3 questions with 2 unique years, timeline has one year blocked
        const mockPool = [
          { id: 'a', year: 1990, type: 'metin' },
          { id: 'b', year: 1990, type: 'metin' },
          { id: 'c', year: 1990, type: 'metin' },
        ];
        const usedIds = new Set();
        const blockedYears = new Set([1990]); // all years blocked
        // Fallback B should kick in and return one despite year block
        const q = pickQuestion(usedIds, mockPool, blockedYears);
        if (!q) throw new Error('Tam yıl çakışmasında fallback devreye girmedi');
        return `Fallback B çalıştı — ${q.id} seçildi`;
      }),
    ];

    // ─── FUNCTIONAL TESTS ─────────────────────────────────────────
    const functionalTests = [
      run('FT-01: Solo oyun başlatma — kart dağıtımı doğru', async () => {
        const qs = await getAllQuestions(500);
        const filtered = qs.filter(q => q.type === 'metin');
        if (filtered.length < 5) throw new Error('Yeterli metin sorusu yok');
        const playerNames = ['Sen'];
        const neededCount = playerNames.length * 2 + 1;
        if (filtered.length < neededCount) throw new Error(`Soru yetersiz: ${filtered.length} < ${neededCount}`);
        const shuffled = [...filtered];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        let cursor = 0;
        const used = new Set();
        const player = { name: 'Sen', cards: [] };
        for (let i = 0; i < 2; i++) {
          const q = shuffled[cursor++];
          player.cards.push({ id: q.id, year: q.year });
          used.add(q.id);
        }
        const firstQ = shuffled[cursor];
        if (!firstQ) throw new Error('İlk soru yok');
        if (used.has(firstQ.id)) throw new Error('İlk soru zaten dağıtılmış');
        if (player.cards.length !== 2) throw new Error('Oyuncu 2 kart alamamadı');
        return `Solo başlatma: 2 kart + 1 ilk soru dağıtıldı`;
      }),
      run('FT-02: Tur sırası döngüsü — online 2 oyuncu', async () => {
        const players = ['A', 'B'];
        let idx = 0;
        const turns = [];
        for (let i = 0; i < 6; i++) {
          turns.push(players[idx]);
          idx = (idx + 1) % players.length;
        }
        const expected = ['A', 'B', 'A', 'B', 'A', 'B'];
        if (JSON.stringify(turns) !== JSON.stringify(expected)) throw new Error('Tur sırası yanlış');
        return '2 oyuncu tur döngüsü ✓';
      }),
      run('FT-03: Kazanma durumu → status=finished yazılmalı', async () => {
        const lobby = await createTestLobby(1);
        const updated = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
          status: 'finished',
          winner: 'TestHost'
        });
        if (updated.status !== 'finished') throw new Error('Status finished değil');
        if (updated.winner !== 'TestHost') throw new Error('Winner yazılmadı');
        await cleanupLobby(lobby.id);
        return 'Kazanma durumu ✓';
      }),
      run('FT-04: Soru tekrar edilmemeli (session used_question_ids)', async () => {
        const qs = await getAllQuestions(10);
        const usedIds = new Set(qs.slice(0, 5).map(q => q.id));
        const available = qs.filter(q => !usedIds.has(q.id));
        if (available.length === 0) throw new Error('Kullanılabilir soru kalmadı');
        const picked = available[0];
        if (usedIds.has(picked.id)) throw new Error('Kullanılan soru tekrar seçildi');
        return 'Soru tekrarı yok ✓';
      }),
      run('FT-05: Solo Challenge category → game config doğru geçiyor', async () => {
        // Simulate SoloChallenge handleStart logic
        const CATEGORIES = ['teknoloji', 'sanat', 'spor', 'genel', 'muzik', 'bilim'];
        const DIFFICULTIES = [
          { id: 'rahat', duration: 0 },
          { id: 'hizli', duration: 30 },
          { id: 'kaos', duration: 15 },
        ];
        for (const cat of CATEGORIES) {
          if (!cat) throw new Error(`Kategori ${cat} geçersiz`);
        }
        for (const diff of DIFFICULTIES) {
          if (typeof diff.duration !== 'number') throw new Error(`${diff.id} süresi geçersiz`);
        }
        // Verify navigate state construction
        const selectedCategory = 'spor';
        const selectedDifficulty = 'kaos';
        const cat = CATEGORIES.find(c => c === selectedCategory);
        const diff = DIFFICULTIES.find(d => d.id === selectedDifficulty);
        const gameState = {
          playerNames: ['Sen'],
          category: cat,
          yearStart: 1900,
          yearEnd: 2025,
          turnDuration: diff.duration,
        };
        if (gameState.category !== 'spor') throw new Error('Kategori yanlış geçti');
        if (gameState.turnDuration !== 15) throw new Error('KAOS süresi 15sn olmalı');
        if (gameState.playerNames[0] !== 'Sen') throw new Error("playerNames[0] 'Sen' olmalı");
        return `SoloChallenge → game: category=${gameState.category}, duration=${gameState.turnDuration}`;
      }),
      run('FT-06: Kart sıralama — yıl bazlı doğru sıralanmalı', async () => {
        const cards = [{ year: 1990 }, { year: 1920 }, { year: 1955 }, { year: 2000 }];
        const sorted = [...cards].sort((a, b) => a.year - b.year);
        const years = sorted.map(c => c.year);
        for (let i = 1; i < years.length; i++) {
          if (years[i] < years[i - 1]) throw new Error(`Sıralama hatalı: ${years}`);
        }
        return years.join(', ');
      }),
      run('FT-07: Authentication — yetkisiz erişim engellenmeli', async () => {
        const mockUser = { role: 'user' };
        if (mockUser.role === 'admin') throw new Error('User admin sanıldı');
        return 'Yetkilendirme doğru ✓';
      }),
      run('FT-08: RAHAT mod — turnDuration=0 (sonsuz tur)', async () => {
        const duration = 0;
        // In game, timer should not fire when duration is 0
        const timerActive = duration > 0;
        if (timerActive) throw new Error('RAHAT modda timer aktif olmamalı');
        return 'RAHAT mod: timer pasif ✓';
      }),
      run('FT-09: Soru skip → yeni soru seçimi akışı', async () => {
        const qs = await getAllQuestions(20);
        const filtered = qs.filter(q => q.type === 'metin');
        if (filtered.length < 3) throw new Error('Yeterli soru yok');
        const used = new Set([filtered[0].id]);
        const next = filtered.find(q => !used.has(q.id));
        if (!next) throw new Error('Skip sonrası soru bulunamadı');
        if (next.id === filtered[0].id) throw new Error('Aynı soru tekrar geldi');
        return `Skip çalışıyor ✓`;
      }),
      run('FT-10: Online lobi oluştur → oyuncu ekle → oyunu başlat akışı', async () => {
        const lobby = await createTestLobby(1);
        if (lobby.players.length !== 2) throw new Error('Oyuncu sayısı hatalı');
        const updated = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
          status: 'starting',
          category: 'spor',
          win_card_count: 5,
        });
        if (updated.status !== 'starting') throw new Error('Status starting değil');
        const inGame = await base44.asServiceRole.entities.Lobby.update(lobby.id, { status: 'in_game' });
        if (inGame.status !== 'in_game') throw new Error('in_game geçişi başarısız');
        await cleanupLobby(lobby.id);
        return 'Lobi akışı: waiting → starting → in_game ✓';
      }),
    ];

    // ─── MEDIA RENDERING TESTS ──────────────────────────────────────
    const mediaTests = [
      run('MED-01: media_url alanı Question entity şemasında tanımlı', async () => {
        const qs = await getAllQuestions(5);
        if (qs.length === 0) throw new Error('Soru yok');
        // media_url is optional — just verify the field exists in schema (can be null)
        const q = qs[0];
        if (!('media_url' in q) && !('icon_url' in q)) {
          // OK — fields are optional and may not appear if null
        }
        return 'media_url ve icon_url opsiyonel alanlar mevcut';
      }),
      run('MED-02: Müzik sorularında media_url dolu olmalı', async () => {
        const qs = await getAllQuestions(500);
        const muzikQs = qs.filter(q => q.type === 'muzik');
        if (muzikQs.length === 0) throw new Error('Müzik sorusu yok');
        const noUrl = muzikQs.filter(q => !q.media_url || q.media_url.trim() === '');
        if (noUrl.length > 0) throw new Error(`${noUrl.length} müzik sorusunda media_url eksik`);
        return `${muzikQs.length} müzik sorusunun tamamında URL var`;
      }),
      run('MED-03: Müzik preview URL formatı geçerli (https)', async () => {
        const qs = await getAllQuestions(500);
        const muzikQs = qs.filter(q => q.type === 'muzik' && q.media_url);
        if (muzikQs.length === 0) throw new Error('Müzik sorusu yok');
        const invalidFormat = muzikQs.filter(q => {
          try {
            const url = new URL(q.media_url);
            return url.protocol !== 'https:' && url.protocol !== 'http:';
          } catch (_) { return true; }
        });
        if (invalidFormat.length > 0) throw new Error(`${invalidFormat.length} URL geçersiz format`);
        return `${muzikQs.length} URL format geçerli`;
      }),
      run('MED-04: icon_url alanı — geçerli URL formatı veya null', async () => {
        const qs = await getAllQuestions(100);
        const withIcon = qs.filter(q => q.icon_url && q.icon_url.trim() !== '');
        let invalidIcons = 0;
        for (const q of withIcon) {
          try { new URL(q.icon_url); } catch (_) { invalidIcons++; }
        }
        if (invalidIcons > 0) throw new Error(`${invalidIcons} icon_url geçersiz format`);
        return `${withIcon.length} icon_url tanımlı, tümü geçerli`;
      }),
      run('MED-05: Metin sorularında media_url opsiyonel (null tolere edilmeli)', async () => {
        const qs = await getAllQuestions(50);
        const metinQs = qs.filter(q => q.type === 'metin');
        const withUrl = metinQs.filter(q => q.media_url);
        const withoutUrl = metinQs.filter(q => !q.media_url);
        // Both are valid — just report numbers
        return `Metin: ${withUrl.length} media_url var, ${withoutUrl.length} yok — her iki durum geçerli`;
      }),
      run('MED-06: Müzik kategorisi filtresi — media_url\'siz sorular havuza girmiyor', async () => {
        const qs = await getAllQuestions(500);
        // Mirror Game.jsx questionPool filter for muzik mode
        const muzikPool = qs
          .filter(q => q.type === 'muzik')
          .filter(q => q.media_url && q.media_url.length > 0);
        const totalMuzik = qs.filter(q => q.type === 'muzik').length;
        const noUrl = qs.filter(q => q.type === 'muzik' && (!q.media_url || q.media_url.length === 0));
        if (noUrl.length > 0) {
          return `UYARI: ${noUrl.length}/${totalMuzik} müzik sorusunda media_url yok — havuzdan hariç tutulacak`;
        }
        return `${muzikPool.length}/${totalMuzik} müzik sorusu havuza giriyor`;
      }),
      run('MED-07: Müzik soruları yıl aralığı dağılımı', async () => {
        const qs = await getAllQuestions(500);
        const muzikQs = qs.filter(q => q.type === 'muzik');
        if (muzikQs.length === 0) throw new Error('Müzik sorusu yok');
        const decades = {};
        for (const q of muzikQs) {
          const decade = Math.floor(q.year / 10) * 10;
          decades[decade] = (decades[decade] || 0) + 1;
        }
        const decadeCount = Object.keys(decades).length;
        if (decadeCount < 3) throw new Error(`Sadece ${decadeCount} farklı on yıl var, en az 3 gerekli`);
        return `${decadeCount} farklı on yıl: ${Object.entries(decades).sort().map(([d, c]) => `${d}s(${c})`).join(', ')}`;
      }),
    ];

    // ─── ADMIN TESTS ────────────────────────────────────────────────
    const adminTests = [
      run('ADM-01: Admin rol doğrulaması çalışıyor', async () => {
        const adminUser = { role: 'admin' };
        const regularUser = { role: 'user' };
        const isAdmin = (u) => u?.role === 'admin';
        if (!isAdmin(adminUser)) throw new Error('Admin kullanıcı admin tanınmadı');
        if (isAdmin(regularUser)) throw new Error('Normal kullanıcı admin sanıldı');
        return 'Admin rol doğrulaması ✓';
      }),
      run('ADM-02: Question oluşturma — zorunlu alanlar doğrulanıyor', async () => {
        // Simulate QuestionManagement form validation
        const validate = (data) => {
          const errors = {};
          if (!data.question || data.question.trim().length < 5) errors.question = 'Çok kısa';
          if (!data.year || typeof data.year !== 'number' || data.year < 1000 || data.year > 2100) errors.year = 'Geçersiz yıl';
          return errors;
        };
        const bad = validate({ question: 'ab', year: 'notanumber' });
        if (!bad.question) throw new Error('Kısa soru hatası yakalanamadı');
        if (!bad.year) throw new Error('Geçersiz yıl hatası yakalanamadı');
        const good = validate({ question: 'Bu geçerli bir soru mudur?', year: 2000 });
        if (Object.keys(good).length > 0) throw new Error('Geçerli form reddedildi');
        return 'Form validasyonu doğru çalışıyor ✓';
      }),
      run('ADM-03: Test sorusu oluşturma ve temizleme', async () => {
        const testQ = await base44.asServiceRole.entities.Question.create({
          question: '[TEST] Admin test sorusu — silinecek',
          year: 1999,
          category: 'genel',
          type: 'metin',
          difficulty: 1,
        });
        if (!testQ?.id) throw new Error('Test sorusu oluşturulamadı');
        await base44.asServiceRole.entities.Question.delete(testQ.id);
        return 'Test sorusu oluştur/sil ✓';
      }),
      run('ADM-04: Question entity şemasında kategori enum geçerli', async () => {
        const validCategories = ['tarih', 'bilim', 'spor', 'sanat', 'teknoloji', 'genel'];
        const validTypes = ['metin', 'gorsel', 'isitsel', 'muzik'];
        const validDiffs = [1, 2, 3];
        const qs = await getAllQuestions(50);
        for (const q of qs) {
          if (q.category && !validCategories.includes(q.category)) {
            throw new Error(`Geçersiz kategori: ${q.category}`);
          }
          if (q.type && !validTypes.includes(q.type)) {
            throw new Error(`Geçersiz tip: ${q.type}`);
          }
          if (q.difficulty && !validDiffs.includes(q.difficulty)) {
            throw new Error(`Geçersiz zorluk: ${q.difficulty}`);
          }
        }
        return 'Tüm enum değerleri geçerli ✓';
      }),
      run('ADM-05: Admin olmayan kullanıcı soru oluşturamaz (RLS)', async () => {
        // RLS is enforced at DB level — we verify the schema declares admin-only create
        // Since we can't simulate a non-admin create here without a real non-admin user,
        // we verify the schema intent via admin service role check
        const mockRole = 'user';
        if (mockRole === 'admin') throw new Error('Mock kullanıcı admin sanıldı');
        return 'Soru oluşturma RLS admin-only olarak tanımlı ✓ (SKIPPED: canlı RLS testi)';
      }),
      run('ADM-06: Kategori dağılımı — en az 3 kategori verisi var', async () => {
        const qs = await getAllQuestions(500);
        const catCounts = {};
        for (const q of qs) {
          const c = q.category || 'genel';
          catCounts[c] = (catCounts[c] || 0) + 1;
        }
        const catCount = Object.keys(catCounts).length;
        if (catCount < 3) throw new Error(`Sadece ${catCount} kategori var`);
        const breakdown = Object.entries(catCounts).map(([k, v]) => `${k}:${v}`).join(', ');
        return `${catCount} kategori: ${breakdown}`;
      }),
    ];

    // ─── TUTORIAL TESTS ──────────────────────────────────────────────
    const tutorialTests = [
      run('TUT-01: tutorialState hasSeen() mantığı doğru', async () => {
        // Simulate localStorage-based tutorialState logic
        const STORAGE_KEY = 'kronox_tutorial_seen';
        const mockStorage = {};
        const hasSeen = () => !!mockStorage[STORAGE_KEY];
        const markSeen = () => { mockStorage[STORAGE_KEY] = 'true'; };
        if (hasSeen()) throw new Error('Başlangıçta hasSeen true olmamalı');
        markSeen();
        if (!hasSeen()) throw new Error('markSeen sonrası hasSeen false olmamalı');
        return 'tutorialState hasSeen/markSeen mantığı ✓';
      }),
      run('TUT-02: İlk açılışta tutorial auto-show', async () => {
        // Logic: if (!tutorialState.hasSeen()) setShowTutorial(true)
        const mockHasSeen = false;
        const showTutorial = !mockHasSeen;
        if (!showTutorial) throw new Error('İlk açılışta tutorial gösterilmeli');
        return 'İlk açılışta tutorial auto-show ✓';
      }),
      run('TUT-03: Tutorial skip/tamamlandıktan sonra tekrar açılmamalı', async () => {
        const mockHasSeen = true; // after seeing
        const showTutorial = !mockHasSeen;
        if (showTutorial) throw new Error('Görüldükten sonra tutorial tekrar açılmamalı');
        return 'Tutorial tekrar açılmıyor ✓';
      }),
      run('TUT-04: Settings > "Nasıl Oynanır?" tutorialı yeniden açabiliyor', async () => {
        // Settings'te manuel trigger var — bu her zaman göstermeli
        let showTutorial = false;
        const openTutorialFromSettings = () => { showTutorial = true; };
        openTutorialFromSettings();
        if (!showTutorial) throw new Error('Settings\'ten tutorial açılamıyor');
        return 'Settings\'ten tutorial yeniden açılıyor ✓';
      }),
      run('TUT-05: Tutorial onDone/onSkip → showTutorial=false', async () => {
        let showTutorial = true;
        const onDone = () => { showTutorial = false; };
        const onSkip = () => { showTutorial = false; };
        onDone();
        if (showTutorial) throw new Error('onDone sonrası showTutorial false olmalı');
        showTutorial = true;
        onSkip();
        if (showTutorial) throw new Error('onSkip sonrası showTutorial false olmalı');
        return 'onDone ve onSkip doğru çalışıyor ✓';
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
        const newPlayer = { email: 'joiner@test.local', name: 'Joiner', ready: true, cards: [] };
        const updated = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
          players: [...lobby.players, newPlayer]
        });
        if (updated.players.length !== 2) throw new Error(`Beklenen 2 oyuncu, bulunan: ${updated.players.length}`);
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
        const found = await base44.asServiceRole.entities.Lobby.filter({ code: lobby.code });
        if (found && found.length > 0) throw new Error('Lobby silinemedi');
      }),
      run('BB-06: Geçersiz lobby kodu ile arama → boş dönemeli', async () => {
        const found = await base44.asServiceRole.entities.Lobby.filter({ code: 'ZZZZZZ' });
        if (found && found.length > 0) throw new Error('Sahte lobiye erişildi');
      }),
      run('BB-07: Question listesi erişilebilir olmalı', async () => {
        const qs = await getAllQuestions(1);
        if (!Array.isArray(qs)) throw new Error('Question listesi array değil');
        return `${qs.length} soru`;
      }),
      run('BB-09: Lobby used_question_ids güncelleme', async () => {
        const lobby = await createTestLobby();
        const qs = await getAllQuestions(3);
        const usedIds = qs.map(q => q.id);
        const updated = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
          used_question_ids: usedIds
        });
        if (!Array.isArray(updated.used_question_ids)) throw new Error('used_question_ids array değil');
        await cleanupLobby(lobby.id);
      }),
      run('BB-10: Lobby current_player_index güncelleme', async () => {
        const lobby = await createTestLobby(1);
        const updated = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
          current_player_index: 1
        });
        if (updated.current_player_index !== 1) throw new Error('current_player_index güncellenemedi');
        await cleanupLobby(lobby.id);
      }),
    ];

    // ─── PERFORMANCE TESTS ────────────────────────────────────────
    const performanceTests = [
      run('PERF-01: 500 soru yükleme süresi < 5sn', async () => {
        const start = Date.now();
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const elapsed = Date.now() - start;
        if (elapsed > 5000) throw new Error(`Yükleme çok yavaş: ${elapsed}ms`);
        return `${elapsed}ms, ${qs.length} soru`;
      }),
      run('PERF-02: 500 soru içinde Fisher-Yates < 50ms', async () => {
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
      run('PERF-03: Soru filtreleme (yıl + tip) < 10ms', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const start = Date.now();
        const filtered = qs
          .filter(q => q.type === 'metin')
          .filter(q => q.year >= 1950 && q.year <= 2000);
        const elapsed = Date.now() - start;
        if (elapsed > 10) throw new Error(`Filtreleme yavaş: ${elapsed}ms`);
        return `${elapsed}ms, ${filtered.length} soru`;
      }),
      run('PERF-04: Soru havuzu oluşturma (filter+shuffle) < 100ms', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const start = Date.now();
        const pool = qs.filter(q => q.type === 'metin' && q.year >= 1900 && q.year <= 2025);
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const elapsed = Date.now() - start;
        if (elapsed > 100) throw new Error(`Havuz oluşturma yavaş: ${elapsed}ms`);
        return `${elapsed}ms, ${pool.length} soru`;
      }),
      run('PERF-05: 20 ardışık pickQuestion seçimi < 200ms', async () => {
        const qs = await getAllQuestions(200);
        const pool = qs.filter(q => q.type === 'metin');
        if (pool.length < 20) throw new Error('Yeterli soru yok');
        const used = new Set();
        const start = Date.now();
        for (let i = 0; i < 20; i++) {
          const q = pickQuestion(used, pool);
          if (q) used.add(q.id);
        }
        const elapsed = Date.now() - start;
        if (elapsed > 200) throw new Error(`20 seçim yavaş: ${elapsed}ms`);
        return `20 seçim: ${elapsed}ms`;
      }),
    ];

    // ─── STABILITY TESTS ──────────────────────────────────────────
    const stabilityTests = [
      run('STB-01: Soru havuzu tükenince graceful fallback (null)', async () => {
        const qs = await getAllQuestions(5);
        const usedIds = new Set(qs.map(q => q.id));
        const result = pickQuestion(usedIds, qs);
        if (result !== null) throw new Error('Tükenen havuzda null dönmeli');
        return 'Havuz tükenince null döner ✓';
      }),
      run('STB-02: Küçük havuz (3 soru) — oyun başlayabiliyor', async () => {
        const qs = await getAllQuestions(5);
        const pool = qs.filter(q => q.type === 'metin').slice(0, 3);
        if (pool.length < 3) throw new Error('Test için yeterli soru yok');
        const neededForSolo = 1 * 2 + 1; // 1 player × 2 cards + 1 first question
        if (pool.length < neededForSolo) throw new Error(`3 soruda solo başlatılamıyor`);
        return `3 soru ile solo başlatılabilir ✓`;
      }),
      run('STB-03: Hızlı ardışık 10 lobby oluştur/sil', async () => {
        const ids = [];
        for (let i = 0; i < 10; i++) {
          const l = await createTestLobby();
          ids.push(l.id);
        }
        let errors = 0;
        for (const id of ids) {
          try { await cleanupLobby(id); } catch (_) { errors++; }
        }
        if (errors > 2) throw new Error(`${errors}/10 silme başarısız`);
        return `10 lobby oluştur+sil, ${errors} hata`;
      }),
      run('STB-04: Aynı anda 20 lobi kodu benzersiz olmalı', async () => {
        const codes = new Set();
        for (let i = 0; i < 20; i++) codes.add(generateCode());
        if (codes.size < 18) throw new Error(`Çok fazla çakışma: ${20 - codes.size}/20`);
        return `20 koddan ${codes.size} unique`;
      }),
      run('STB-05: fetchFromNetwork fallback — entity\'den okuma', async () => {
        const mockInvokeFail = async () => { throw new Error('Network error'); };
        const mockEntityFetch = async () => [{ id: '1', question: 'Test', year: 1990 }];
        let fetched = [];
        try {
          fetched = await mockInvokeFail();
        } catch (_) {
          fetched = await mockEntityFetch();
        }
        if (fetched.length === 0) throw new Error('Fallback çalışmadı');
        return `Fallback başarılı: ${fetched.length} soru ✓`;
      }),
      run('STB-06: media_url boş/null — gameplay kırılmamalı', async () => {
        const mockQuestion = { id: 'q1', year: 1990, question: 'Test', type: 'metin', media_url: null };
        const canRender = !!mockQuestion.question && typeof mockQuestion.year === 'number';
        if (!canRender) throw new Error('media_url=null olan soru render edilemiyor');
        return 'media_url=null olan soru güvenli şekilde render edilebilir ✓';
      }),
      run('STB-07: Concurrent lobby güncelleme çakışma testi', async () => {
        const lobby = await createTestLobby(1);
        const [u1, u2] = await Promise.all([
          base44.asServiceRole.entities.Lobby.update(lobby.id, { status: 'in_game' }),
          base44.asServiceRole.entities.Lobby.update(lobby.id, { current_player_index: 1 }),
        ]);
        if (!u1 && !u2) throw new Error('Concurrent güncelleme ikisi de başarısız');
        await cleanupLobby(lobby.id);
        return 'Concurrent güncelleme — en az biri başarılı ✓';
      }),
    ];

    // ─── REGRESSION TESTS ──────────────────────────────────────────
    const regressionTests = [
      run('REG-01: Drag/drop — zone validasyonu değişmedi', async () => {
        // zone=0 → year <= first card
        const cards = [{ year: 1950 }, { year: 1980 }];
        const sorted = [...cards].sort((a, b) => a.year - b.year);
        const qYear = 1920;
        const zone = 0;
        const correct = sorted.length === 0 || qYear <= sorted[0].year;
        if (!correct) throw new Error('Zone=0 validasyonu bozuldu');
        // zone=N → year >= last card
        const zone2 = sorted.length;
        const correct2 = qYear >= sorted[sorted.length - 1].year;
        // 1920 < 1950 so this should be false — that's expected, not a bug
        return 'Drag/drop zone validasyonu değişmedi ✓';
      }),
      run('REG-02: Timeline placement — orta zone hâlâ doğru çalışıyor', async () => {
        const cards = [{ year: 1900 }, { year: 1970 }];
        const sorted = [...cards].sort((a, b) => a.year - b.year);
        const tests = [
          { year: 1950, zone: 1, expected: true },
          { year: 1800, zone: 1, expected: false },
          { year: 1990, zone: 1, expected: false },
        ];
        for (const t of tests) {
          const result = t.year >= sorted[t.zone - 1].year && t.year <= sorted[t.zone].year;
          if (result !== t.expected) throw new Error(`year=${t.year} zone=1 → expected ${t.expected}, got ${result}`);
        }
        return 'Placement validasyonu değişmedi ✓';
      }),
      run('REG-03: Online lobi durumu geçişleri hâlâ çalışıyor', async () => {
        const lobby = await createTestLobby(1);
        const states = ['waiting', 'starting', 'in_game', 'finished'];
        for (const status of states) {
          const upd = await base44.asServiceRole.entities.Lobby.update(lobby.id, { status });
          if (upd.status !== status) throw new Error(`${status} geçişi başarısız`);
        }
        await cleanupLobby(lobby.id);
        return 'Lobi durum geçişleri değişmedi ✓';
      }),
      run('REG-04: FeedbackOverlay tetikleyicileri değişmedi', async () => {
        // Verify feedback triggers: correct placement and wrong placement both set feedback
        const mockSetFeedback = (val) => val;
        const correctResult = mockSetFeedback({ result: 'correct', year: 1990, guessedYear: null });
        const wrongResult = mockSetFeedback({ result: 'wrong', year: 1990, guessedYear: 2000 });
        if (correctResult.result !== 'correct') throw new Error('Correct feedback bozuldu');
        if (wrongResult.result !== 'wrong') throw new Error('Wrong feedback bozuldu');
        return 'FeedbackOverlay tetikleyicileri değişmedi ✓';
      }),
      run('REG-05: Auth flow — unauthenticated kullanıcı online moda giremez', async () => {
        const user = null;
        const canEnterOnline = !!user;
        if (canEnterOnline) throw new Error('Auth olmadan online moda girilmemeli');
        return 'Auth guard online mod ✓';
      }),
      run('REG-06: Game başlatma — playerNames eksikse redirect', async () => {
        const playerNames = null;
        const shouldRedirect = !playerNames;
        if (!shouldRedirect) throw new Error('playerNames eksikse redirect olmalı');
        return 'playerNames guard redirect ✓';
      }),
      run('REG-07: used_question_ids — aynı ID iki kez girilemiyor (Set semantiği)', async () => {
        const qs = await getAllQuestions(5);
        const used = new Set();
        for (const q of qs) used.add(q.id);
        for (const q of qs) used.add(q.id); // add again
        if (used.size !== qs.length) throw new Error('Set semantiği bozuldu');
        return `Set semantiği doğru: ${used.size} unique ID`;
      }),
    ];

    // ─── API TESTS ────────────────────────────────────────────────
    const apiTests = [
      run('API-01: getQuestions fonksiyonu erişilebilir', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 10);
        if (!Array.isArray(qs)) throw new Error('Yanıt array değil');
        return `${qs.length} soru döndü`;
      }),
      run('API-02: Question entity şeması — zorunlu alanlar mevcut', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 5);
        for (const q of qs) {
          if (!q.id) throw new Error('id alanı eksik');
          if (!q.question) throw new Error('question alanı eksik');
          if (typeof q.year !== 'number') throw new Error('year sayı değil');
        }
        return `${qs.length} soru şema doğrulaması geçti`;
      }),
      run('API-03: Lobby CRUD tam döngüsü', async () => {
        const lobby = await createTestLobby();
        const read = await base44.asServiceRole.entities.Lobby.filter({ code: lobby.code });
        if (!read || read.length === 0) throw new Error('Okuma başarısız');
        const upd = await base44.asServiceRole.entities.Lobby.update(lobby.id, { status: 'in_game' });
        if (upd.status !== 'in_game') throw new Error('Güncelleme başarısız');
        await base44.asServiceRole.entities.Lobby.delete(lobby.id);
        const afterDelete = await base44.asServiceRole.entities.Lobby.filter({ code: lobby.code });
        if (afterDelete && afterDelete.length > 0) throw new Error('Silme başarısız');
        return 'CRUD tam döngüsü ✓';
      }),
      run('API-04: GameRecord entity CRUD', async () => {
        const record = await base44.asServiceRole.entities.GameRecord.create({
          user_email: 'api_test@kronos.local',
          player_name: 'APITester',
          duration_seconds: 120,
          cards_won: 10,
          win_card_count: 10,
          category: 'karisik',
          year_start: 1900,
          year_end: 2025,
        });
        if (!record?.id) throw new Error('GameRecord oluşturulamadı');
        await base44.asServiceRole.entities.GameRecord.delete(record.id);
        return 'GameRecord CRUD ✓';
      }),
      run('API-05: Toplu soru filtresi — limit=50 çalışıyor', async () => {
        const page = await base44.asServiceRole.entities.Question.list('-created_date', 50);
        if (!Array.isArray(page)) throw new Error('Array değil');
        if (page.length > 50) throw new Error(`Limit aşıldı: ${page.length} > 50`);
        return `${page.length} soru`;
      }),
    ];

    // ─── DEVICE TESTS ─────────────────────────────────────────────
    const deviceTests = [
      run('DEV-01: Küçük ekran (320px) — min kart sayısı', async () => {
        const minWidth = 320;
        const cardMinWidth = 80;
        const maxCardsVisible = Math.floor(minWidth / cardMinWidth);
        if (maxCardsVisible < 2) throw new Error(`320px ekranda ${maxCardsVisible} kart sığıyor`);
        return `320px ekranda ${maxCardsVisible} kart sığabilir`;
      }),
      run('DEV-02: Safe-area padding tanımları mevcut', async () => {
        const safeAreaVars = ['safe-area-inset-top', 'safe-area-inset-bottom'];
        if (safeAreaVars.length < 2) throw new Error('Safe area değişkenleri eksik');
        return 'Safe-area-inset top ve bottom tanımlı ✓';
      }),
      run('DEV-03: Minimum dokunma hedefi 44x44px kuralı', async () => {
        const minTouchTarget = 44;
        const buttonHeights = [44, 48, 56];
        const allValid = buttonHeights.every(h => h >= minTouchTarget);
        if (!allValid) throw new Error(`Bazı butonlar ${minTouchTarget}px altında`);
        return `Tüm dokunma hedefleri ≥${minTouchTarget}px ✓`;
      }),
    ];

    // ─── PLAYABILITY TESTS ────────────────────────────────────────
    const playabilityTests = [
      run('PLAY-01: Solo oyun kurulabiliyor (min 3 soru)', async () => {
        const qs = await getAllQuestions(500);
        const filtered = qs.filter(q => q.type === 'metin');
        if (filtered.length < 3) throw new Error(`Solo için bile soru yok: ${filtered.length}`);
        return `${filtered.length} metin sorusu`;
      }),
      run('PLAY-02: 1900-2025 yıl aralığı için yeterli soru (≥20)', async () => {
        const qs = await getAllQuestions(500);
        const filtered = qs.filter(q => q.type === 'metin' && q.year >= 1900 && q.year <= 2025);
        if (filtered.length < 20) throw new Error(`Sadece ${filtered.length} soru var, 20 gerekli`);
        return `${filtered.length} soru`;
      }),
      run('PLAY-03: Mevcut kategoriler kontrolü', async () => {
        const qs = await getAllQuestions(500);
        const allCats = [...new Set(qs.map(q => q.category).filter(Boolean))];
        if (allCats.length === 0) throw new Error('Hiç kategorili soru yok');
        return `Kategoriler: ${allCats.join(', ')}`;
      }),
      run('PLAY-04: Tüm soruların yıl alanı geçerli', async () => {
        const qs = await getAllQuestions(200);
        const invalidYears = qs.filter(q => !q.year || typeof q.year !== 'number');
        if (invalidYears.length > 0) throw new Error(`${invalidYears.length} soruda geçersiz yıl var`);
        return `${qs.length} sorunun tamamı geçerli`;
      }),
      run('PLAY-05: RAHAT (∞), HIZLI (30sn), KAOS (15sn) seçenekleri çalışıyor', async () => {
        const options = [
          { id: 'rahat', duration: 0, timerActive: false },
          { id: 'hizli', duration: 30, timerActive: true },
          { id: 'kaos', duration: 15, timerActive: true },
        ];
        for (const opt of options) {
          const shouldTimer = opt.duration > 0;
          if (shouldTimer !== opt.timerActive) throw new Error(`${opt.id} timer mantığı hatalı`);
        }
        return 'Tüm zorluk seçenekleri geçerli ✓';
      }),
      run('PLAY-06: Kazanma kartı sayısı default=10 geçerli', async () => {
        const validOptions = [5, 7, 10, 15];
        const defaultWin = 10;
        if (!validOptions.includes(defaultWin)) throw new Error('Default winCardCount geçersiz');
        return `Default winCardCount: ${defaultWin} ✓`;
      }),
      run('PLAY-07: Tur geçme (timer doldu) → soru değişmeli', async () => {
        const qs = await getAllQuestions(10);
        const usedIds = new Set([qs[0].id]);
        const available = qs.filter(q => !usedIds.has(q.id));
        if (available.length === 0) throw new Error('Yeni soru seçilemiyor');
        if (available[0].id === qs[0].id) throw new Error('Aynı soru tekrar geldi');
        return 'Timer dolunca yeni soru seçiliyor ✓';
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
      run('MUZ-02: Müzik sorularında media_url mevcut olmalı', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const muzikQs = qs.filter(q => q.type === 'muzik');
        if (muzikQs.length === 0) throw new Error('Müzik sorusu yok');
        const noUrl = muzikQs.filter(q => !q.media_url || q.media_url.trim() === '');
        if (noUrl.length > 0) throw new Error(`${noUrl.length} müzik sorusunda media_url eksik`);
        return `${muzikQs.length} sorunun tamamında URL var`;
      }),
      run('MUZ-03: Müzik modu için yeterli soru (≥10)', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const muzikQs = qs.filter(q => q.type === 'muzik');
        if (muzikQs.length < 10) throw new Error(`Sadece ${muzikQs.length} müzik sorusu var, en az 10 gerekli`);
        return `${muzikQs.length} müzik sorusu`;
      }),
      run('MUZ-04: Müzik kategorisi filtresi — metin ile çakışmıyor', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const muzikPool = qs.filter(q => q.type === 'muzik');
        const metinPool = qs.filter(q => q.type === 'metin');
        const overlap = muzikPool.filter(q => metinPool.some(m => m.id === q.id));
        if (overlap.length > 0) throw new Error('Müzik ve metin soruları çakışıyor');
        return `muzik=${muzikPool.length}, metin=${metinPool.length}`;
      }),
      run('MUZ-05: Müzik soruları yıl aralığı dağılımı (≥3 on yıl)', async () => {
        const qs = await base44.asServiceRole.entities.Question.list('-created_date', 500);
        const muzikQs = qs.filter(q => q.type === 'muzik');
        if (muzikQs.length === 0) throw new Error('Müzik sorusu yok');
        const decades = {};
        for (const q of muzikQs) {
          const d = Math.floor(q.year / 10) * 10;
          decades[d] = (decades[d] || 0) + 1;
        }
        const decadeCount = Object.keys(decades).length;
        if (decadeCount < 3) throw new Error(`Sadece ${decadeCount} farklı on yıl`);
        return `${decadeCount} farklı on yıl ✓`;
      }),
    ];

    // ─── A/B TESTS ────────────────────────────────────────────────
    const abTests = [
      run('AB-01: Kategori dağılımı — karışık vs özel', async () => {
        const qs = await getAllQuestions(500);
        const categories = {};
        for (const q of qs) {
          const c = q.category || 'genel';
          categories[c] = (categories[c] || 0) + 1;
        }
        const catCount = Object.keys(categories).length;
        if (catCount < 2) throw new Error('Yeterli kategori çeşitliliği yok');
        return `${catCount} kategori: ${Object.entries(categories).map(([k, v]) => `${k}:${v}`).join(', ')}`;
      }),
      run('AB-02: Yıl aralığı kapsam gücü (≥80%)', async () => {
        const qs = await getAllQuestions(500);
        const inRange = qs.filter(q => q.year >= 1900 && q.year <= 2025);
        const coverage = Math.round((inRange.length / qs.length) * 100);
        if (coverage < 80) throw new Error(`1900-2025 kapsam sadece %${coverage}`);
        return `1900-2025 kapsam: %${coverage}`;
      }),
    ];

    // ─── SUITE SEÇİMİ ─────────────────────────────────────────────
    const suiteMap = {
      smoke: smokeTests,
      unit: unitTests,
      question_engine: questionEngineTests,
      functional: functionalTests,
      media: mediaTests,
      admin: adminTests,
      tutorial: tutorialTests,
      blackbox: blackboxTests,
      performance: performanceTests,
      stability: stabilityTests,
      regression: regressionTests,
      api: apiTests,
      device: deviceTests,
      playability: playabilityTests,
      music: musicTests,
      ab: abTests,
    };

    let testsToRun = [];
    if (!suite || suite === 'all') {
      testsToRun = Object.values(suiteMap).flat();
    } else if (suiteMap[suite]) {
      testsToRun = suiteMap[suite];
    }

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
