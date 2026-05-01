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
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(to bottom, #0B1F3A 0%, #1E3A8A 100%)' }}>
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
          <img
            src="https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/d9d7b953d_Kronoxlogo1.png"
            alt="Kronox"
            className="h-12 object-contain"
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
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-colors
                ${showChat ? 'bg-primary/20 border-primary/60 text-primary' : 'bg-white/10 border-white/20 text-white/70'}`}
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          )}
          {/* Placeholder so layout stays balanced when no chat and no timer */}
          {!isOnline && !isMyTurn && <div className="w-10 h-10" />}
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
      <div className="flex-shrink-0 flex justify-center items-center px-4 py-2">
        {currentQuestion && isMyTurn && !winner ? (
          <div className="relative">
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