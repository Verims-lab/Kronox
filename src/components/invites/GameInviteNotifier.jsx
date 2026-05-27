import React, { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { loadIncomingInvites } from '@/lib/inviteApi';
import { normalizeEmail } from '@/lib/friendsApi';

function buildInviteTarget(invite) {
  const params = new URLSearchParams();
  if (invite?.id) params.set('inviteId', invite.id);
  if (invite?.lobby_id) params.set('lobbyId', invite.lobby_id);
  if (invite?.lobby_code) params.set('lobbyCode', invite.lobby_code);
  const query = params.toString();
  return query ? `/lobby?${query}` : '/lobby';
}

export default function GameInviteNotifier() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const knownInviteIdsRef = useRef(new Set());
  const bootstrappedRef = useRef(false);

  const showInviteToast = useCallback((invite) => {
    const display = invite?.from_name?.trim() || invite?.from_email || 'Bir arkadaşın';
    const target = buildInviteTarget(invite);
    toast({
      title: 'Kronox oyun daveti',
      description: `${display} seni Kronox oyununa davet etti.`,
      action: (
        <ToastAction onClick={() => navigate(target)}>
          Aç
        </ToastAction>
      ),
    });
  }, [navigate]);

  const ingestInvites = useCallback((rows, { notifyNew }) => {
    const known = knownInviteIdsRef.current;
    (rows || []).forEach((invite) => {
      if (!invite?.id) return;
      const wasKnown = known.has(invite.id);
      known.add(invite.id);
      if (notifyNew && !wasKnown && invite.status === 'pending') {
        showInviteToast(invite);
      }
    });
  }, [showInviteToast]);

  useEffect(() => {
    const email = normalizeEmail(user?.email);
    knownInviteIdsRef.current = new Set();
    bootstrappedRef.current = false;
    if (!email) return undefined;

    let cancelled = false;
    let intervalId = null;

    const refresh = async ({ notifyNew }) => {
      const rows = await loadIncomingInvites(email).catch(() => []);
      if (cancelled) return;
      ingestInvites(rows, { notifyNew });
      bootstrappedRef.current = true;
    };

    refresh({ notifyNew: false });

    const unsub = base44.entities.GameInvite.subscribe((event) => {
      const eventType = event?.type || event?.eventType || 'update';
      const invite = event?.data || event;
      if (eventType === 'delete') return;
      if (normalizeEmail(invite?.to_email) !== email || invite?.status !== 'pending') return;
      ingestInvites([invite], { notifyNew: bootstrappedRef.current });
    });

    intervalId = window.setInterval(() => {
      refresh({ notifyNew: true });
    }, 20000);

    return () => {
      cancelled = true;
      if (typeof unsub === 'function') unsub();
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [ingestInvites, user?.email]);

  return null;
}
