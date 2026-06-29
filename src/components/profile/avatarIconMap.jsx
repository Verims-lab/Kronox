// Codex486 — Maps bundled avatar icon ids to lucide-react glyphs.
// All glyphs ship with the app (lucide-react, ISC license); no remote assets.
import {
  Shield,
  Hourglass,
  Zap,
  Crown,
  Compass,
  Star,
  BookOpen,
  Flame,
  Moon,
  Globe2,
  HardHat,
  Gem,
  Trophy,
  Aperture,
  Rocket,
  Swords,
} from 'lucide-react';

export const AVATAR_ICON_GLYPHS = {
  shield: Shield,
  hourglass: Hourglass,
  lightning: Zap,
  crown: Crown,
  compass: Compass,
  star: Star,
  book: BookOpen,
  flame: Flame,
  moon: Moon,
  planet: Globe2,
  helmet: HardHat,
  crystal: Gem,
  trophy: Trophy,
  portal: Aperture,
  rocket: Rocket,
  sword: Swords,
};

export function getAvatarIconGlyph(iconId) {
  return AVATAR_ICON_GLYPHS[String(iconId || '').trim()] || null;
}