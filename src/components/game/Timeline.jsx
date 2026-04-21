import React, { useRef, useEffect } from 'react';
import TimelineCard from './TimelineCard';
import DropZone from './DropZone';

export default function Timeline({ cards = [], onPlaceCard, selectedZone, onSelectZone }) {
  const sortedCards = cards && Array.isArray(cards) ? [...cards].sort((a, b) => a.year - b.year) : [];
  const scrollRef = useRef(null);

  // When selectedZone is 0, scroll to the far left so the user can see the first drop zone
  useEffect(() => {
    if (!scrollRef.current) return;
    if (selectedZone === 0) {
      scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (selectedZone === sortedCards.length) {
      scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' });
    }
  }, [selectedZone, sortedCards.length]);

  // After a card is added, scroll to show the newly placed card
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    // small delay to let DOM update
    setTimeout(() => {
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    }, 50);
  }, [cards.length]);

  return (
    <div className="w-full">
      <div ref={scrollRef} className="flex items-center justify-start gap-1 overflow-x-auto py-3 px-2">
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