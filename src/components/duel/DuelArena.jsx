import React from 'react';
import GameLayout from '@/components/game/GameLayout';

export default function DuelArena({ duel }) {
  const { players, myIndex, myPlayer, activeCard, canAttempt, pending, notice, error, feedback, selectedZone, setSelectedZone, submitPlacement, drag } = duel;
  return (
    <div className="relative" data-kronox-same-question-duel="active">
      <div className="pointer-events-none fixed left-3 top-3 z-[70] rounded-full border border-cyan-300/30 bg-slate-950/80 px-3 py-1 font-inter text-[10px] font-black text-cyan-100">
        DUELLO · 10 KART
      </div>
      {(error || notice || pending) && (
        <div className="pointer-events-none fixed left-1/2 top-[7.4rem] z-[70] w-[min(88vw,22rem)] -translate-x-1/2 rounded-xl border border-amber-300/30 bg-slate-950/90 px-3 py-2 text-center font-inter text-xs font-bold text-amber-100">
          {pending ? 'Hamle sunucuda doğrulanıyor...' : (error || notice)}
        </div>
      )}
      <GameLayout
        players={players} currentPlayerIndex={myIndex} currentPlayer={myPlayer}
        currentQuestion={activeCard} winCardCount={10} selectedZone={selectedZone}
        isDragging={drag.isDragging} touchDragPos={drag.touchDragPos} touchDragEnd={drag.touchDragEnd}
        isMyTurn={canAttempt} isOnline myEmail={null}
        onlineModeLabel="İlk doğru yerleştirme kartı alır"
        onlineReadOnlyLabel="CEVABIN KİLİTLİ"
        onlineReadOnlyMessage="Bu kart için cevabın kilitlendi. Rakibin hamlesi bekleniyor."
        feedback={feedback} winner={null} turnDuration={0} timerKey={activeCard?.sequence_id || 0} isTimeUp={false}
        progressCardCount={myPlayer?.claimed_count || 0} progressCardTarget={10}
        onSelectZone={setSelectedZone} onDropOnZone={submitPlacement}
        onConfirmPlacement={() => submitPlacement(selectedZone)}
        onDragStart={drag.onDragStart} onDragEnd={drag.onDragEnd}
        onTouchDragMove={drag.onTouchDragMove} onTouchDragEnd={drag.onTouchDragEnd}
        onTouchDragCancel={drag.onTouchDragCancel} interactionPaused={pending || !canAttempt}
      />
    </div>
  );
}
