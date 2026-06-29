import React, { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { getAvatarColor, resolveProfileAvatar } from '@/lib/avatarOptions';
import { getAvatarIconGlyph } from './avatarIconMap';

// Codex486 — Single source of truth for rendering a profile avatar.
// Priority: uploaded photo (object-fit: cover) → bundled icon → initial/fallback.
// If a photo fails to load, it falls back to the selected icon or the initial.
export default function KronoxAvatar({
  profile,
  initial = 'K',
  size = 56,
  className = '',
  style = {},
}) {
  const avatar = resolveProfileAvatar(profile);
  const color = getAvatarColor(avatar.colorId);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    setPhotoFailed(false);
  }, [avatar.url]);

  const frameStyle = {
    width: size,
    height: size,
    borderRadius: '9999px',
    background: `radial-gradient(circle at 35% 28%, ${color.from}, ${color.to} 72%)`,
    boxShadow:
      '0 0 22px rgba(250,204,21,0.30), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -6px 8px rgba(0,0,0,0.40)',
    ...style,
  };

  const showPhoto = avatar.type === 'photo' && !photoFailed;
  const IconGlyph = avatar.type === 'icon' ? getAvatarIconGlyph(avatar.iconId) : null;
  const glyphSize = Math.round(size * 0.5);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      style={frameStyle}
    >
      {showPhoto ? (
        <img
          src={avatar.url}
          alt="Profil fotoğrafı"
          className="h-full w-full object-cover"
          draggable={false}
          onError={() => setPhotoFailed(true)}
        />
      ) : IconGlyph ? (
        <IconGlyph
          width={glyphSize}
          height={glyphSize}
          strokeWidth={2.4}
          style={{ color: color.glyph }}
        />
      ) : initial ? (
        <span className="font-bangers leading-none" style={{ color: color.glyph, fontSize: glyphSize }}>
          {String(initial).charAt(0).toLocaleUpperCase('tr-TR')}
        </span>
      ) : (
        <UserRound width={glyphSize} height={glyphSize} strokeWidth={2.6} style={{ color: color.glyph }} />
      )}
    </div>
  );
}