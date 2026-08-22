import React from 'react';
import { Home, RotateCcw, Swords, Trophy } from 'lucide-react';

export default function DuelResult({ duel }) {
  const {
    isWinner,
    isDraw,
    myPlayer,
    opponent,
    myCorrectCount,
    opponentCorrectCount,
    earnedPoints,
    scoreResult,
    lobby,
    navigate,
  } = duel;
  const title = isDraw ? 'BERABERE!' : (isWinner ? 'KAZANDIN!' : 'DUELLO SONA ERDİ');
  const winnerName = lobby?.winner || opponent?.username || opponent?.name || 'Rakip';
  const resultMessage = isDraw
    ? '12 soru sonunda doğru sayıları eşit'
    : (isWinner ? 'Ortak zaman çizgisinde üstünlük senin' : `${winnerName} kazandı`);

  return (
    <main
      className="flex min-h-[100dvh] items-center justify-center px-4 text-white"
      data-kronox-duel-result={isDraw ? 'draw' : (isWinner ? 'win' : 'loss')}
      data-kronox-duello-result-reason={lobby?.duel_result_reason || ''}
      style={{
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
        background:
          'radial-gradient(circle at 50% 25%, rgba(31,91,151,0.36), transparent 36%), linear-gradient(180deg, #06152f 0%, #041226 100%)',
      }}
    >
      <section className="w-full max-w-sm rounded-lg border border-cyan-300/25 bg-[#0b2143]/94 p-5 text-center shadow-[0_18px_44px_rgba(0,0,0,0.34)]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#FFC928] text-[#07172f] shadow-[0_0_24px_rgba(255,201,40,0.35)]">
          {isWinner ? <Trophy className="h-8 w-8" aria-hidden="true" /> : <Swords className="h-8 w-8" aria-hidden="true" />}
        </div>
        <h1 className="mt-4 font-barlow text-3xl font-black text-[#FFC928]">{title}</h1>
        <p className="mt-1 font-inter text-sm text-cyan-50/70">{resultMessage}</p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <PlayerResult player={myPlayer} count={myCorrectCount} label="SEN" highlighted={isWinner} />
          <PlayerResult player={opponent} count={opponentCorrectCount} label="RAKİP" highlighted={!isDraw && !isWinner} />
        </div>

        {isWinner && earnedPoints > 0 && (
          <p className="mt-5 font-barlow text-2xl font-black text-[#FFC928]" data-testid="duello-earned-points">
            +{earnedPoints} PUAN
          </p>
        )}
        {isDraw && <p className="mt-5 font-barlow text-lg font-black text-white/75">PUAN YOK</p>}
        <p className="mt-1 min-h-5 font-inter text-xs text-cyan-50/60">
          {scoreResult?.message || (scoreResult?.saved ? 'Sonuç sunucu tarafından kaydedildi' : 'Sonuç sunucu tarafından doğrulandı')}
        </p>

        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Rövanş eşleştirmesi güvenli biçimde etkinleştirildiğinde kullanılabilir"
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-[#FFC928]/35 bg-[#FFC928]/15 font-barlow text-base font-black text-[#FFC928]/55"
          data-kronox-rematch-state="gated-pending"
        >
          <RotateCcw className="h-5 w-5" aria-hidden="true" />
          RÖVANŞ İSTE
        </button>
        <p className="mt-1 font-inter text-[10px] text-white/45">Rövanş eşleştirmesi yakında</p>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-cyan-200/25 bg-[#07172f] font-barlow text-base font-black text-white"
        >
          <Home className="h-5 w-5" aria-hidden="true" />
          ANA SAYFA
        </button>
      </section>
    </main>
  );
}

function PlayerResult({ player, count, label, highlighted }) {
  return (
    <div className={`min-w-0 rounded-lg border p-3 ${highlighted ? 'border-[#FFC928]/55 bg-[#FFC928]/10' : 'border-cyan-200/15 bg-[#07172f]/70'}`}>
      <p className="font-inter text-[9px] font-bold text-cyan-100/55">{label}</p>
      <p className="mt-1 truncate font-inter text-xs font-black text-white" title={player?.username || player?.name || ''}>
        {player?.username || player?.name || 'Oyuncu'}
      </p>
      <p className="kronox-number mt-2 text-xl font-black text-[#FFC928]">{count}</p>
      <p className="font-inter text-[10px] text-white/55">doğru</p>
    </div>
  );
}
