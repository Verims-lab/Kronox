import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Timer, LayoutGrid } from 'lucide-react';
import { formatDuration } from './GameOverTimer';

export default function TopScores({ user }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    base44.entities.GameRecord.filter(
      { user_email: user.email },
      'duration_seconds', // en hızlı önce
      5
    ).then(data => {
      setRecords(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.email]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <p className="font-inter text-xs text-muted-foreground/60 text-center py-4">
        Henüz tamamlanmış oyun yok. Tek kişilik oyun oynayarak rekor kır!
      </p>
    );
  }

  const categoryLabel = (cat) => {
    const map = { karisik: 'Karışık', tarih: 'Tarih', bilim: 'Bilim', spor: 'Spor', sanat: 'Sanat' };
    return map[cat] || cat;
  };

  const medals = ['🥇', '🥈', '🥉', '4.', '5.'];

  return (
    <div className="space-y-2">
      {records.map((r, i) => (
        <div
          key={r.id}
          className="flex items-center gap-3 p-3 rounded-2xl border border-border/30 bg-secondary/20"
        >
          <span className="text-lg w-7 text-center flex-shrink-0">{medals[i]}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Timer className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="font-cinzel text-sm font-bold text-primary">
                {formatDuration(r.duration_seconds)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <LayoutGrid className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <span className="font-inter text-xs text-muted-foreground">
                {r.cards_won} kart · {categoryLabel(r.category)} · {r.year_start}–{r.year_end}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
