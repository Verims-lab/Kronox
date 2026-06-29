import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ImagePlus, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';
import {
  KRONOX_AVATAR_COLORS,
  KRONOX_AVATAR_ICON_CATEGORIES,
  KRONOX_AVATAR_ICONS,
  getAvatarColor,
  normalizeAvatarColorId,
  resolveProfileAvatar,
} from '@/lib/avatarOptions';
import {
  isAcceptedAvatarFile,
  normalizeAvatarSaveError,
  saveIconAvatar,
  savePhotoAvatar,
  uploadAvatarPhoto,
} from '@/lib/avatarUpdate';
import { getAvatarIconGlyph } from './avatarIconMap';

// Codex486 — Avatar picker as a bottom sheet, consistent with the existing
// Kronox profile edit sheet pattern (modal navigation, not inline expansion).
export default function AvatarPickerSheet({ open, profile, onClose, onSaved }) {
  const fileInputRef = useRef(null);
  const initialAvatar = resolveProfileAvatar(profile);
  const [tab, setTab] = useState('icon');
  const [selectedIconId, setSelectedIconId] = useState(initialAvatar.iconId || 'shield');
  const [colorId, setColorId] = useState(normalizeAvatarColorId(initialAvatar.colorId));
  const [photoPreview, setPhotoPreview] = useState(initialAvatar.type === 'photo' ? initialAvatar.url : '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const next = resolveProfileAvatar(profile);
    setTab(next.type === 'photo' ? 'photo' : 'icon');
    setSelectedIconId(next.iconId || 'shield');
    setColorId(normalizeAvatarColorId(next.colorId));
    setPhotoPreview(next.type === 'photo' ? next.url : '');
    setError('');
    setUploading(false);
    setSaving(false);
  }, [open, profile]);

  const busy = uploading || saving;

  const handlePickFile = () => {
    if (busy) return;
    sounds.tap();
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!isAcceptedAvatarFile(file)) {
      setError('Sadece resim dosyası yükleyebilirsin (JPG, PNG, WEBP).');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const url = await uploadAvatarPhoto(file);
      setPhotoPreview(url);
      setTab('photo');
    } catch (uploadError) {
      setError(normalizeAvatarSaveError(uploadError));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (busy) return;
    setSaving(true);
    setError('');
    try {
      const result = tab === 'photo' && photoPreview
        ? await savePhotoAvatar(photoPreview, colorId)
        : await saveIconAvatar(selectedIconId, colorId);
      sounds.tap();
      onSaved?.(result);
    } catch (saveError) {
      setError(normalizeAvatarSaveError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const previewColor = getAvatarColor(colorId);
  const PreviewGlyph = getAvatarIconGlyph(selectedIconId);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[160] flex items-end justify-center bg-slate-950/72 px-3 pb-3 backdrop-blur-sm"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="avatar-picker-title"
        >
          <button type="button" className="absolute inset-0" onClick={busy ? undefined : onClose} aria-label="Avatar seçimini kapat" />
          <motion.div
            className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[1.75rem] p-5 kx-contained-scroll"
            style={{
              background: 'linear-gradient(180deg, rgba(20,33,69,0.99), rgba(5,10,24,0.99))',
              boxShadow: 'inset 0 0 0 1px rgba(120,170,255,0.28), 0 24px 60px rgba(0,0,0,0.46)',
            }}
            initial={{ y: 26, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full"
                style={{ background: `radial-gradient(circle at 35% 28%, ${previewColor.from}, ${previewColor.to} 72%)` }}
              >
                {tab === 'photo' && photoPreview ? (
                  <img src={photoPreview} alt="" className="h-full w-full object-cover" draggable={false} />
                ) : PreviewGlyph ? (
                  <PreviewGlyph className="h-6 w-6" strokeWidth={2.4} style={{ color: previewColor.glyph }} />
                ) : (
                  <Sparkles className="h-6 w-6" style={{ color: previewColor.glyph }} />
                )}
              </div>
              <h2 id="avatar-picker-title" className="flex-1 font-inter text-lg font-black text-white">Avatar Seç</h2>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white/70 disabled:opacity-60"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white/[0.06] p-1">
              <TabButton active={tab === 'icon'} onClick={() => { sounds.tap(); setTab('icon'); }}>
                <Sparkles className="h-4 w-4" /> Hazır ikonlar
              </TabButton>
              <TabButton active={tab === 'photo'} onClick={() => { sounds.tap(); setTab('photo'); }}>
                <ImagePlus className="h-4 w-4" /> Fotoğraf yükle
              </TabButton>
            </div>

            {tab === 'icon' ? (
              <div className="space-y-4">
                {KRONOX_AVATAR_ICON_CATEGORIES.map((category) => {
                  const icons = KRONOX_AVATAR_ICONS.filter((icon) => icon.category === category.id);
                  if (!icons.length) return null;
                  return (
                    <section key={category.id} className="space-y-2">
                      <p className="font-inter text-[11px] font-black uppercase tracking-wider text-blue-100/58">
                        {category.label}
                      </p>
                      <div className="grid grid-cols-5 gap-2">
                        {icons.map((icon) => {
                          const Glyph = getAvatarIconGlyph(icon.id);
                          const selected = selectedIconId === icon.id;
                          return (
                            <button
                              type="button"
                              key={icon.id}
                              onClick={() => { sounds.tap(); setSelectedIconId(icon.id); }}
                              className="flex aspect-square items-center justify-center rounded-2xl transition-transform active:scale-95"
                              style={{
                                background: selected
                                  ? `radial-gradient(circle at 35% 28%, ${previewColor.from}, ${previewColor.to} 72%)`
                                  : 'rgba(255,255,255,0.05)',
                                boxShadow: selected
                                  ? 'inset 0 0 0 2px rgba(250,204,21,0.65), 0 0 14px rgba(250,204,21,0.30)'
                                  : 'inset 0 0 0 1px rgba(255,255,255,0.10)',
                              }}
                              aria-label={icon.label}
                              aria-pressed={selected}
                            >
                              {Glyph ? (
                                <Glyph className="h-5 w-5" strokeWidth={2.4} style={{ color: selected ? previewColor.glyph : '#cbd5f5' }} />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div
                  className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full"
                  style={{ background: `radial-gradient(circle at 35% 28%, ${previewColor.from}, ${previewColor.to} 72%)` }}
                >
                  {uploading ? (
                    <Loader2 className="h-7 w-7 animate-spin" style={{ color: previewColor.glyph }} />
                  ) : photoPreview ? (
                    <img src={photoPreview} alt="Yüklenen fotoğraf önizleme" className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <ImagePlus className="h-9 w-9" style={{ color: previewColor.glyph }} />
                  )}
                </div>
                <button
                  type="button"
                  onClick={handlePickFile}
                  disabled={busy}
                  className="mt-4 flex h-11 items-center gap-2 rounded-full bg-white/[0.08] px-5 font-inter text-sm font-black text-white disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" /> {photoPreview ? 'Fotoğrafı değiştir' : 'Fotoğraf seç'}
                </button>
                <p className="mt-2 text-center font-inter text-[11px] font-semibold text-blue-100/55">
                  JPG, PNG veya WEBP • en fazla 5 MB. Fotoğraf daire içine kırpılır.
                </p>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>
            )}

            <div className="mt-5">
              <p className="mb-2 font-inter text-[11px] font-black uppercase tracking-wider text-blue-100/65">Çerçeve rengi</p>
              <div className="flex flex-wrap gap-2.5">
                {KRONOX_AVATAR_COLORS.map((color) => {
                  const selected = colorId === color.id;
                  return (
                    <button
                      type="button"
                      key={color.id}
                      onClick={() => { sounds.tap(); setColorId(color.id); }}
                      className="h-9 w-9 rounded-full transition-transform active:scale-90"
                      style={{
                        background: `radial-gradient(circle at 35% 28%, ${color.from}, ${color.to} 72%)`,
                        boxShadow: selected ? 'inset 0 0 0 2px #ffffff, 0 0 12px rgba(255,255,255,0.45)' : 'inset 0 0 0 1px rgba(255,255,255,0.18)',
                      }}
                      aria-label={`Renk ${color.id}`}
                      aria-pressed={selected}
                    />
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-2xl border border-red-300/25 bg-red-500/10 px-4 py-3 font-inter text-xs font-bold text-red-100" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={busy || (tab === 'photo' && !photoPreview)}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 font-inter text-sm font-black text-amber-950 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Kaydet
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 items-center justify-center gap-1.5 rounded-xl font-inter text-[12px] font-black transition-colors"
      style={{
        background: active ? 'rgba(250,204,21,0.18)' : 'transparent',
        color: active ? '#fde68a' : 'rgba(203,213,245,0.75)',
        boxShadow: active ? 'inset 0 0 0 1px rgba(250,204,21,0.5)' : 'none',
      }}
    >
      {children}
    </button>
  );
}
