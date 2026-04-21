import React from 'react';
import { User, Crown } from 'lucide-react';

const playerColors = [
  'from-blue-500/20 to-blue-600/10 border-blue-500/50 text-blue-400',
  'from-rose-500/20 to-rose-600/10 border-rose-500/50 text-rose-400',
  'from-emerald-500/20 to-emerald-600/10 border-emerald-500/50 text-emerald-400',
  'from-violet-500/20 to-violet-600/10 border-violet-500/50 text-violet-400',
];

export default function PlayerIndicator({ players, currentPlayerIndex }) {
  return (
    <div className="flex gap-2 justify-center flex-wrap px-2">
      {players.map((player, i) => (
        <div
          key={i}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-inter font-medium
            bg-gradient-to-r transition-all duration-300
            ${playerColors[i]}
            ${i === currentPlayerIndex ? 'ring-2 ring-primary scale-105 shadow-lg' : 'opacity-60'}
          `}
        >
          {i === currentPlayerIndex ? (
            <Crown className="w-3 h-3" />
          ) : (
            <User className="w-3 h-3" />
          )}
          <span>{player.name}</span>
          <span className="bg-background/50 px-1.5 py-0.5 rounded-full text-foreground/70"
                style={{ fontSize: '10px' }}>
            {player.cards.length}/10
          </span>
        </div>
      ))}
    </div>
  );
}