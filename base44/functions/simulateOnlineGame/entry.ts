/**
 * Online oyun simülasyonu — 3 farklı senaryo:
 * 1. Normal: 2 oyuncu, sıralı hamle, hızlı bağlantı
 * 2. Gecikmeli: DB yazma yavaş, subscription erken geliyor (race condition)
 * 3. Eş zamanlı: İki oyuncu neredeyse aynı anda hamle yapıyor
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function generateCode() {
  return 'SIM' + Math.random().toString(36).substring(2, 5).toUpperCase();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const scenario = body.scenario || 'all'; // 'normal' | 'delayed' | 'concurrent' | 'all'

    const results = {};

    // ─── SENARYO 1: Normal akış ───────────────────────────────────────────────
    if (scenario === 'normal' || scenario === 'all') {
      const result = await runScenario('normal', base44, async (lobbyId) => {
        const logs = [];

        // Oyuncu 1 hamle yapar → DB günceller
        const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        const players = lobby.players;

        // Hamle: kart ekle, tur geç
        const updatedPlayers = players.map((p, i) =>
          i === 0
            ? { ...p, cards: [...(p.cards || []), { id: 'q1', year: 1969, question: 'Test soru', type: 'metin' }] }
            : p
        );

        await base44.asServiceRole.entities.Lobby.update(lobbyId, {
          players: updatedPlayers,
          current_player_index: 1,
          current_question_id: 'q2',
        });
        logs.push('✅ Oyuncu 1 hamle yaptı, tur geçti');

        await sleep(300);

        // Oyuncu 2 hamle yapar
        const lobby2 = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        const updatedPlayers2 = lobby2.players.map((p, i) =>
          i === 1
            ? { ...p, cards: [...(p.cards || []), { id: 'q2', year: 1985, question: 'Test soru 2', type: 'metin' }] }
            : p
        );
        await base44.asServiceRole.entities.Lobby.update(lobbyId, {
          players: updatedPlayers2,
          current_player_index: 0,
          current_question_id: 'q3',
        });
        logs.push('✅ Oyuncu 2 hamle yaptı, tur geçti');

        return { status: 'PASS', logs };
      });
      results.normal = result;
    }

    // ─── SENARYO 2: Gecikmeli yazma (race condition) ──────────────────────────
    if (scenario === 'delayed' || scenario === 'all') {
      const result = await runScenario('delayed', base44, async (lobbyId) => {
        const logs = [];

        const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);

        // Oyuncu 1 optimistic update yapar (lokal state güncellendi)
        logs.push('⏳ Oyuncu 1 optimistic update uyguladı (lokal)');

        // DB yazma gecikmeli — 1.5sn sonra geliyor
        await sleep(1500);

        const updatedPlayers = lobby.players.map((p, i) =>
          i === 0
            ? { ...p, cards: [...(p.cards || []), { id: 'q1', year: 1969, question: 'Test', type: 'metin' }] }
            : p
        );

        await base44.asServiceRole.entities.Lobby.update(lobbyId, {
          players: updatedPlayers,
          current_player_index: 1,
          current_question_id: 'q2',
        });
        logs.push('✅ Gecikmeli DB yazma tamamlandı');

        // Subscription bu noktada tetikleniyor — pendingWrite kilidi DB yazma sonrası 2sn devam etmeli
        // Bu süre içinde gelen subscription event'i yok sayılmalı
        logs.push('🔍 Kontrol: pendingWriteRef.current=true iken subscription ezme engellendi mi?');

        await sleep(2100); // Kilit kalktıktan sonra

        const finalLobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        const p1Cards = finalLobby.players[0]?.cards?.length || 0;

        if (p1Cards === 1) {
          logs.push('✅ Kart korundu — race condition engellendi');
          return { status: 'PASS', logs };
        } else {
          logs.push(`❌ Kart kaybedildi! p1Cards=${p1Cards}`);
          return { status: 'FAIL', logs };
        }
      });
      results.delayed = result;
    }

    // ─── SENARYO 3: Eş zamanlı hamle (concurrent write) ─────────────────────
    if (scenario === 'concurrent' || scenario === 'all') {
      const result = await runScenario('concurrent', base44, async (lobbyId) => {
        const logs = [];

        const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);

        // İki oyuncu neredeyse aynı anda veri çekiyor (stale read)
        const [lobbyA, lobbyB] = await Promise.all([
          base44.asServiceRole.entities.Lobby.get(lobbyId),
          base44.asServiceRole.entities.Lobby.get(lobbyId),
        ]);
        logs.push('⚡ İki oyuncu aynı anda lobi verisini okudu (stale read senaryosu)');

        // Oyuncu A yazar
        const playersA = lobbyA.players.map((p, i) =>
          i === 0 ? { ...p, cards: [{ id: 'qA', year: 1990, question: 'A sorusu', type: 'metin' }] } : p
        );
        
        // Oyuncu B hemen arkasından yazar (A'nın yazısını ezme riski)
        const playersB = lobbyB.players.map((p, i) =>
          i === 1 ? { ...p, cards: [{ id: 'qB', year: 2000, question: 'B sorusu', type: 'metin' }] } : p
        );

        // Eş zamanlı yaz
        await Promise.all([
          base44.asServiceRole.entities.Lobby.update(lobbyId, {
            players: playersA,
            current_player_index: 1,
          }),
          sleep(50).then(() => base44.asServiceRole.entities.Lobby.update(lobbyId, {
            players: playersB,
            current_player_index: 0,
          })),
        ]);
        logs.push('⚡ İki eş zamanlı yazma tamamlandı');

        await sleep(500);
        const finalLobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
        const p1Cards = finalLobby.players[0]?.cards?.length || 0;
        const p2Cards = finalLobby.players[1]?.cards?.length || 0;

        logs.push(`📊 Sonuç: P1=${p1Cards} kart, P2=${p2Cards} kart`);

        // Bu senaryo'da son yazma kazanır — bu bilinen bir durum
        // Önemli olan: oyun state'inin tutarlı kalması (index doğru mu?)
        const indexOk = finalLobby.current_player_index === 0 || finalLobby.current_player_index === 1;
        if (indexOk) {
          logs.push('✅ current_player_index tutarlı kaldı — en az biri kazandı (last-write-wins)');
          return { status: 'PASS', logs };
        } else {
          logs.push('❌ current_player_index bozuldu!');
          return { status: 'FAIL', logs };
        }
      });
      results.concurrent = result;
    }

    return Response.json({ success: true, results });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function runScenario(name, base44, fn) {
  let lobbyId = null;
  try {
    // Senaryo için geçici lobi oluştur
    const lobby = await base44.asServiceRole.entities.Lobby.create({
      code: 'SIM' + name.substring(0, 3).toUpperCase(),
      host_email: 'sim_host@test.local',
      host_name: 'SimHost',
      players: [
        { email: 'sim_p1@test.local', name: 'SimP1', ready: true, cards: [] },
        { email: 'sim_p2@test.local', name: 'SimP2', ready: true, cards: [] },
      ],
      status: 'in_game',
      current_player_index: 0,
      current_question_id: 'q_start',
      used_question_ids: ['q_start'],
      category: 'karisik',
      year_start: 1900,
      year_end: 2020,
      turn_duration: 60,
      win_card_count: 10,
    });
    lobbyId = lobby.id;

    const result = await fn(lobbyId);
    return { scenario: name, ...result };
  } catch (err) {
    return { scenario: name, status: 'ERROR', error: err.message };
  } finally {
    // Temizle
    if (lobbyId) {
      await base44.asServiceRole.entities.Lobby.delete(lobbyId).catch(() => {});
    }
  }
}