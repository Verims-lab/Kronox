import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Gem, Gift, Loader2, RotateCw, Sparkles, X } from 'lucide-react';
import { useDailyWheel } from '@/hooks/useDailyWheel';
import { sounds } from '@/lib/gameSounds';

function formatCountdown(nextAvailableAt) {
  const target = Date.parse(String(nextAvailableAt || ''));
  if (!Number.isFinite(target)) return 'Yarın hazır';
  const ms = Math.max(0, target - Date.now());
  if (!ms) return 'Yarın hazır';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours <= 0) return `${minutes || 1} dk sonra`;
  return `${hours} sa ${minutes} dk`;
}

function formatDiamondCount(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  return n.toLocaleString('tr-TR');
}

export default function DailyWheelCard({ user, onUserUpdated, onLogin }) {
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const wheel = useDailyWheel({ user, onUserUpdated });
  const claimedLabel = useMemo(
    () => formatCountdown(wheel.wheel?.nextAvailableAt),
    [wheel.wheel?.nextAvailableAt],
  );

  const handleCardClick = () => {
    sounds.tap();
    if (wheel.status === 'sign_in_required') {
      onLogin?.();
      return;
    }
    if (wheel.status === 'available') {
      wheel.openResult();
      return;
    }
    if (wheel.status === 'claimed') {
      setStatusModalOpen(true);
      return;
    }
    if (wheel.status === 'error') wheel.refresh();
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={handleCardClick}
        disabled={wheel.claiming}
        aria-busy={wheel.claiming ? 'true' : 'false'}
        whileTap={{ y: 1, scale: 0.99 }}
        className="relative flex w-full items-center justify-center overflow-hidden font-inter text-left"
        style={{
          minHeight: 'clamp(72px, 17vw, 88px)',
          borderRadius: 18,
          border: '1px solid rgba(250,204,21,0.38)',
          background:
            'linear-gradient(135deg, rgba(5,14,36,0.88) 0%, rgba(10,28,66,0.88) 60%, rgba(5,14,36,0.92) 100%)',
          boxShadow:
            wheel.status === 'available'
              ? '0 0 20px rgba(250,204,21,0.18), inset 0 0 0 1px rgba(255,255,255,0.06)'
              : 'inset 0 0 0 1px rgba(255,255,255,0.05)',
          color: '#f8fafc',
        }}
        aria-label="Günlük Çark"
      >
        {wheel.status === 'available' && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-0"
            animate={{ opacity: [0.25, 0.55, 0.25] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background: 'radial-gradient(circle at 22% 50%, rgba(250,204,21,0.24), transparent 42%)',
            }}
          />
        )}

        <div className="relative flex w-full items-center gap-3 px-4 py-3">
          <WheelEmblem spinning={wheel.claiming} muted={wheel.status === 'claimed'} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="truncate"
                style={{
                  fontSize: 'clamp(17px, 5vw, 22px)',
                  fontWeight: 900,
                  letterSpacing: '0',
                  textShadow: '0 2px 8px rgba(0,0,0,0.45)',
                }}
              >
                Günlük Çark
              </span>
              {wheel.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-amber-200" />}
            </div>
            <StatusBadge wheel={wheel} claimedLabel={claimedLabel} />
          </div>
        </div>
      </motion.button>

      {wheel.showPrompt && (
        <DailyWheelPromptModal
          claiming={wheel.claiming}
          onSpin={wheel.claim}
          onClose={wheel.dismissPrompt}
        />
      )}

      {wheel.showResult && (
        <DailyWheelResultModal
          status={wheel.status}
          error={wheel.error}
          claiming={wheel.claiming}
          result={wheel.lastResult}
          onSpin={wheel.claim}
          onClose={wheel.closeResult}
        />
      )}

      {statusModalOpen && (
        <DailyWheelStatusModal
          nextLabel={claimedLabel}
          onClose={() => setStatusModalOpen(false)}
        />
      )}
    </>
  );
}

function StatusBadge({ wheel, claimedLabel }) {
  if (wheel.status === 'sign_in_required') {
    return <Badge tone="neutral" icon={Gift} label="Giriş gerekli" />;
  }
  if (wheel.status === 'loading') {
    return <Badge tone="neutral" icon={Loader2} label="Kontrol ediliyor" />;
  }
  if (wheel.status === 'error') {
    return <Badge tone="danger" icon={RotateCw} label="Tekrar dene" />;
  }
  if (wheel.status === 'claimed') {
    return <Badge tone="passive" icon={Gem} label={claimedLabel || 'Yarın hazır'} />;
  }
  return <Badge tone="ready" icon={Sparkles} label="Hazır!" />;
}

function Badge({ icon: Icon, label, tone }) {
  const styles = {
    ready: {
      color: '#86efac',
      border: 'rgba(132,204,22,0.45)',
      bg: 'rgba(132,204,22,0.10)',
    },
    passive: {
      color: '#cbd5e1',
      border: 'rgba(148,163,184,0.28)',
      bg: 'rgba(148,163,184,0.08)',
    },
    danger: {
      color: '#fecaca',
      border: 'rgba(248,113,113,0.4)',
      bg: 'rgba(248,113,113,0.10)',
    },
    neutral: {
      color: '#fde68a',
      border: 'rgba(250,204,21,0.35)',
      bg: 'rgba(250,204,21,0.08)',
    },
  }[tone] || {};

  return (
    <span
      className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold"
      style={{
        color: styles.color,
        background: styles.bg,
        boxShadow: `inset 0 0 0 1px ${styles.border}`,
      }}
    >
      <Icon className={`h-3.5 w-3.5 ${Icon === Loader2 ? 'animate-spin' : ''}`} />
      {label}
    </span>
  );
}

function WheelEmblem({ spinning, muted }) {
  const spokes = Array.from({ length: 12 }, (_, index) => index);
  return (
    <motion.span
      aria-hidden="true"
      className="relative grid shrink-0 place-items-center"
      animate={spinning ? { rotate: 720 } : { rotate: 0 }}
      transition={{ duration: 1.15, ease: [0.2, 0.9, 0.2, 1] }}
      style={{
        width: 'clamp(58px, 15.8vw, 70px)',
        height: 'clamp(58px, 15.8vw, 70px)',
        opacity: muted ? 0.72 : 1,
        filter: 'drop-shadow(0 0 14px rgba(250,204,21,0.34))',
      }}
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 38% 30%, rgba(255,255,255,0.35), rgba(250,204,21,0.18) 22%, transparent 46%)',
        }}
      />
      <span
        className="absolute inset-[3px] rounded-full"
        style={{
          background: 'linear-gradient(145deg, #ffe77a 0%, #f6b70b 42%, #8b5204 100%)',
          boxShadow: 'inset 0 2px 2px rgba(255,255,255,0.38), inset 0 -3px 5px rgba(60,27,0,0.5)',
        }}
      />
      <span
        className="absolute inset-[9px] rounded-full"
        style={{
          background: 'radial-gradient(circle at 50% 50%, #0b1736 0%, #101f46 54%, #030817 100%)',
          boxShadow: 'inset 0 0 0 2px rgba(255,217,102,0.72), inset 0 0 16px rgba(0,0,0,0.62)',
        }}
      />
      {spokes.map((index) => {
        const highlighted = index % 3 === 0;
        return (
          <span
            key={index}
            className="absolute left-1/2 top-1/2 origin-left"
            style={{
              width: '31%',
              height: highlighted ? 2 : 1,
              transform: `rotate(${index * 30}deg)`,
              background: highlighted
                ? 'linear-gradient(90deg, rgba(255,236,160,0.18), rgba(255,218,74,0.95))'
                : 'linear-gradient(90deg, rgba(255,236,160,0.08), rgba(250,204,21,0.72))',
              borderRadius: 999,
              boxShadow: highlighted ? '0 0 4px rgba(250,204,21,0.5)' : 'none',
            }}
          />
        );
      })}
      <span
        className="absolute rounded-full"
        style={{
          width: '24%',
          height: '24%',
          background: 'radial-gradient(circle at 35% 28%, #fff7bd, #facc15 45%, #a16207 100%)',
          boxShadow: '0 0 0 2px rgba(91,42,0,0.65), 0 0 10px rgba(250,204,21,0.45)',
        }}
      />
      <span
        className="absolute"
        style={{
          top: '2%',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '14px solid #f8fafc',
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.72)) drop-shadow(0 0 3px rgba(250,204,21,0.35))',
        }}
      />
    </motion.span>
  );
}

function DailyWheelPromptModal({ claiming, onSpin, onClose }) {
  return (
    <DailyWheelModalFrame onClose={onClose}>
      <WheelEmblem spinning={claiming} />
      <h2 className="text-center font-inter text-2xl font-black text-white">Günlük Çark hazır!</h2>
      <p className="text-center text-sm font-semibold text-slate-200">Bugünkü ödülünü almak için çevir.</p>
      <div className="mt-2 flex w-full gap-2">
        <ModalButton tone="secondary" onClick={onClose}>Sonra</ModalButton>
        <ModalButton onClick={onSpin} disabled={claiming}>
          {claiming ? 'Çevriliyor...' : 'Çevir'}
        </ModalButton>
      </div>
    </DailyWheelModalFrame>
  );
}

function DailyWheelResultModal({ status, error, claiming, result, onSpin, onClose }) {
  const hasReward = Number(result?.totalRewardAmount) > 0;
  const alreadyClaimed = Boolean(result?.alreadyClaimedToday || result?.alreadyClaimed);
  const updatedDiamondTotal = Number(result?.updatedDiamondTotal);
  return (
    <DailyWheelModalFrame onClose={onClose}>
      {status === 'error' ? (
        <>
          <WheelEmblem spinning={claiming} />
          <h2 className="text-center font-inter text-2xl font-black text-white">Çark durdu</h2>
          <p
            role="alert"
            className="rounded-xl bg-red-500/12 px-3 py-2 text-center text-xs font-bold text-red-100"
          >
            {error || 'Günlük Çark ödülü alınamadı. Lütfen tekrar dene.'}
          </p>
          <div className="mt-2 flex w-full gap-2">
            <ModalButton tone="secondary" onClick={onClose}>Kapat</ModalButton>
            <ModalButton onClick={onSpin} disabled={claiming}>
              {claiming ? 'Çevriliyor...' : 'Tekrar dene'}
            </ModalButton>
          </div>
        </>
      ) : hasReward ? (
        <>
          <Sparkles className="h-10 w-10 text-amber-300" />
          <h2 className="text-center font-inter text-2xl font-black text-white">
            +{formatDiamondCount(result.totalRewardAmount)} elmas kazandın
          </h2>
          {Number(result.streakBonusAmount) > 0 && (
            <div className="space-y-2 rounded-xl bg-amber-300/12 px-3 py-2 text-center">
              <p className="text-sm font-extrabold text-amber-100">
                7 günlük seri bonusu: +100 elmas
              </p>
              <p className="text-xs font-bold text-amber-50/80">
                Çark ödülü: +{formatDiamondCount(result.rewardAmount)} elmas
              </p>
            </div>
          )}
          {Number.isFinite(updatedDiamondTotal) && (
            <p className="rounded-full bg-slate-950/38 px-3 py-1.5 text-center text-sm font-extrabold text-amber-100">
              Toplam Elmas: {formatDiamondCount(updatedDiamondTotal)}
            </p>
          )}
          <p className="text-center text-xs font-semibold text-slate-300">
            Seri: {Number(result.streakAfter) || 1} gün
          </p>
          <ModalButton onClick={onClose}>Tamam</ModalButton>
        </>
      ) : alreadyClaimed ? (
        <>
          <Gift className="h-10 w-10 text-amber-300" />
          <h2 className="text-center font-inter text-xl font-black text-white">Bugünkü ödülünü aldın.</h2>
          <p className="text-center text-sm font-semibold text-slate-200">
            Yeni çark yarın hazır olacak.
          </p>
          {result?.nextAvailableAt && (
            <p className="text-center text-xs font-bold text-amber-100/85">
              {formatCountdown(result.nextAvailableAt)}
            </p>
          )}
          <ModalButton onClick={onClose}>Tamam</ModalButton>
        </>
      ) : (
        <>
          <WheelEmblem spinning={claiming} />
          <h2 className="text-center font-inter text-2xl font-black text-white">Günlük Çark hazır!</h2>
          <p className="text-center text-sm font-semibold text-slate-200">Bugünkü ödülünü almak için çevir.</p>
          {error && (
            <p role="alert" className="rounded-xl bg-red-500/12 px-3 py-2 text-center text-xs font-bold text-red-100">
              {error}
            </p>
          )}
          <ModalButton onClick={onSpin} disabled={claiming}>
            {claiming ? 'Çevriliyor...' : 'Çevir'}
          </ModalButton>
        </>
      )}
    </DailyWheelModalFrame>
  );
}

function DailyWheelStatusModal({ nextLabel, onClose }) {
  return (
    <DailyWheelModalFrame onClose={onClose}>
      <Gift className="h-10 w-10 text-amber-300" />
      <h2 className="text-center font-inter text-xl font-black text-white">Bugünkü ödülünü aldın.</h2>
      <p className="text-center text-sm font-semibold text-slate-200">
        Yeni çark yarın hazır olacak.
      </p>
      <p className="text-center text-xs font-bold text-amber-100/85">{nextLabel}</p>
      <ModalButton onClick={onClose}>Tamam</ModalButton>
    </DailyWheelModalFrame>
  );
}

function DailyWheelModalFrame({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[220] grid place-items-center px-5"
      style={{ background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="relative flex w-full max-w-[21rem] flex-col items-center gap-4 rounded-[22px] p-5"
        style={{
          border: '1px solid rgba(250,204,21,0.42)',
          background: 'linear-gradient(180deg, rgba(10,24,58,0.98), rgba(4,10,28,0.98))',
          boxShadow: '0 24px 80px rgba(0,0,0,0.62), inset 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-slate-200"
          style={{ background: 'rgba(255,255,255,0.08)' }}
          aria-label="Kapat"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </motion.div>
    </div>
  );
}

function ModalButton({ children, tone = 'primary', disabled = false, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-11 flex-1 rounded-xl px-4 py-3 text-sm font-black transition-transform active:scale-[0.98] disabled:opacity-60"
      style={{
        background: tone === 'secondary'
          ? 'rgba(148,163,184,0.14)'
          : 'linear-gradient(180deg, #facc15, #d99b05)',
        color: tone === 'secondary' ? '#e2e8f0' : '#1a1003',
        boxShadow: tone === 'secondary'
          ? 'inset 0 0 0 1px rgba(255,255,255,0.12)'
          : 'inset 0 1px 0 rgba(255,255,255,0.55), 0 10px 24px rgba(0,0,0,0.35)',
      }}
    >
      {children}
    </button>
  );
}
