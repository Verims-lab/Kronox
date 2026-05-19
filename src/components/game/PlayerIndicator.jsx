import React from 'react';
import { User, Crown } from 'lucide-react';
import { playerBadgeColors } from './playerColors';

const playerColors = playerBadgeColors;

export default function PlayerIndicator({ players = [], currentPlayerIndex = 0, myPlayerName }) {
  console.log('[PlayerIndicator] rendered players:', {
    renderedPlayersCount: players?.length || 0,
    renderedPlayerNames: (players || []).map(p => p?.name),
    currentPlayerIndex,
    currentPlayerName: players?.[currentPlayerIndex]?.name || null,
  });

  if (!players || players.length === 0) {
    return <div className="text-xs text-muted-foreground">Oyuncular yükleniyor...</div>;
  }

  return (
    <div className="flex gap-2 justify-center flex-wrap px-2">
      {players.map((player, i) => {
        if (!player || !player.name) return null;
        
        const isActive = i === currentPlayerIndex;
        const isMe = myPlayerName && player.name === myPlayerName;
        const cardCount = player.cards?.length || 0;
        
        return (
          <div
            key={i}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-inter font-medium
              bg-gradient-to-r transition-all duration-300
              ${playerColors[i % playerColors.length]}
              ${isActive ? 'ring-2 ring-primary scale-105 shadow-lg' : 'opacity-60'}
            `}
          >
            {isActive ? (
              <Crown className="w-3 h-3" />
            ) : (
              <User className="w-3 h-3" />
            )}
            <span>{player.name}</span>
            {isMe && !isActive && (
              <span className="text-[9px] bg-background/40 px-1 rounded-full text-foreground/50">(sen)</span>
            )}
            {isMe && isActive && (
              <span className="text-[9px] bg-primary/30 px-1 rounded-full text-primary font-bold">SENIN SIRAN!</span>
            )}
            <span className="bg-background/50 px-1.5 py-0.5 rounded-full text-foreground/70"
                  style={{ fontSize: '10px' }}>
              {cardCount}/10
            </span>
          </div>
        );
      })}
    </div>
  );
}
