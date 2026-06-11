import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(Boolean(media.matches));
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

function valuesEqual(left, right) {
  return String(left) === String(right);
}

function isSelected(optionValue, value, multiple) {
  if (multiple) return Array.isArray(value) && value.some((item) => valuesEqual(item, optionValue));
  return valuesEqual(optionValue, value);
}

export default function KronoxSelectSheet({
  label,
  value,
  options,
  onChange,
  placeholder = 'Seç',
  disabled = false,
  multiple = false,
  className = '',
  error = '',
  sheetTitle,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const normalizedOptions = Array.isArray(options) ? options : [];

  const selectedLabels = useMemo(() => {
    const selected = normalizedOptions.filter((option) => isSelected(option.value, value, multiple));
    if (!selected.length) return placeholder;
    return selected.map((option) => option.label).join(', ');
  }, [multiple, normalizedOptions, placeholder, value]);

  const closeSheet = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame?.(() => triggerRef.current?.focus?.());
  }, []);

  const handleSelect = useCallback((optionValue) => {
    if (disabled) return;
    if (!multiple) {
      onChange?.(optionValue);
      closeSheet();
      return;
    }
    const current = Array.isArray(value) ? value : [];
    const exists = current.some((item) => valuesEqual(item, optionValue));
    const next = exists
      ? current.filter((item) => !valuesEqual(item, optionValue))
      : [...current, optionValue];
    onChange?.(next);
  }, [closeSheet, disabled, multiple, onChange, value]);

  useEffect(() => {
    if (!open) return undefined;
    const node = dialogRef.current;
    const focusable = node?.querySelectorAll?.('button:not([disabled]), [href], input, textarea, [tabindex]:not([tabindex="-1"])');
    const firstSelected = node?.querySelector?.('[data-kronox-selected="true"]');
    const first = firstSelected || focusable?.[0];
    first?.focus?.();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSheet();
        return;
      }
      if (event.key !== 'Tab' || !focusable?.length) return;
      const firstItem = focusable[0];
      const lastItem = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeSheet, open]);

  const titleId = `${String(label || sheetTitle || 'kronox-select').replace(/\s+/g, '-').toLowerCase()}-sheet-title`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left font-inter text-sm font-bold outline-none transition focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/20 disabled:opacity-55 ${className}`}
        style={{
          borderColor: error ? 'rgba(248,113,113,0.55)' : 'rgba(191,219,254,0.16)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.72), rgba(2,6,23,0.72))',
          color: 'hsl(var(--foreground))',
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={error ? 'true' : undefined}
      >
        <span className="min-w-0 flex-1 truncate">{selectedLabels}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[90]" aria-hidden={!open}>
          <button
            type="button"
            aria-label="Seçim penceresini kapat"
            className="absolute inset-0 h-full w-full bg-slate-950/72 backdrop-blur-sm"
            onClick={closeSheet}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl border border-amber-300/30 bg-slate-950 text-white shadow-[0_-22px_46px_rgba(2,6,23,0.62),inset_0_1px_0_rgba(255,255,255,0.12)]"
            style={{
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
              transform: 'translateY(0)',
              animation: reducedMotion ? 'none' : 'kx-select-sheet-in 180ms ease-out',
            }}
          >
            <div className="border-b border-white/10 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p id={titleId} className="truncate font-cinzel text-base font-black tracking-wide text-amber-100">
                    {sheetTitle || label || placeholder}
                  </p>
                  {label && (
                    <p className="mt-1 font-inter text-xs text-blue-100/60">Kronox seçim paneli</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={closeSheet}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-blue-100"
                  aria-label="Kapat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[62dvh] overflow-y-auto px-3 py-3" style={{ WebkitOverflowScrolling: 'touch' }}>
              {normalizedOptions.map((option) => {
                const selected = isSelected(option.value, value, multiple);
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-kronox-selected={selected ? 'true' : undefined}
                    onClick={() => handleSelect(option.value)}
                    className="mb-2 flex min-h-12 w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors"
                    style={{
                      borderColor: selected ? 'rgba(250,204,21,0.55)' : 'rgba(148,163,184,0.20)',
                      background: selected
                        ? 'linear-gradient(180deg, rgba(250,204,21,0.16), rgba(59,130,246,0.10))'
                        : 'rgba(15,23,42,0.48)',
                    }}
                  >
                    <span
                      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border"
                      style={{
                        borderColor: selected ? 'rgba(250,204,21,0.75)' : 'rgba(148,163,184,0.35)',
                        background: selected ? 'rgba(250,204,21,0.20)' : 'transparent',
                      }}
                      aria-hidden="true"
                    >
                      {selected && <Check className="h-3.5 w-3.5 text-amber-200" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-inter text-sm font-black text-blue-50">
                        {option.label}
                      </span>
                      {option.help && (
                        <span className="mt-1 block break-words font-inter text-xs leading-relaxed text-blue-100/62">
                          {option.help}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {multiple && (
              <div className="px-3 pb-3">
                <button
                  type="button"
                  onClick={closeSheet}
                  className="min-h-11 w-full rounded-xl bg-amber-400 px-4 py-3 font-inter text-sm font-black text-slate-950"
                >
                  Tamam
                </button>
              </div>
            )}
          </div>
          <style>{`
            @keyframes kx-select-sheet-in {
              from { transform: translateY(16px); opacity: 0.88; }
              to { transform: translateY(0); opacity: 1; }
            }
            @media (prefers-reduced-motion: reduce) {
              [data-kronox-selected] { transition: none !important; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
