// Comment from verims at 23.06.2026
import React, { memo } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DAILY_QUEST_TYPE_LABELS } from '@/lib/dbGateway/dailyQuestGateway';

function statusLabel(status) {
  return status === 'passive' ? 'Pasif' : 'Aktif';
}

function Meta({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-blue-100/40">{label}</div>
      <div className="mt-0.5 truncate text-xs font-bold text-blue-50">{value}</div>
    </div>
  );
}

function DailyQuestDefinitionCard({ definition, busy, loading, onStatusToggle }) {
  const duplicateCount = Number(definition.duplicate_count || 0);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-inter text-sm font-black text-blue-50">{definition.title}</p>
            {duplicateCount > 0 && (
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 font-inter text-[12px] font-black text-amber-50">
                {duplicateCount} yinelenen kayıt
              </span>
            )}
          </div>
          <p className="mt-1 font-inter text-xs leading-relaxed text-blue-100/65">{definition.description}</p>
        </div>
        <button
          type="button"
          aria-label={`${definition.title} durumunu ${definition.status === 'active' ? 'Pasif' : 'Aktif'} yap`}
          onClick={() => onStatusToggle(definition)}
          disabled={busy || !definition.id}
          className={`shrink-0 rounded-full px-2.5 py-1 font-inter text-[12px] font-black uppercase tracking-[0.12em] ${
            definition.status === 'active'
              ? 'border border-emerald-300/25 bg-emerald-400/10 text-emerald-100'
              : 'border border-slate-300/20 bg-slate-400/10 text-slate-100'
          } disabled:opacity-50`}
        >
          {loading === `status:${definition.id}` ? '...' : statusLabel(definition.status)}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 font-inter text-[12px] text-blue-100/60 sm:grid-cols-5">
        <Meta label="Anahtar" value={definition.quest_key} />
        <Meta label="Görev Tipi" value={DAILY_QUEST_TYPE_LABELS[definition.quest_type] || definition.quest_type} />
        <Meta label="Hedef" value={definition.target_value} />
        <Meta label="Ödül Elmas" value={definition.reward_diamonds} />
        <Meta label="Sıra" value={definition.sort_order} />
      </div>
      {duplicateCount > 0 && (
        <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-300/5 px-2 py-1.5 font-inter text-[12px] leading-relaxed text-amber-50/75">
          Bu quest_key için birincil kayıt kullanılıyor. Yinelenen kayıtlar otomatik silinmez; manuel DB temizliği önerilir.
        </p>
      )}
    </div>
  );
}

function DailyQuestDefinitionList({
  definitions,
  duplicateDefinitionCount,
  loading,
  busy,
  onRefresh,
  onStatusToggle,
}) {
  return (
    <div className="mt-4 rounded-xl border border-blue-200/15 bg-slate-950/35 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="font-inter text-xs font-black uppercase tracking-[0.18em] text-blue-100/55">Tanımlı Görevler</p>
          <p className="mt-1 font-inter text-[11px] text-blue-100/55">
            Günlük Çarktan ayrıdır. Ödüller yalnızca elmas sözleşmesidir.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Görevleri yenile"
          onClick={onRefresh}
          disabled={busy}
          className="h-9 shrink-0 border-sky-300/30 bg-sky-300/10 text-sky-50 hover:bg-sky-300/15"
        >
          {loading === 'list' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {duplicateDefinitionCount > 0 && (
        <div className="mb-3 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-100" />
            <p className="font-inter text-[11px] leading-relaxed text-amber-50/80">
              Yinelenen görev tanımı kayıtları var: {duplicateDefinitionCount} adet. Liste birincil tanımı gösterir; manuel DB temizliği için yedek alıp aynı quest_key altındaki yinelenen kayıtları pasifleştirin veya silin.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {definitions.length === 0 && loading !== 'list' && (
          <p className="rounded-xl border border-dashed border-blue-200/20 px-3 py-3 font-inter text-xs text-blue-100/60">
            Henüz günlük görev tanımı yok.
          </p>
        )}
        {definitions.map((definition) => (
          <DailyQuestDefinitionCard
            key={definition.quest_key || definition.id}
            definition={definition}
            busy={busy}
            loading={loading}
            onStatusToggle={onStatusToggle}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(DailyQuestDefinitionList);