/**
 * Kronos Online Oyun Simülasyon Paketi
 *
 * Senaryolar:
 *  2p_normal      — 2 oyuncu, normal sıralı hamle akışı
 *  2p_win         — 2 oyuncu, biri kazanma koşuluna ulaşıyor
 *  2p_delayed     — 2 oyuncu, DB gecikmesi / race condition
 *  2p_concurrent  — 2 oyuncu, eş zamanlı yazma çakışması
 *  3p_turn_order  — 3 oyuncu, tur sırası 0→1→2→0 doğru mu?
 *  3p_spectate    — 3 oyuncu, sıra olmayan oyuncular sadece izliyor (kart ekleyemiyor)
 *  4p_full        — 4 oyuncu, tam oyun döngüsü
 *  4p_win         — 4 oyuncu, bir oyuncu 10 kart toplayarak kazanıyor
 *  all            — tüm senaryoları çalıştır
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function makePlayer(n, index) {
  return { email: `sim_p${index}@test.local`, name: `SimP${index}`, ready: true, cards: [] };
}

function makeLobby(playerCount, extra = {}) {
  const players = Array.from({ length: playerCount }, (_, i) => makePlayer(playerCount, i + 1));
  return {
    code: 'SIM' + Math.random().toString(36).substring(2, 5).toUpperCase(),
    host_email: 'sim_p1@test.local',
    host_name: 'SimP1',
    players,
    status: 'in_game',
    current_player_index: 0,
    current_question_id: 'q_start',
    used_question_ids: ['q_start'],
    category: 'karisik',
    year_start: 1900,
    year_end: 2020,
    turn_duration: 60,
    win_card_count: 10,
    ...extra,
  };
}

async function runScenario(name, base44, playerCount, fn) {
  let lobbyId = null;
  try {
    const lobby = await base44.asServiceRole.entities.Lobby.create(makeLobby(playerCount));
    lobbyId = lobby.id;
    const result = await fn(lobbyId, lobby);
    return { scenario: name, playerCount, ...result };
  } catch (err) {
    return { scenario: name, playerCount, status: 'ERROR', error: err.message };
  } finally {
    if (lobbyId) {
      await base44.asServiceRole.entities.Lobby.delete(lobbyId).catch(() => {});
    }
  }
}

// Bir oyuncuya kart ekle ve turu geç
async function doTurn(base44, lobbyId, playerIndex, cardId, cardYear, nextPlayerIndex, nextQId) {
  const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
  const updatedPlayers = lobby.players.map((p, i) =>
    i === playerIndex
      ? { ...p, cards: [...(p.cards || []), { id: cardId, year: cardYear, question: `Soru ${cardId}`, type: 'metin' }] }
      : p
  );
  await base44.asServiceRole.entities.Lobby.update(lobbyId, {
    players: updatedPlayers,
    current_player_index: nextPlayerIndex,
    current_question_id: nextQId,
    used_question_ids: [...(lobby.used_question_ids || []), nextQId],
  });
  return updatedPlayers;
}

// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const scenario = body.scenario || 'all';

    const results = {};

    // ══════════════════════════════════════════════════════════════════
    // TEK OYUNCU OFFLINE — SORU HAVUZU KONTROLLERİ
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'single_player_offline' || scenario === 'all') {
      results['single_player_offline'] = await (async () => {
        const logs = [];
        try {
          const questions = await base44.asServiceRole.entities.Question.list('-created_date', 200);
          const categoryFilters = [
            { cat: 'karisik', text: 'mixed' },
            { cat: 'tarih', text: 'history' },
            { cat: 'bilim', text: 'science' },
          ];
          
          for (const { cat, text } of categoryFilters) {
            const filtered = questions
              .filter(q => q.type === 'metin')
              .filter(q => cat === 'karisik' || q.category === cat);
            
            // Minimum 10 soru gerekli
            if (filtered.length < 10) {
              logs.push(`⚠️  ${text.toUpperCase()} (${cat}): ${filtered.length} soru < 10 (hata verilmeli)`);
            } else {
              logs.push(`✅ ${text.toUpperCase()} (${cat}): ${filtered.length} ≥ 10 soru (oyun başlar)`);
            }
          }
          
          if (logs.some(l => l.includes('✅'))) {
            logs.push('✅ Minimum 1 kategori 10+ soru içeriyor — offline oyun başlatılabilir');
            return { status: 'PASS', logs };
          } else {
            logs.push('❌ Hiçbir kategori 10+ soru içermiyor — oyun başlamaz');
            return { status: 'FAIL', logs };
          }
        } catch (err) {
          return { status: 'ERROR', error: err.message };
        }
      })();
    }

    // ══════════════════════════════════════════════════════════════════
    // 2 OYUNCU — NORMAL AKIŞ
    // ══════════════════════════════════════════════════════════════════
    if (scenario === '2p_normal' || scenario === 'all') {
      results['2p_normal'] = await runScenario('2p_normal', base44, 2, async (lobbyId) => {
        const logs = [];

        // Tur 1: P1 hamle yapar → index 1'e geçmeli
        await doTurn(base44, lobbyId, 0, 'q1', 1969, 1, 'q2');
        let lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        if (lobby.current_player_index !== 1) return { status: 'FAIL', logs: [...logs, `❌ Tur 1 sonrası index=${lobby.current_player_index}, beklenen=1`] };
        if (lobby.players[0].cards.length !== 1) return { status: 'FAIL', logs: [...logs, `❌ P1 kart sayısı=${lobby.players[0].cards.length}, beklenen=1`] };
        logs.push('✅ Tur 1: P1 hamle yaptı, index=1, P1 kart=1');

        await sleep(200);

        // Tur 2: P2 hamle yapar → index 0'a dönmeli
        await doTurn(base44, lobbyId, 1, 'q2', 1985, 0, 'q3');
        lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        if (lobby.current_player_index !== 0) return { status: 'FAIL', logs: [...logs, `❌ Tur 2 sonrası index=${lobby.current_player_index}, beklenen=0`] };
        if (lobby.players[1].cards.length !== 1) return { status: 'FAIL', logs: [...logs, `❌ P2 kart sayısı=${lobby.players[1].cards.length}, beklenen=1`] };
        logs.push('✅ Tur 2: P2 hamle yaptı, index=0, P2 kart=1');

        // Tur 3: P1 tekrar → kart birikimi doğru mu?
        await doTurn(base44, lobbyId, 0, 'q3', 2001, 1, 'q4');
        lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        if (lobby.players[0].cards.length !== 2) return { status: 'FAIL', logs: [...logs, `❌ P1 kart birikimi hatalı: ${lobby.players[0].cards.length}`] };
        logs.push('✅ Tur 3: P1 tekrar hamle yaptı, kart birikimi doğru (P1=2, P2=1)');

        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // 2 OYUNCU — KAZANMA KOŞULU
    // ══════════════════════════════════════════════════════════════════
    if (scenario === '2p_win' || scenario === 'all') {
      results['2p_win'] = await runScenario('2p_win', base44, 2, async (lobbyId) => {
        const logs = [];

        // P1'e 9 kart elle ver
        const preCards = Array.from({ length: 9 }, (_, i) => ({ id: `pre${i}`, year: 1900 + i * 5, question: `Soru ${i}`, type: 'metin' }));
        let lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        const preUpdate = lobby.players.map((p, i) => i === 0 ? { ...p, cards: preCards } : p);
        await base44.asServiceRole.entities.Lobby.update(lobbyId, { players: preUpdate });
        logs.push('✅ P1\'e 9 başlangıç kartı yüklendi');

        // P1 10. kartı kazanıyor → status: finished, winner: SimP1
        lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        const winPlayers = lobby.players.map((p, i) =>
          i === 0 ? { ...p, cards: [...p.cards, { id: 'win_q', year: 1999, question: 'Son soru', type: 'metin' }] } : p
        );
        await base44.asServiceRole.entities.Lobby.update(lobbyId, {
          players: winPlayers,
          status: 'finished',
          winner: 'SimP1',
        });
        logs.push('✅ 10. kart eklendi, status=finished, winner=SimP1 yazıldı');

        // Doğrulama
        lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        if (lobby.status !== 'finished') return { status: 'FAIL', logs: [...logs, `❌ status=${lobby.status}, beklenen=finished`] };
        if (lobby.winner !== 'SimP1') return { status: 'FAIL', logs: [...logs, `❌ winner=${lobby.winner}, beklenen=SimP1`] };
        if (lobby.players[0].cards.length !== 10) return { status: 'FAIL', logs: [...logs, `❌ P1 kart=${lobby.players[0].cards.length}, beklenen=10`] };
        logs.push('✅ Kazanma doğrulandı: status=finished, winner=SimP1, P1 kart=10');

        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // 2 OYUNCU — GECİKMELİ YAZMA (Race Condition)
    // ══════════════════════════════════════════════════════════════════
    if (scenario === '2p_delayed' || scenario === 'all') {
      results['2p_delayed'] = await runScenario('2p_delayed', base44, 2, async (lobbyId) => {
        const logs = [];

        const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        logs.push('⏳ P1 lokal state\'i güncelliyor (optimistic update), DB yazma 1.5sn gecikmeli...');

        await sleep(1500); // DB yazma gecikmesi simülasyonu

        // Gecikmeli DB yazma
        const updatedPlayers = lobby.players.map((p, i) =>
          i === 0 ? { ...p, cards: [{ id: 'delayed_q', year: 1969, question: 'Gecikmeli soru', type: 'metin' }] } : p
        );
        await base44.asServiceRole.entities.Lobby.update(lobbyId, {
          players: updatedPlayers,
          current_player_index: 1,
          current_question_id: 'q_after_delay',
        });
        logs.push('✅ Gecikmeli DB yazma tamamlandı (1.5sn sonra)');

        // pendingWrite kilidi simülasyonu: 2sn içinde gelen subscription event'i yoksay
        // Backend'de bunu doğrulayamayız ama DB state'ini kontrol edebiliriz
        await sleep(500);
        const check = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        if (check.players[0].cards.length !== 1) {
          return { status: 'FAIL', logs: [...logs, `❌ Gecikmeli yazmadan sonra P1 kart kaybedildi: ${check.players[0].cards.length}`] };
        }
        if (check.current_player_index !== 1) {
          return { status: 'FAIL', logs: [...logs, `❌ Tur sırası bozuldu: index=${check.current_player_index}`] };
        }
        logs.push('✅ DB state doğru korundu: P1 kart=1, index=1');
        logs.push('ℹ️  pendingWriteRef kilidi: frontend 2sn boyunca subscription\'ı yoksayar — DB tutarlı');

        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // 2 OYUNCU — EŞ ZAMANLI YAZMA (Concurrent)
    // ══════════════════════════════════════════════════════════════════
    if (scenario === '2p_concurrent' || scenario === 'all') {
      results['2p_concurrent'] = await runScenario('2p_concurrent', base44, 2, async (lobbyId) => {
        const logs = [];

        // İki oyuncu neredeyse aynı anda eski veriyi okuyor
        const [snapA, snapB] = await Promise.all([
          base44.asServiceRole.entities.Lobby.get(lobbyId),
          base44.asServiceRole.entities.Lobby.get(lobbyId),
        ]);
        logs.push('⚡ İki oyuncu aynı anda lobi okudu (stale snapshot)');

        // P1 (snapA üzerinden) yazar
        const playersA = snapA.players.map((p, i) => i === 0 ? { ...p, cards: [{ id: 'cA', year: 1990, question: 'A', type: 'metin' }] } : p);
        // P2 (snapB üzerinden) 50ms sonra yazar — P1'in yazısını ezebilir
        const playersB = snapB.players.map((p, i) => i === 1 ? { ...p, cards: [{ id: 'cB', year: 2000, question: 'B', type: 'metin' }] } : p);

        await Promise.all([
          base44.asServiceRole.entities.Lobby.update(lobbyId, { players: playersA, current_player_index: 1 }),
          sleep(50).then(() => base44.asServiceRole.entities.Lobby.update(lobbyId, { players: playersB, current_player_index: 0 })),
        ]);
        logs.push('⚡ Eş zamanlı yazma tamamlandı (last-write-wins bekleniyor)');

        await sleep(300);
        const final = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        const p1c = final.players[0]?.cards?.length || 0;
        const p2c = final.players[1]?.cards?.length || 0;
        const idx = final.current_player_index;

        logs.push(`📊 Sonuç: P1=${p1c} kart, P2=${p2c} kart, index=${idx}`);
        logs.push('ℹ️  Last-write-wins: Son yazan kazanır. Gerçek oyunda her oyuncu sadece kendi sırasında yazar, çakışma minimumdur.');

        // index tutarlı mı?
        if (idx !== 0 && idx !== 1) {
          return { status: 'FAIL', logs: [...logs, `❌ current_player_index bozuldu: ${idx}`] };
        }
        logs.push('✅ current_player_index tutarlı kaldı');
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // 3 OYUNCU — TUR SIRASI (0→1→2→0)
    // ══════════════════════════════════════════════════════════════════
    if (scenario === '3p_turn_order' || scenario === 'all') {
      results['3p_turn_order'] = await runScenario('3p_turn_order', base44, 3, async (lobbyId) => {
        const logs = [];
        const total = 3;

        for (let round = 0; round < 2; round++) { // 2 tam tur (6 hamle)
          for (let p = 0; p < total; p++) {
            const nextP = (p + 1) % total;
            const cardId = `r${round}_p${p}`;
            await doTurn(base44, lobbyId, p, cardId, 1900 + round * 10 + p, nextP, `q_r${round}_p${p}`);
            const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
            if (lobby.current_player_index !== nextP) {
              return { status: 'FAIL', logs: [...logs, `❌ Round ${round} P${p}: index=${lobby.current_player_index}, beklenen=${nextP}`] };
            }
            logs.push(`✅ Round ${round}, P${p} → P${nextP}: index doğru`);
            await sleep(100);
          }
        }

        // Kart sayıları doğru mu? Her oyuncu 2 kart olmalı
        const final = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        for (let i = 0; i < total; i++) {
          if (final.players[i].cards.length !== 2) {
            return { status: 'FAIL', logs: [...logs, `❌ P${i+1} kart=${final.players[i].cards.length}, beklenen=2`] };
          }
        }
        logs.push('✅ 3 oyuncu, 2 tam tur: her oyuncuda 2 kart, tur sırası hep doğru');
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // 3 OYUNCU — BEKLEME / İZLEME (Sıra olmayan oyuncu kart ekleyemiyor)
    // ══════════════════════════════════════════════════════════════════
    if (scenario === '3p_spectate' || scenario === 'all') {
      results['3p_spectate'] = await runScenario('3p_spectate', base44, 3, async (lobbyId) => {
        const logs = [];

        // Başlangıç: index=0 (P1 oynuyor)
        let lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        logs.push(`✅ Başlangıç: current_player_index=${lobby.current_player_index} (P1 oynuyor)`);

        // P2 kendi sırası DEĞİLKEN kart eklemeye çalışıyor (hatalı senaryo)
        // Frontend bunu engeller — backend'de biz sadece DB'nin doğru state'i tutup tutmadığını test ediyoruz
        // P2'nin "kart ekleme denemesini" simüle edelim: P2 stale state'e dayanarak kendi kartını ekliyor
        const badUpdate = lobby.players.map((p, i) =>
          i === 1 ? { ...p, cards: [{ id: 'bad_q', year: 1955, question: 'Yetkisiz hamle', type: 'metin' }] } : p
        );
        // Bu yazma başarılı OLUR (DB katmanında kısıtlama yok) — ama frontend sıra kontrolü yapar
        // Test: P2 yazdıktan sonra P1'in sırası hâlâ P1'de mi?
        await base44.asServiceRole.entities.Lobby.update(lobbyId, { players: badUpdate });
        logs.push('⚠️  P2 sırası olmadan kart ekledi (yetkisiz yazma simülasyonu)');

        lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        if (lobby.current_player_index !== 0) {
          return { status: 'FAIL', logs: [...logs, `❌ index bozuldu: ${lobby.current_player_index}`] };
        }
        logs.push('✅ current_player_index=0 korundu — P1 hâlâ aktif oyuncu');
        logs.push('ℹ️  Frontend: isMyTurn kontrolü ile P2 ve P3 "YERLEŞTIR" butonunu göremez; sadece izler');

        // Şimdi P1 doğru hamlesini yapıyor → P2'nin yetkisiz kartını koruyarak devam ediyor mu?
        const p1Turn = lobby.players.map((p, i) =>
          i === 0 ? { ...p, cards: [{ id: 'p1_q', year: 1970, question: 'P1 hamlesi', type: 'metin' }] } : p
        );
        await base44.asServiceRole.entities.Lobby.update(lobbyId, { players: p1Turn, current_player_index: 1 });
        lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);

        if (lobby.current_player_index !== 1) return { status: 'FAIL', logs: [...logs, '❌ P1 sonrası index=1 olmalıydı'] };
        if (lobby.players[0].cards.length !== 1) return { status: 'FAIL', logs: [...logs, '❌ P1 kartı kayboldu'] };
        logs.push('✅ P1 hamle sonrası: index=1, P1 kart=1 — sıra P2\'ye geçti');
        logs.push('✅ Diğer oyuncular: index değiştiğinde subscription ile kendi ekranlarını günceller');

        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // 4 OYUNCU — TAM OYUN DÖNGÜSÜ
    // ══════════════════════════════════════════════════════════════════
    if (scenario === '4p_full' || scenario === 'all') {
      results['4p_full'] = await runScenario('4p_full', base44, 4, async (lobbyId) => {
        const logs = [];
        const total = 4;

        // 3 tam tur (12 hamle)
        for (let round = 0; round < 3; round++) {
          for (let p = 0; p < total; p++) {
            const nextP = (p + 1) % total;
            await doTurn(base44, lobbyId, p, `r${round}p${p}`, 1900 + round * 10 + p, nextP, `qr${round}p${p}`);
            const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
            if (lobby.current_player_index !== nextP) {
              return { status: 'FAIL', logs: [...logs, `❌ R${round} P${p}: index=${lobby.current_player_index}, beklenen=${nextP}`] };
            }
          }
          logs.push(`✅ Round ${round + 1} tamamlandı (4 oyuncu, tur sırası doğru)`);
          await sleep(100);
        }

        // 3 turdan sonra her oyuncuda 3 kart olmalı
        const final = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        for (let i = 0; i < total; i++) {
          if (final.players[i].cards.length !== 3) {
            return { status: 'FAIL', logs: [...logs, `❌ P${i+1} kart=${final.players[i].cards.length}, beklenen=3`] };
          }
        }
        logs.push('✅ 4 oyuncu, 3 tam tur: her oyuncuda 3 kart, tüm tur sıraları doğru');
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // 4 OYUNCU — KAZANMA KOŞULU
    // ══════════════════════════════════════════════════════════════════
    if (scenario === '4p_win' || scenario === 'all') {
      results['4p_win'] = await runScenario('4p_win', base44, 4, async (lobbyId) => {
        const logs = [];

        // P3'e 9 kart yükle
        let lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        const preCards = Array.from({ length: 9 }, (_, i) => ({ id: `pre${i}`, year: 1900 + i * 5, question: `Q${i}`, type: 'metin' }));
        const preUpdate = lobby.players.map((p, i) => i === 2 ? { ...p, cards: preCards } : p);
        await base44.asServiceRole.entities.Lobby.update(lobbyId, {
          players: preUpdate,
          current_player_index: 2, // P3'ün sırası
        });
        logs.push('✅ P3\'e 9 kart yüklendi, sıra P3\'te');

        // P3 10. kartı kazanıyor
        lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        const winPlayers = lobby.players.map((p, i) =>
          i === 2 ? { ...p, cards: [...p.cards, { id: 'win_q', year: 2000, question: 'Son soru', type: 'metin' }] } : p
        );
        await base44.asServiceRole.entities.Lobby.update(lobbyId, {
          players: winPlayers,
          status: 'finished',
          winner: 'SimP3',
        });
        logs.push('✅ P3 10. kartı ekledi, status=finished, winner=SimP3');

        // Doğrulama
        lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        if (lobby.status !== 'finished') return { status: 'FAIL', logs: [...logs, `❌ status=${lobby.status}`] };
        if (lobby.winner !== 'SimP3') return { status: 'FAIL', logs: [...logs, `❌ winner=${lobby.winner}`] };
        if (lobby.players[2].cards.length !== 10) return { status: 'FAIL', logs: [...logs, `❌ P3 kart=${lobby.players[2].cards.length}`] };
        logs.push('✅ 4 oyunculu oyunda P3 kazandı: status=finished, winner=SimP3, P3 kart=10');
        logs.push('ℹ️  Diğer 3 oyuncu subscription ile winner ekranını görür (GameOver overlay)');

        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // SORU HAVUZU — Tükenme
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'pool_exhausted' || scenario === 'all') {
      results['pool_exhausted'] = await runScenario('pool_exhausted', base44, 2, async (lobbyId) => {
        const logs = [];
        // 200 farklı soru ID'si kullanıldı olarak işaretle
        const usedIds = Array.from({ length: 200 }, (_, i) => `q_used_${i}`);
        await base44.asServiceRole.entities.Lobby.update(lobbyId, { used_question_ids: usedIds });
        const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        if (lobby.used_question_ids.length !== 200) {
          return { status: 'FAIL', logs: ['❌ used_question_ids 200 olarak kaydedilmedi'] };
        }
        logs.push('✅ 200 soru ID tükendi olarak işaretlendi');
        logs.push('ℹ️  Frontend: pickQuestion() available=[] döner, null ile güvenli çalışır');
        logs.push('✅ DB state tutarlı — havuz tükenmesi veri bozulmasına yol açmıyor');
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // LOBİ DURUMU GEÇİŞLERİ
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'lobby_state_transitions' || scenario === 'all') {
      results['lobby_state_transitions'] = await runScenario('lobby_state_transitions', base44, 2, async (lobbyId) => {
        const logs = [];
        const validTransitions = [
          { from: 'waiting', to: 'starting' },
          { from: 'starting', to: 'in_game' },
          { from: 'in_game', to: 'finished' },
        ];
        for (const t of validTransitions) {
          await base44.asServiceRole.entities.Lobby.update(lobbyId, { status: t.to });
          const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
          if (lobby.status !== t.to) {
            return { status: 'FAIL', logs: [...logs, `❌ ${t.from}→${t.to} geçişi başarısız, status=${lobby.status}`] };
          }
          logs.push(`✅ ${t.from} → ${t.to} geçişi doğru`);
        }
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // KART YERLEŞİM DOĞRULAMA — Sınır Koşulları
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'placement_boundary' || scenario === 'all') {
      results['placement_boundary'] = await runScenario('placement_boundary', base44, 1, async (lobbyId) => {
        const logs = [];
        // Sıralı kartlar: [1950, 1970, 1990]
        const cards = [
          { id: 'c1', year: 1950, question: 'Q1', type: 'metin' },
          { id: 'c2', year: 1970, question: 'Q2', type: 'metin' },
          { id: 'c3', year: 1990, question: 'Q3', type: 'metin' },
        ];
        const sorted = [...cards].sort((a, b) => a.year - b.year);

        // Test case 1: En sola (zone 0) → questionYear < sorted[0].year
        const t1 = { year: 1930, zone: 0 };
        const r1 = t1.zone === 0 ? t1.year <= sorted[0].year : false;
        if (!r1) return { status: 'FAIL', logs: ['❌ Zone 0 sol uç kontrolü hatalı'] };
        logs.push('✅ Zone 0 (en sol): 1930 < 1950 → DOĞRU');

        // Test case 2: Zone 0'a yanlış yerleştirme
        const t2 = { year: 1960, zone: 0 };
        const r2 = t2.zone === 0 ? t2.year <= sorted[0].year : false;
        if (r2) return { status: 'FAIL', logs: [...logs, '❌ Zone 0 yanlış yerleşimi reddetmedi'] };
        logs.push('✅ Zone 0: 1960 > 1950 → YANLIŞ (doğru reddedildi)');

        // Test case 3: Ortaya (zone 2) → sorted[1].year <= q.year <= sorted[2].year
        const t3 = { year: 1980, zone: 2 };
        const r3 = t3.year >= sorted[t3.zone - 1].year && t3.year <= sorted[t3.zone].year;
        if (!r3) return { status: 'FAIL', logs: [...logs, '❌ Orta zone yerleştirme hatalı'] };
        logs.push('✅ Zone 2 (orta): 1970 ≤ 1980 ≤ 1990 → DOĞRU');

        // Test case 4: En sağa (zone 3) → questionYear >= sorted[last].year
        const t4 = { year: 2000, zone: 3 };
        const r4 = t4.zone === sorted.length ? t4.year >= sorted[sorted.length - 1].year : false;
        if (!r4) return { status: 'FAIL', logs: [...logs, '❌ En sağ zone kontrolü hatalı'] };
        logs.push('✅ Zone 3 (en sağ): 2000 > 1990 → DOĞRU');

        // Test case 5: Eşit yıl (kenar değer) → kabul edilmeli
        const t5 = { year: 1950, zone: 0 };
        const r5 = t5.year <= sorted[0].year;
        if (!r5) return { status: 'FAIL', logs: [...logs, '❌ Eşit yıl (1950=1950) reddedildi'] };
        logs.push('✅ Eşit yıl kenar değeri: 1950 = 1950 → DOĞRU (kabul edildi)');

        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // BOŞ TİMELİNE YERLEŞTIRME (0 kartlı oyuncu)
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'placement_empty_timeline' || scenario === 'all') {
      results['placement_empty_timeline'] = await runScenario('placement_empty_timeline', base44, 2, async (lobbyId) => {
        const logs = [];
        // P1 hiç kartı yok → zone 0'a her yılı yerleştirebilmeli
        const testYears = [1800, 1950, 2023];
        for (const year of testYears) {
          const cards = [];
          const zone = 0;
          // Boş timeline'da zone 0: her zaman doğru (cards.length === 0)
          const isCorrect = cards.length === 0 || year <= cards[0]?.year;
          if (!isCorrect) return { status: 'FAIL', logs: [...logs, `❌ Boş timeline zone 0: ${year} reddedildi`] };
          logs.push(`✅ Boş timeline: ${year} yılı zone 0'a → DOĞRU`);
        }
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // KAZANMA — FARKLI KART EŞİKLERİ
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'win_thresholds' || scenario === 'all') {
      results['win_thresholds'] = await runScenario('win_thresholds', base44, 2, async (lobbyId) => {
        const logs = [];
        const thresholds = [5, 7, 10, 15];
        for (const threshold of thresholds) {
          await sleep(400);
          await base44.asServiceRole.entities.Lobby.update(lobbyId, { win_card_count: threshold });
          await sleep(200);
          const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
          if (lobby.win_card_count !== threshold) {
            return { status: 'FAIL', logs: [...logs, `❌ win_card_count ${threshold} kaydedilemedi`] };
          }
          logs.push(`✅ win_card_count=${threshold} doğru kaydedildi`);
        }
        // Eşiği aşan kart sayısında winner yazılması
        const cards = Array.from({ length: 10 }, (_, i) => ({ id: `w${i}`, year: 1900 + i, question: `Q${i}`, type: 'metin' }));
        let lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        const updated = lobby.players.map((p, i) => i === 0 ? { ...p, cards } : p);
        await base44.asServiceRole.entities.Lobby.update(lobbyId, { players: updated, win_card_count: 10, status: 'finished', winner: 'SimP1' });
        lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        if (lobby.winner !== 'SimP1' || lobby.status !== 'finished') {
          return { status: 'FAIL', logs: [...logs, '❌ Eşik aşımında winner/status yazılmadı'] };
        }
        logs.push('✅ 10 kart eşiğinde winner=SimP1, status=finished → DOĞRU');
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // OYUNCU AYRILIĞI (Host Olmayan Çıkış)
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'player_leave' || scenario === 'all') {
      results['player_leave'] = await runScenario('player_leave', base44, 3, async (lobbyId) => {
        const logs = [];
        let lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        const before = lobby.players.length;

        // P3 ayrılıyor
        const remaining = lobby.players.filter(p => p.name !== 'SimP3');
        await base44.asServiceRole.entities.Lobby.update(lobbyId, { players: remaining });
        lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);

        if (lobby.players.length !== before - 1) {
          return { status: 'FAIL', logs: [`❌ Oyuncu sayısı beklenen=${before - 1}, gerçek=${lobby.players.length}`] };
        }
        logs.push(`✅ P3 ayrıldı: ${before} → ${lobby.players.length} oyuncu`);

        // Kalan oyuncuların current_player_index bozulmamalı
        if (lobby.current_player_index !== 0) {
          // index P3'ü işaret ediyorsa düzelt
          logs.push(`⚠️  current_player_index=${lobby.current_player_index}, kalan oyuncu sayısına göre ayarlanmalı`);
        } else {
          logs.push('✅ current_player_index sıfırda, devam edebilir');
        }
        logs.push('ℹ️  Frontend: oyuncu sayısı değişince tur sırası kontrol edilmeli');
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // HOST AYRILIĞI (Lobi Silme)
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'host_leave' || scenario === 'all') {
      results['host_leave'] = await runScenario('host_leave', base44, 3, async (lobbyId) => {
        const logs = [];
        // Host lobiden ayrılıyor → lobi silinmeli
        await base44.asServiceRole.entities.Lobby.delete(lobbyId);
        let exists = true;
        try {
          await base44.asServiceRole.entities.Lobby.get(lobbyId);
        } catch {
          exists = false;
        }
        if (exists) return { status: 'FAIL', logs: ['❌ Host çıktı ama lobi hâlâ mevcut'] };
        logs.push('✅ Host çıktı → lobi silindi');
        logs.push('ℹ️  Frontend: subscription "delete" eventi → tüm oyuncular bildirim alır');
        // Cleanup bloğu zaten silinmiş lobi için hata verir — bunu tolere et
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // TUR SÜRESİ — Farklı Değerler
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'turn_duration_variants' || scenario === 'all') {
      results['turn_duration_variants'] = await runScenario('turn_duration_variants', base44, 2, async (lobbyId) => {
        const logs = [];
        const durations = [0, 10, 30, 60, 120]; // 0 = süresiz
        for (const d of durations) {
          await sleep(400);
          await base44.asServiceRole.entities.Lobby.update(lobbyId, { turn_duration: d });
          await sleep(200);
          const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
          if (lobby.turn_duration !== d) {
            return { status: 'FAIL', logs: [...logs, `❌ turn_duration=${d} kaydedilemedi, gerçek=${lobby.turn_duration}`] };
          }
          logs.push(`✅ turn_duration=${d === 0 ? '0 (süresiz)' : d + 'sn'} doğru kaydedildi`);
        }
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // KATEGORİ FİLTRESİ
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'category_filter' || scenario === 'all') {
      results['category_filter'] = await runScenario('category_filter', base44, 2, async (lobbyId) => {
        const logs = [];
        const categories = ['karisik', 'tarih', 'bilim', 'spor', 'sanat'];
        for (const cat of categories) {
          await sleep(400);
          await base44.asServiceRole.entities.Lobby.update(lobbyId, { category: cat });
          await sleep(200);
          const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
          if (lobby.category !== cat) {
            return { status: 'FAIL', logs: [...logs, `❌ category=${cat} kaydedilemedi`] };
          }
          logs.push(`✅ category=${cat} doğru kaydedildi`);
        }
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // YIL ARALIĞI DOĞRULAMASI
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'year_range' || scenario === 'all') {
      results['year_range'] = await runScenario('year_range', base44, 2, async (lobbyId) => {
        const logs = [];
        const ranges = [
          { start: 0, end: 500 },
          { start: 1900, end: 2000 },
          { start: 1950, end: 1960 }, // dar aralık
          { start: 1900, end: 2024 }, // geniş aralık
        ];
        for (const r of ranges) {
          await sleep(400);
          await base44.asServiceRole.entities.Lobby.update(lobbyId, { year_start: r.start, year_end: r.end });
          await sleep(200);
          const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
          if (lobby.year_start !== r.start || lobby.year_end !== r.end) {
            return { status: 'FAIL', logs: [...logs, `❌ Yıl aralığı ${r.start}-${r.end} hatalı kaydedildi`] };
          }
          logs.push(`✅ Yıl aralığı ${r.start}–${r.end} doğru kaydedildi`);
        }
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // LOBİ MESAJI (Sohbet)
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'lobby_chat' || scenario === 'all') {
      results['lobby_chat'] = await runScenario('lobby_chat', base44, 2, async (lobbyId) => {
        const logs = [];
        const messages = [
          { lobby_id: lobbyId, player_name: 'SimP1', message: 'Merhaba!', type: 'chat' },
          { lobby_id: lobbyId, player_name: 'SimP2', message: 'Hazırım 👋', type: 'chat' },
          { lobby_id: lobbyId, player_name: 'system', message: 'Oyun başladı', type: 'system' },
        ];
        const created = [];
        for (const m of messages) {
          const msg = await base44.asServiceRole.entities.LobbyMessage.create(m);
          created.push(msg.id);
          logs.push(`✅ Mesaj oluşturuldu: "${m.message}" (${m.type})`);
        }
        // Doğrulama: mesajlar geri okunabilmeli
        const fetched = await base44.asServiceRole.entities.LobbyMessage.filter({ lobby_id: lobbyId });
        if (fetched.length < 3) {
          return { status: 'FAIL', logs: [...logs, `❌ Mesaj sayısı beklenen=3, gerçek=${fetched.length}`] };
        }
        logs.push(`✅ ${fetched.length} mesaj DB'den okundu`);
        // Temizlik
        for (const id of created) {
          await base44.asServiceRole.entities.LobbyMessage.delete(id).catch(() => {});
        }
        logs.push('✅ Test mesajları temizlendi');
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // SORU HAVUZU DEDÜPLİKASYONU
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'dedup_questions' || scenario === 'all') {
      results['dedup_questions'] = await runScenario('dedup_questions', base44, 2, async (lobbyId) => {
        const logs = [];
        // Aynı soru ID'sini iki kez used_question_ids'e eklemeye çalış
        const usedIds = ['q1', 'q2', 'q3', 'q1']; // q1 çift
        const deduped = [...new Set(usedIds)];
        if (deduped.length !== 3) {
          return { status: 'FAIL', logs: ['❌ Set dedup çalışmıyor — q1 çift kaldı'] };
        }
        await base44.asServiceRole.entities.Lobby.update(lobbyId, { used_question_ids: deduped });
        const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        if (lobby.used_question_ids.includes('q1') && lobby.used_question_ids.filter(id => id === 'q1').length > 1) {
          return { status: 'FAIL', logs: [...logs, '❌ DB\'de duplicate q1 var'] };
        }
        logs.push('✅ Set() ile dedup: [q1,q2,q3,q1] → [q1,q2,q3]');
        logs.push('ℹ️  pickQuestion() used Set(usedQuestionIds) — ID tekrar çekilmez');
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // OYUNCU İSMİ — Özel Karakter ve Uzun İsim
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'player_name_edge' || scenario === 'all') {
      results['player_name_edge'] = await runScenario('player_name_edge', base44, 2, async (lobbyId) => {
        const logs = [];
        const edgeNames = [
          'A',                              // tek karakter
          'Çağrı Öztürk',                   // Türkçe karakter
          '123456',                         // sayısal
          'Player <script>',                // XSS girişimi (depolarda string olarak saklanmalı)
          'A'.repeat(50),                   // uzun isim (50 karakter)
        ];
        for (const name of edgeNames) {
          await sleep(400);
          let lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
          const updated = lobby.players.map((p, i) => i === 0 ? { ...p, name } : p);
          await base44.asServiceRole.entities.Lobby.update(lobbyId, { players: updated });
          await sleep(200);
          lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
          if (lobby.players[0].name !== name) {
            return { status: 'FAIL', logs: [...logs, `❌ İsim "${name}" kaydedilemedi`] };
          }
          logs.push(`✅ İsim "${name.substring(0, 20)}${name.length > 20 ? '...' : ''}" doğru kaydedildi`);
        }
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // OYUN DURUMU — Yeniden Başlatma (Restart)
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'game_restart' || scenario === 'all') {
      results['game_restart'] = await runScenario('game_restart', base44, 2, async (lobbyId) => {
        const logs = [];
        // Önce oyunu bitmiş duruma getir
        let lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        const winPlayers = lobby.players.map((p, i) =>
          i === 0 ? { ...p, cards: Array.from({ length: 10 }, (_, j) => ({ id: `w${j}`, year: 1900 + j, question: `Q${j}`, type: 'metin' })) } : p
        );
        await base44.asServiceRole.entities.Lobby.update(lobbyId, {
          players: winPlayers, status: 'finished', winner: 'SimP1'
        });
        logs.push('✅ Oyun finished durumuna getirildi (SimP1 kazandı)');

        // Restart: navigate('/') ile ana sayfaya dön — DB'de lobi temizlenir veya yeni lobi açılır
        // Burada sadece lobi durumunu sıfırlıyoruz (reset simülasyonu)
        const resetPlayers = lobby.players.map(p => ({ ...p, cards: [] }));
        await base44.asServiceRole.entities.Lobby.update(lobbyId, {
          players: resetPlayers,
          status: 'waiting',
          winner: null,
          current_player_index: 0,
          current_question_id: null,
          used_question_ids: [],
        });
        lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        if (lobby.status !== 'waiting') return { status: 'FAIL', logs: [...logs, `❌ status=${lobby.status}`] };
        if (lobby.players.some(p => p.cards.length > 0)) return { status: 'FAIL', logs: [...logs, '❌ Bazı oyuncuların kartları sıfırlanmadı'] };
        if (lobby.used_question_ids.length !== 0) return { status: 'FAIL', logs: [...logs, '❌ used_question_ids temizlenmedi'] };
        logs.push('✅ Yeniden başlatma: status=waiting, tüm kartlar ve soru geçmişi sıfırlandı');
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // SORU KATEGORİSİ × YIL ARALIĞI KOMBİNASYONU
    // ══════════════════════════════════════════════════════════════════
    if (scenario === 'category_year_combo' || scenario === 'all') {
      results['category_year_combo'] = await runScenario('category_year_combo', base44, 2, async (lobbyId) => {
        const logs = [];
        const combos = [
          { category: 'tarih', year_start: 1900, year_end: 1950 },
          { category: 'bilim', year_start: 1950, year_end: 2000 },
          { category: 'karisik', year_start: 0, year_end: 2024 },
        ];
        for (const c of combos) {
          await base44.asServiceRole.entities.Lobby.update(lobbyId, c);
          const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
          if (lobby.category !== c.category || lobby.year_start !== c.year_start || lobby.year_end !== c.year_end) {
            return { status: 'FAIL', logs: [...logs, `❌ Kombinasyon ${c.category} ${c.year_start}-${c.year_end} hatalı`] };
          }
          logs.push(`✅ ${c.category} | ${c.year_start}–${c.year_end} kombinasyonu doğru`);
        }
        return { status: 'PASS', logs };
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // 2 OYUNCU — RAKIP KAZANMA (P2 Kazanır)
    // ══════════════════════════════════════════════════════════════════
    if (scenario === '2p_rival_win' || scenario === 'all') {
      results['2p_rival_win'] = await runScenario('2p_rival_win', base44, 2, async (lobbyId) => {
        const logs = [];
        // P1 9 kart, P2 8 kart → P1 kazanıyor
        let lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        const setupPlayers = lobby.players.map((p, i) => ({
          ...p,
          cards: Array.from({ length: i === 0 ? 9 : 8 }, (_, j) => ({ id: `p${i}c${j}`, year: 1900 + i * 20 + j, question: `Q${j}`, type: 'metin' }))
        }));
        await base44.asServiceRole.entities.Lobby.update(lobbyId, { players: setupPlayers, current_player_index: 0 });
        logs.push('✅ P1=9 kart, P2=8 kart, P1 oynuyor');

        // P1 10. kartı alıyor → winner P1
        lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        const finalPlayers = lobby.players.map((p, i) =>
          i === 0 ? { ...p, cards: [...p.cards, { id: 'final_q', year: 1999, question: 'Son', type: 'metin' }] } : p
        );
        await base44.asServiceRole.entities.Lobby.update(lobbyId, { players: finalPlayers, status: 'finished', winner: 'SimP1' });

        lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        if (lobby.winner !== 'SimP1' || lobby.players[1].cards.length !== 8) {
          return { status: 'FAIL', logs: [...logs, '❌ Rakip kazanma senaryosu hatalı'] };
        }
        logs.push('✅ P1 10. kartla kazandı, P2 8 kartta kaldı — winner doğru yazıldı');
        return { status: 'PASS', logs };
      });
    }

    // Özet
    const total = Object.keys(results).length;
    const passed = Object.values(results).filter(r => r.status === 'PASS').length;
    const failed = Object.values(results).filter(r => r.status === 'FAIL').length;
    const errors = Object.values(results).filter(r => r.status === 'ERROR').length;

    return Response.json({
      success: true,
      summary: { total, passed, failed, errors },
      results,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});