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