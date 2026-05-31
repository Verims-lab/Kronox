import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { loadIncomingInvites, mergeActiveIncomingGameInvites, openGameInvite, rejectGameInvite } from '@/lib/inviteApi';
import {
  getGameInviteActiveFilterReason,
  getInviteRecipientEmail,
  traceGameInviteLifecycle,
} from '@/lib/gameInviteSelectors';
import InviteCountdown from '@/components/invites/InviteCountdown';

export default function HeaderGameInviteBell({ user }) {
  const navigate = useNavigate();
  const [invites, setInvites] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async ({ preserveExisting = false, source = 'fetch' } = {}) => {
    if (!user?.email) return;
    setLoading(true);
    setError('');
    try {
      const rows = await loadIncomingInvites(user.email);
      setInvites(prev => {
        const next = preserveExisting
          ? mergeActiveIncomingGameInvites(prev, rows, user.email)
          : rows;
        traceGameInviteLifecycle('header_badge_recalculated', { id: `count:${next.length}`, status: 'pending', to_email: user.email }, {
          source: `HeaderGameInviteBell.${source}`,
          user,
          userEmail: user.email,
          reason: preserveExisting ? 'preserve_existing_merge' : 'authoritative_replace',
        });
        return next;
      });
    } catch (err) {
      setError(err?.message || 'Davetler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!user?.email) return undefined;
    let intervalId = null;
    const myEmail = String(user.email || '').trim().toLowerCase();

    const unsub = base44.entities.GameInvite.subscribe((event) => {
      const eventType = event?.type || event?.eventType || 'update';
      const invite = event?.data || event;
      if (eventType === 'delete') return;
      if (getInviteRecipientEmail(invite) !== myEmail) return;

      const reason = getGameInviteActiveFilterReason(invite, myEmail);
      traceGameInviteLifecycle(reason.startsWith('active') ? 'invite_passed_active_filter' : 'invite_failed_active_filter', invite, {
        source: `HeaderGameInviteBell.subscription:${eventType}`,
        user,
        userEmail: myEmail,
        reason,
      });

      if (reason.startsWith('active')) {
        setInvites(prev => mergeActiveIncomingGameInvites(prev, [invite], myEmail));
        window.setTimeout(() => refresh({ preserveExisting: true, source: 'subscription_followup' }), 900);
      } else {
        setInvites(prev => prev.filter(item => item.id !== invite.id));
        refresh({ preserveExisting: false, source: 'terminal_followup' });
      }
    });

    intervalId = window.setInterval(() => refresh({ preserveExisting: false, source: 'polling' }), 20000);

    return () => {
      if (typeof unsub === 'function') unsub();
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [refresh, user]);

  const handleAccept = async (invite) => {
    if (busyId) return;
    setBusyId(invite.id);
    setError('');
    try {
      await openGameInvite(invite, {
        navigate,
        userEmail: user.email,
        source: 'header_notifications',
        onAccepted: async () => {
          setInvites(prev => prev.filter(item => item.id !== invite.id));
          await refresh({ preserveExisting: false, source: 'accepted_followup' });
        },
      });
    } catch (err) {
      setError(err?.message || 'Davet kabul edilemedi. Lütfen tekrar dene.');
    } finally {
      setBusyId('');
    }
  };

  const handleReject = async (invite) => {
    if (busyId) return;
    setBusyId(invite.id);
    setError('');
    try {
      await rejectGameInvite(invite.id);
      setInvites(prev => prev.filter(item => item.id !== invite.id));
      await refresh({ preserveExisting: false, source: 'rejected_followup' });
    } catch (err) {
      setError(err?.message || 'Davet reddedilemedi.');
    } finally {
      setBusyId('');
    }
  };

  if (!user?.email || (invites.length === 0 && !open)) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-amber-100"
        style={{
          background: 'linear-gradient(180deg, rgba(20,30,58,0.94), rgba(4,8,22,0.98))',
          boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.38), 0 0 10px rgba(250,204,21,0.18)',
        }}
        aria-label={`Oyun davetleri: ${invites.length}`}
      >
        <Bell className="h-4.5 w-4.5" />
        {invites.length > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-inter text-[10px] font-black text-amber-950"
            style={{ background: '#facc15', boxShadow: '0 0 10px rgba(250,204,21,0.6)' }}
          >
            {invites.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-12 z-[160] w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl p-3 text-left"
          style={{
            background: 'linear-gradient(180deg, rgba(18,29,58,0.98), rgba(5,10,25,0.99))',
            boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.35), 0 18px 34px rgba(0,0,0,0.45)',
          }}
        >
          <p className="font-inter text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/80">
            Oyun Davetleri
          </p>
          {error && <p className="mt-2 font-inter text-xs text-rose-200">{error}</p>}
          {loading && invites.length === 0 ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-blue-100/70">
              <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
            </div>
          ) : invites.length === 0 ? (
            <p className="mt-3 font-inter text-xs text-blue-100/65">Bekleyen davet yok.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {invites.map(invite => (
                <li
                  key={invite.id}
                  className="rounded-xl p-2"
                  style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
                >
                  <p className="truncate font-inter text-xs font-bold text-white">
                    {invite.from_name?.trim() || invite.from_email || 'Bir arkadaşın'}
                  </p>
                  <div className="mt-1"><InviteCountdown invite={invite} /></div>
                  <div className="mt-2 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleReject(invite)}
                      disabled={busyId === invite.id}
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ background: 'rgba(244,63,94,0.12)', boxShadow: 'inset 0 0 0 1px rgba(244,63,94,0.35)' }}
                      aria-label="Daveti reddet"
                    >
                      {busyId === invite.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-200" /> : <X className="h-3.5 w-3.5 text-rose-200" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAccept(invite)}
                      disabled={busyId === invite.id}
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ background: 'linear-gradient(180deg,#ffe066,#b97a06)', boxShadow: '0 0 10px rgba(250,204,21,0.42)' }}
                      aria-label="Daveti kabul et"
                    >
                      {busyId === invite.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-950" /> : <Check className="h-3.5 w-3.5 text-amber-950" strokeWidth={3} />}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
