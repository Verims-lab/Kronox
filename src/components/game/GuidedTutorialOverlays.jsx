import React from 'react';
import { Clock3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Guided first-Solo-level tutorial step copy. Index advances with the
// number of cards the player has completed (see GuidedSoloTutorialOverlay).
const GUIDED_TUTORIAL_MESSAGES = [
  {
    variant: 'sentence',
    body: 'Kartı tut ve doğru zaman aralığına sürükle.',
  },
  {
    variant: 'sentence',
    body: 'Zaman çizgisini parmağınla sağa ve sola kaydır.',
  },
  {
    icon: Sparkles,
    title: 'Araya Yerleştir',
    body: 'İki olayın arasındaki boşluk da geçerli bir hamledir.',
  },
  {
    icon: Clock3,
    title: 'Zaman ve Hamle',
    body: 'Her geçerli yerleştirme bir hamledir. 7 kartı 10 hamle içinde tamamla.',
  },
  {
    variant: 'sentence',
    body: 'Kartı doğru yere yerleştir, seviyeyi tamamla',
  },
];

export function GuidedTutorialPopup({ popup, onContinue }) {
  if (!popup) return null;
  const content = popup.type === 'timer'
    ? {
        body: 'Oyunu sana verilen süre ve hamle sayısı tamamlanmadan bitirmelisin. Ne kadar hızlı bitirirsen o kadar çok puan kazanırsın',
        buttonLabel: 'Hadi Başlayalım',
      }
    : popup.type === 'mistake'
      ? {
          title: 'Hamle Hakkına Dikkat',
          body: popup.protected
            ? 'Kronokalkan hamle hakkını korudu. Daha az hamleyle bitirirsen daha çok yıldız ve Puan / Kronox Puan kazanırsın.'
            : 'Bu deneme bir hamle sayıldı. Daha az hamleyle bitirirsen daha çok yıldız ve Puan / Kronox Puan kazanırsın.',
          eyebrow: 'Hamle',
          buttonLabel: 'Anladım',
        }
      : null;

  if (!content) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-5"
      style={{ background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(3px)' }}
      data-kronox-guided-tutorial-popup={popup.type}
    >
      <div className="w-full max-w-[340px] rounded-3xl border border-yellow-300/45 bg-slate-950 px-5 py-5 text-center shadow-2xl">
        {content.eyebrow && (
          <div className="mx-auto mb-3 inline-flex min-h-9 items-center justify-center rounded-full border border-yellow-300/45 bg-yellow-300/12 px-4 font-inter text-xs font-black text-yellow-100">
            {content.eyebrow}
          </div>
        )}
        {content.title && <h2 className="font-cinzel text-xl font-black text-white">{content.title}</h2>}
        <p className={content.title ? 'mt-2 font-inter text-sm font-semibold leading-relaxed text-blue-100/82' : 'font-inter text-base font-bold leading-relaxed text-blue-100/86'}>
          {content.body}
        </p>
        <Button
          type="button"
          onClick={onContinue}
          className="mt-5 min-h-11 w-full rounded-xl font-inter font-black"
        >
          {content.buttonLabel || 'Anladım'}
        </Button>
      </div>
    </div>
  );
}

export function GuidedSoloTutorialOverlay({
  cardsCompleted = 0,
  cardTarget = 7,
  remainingMoves = 10,
  jokerInstruction = '',
}) {
  const activeIndex = Math.min(
    GUIDED_TUTORIAL_MESSAGES.length - 1,
    Math.max(0, Math.floor(Math.max(0, Number(cardsCompleted) - 2))),
  );
  const item = GUIDED_TUTORIAL_MESSAGES[activeIndex] || GUIDED_TUTORIAL_MESSAGES[0];
  const Icon = item.icon;
  const sentenceOnly = item.variant === 'sentence';
  const jokerOnly = Boolean(jokerInstruction);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[42] px-4"
      style={{ top: 'calc(6.5rem + env(safe-area-inset-top))' }}
      data-kronox-guided-first-solo-level="true"
    >
      <div className="mx-auto max-w-[340px] rounded-2xl border border-yellow-300/35 bg-slate-950/78 px-3 py-2.5 shadow-2xl backdrop-blur-md">
        {jokerOnly ? (
          <p
            className="px-1.5 py-1 text-center font-inter text-sm font-black leading-snug text-yellow-50"
            data-kronox-guided-joker-single-copy="true"
          >
            {jokerInstruction}
          </p>
        ) : sentenceOnly ? (
          <p className="px-1.5 py-1 text-center font-inter text-sm font-black leading-snug text-yellow-50">
            {item.body}
          </p>
        ) : (
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl border border-yellow-300/35 bg-yellow-300/12 text-yellow-200">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-inter text-xs font-black text-yellow-100">{item.title}</span>
              <span className="mt-0.5 block font-inter text-[11px] font-semibold leading-snug text-blue-100/82">{item.body}</span>
              <span className="mt-1.5 flex flex-wrap gap-1.5 font-inter text-[10px] font-bold text-blue-100/62">
                <span>{Math.max(0, Number(cardsCompleted) || 0)}/{Math.max(1, Number(cardTarget) || 7)} kart</span>
                <span>{Math.max(0, Number(remainingMoves) || 0)} hamle</span>
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}