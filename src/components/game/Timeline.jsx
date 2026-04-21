import React from 'react';
import TimelineCard from './TimelineCard';
import DropZone from './DropZone';

export default function Timeline({ cards, onPlaceCard, selectedZone, onSelectZone }) {
  const sortedCards = [...cards].sort((a, b) => a.year - b.year);

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-1 overflow-x-auto py-3 px-2">
        {/* Drop zone before first card */}
        <DropZone 
          index={0} 
          isActive={selectedZone === 0}
          onDrop={onSelectZone}
        />
        
        {sortedCards.map((card, i) => (
          <React.Fragment key={card.id || i}>
            <TimelineCard card={card} index={i} compact={cards.length > 4} />
            <DropZone 
              index={i + 1} 
              isActive={selectedZone === i + 1}
              onDrop={onSelectZone}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}