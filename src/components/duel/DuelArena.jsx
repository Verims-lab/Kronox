import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, LockKeyhole, Timer } from 'lucide-react';
import QuestionCard from '@/components/game/QuestionCard';
import Timeline from '@/components/game/Timeline';

export default function DuelArena({ duel }) {
  const {
    myPlayer,
    opponent,
    activeCard,
    sharedTimeline,
    sequence,
    canAttempt,
    answerLocked,
    pending,
    notice,
    error,
    feedback,
    selectedZone,
    setSelectedZone,
    submitPlacement,
    drag,
    clock,
    questionFingerprint,
    timelineFingerprint,
    myCorrectCount,
    opponentCorrectCount,
    isSuddenDeath,
    matchState,
    navigate,
  } = duel;

  const statusText = error || notice || (isSuddenDeath ? 'ANİ ÖLÜM' : '');
  const isCountdown = clock.countdownValue > 0;
  const interactionLocked = !canAttempt || pending || isCountdown;

  return (
    <main
      className="relative min-h-[100dvh] overflow-x-hidden text-white"
      data-kronox-same-question-duel="v2-shared-timeline"
      data-kronox-duello-state={matchState}
      data-kronox-duello-sequence={sequence || 'pending'}
      data-kronox-duello-question-index={sequence || 0}
      data-kronox-duello-question-fingerprint={questionFingerprint}
      data-kronox-duello-timeline-fingerprint={timelineFingerprint}
      data-kronox-duello-timeline-count={sharedTimeline.length}
      data-kronox-duello-answer-locked={answerLocked ? 'true' : 'false'}
      data-kronox-duello-deadline={duel.lobby?.duel_question_deadline || ''}
      data-testid="duello-active-card"
      style={/** @type {React.CSSProperties} */ ({
        minHeight: '100dvh',
        background:
          'radial-gradient(circle at 50% 18%, rgba(31,91,151,0.35), transparent 34%), linear-gradient(180deg, #06152f 0%, #08294b 48%, #041226 100%)',
        '--solo-active-question-card-width': 'clamp(9.5rem, 42vw, 12rem)',
        '--solo-active-question-card-height': 'clamp(14rem, 34dvh, 17rem)',
        '--solo-timeline-card-width': 'clamp(4.25rem, 19vw, 5rem)',
        '--solo-timeline-card-height': 'clamp(5.8rem, 16dvh, 6.75rem)',
      })}
    >
      <div
        className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col px-3"
        style={{
          paddingTop: 'calc(0.65rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
        }}
      >
        <header className="relative grid min-h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <PlayerScore player={myPlayer} count={myCorrectCount} align="left" label="SEN" />
          <div className="flex min-w-[4.5rem] flex-col items-center justify-center">
            <span className="kronox-number text-base font-black text-[#FFC928]" data-testid="duello-question-progress">
              {Math.max(1, sequence)} / 12
            </span>
            <span className="mt-0.5 font-inter text-[9px] font-bold text-cyan-100/70">
              {isSuddenDeath ? 'ANİ ÖLÜM' : 'DUELLO'}
            </span>
          </div>
          <PlayerScore player={opponent} count={opponentCorrectCount} align="right" label="RAKİP" />
          <button
            type="button"
            aria-label="Duello'dan çık"
            title="Duello'dan çık"
            onClick={() => navigate('/')}
            className="absolute -bottom-8 left-0 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-[#07172f]/85 text-white/80"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="mt-6 flex min-h-8 items-center justify-center px-10">
          <AnimatePresence mode="wait">
            {statusText && (
              <motion.p
                key={`${sequence}:${statusText}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="text-center font-barlow text-sm font-black text-[#FFC928]"
                data-testid="duello-status-message"
              >
                {statusText}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <section className="relative mt-1 flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          <p className="font-barlow text-sm font-bold text-white/90">KARTI ORTAK ZAMAN ÇİZGİSİNE YERLEŞTİR</p>
          {activeCard ? (
            <div className="relative">
              <QuestionCard
                question={activeCard}
                onImageError={undefined}
                onAudioError={undefined}
                draggable={!interactionLocked && !feedback}
                readOnly={interactionLocked || Boolean(feedback)}
                readOnlyLabel={answerLocked ? 'CEVABIN KİLİTLENDİ' : (isCountdown ? 'HAZIRLAN' : 'BEKLE')}
                onDragStart={!interactionLocked ? drag.onDragStart : undefined}
                onDragEnd={!interactionLocked ? drag.onDragEnd : undefined}
                onTouchDragMove={!interactionLocked ? drag.onTouchDragMove : undefined}
                onTouchDragEnd={!interactionLocked ? drag.onTouchDragEnd : undefined}
                onTouchDragCancel={!interactionLocked ? drag.onTouchDragCancel : undefined}
                onlineReadableCard
              />
              {answerLocked && !feedback && (
                <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#06152f]/88 px-2 py-1.5 font-inter text-[10px] font-bold text-cyan-100">
                  <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                  CEVABIN KİLİTLENDİ
                </div>
              )}
              <AnimatePresence>
                {isCountdown && (
                  <motion.div
                    key={clock.countdownValue}
                    initial={{ opacity: 0, scale: 0.78 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.15 }}
                    className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl bg-[#06152f]/58 font-barlow text-6xl font-black text-[#FFC928]"
                    data-testid="duello-countdown"
                  >
                    {clock.countdownValue}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center font-inter text-sm text-white/65">Ortak soru hazırlanıyor</div>
          )}
        </section>

        <section
          className="mt-3 flex-shrink-0 overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#173763] py-2 shadow-[0_12px_28px_rgba(0,0,0,0.24)]"
          data-testid="duello-shared-timeline"
        >
          <Timeline
            cards={sharedTimeline}
            selectedZone={canAttempt ? selectedZone : null}
            onSelectZone={canAttempt ? setSelectedZone : undefined}
            isDragMode={drag.isDragging && canAttempt}
            onPlaceCard={canAttempt ? submitPlacement : undefined}
            dragClientX={canAttempt ? drag.touchDragPos?.x : null}
            dragClientY={canAttempt ? drag.touchDragPos?.y : null}
            dragEndEvent={canAttempt && drag.touchDragEnd
              ? { clientX: drag.touchDragEnd.x, clientY: drag.touchDragEnd.y }
              : null}
            onZoneChange={undefined}
            isTimeUp={clock.deadlineReached}
            scrollRefCallback={undefined}
            placementFeedback={feedback && ['correct', 'wrong'].includes(feedback.result) ? feedback : null}
            onGuidedScrollHintInteraction={undefined}
            soloYearOnlyCards
          />
        </section>

        <button
          type="button"
          data-testid="duello-confirm-placement"
          onClick={() => submitPlacement(selectedZone)}
          disabled={!canAttempt || selectedZone === null}
          className="mt-2 h-11 w-full flex-shrink-0 rounded-xl bg-[#FFC928] font-barlow text-base font-black text-[#07172f] shadow-[0_6px_16px_rgba(255,201,40,0.22)] disabled:cursor-not-allowed disabled:bg-[#2b405d] disabled:text-white/35 disabled:shadow-none"
        >
          KARTI YERLEŞTİR
        </button>

        <div className="mt-2 flex-shrink-0" data-testid="duello-time-bar">
          <div className="mb-1 flex items-center justify-between font-inter text-[10px] font-bold text-cyan-100/80">
            <span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" aria-hidden="true" /> ORTAK SÜRE</span>
            <span className="kronox-number">{answerLocked ? 'KİLİTLİ' : `${clock.remainingSeconds} sn`}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full border border-cyan-200/20 bg-[#07172f]">
            <div
              className="h-full rounded-full bg-[#FFC928]"
              style={{ width: `${answerLocked ? 0 : clock.timePercent}%`, transition: 'width 100ms linear' }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function PlayerScore({ player, count, align, label }) {
  const isRight = align === 'right';
  return (
    <div className={`min-w-0 ${isRight ? 'text-right' : 'text-left'}`}>
      <p className="truncate font-inter text-[9px] font-bold text-cyan-100/65">{label}</p>
      <p className="truncate font-inter text-xs font-black text-white" title={player?.username || player?.name || ''}>
        {player?.username || player?.name || 'Oyuncu'}
      </p>
      <p className="kronox-number mt-0.5 text-lg font-black text-[#FFC928]">{count}</p>
    </div>
  );
}
