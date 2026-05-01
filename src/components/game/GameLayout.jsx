import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, RotateCcw, ChevronRight, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  // Handlers
  onSelectZone,
  onDropOnZone,
  onConfirmPlacement,
  onUndoPlacement,
  onSkipTurn,
  onImageError,
  onDragStart,
  onDragEnd,
  onTouchDragMove,
  onTouchDragEnd,
  onExternalZoneChange,
  onTimeUp,
  onBack,
  onToggleSettings,
  onToggleChat,
}) {
  // "Sıradaki Kartlar" — all cards except the one currently being placed
  const handCards = currentPlayer?.cards?.slice() || [];

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a2a6e 0%, #0a0e2e 60%, #07091f 100%)' }}>
      {/* TOP BAR */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 pt-2 pb-1 gap-2"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
      >
        {/* Left: Settings */}
        <button
          onClick={onToggleSettings}
          className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white/70 hover:bg-white/20 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Center: Logo + progress */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <h1 className="font-bangers text-3xl text-primary tracking-widest leading-none" style={{ textShadow: '0 2px 12px rgba(255,193,7,0.5), 0 0 30px rgba(255,193,7,0.3)' }}>
            KRONOS
          </h1>
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

        {/* Right: Score / Timer */}
        <div className="flex items-center gap-1.5">
          <TurnTimer key={timerKey} active={!feedback && !winner} onTimeUp={isMyTurn ? onTimeUp : undefined} duration={turnDuration} />
          {isOnline && (
            <button
              onClick={onToggleChat}
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-colors
                ${showChat ? 'bg-primary/20 border-primary/60 text-primary' : 'bg-white/10 border-white/20 text-white/70'}`}
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          )}
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

      {/* CENTER: Question card */}
      <div className="flex-shrink-0 flex justify-center px-8 py-2">
        {currentQuestion && isMyTurn && !winner ? (
          <div className="w-full max-w-xs">
            <QuestionCard
              question={currentQuestion}
              onImageError={onImageError}
              draggable={!feedback}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onTouchDragMove={onTouchDragMove}
              onTouchDragEnd={onTouchDragEnd}
            />
          </div>
        ) : currentQuestion && !isMyTurn ? (
          <div className="w-full max-w-xs rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center py-8 text-center">
            <p className="font-inter text-white/60 text-sm">
              <span className="text-primary font-bold block mb-1">{currentPlayer?.name}</span>
              oynuyor…
            </p>
          </div>
        ) : null}
      </div>

      {/* TIMELINE */}
      <div className="flex-shrink-0 px-2 py-1">
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden py-2">
          {currentPlayer && (
            <Timeline
              cards={currentPlayer.cards}
              selectedZone={isMyTurn ? selectedZone : null}
              onSelectZone={isMyTurn ? onSelectZone : undefined}
              isDragMode={isDragging && isMyTurn}
              onPlaceCard={isMyTurn ? onDropOnZone : undefined}
              externalTouchX={isMyTurn ? touchDragPos?.x : null}
              externalTouchY={isMyTurn ? touchDragPos?.y : null}
              externalTouchEnd={isMyTurn ? touchDragEnd : null}
              onExternalZoneChange={onExternalZoneChange}
            />
          )}
        </div>
      </div>

      {/* HAND CARDS (next cards preview) */}
      {handCards.length > 0 && (
        <div className="flex-shrink-0 px-3 py-1">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="font-inter text-xs text-white/50 font-semibold">Sıradaki Kartlar</span>
            <span className="text-xs text-white/30 ml-1">{handCards.length}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {handCards.map((card, i) => (
              <div key={card.id || i} className="flex-shrink-0 bg-white rounded-xl p-1.5 shadow" style={{ width: 64 }}>
                <div className="text-center font-bangers text-sm text-gray-800 leading-none">{card.year}</div>
                <div className="text-center text-lg my-0.5">
                  {({ tarih:'🏰', bilim:'🔬', spor:'⚽', sanat:'🎨', teknoloji:'💡', genel:'🌍' })[card.category] || '🌍'}
                </div>
                <div className="text-center font-inter text-[8px] text-gray-600 leading-tight line-clamp-2">{card.question}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOTTOM BUTTONS */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 pt-2"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {/* Undo */}
        <button
          onClick={onUndoPlacement}
          className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white/60 hover:bg-white/20 transition-colors flex-shrink-0"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {/* Main action */}
        <button
          onClick={isMyTurn && selectedZone !== null ? onConfirmPlacement : undefined}
          disabled={!isMyTurn || selectedZone === null || !!feedback || !!winner}
          className={`flex-1 h-12 rounded-2xl font-bangers text-xl tracking-wider transition-all
            ${isMyTurn && selectedZone !== null && !feedback && !winner
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/40 hover:bg-primary/90 active:scale-95'
              : 'bg-white/10 text-white/30 cursor-not-allowed'}
          `}
        >
          Kartı Yerleştir
        </button>

        {/* Skip */}
        <button
          onClick={onSkipTurn}
          className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white/60 hover:bg-white/20 transition-colors flex-shrink-0"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Ghost drag card */}
      <AnimatePresence>
        {isDragging && touchDragPos && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0.8 }}
            animate={{ scale: 1.05, opacity: 0.95 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="fixed z-50 pointer-events-none"
            style={{ left: touchDragPos.x - 90, top: touchDragPos.y - 50, width: 180 }}
          >
            <div className="rounded-2xl bg-white shadow-2xl px-3 py-3 text-center">
              <p className="font-inter text-sm text-gray-800 font-semibold line-clamp-2 leading-snug">
                {currentQuestion?.question}
              </p>
              <p className="font-inter text-xs text-gray-400 mt-1">↓ bırak</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}