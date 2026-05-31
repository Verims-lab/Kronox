// Codex131 — Active Lobby Card.
//
// PURPOSE
//   Surfaces an existing pending lobby (host or member) on the Online
//   screen so the user can return to it after navigating away. Hidden
//   when there is no active lobby, when the lobby is stale (10-min TTL),
//   or when the lobby has already started/finished.
//
// CONTRACT
//   • Read-only: never mutates Lobby. Tapping calls onResume(lobby).
//   • Stale guard: uses isLobbyStale() from inviteApi → same 10-min rule
//     enforced by acceptGameInvite / findLobbyByCode / Game route.
//   • No business logic. Pure presentational + a single resume action.

import React from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowRight, Crown } from 'lucide-react';

export default function ActiveLobbyCard({ lobby, isHost, onResume }) {
  if (!lobby) return null;
  const playerCount = Array.isArray(lobby.players) ? lobby.players.length : 0;
  const expected = Math.max(2, Number(lobby.max_players) || playerCount);
  const hostName = lobby.host_name || 'Senin lobin';
  const label = isHost ? 'Senin lobin' : `${hostName} lobide`;

  return (
    <motion.button
      type="button"
      onClick={() => onResume?.(lobby)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.985 }}
      className="w-full flex items-center gap-3 rounded-2xl p-3 text-left"
      style={{
        background:
          'linear-gradient(180deg, rgba(45,28,8,0.92) 0%, rgba(20,14,4,0.96) 100%)',
        boxShadow:
          'inset 0 0 0 1.5px rgba(250,204,21,0.55), inset 0 1px 0 rgba(255,255,255,0.10), 0 0 16px rgba(250,204,21,0.30)',
      }}
      aria-label="Aktif lobine geri dön"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 70%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.45), 0 0 12px rgba(250,204,21,0.5)',
        }}
      >
        <Crown className="h-5 w-5 text-amber-950" strokeWidth={2.6} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-inter text-sm font-black text-amber-100">
          {label}
        </p>
        <div className="mt-0.5 flex items-center gap-2 font-inter text-[11px] text-amber-200/75">
          <Users className="h-3 w-3" />
          <span>{playerCount}/{expected} oyuncu</span>
          <span className="text-amber-200/55">•</span>
          <span>Lobiye Dön</span>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-amber-200/85" />
    </motion.button>
  );
}