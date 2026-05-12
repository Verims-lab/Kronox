import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, RotateCcw, ChevronRight, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sounds } from '@/lib/gameSounds';

function CTAButton({ active, onClick, disabled }) {
  return (
    <motion.button
      onClick={() => { if (active && onClick) { sounds.tap(); onClick(); } }}
      disabled={disabled}
      animate={active ? {
        boxShadow: ['0 0 16px rgba(250,204,21,0.4)', '0 0 28px rgba(250,204,21,0.7)', '0 0 16px rgba(250,204,21,0.4)'],
        scale: [1, 1.02, 1],
      } : {
        boxShadow: 'none',
        scale: 1,
      }}
      transition={active ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
      className="flex-1 h-12 rounded-2xl font-bangers text-xl tracking-wider transition-colors"
      style={{
        background: active
          ? 'linear-gradient(135deg, #facc15 0%, #f59e0b 100%)'
          : 'rgba(255,255,255,0.08)',
        color: active ? '#0a0f23' : 'rgba(255,255,255,0.25)',
        cursor: active ? 'pointer' : 'not-allowed',
      }}
    >
      Kartı Yerleştir
    </motion.button>
  );
}
import QuestionCard from './QuestionCard.jsx';
import Timeline from './Timeline.jsx';
import PlayerIndicator from './PlayerIndicator.jsx';
import TurnTimer from './TurnTimer.jsx';
import LobbyChat from '@/components/lobby/LobbyChat';
import { playerTextColors } from './playerColors';

export default function GameLayout({
  // Game state
  players,
  currentPlayerIndex,
  currentPlayer,
  currentQuestion,
  winCardCount,
  selectedZone,
  isDragging,
  touchDragPos,
  touchDragEnd,
  isMyTurn,
  isOnline,
  myPlayerName,
  myPlayer,
  lobbyId,
  feedback,
  winner,
  turnDuration,
  timerKey,
  showSettings,
  showChat,
  isTimeUp,
  // Handlers
  onSelectZone,
  onDropOnZone,
  onConfirmPlacement,
  onUndoPlacement,
  onSkipTurn,
  onImageError,
  onAudioError,
  onDragStart,
  onDragEnd,
  onTouchDragMove,
  onTouchDragEnd,
  onTimeUp,
  onBack,
  onToggleSettings,
  onToggleChat,
}) {
  // Ghost card follows the raw finger position (viewport coords) — no scroll correction needed
  // Timeline uses world coords internally for hit-testing

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(to bottom, #0B1F3A 0%, #1E3A8A 100%)' }}>
      {/* TOP BAR */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 pt-2 pb-1 gap-2"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
      >
        {/* Left: Settings */}
        <button
          onClick={onToggleSettings}
          className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white/70 hover:bg-white/20 transition-colors"
          aria-label="Oyun ayarları"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Center: Logo + progress */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <img
            src="https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/49fc6f458_kronoxnobckgrnd.png"
            alt="Kronox"
            className="h-20 object-contain mb-1"
          />
          {/* Progress bar */}
          <div className="w-32 mt-1">
            <div className="text-center text-white/60 text-xs font-inter mb-0.5">
              {currentPlayer?.cards?.length || 0}/{winCardCount}
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-yellow-300"
                animate={{ width: `${((currentPlayer?.cards?.length || 0) / winCardCount) * 100}%` }}
                transition={{ type: 'spring', stiffness: 200, damping: 30 }}
              />
            </div>
          </div>
        </div>

        {/* Right: Timer + Chat */}
        <div className="flex items-center gap-1.5">
          {isMyTurn && !winner && (
            <TurnTimer key={timerKey} active={!feedback && !winner} onTimeUp={isMyTurn ? onTimeUp : undefined} duration={turnDuration} size="lg" />
          )}
          {isOnline && (
            <button
              onClick={onToggleChat}
              className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition-colors min-h-[44px] min-w-[44px]
                ${showChat ? 'bg-primary/20 border-primary/60 text-primary' : 'bg-white/10 border-white/20 text-white/70'}`}
              aria-label={showChat ? 'Sohbeti kapat' : 'Sohbeti aç'}
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          )}
          {/* Placeholder so layout stays balanced when no chat and no timer */}
          {!isOnline && !isMyTurn && <div className="w-11 h-11" />}
        </div>
      </div>

      {/* CURRENT PLAYER LABEL */}
      {players.length > 1 && (
        <div className="flex-shrink-0 flex items-center justify-center gap-2 pb-1">
          <div className={`w-2 h-2 rounded-full animate-pulse ${['bg-blue-400','bg-rose-400','bg-emerald-400','bg-violet-400'][currentPlayerIndex % 4]}`} />
          <span className={`font-inter text-sm font-semibold ${playerTextColors[currentPlayerIndex % playerTextColors.length]}`}>
            {currentPlayer?.name}
          </span>
        </div>
      )}

      {/* CENTER: Instruction + Question card */}
      <div className="flex-shrink-0 flex flex-col items-center px-4 py-1 gap-1">
        {/* Instruction text */}
        {isMyTurn && !winner && currentQuestion && !feedback && (
          <div className="text-center">
            <p className="font-inter font-semibold tracking-wide" style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
              KARTI ZAMAN ÇİZGİSİNE
            </p>
            <p className="font-bangers tracking-widest" style={{ fontSize: 18, color: '#facc15' }}>
              YERLEŞTİR!
            </p>
          </div>
        )}

        {currentQuestion && isMyTurn && !winner ? (
          <QuestionCard
            question={currentQuestion}
            onImageError={onImageError}
            onAudioError={onAudioError}
            draggable={!feedback}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onTouchDragMove={onTouchDragMove}
            onTouchDragEnd={onTouchDragEnd}
          />
        ) : currentQuestion && !isMyTurn ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-xs rounded-2xl flex flex-col items-center justify-center py-7 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <motion.div
              animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-3 h-3 rounded-full bg-primary mb-3"
              style={{ boxShadow: '0 0 10px rgba(250,204,21,0.6)' }}
            />
            <span className="font-bangers text-xl tracking-wider text-primary block mb-0.5">{currentPlayer?.name}</span>
            <span className="font-inter text-white/40 text-xs">düşünüyor…</span>
          </motion.div>
        ) : null}
      </div>

      {/* TIMELINE */}
      <div className="flex-shrink-0 px-2 py-1">
        <div
          className="rounded-2xl overflow-hidden py-2 transition-all duration-300"
          style={{
            background: isTimeUp ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.04)',
            border: isTimeUp ? '1.5px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.08)',
            boxShadow: isTimeUp ? '0 0 16px rgba(239,68,68,0.2)' : 'none',
          }}
        >
          {currentPlayer && (
            <Timeline
              cards={currentPlayer.cards}
              selectedZone={isMyTurn ? selectedZone : null}
              onSelectZone={isMyTurn ? onSelectZone : undefined}
              isDragMode={isDragging && isMyTurn}
              onPlaceCard={isMyTurn ? onDropOnZone : undefined}
              dragClientX={isMyTurn ? touchDragPos?.x : null}
              dragClientY={isMyTurn ? touchDragPos?.y : null}
              dragEndEvent={isMyTurn && touchDragEnd ? { clientX: touchDragEnd.x, clientY: touchDragEnd.y } : null}
              isTimeUp={isTimeUp}
            />
          )}
        </div>

        {/* SÜRE DOLDU uyarısı */}
        {isTimeUp && (
          <div className="flex items-center gap-2 mt-2 px-1">
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
              <span style={{ fontSize: 11 }}>⏱</span>
            </div>
            <div>
              <p className="font-bangers tracking-wider text-red-400" style={{ fontSize: 13 }}>SÜRE DOLDU!</p>
              <p className="font-inter text-red-400/70" style={{ fontSize: 10 }}>Bir seçim yapmadan süre bitti.</p>
            </div>
          </div>
        )}
      </div>



      {/* BOTTOM BUTTONS */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 pt-2"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {/* Undo */}
        <button
          onClick={onUndoPlacement}
          className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white/60 hover:bg-white/20 transition-colors flex-shrink-0 min-h-[44px] min-w-[44px]"
          aria-label="Son hamlayı geri al"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {/* Main action */}
        <CTAButton
          active={isMyTurn && selectedZone !== null && !feedback && !winner}
          onClick={isMyTurn && selectedZone !== null ? onConfirmPlacement : undefined}
          disabled={!isMyTurn || selectedZone === null || !!feedback || !!winner}
        />

        {/* Skip */}
        <button
          onClick={onSkipTurn}
          className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white/60 hover:bg-white/20 transition-colors flex-shrink-0 min-h-[44px] min-w-[44px]"
          aria-label="Turunuzu atla"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Ghost drag card */}
      <AnimatePresence>
        {isDragging && touchDragPos && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 0.9 }}
            exit={{ scale: 0.85, opacity: 0 }}
            className="fixed z-50 pointer-events-none"
            style={{ left: touchDragPos.x - 80, top: touchDragPos.y - 60, width: 160 }}
          >
            <div
              className="rounded-2xl px-3 py-3 text-center"
              style={{
                background: 'linear-gradient(160deg, #0f1428 0%, #0a0f23 100%)',
                border: '2px solid #facc15',
                boxShadow: '0 0 20px rgba(250,204,21,0.4)',
              }}
            >
              <p className="font-inter text-xs text-white font-semibold line-clamp-2 leading-snug">
                {currentQuestion?.question}
              </p>
              <p className="font-bangers text-sm text-yellow-400 mt-1 tracking-wide">↓ BIRAK</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}