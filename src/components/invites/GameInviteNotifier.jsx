import React, { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { loadIncomingInvites } from '@/lib/inviteApi';
import { normalizeEmail } from '@/lib/friendsApi';

const INVITE_TOAST_DURATION_MS = 8000;

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
  const location = useLocation();
  const { user } = useAuth();
  const knownInviteIdsRef = useRef(new Set());
  const dismissedInviteIdsRef = useRef(new Set());
  const activeToastByInviteIdRef = useRef(new Map());
  const bootstrappedRef = useRef(false);
  const pathnameRef = useRef(location.pathname);

  const dismissInviteToast = useCallback((inviteId, { remember = true } = {}) => {
    if (!inviteId) return;
    const active = activeToastByInviteIdRef.current.get(inviteId);
    if (remember) dismissedInviteIdsRef.current.add(inviteId);
    if (active?.timerId) window.clearTimeout(active.timerId);
    active?.controller?.dismiss?.();
    activeToastByInviteIdRef.current.delete(inviteId);
  }, []);

  const dismissAllInviteToasts = useCallback(() => {
    Array.from(activeToastByInviteIdRef.current.keys()).forEach((inviteId) => {
      dismissInviteToast(inviteId);
    });
  }, [dismissInviteToast]);

  const showInviteToast = useCallback((invite) => {
    if (!invite?.id) return;
    if (pathnameRef.current === '/game') {
      knownInviteIdsRef.current.add(invite.id);
      return;
    }
    if (dismissedInviteIdsRef.current.has(invite.id) || activeToastByInviteIdRef.current.has(invite.id)) {
      return;
    }

    const display = invite?.from_name?.trim() || invite?.from_email || 'Bir arkadaşın';
    const target = buildInviteTarget(invite);
    const controller = toast({
      title: 'Kronox oyun daveti',
      description: `${display} seni Kronox oyununa davet etti.`,
      duration: Infinity,
      onDismiss: () => dismissInviteToast(invite.id),
      action: (
        <ToastAction
          onClick={() => {
            dismissInviteToast(invite.id);
            navigate(target);
          }}
        >
          Aç
        </ToastAction>
      ),
    });

    const timerId = window.setTimeout(() => {
      dismissInviteToast(invite.id);
    }, INVITE_TOAST_DURATION_MS);

    activeToastByInviteIdRef.current.set(invite.id, {
      controller,
      toastId: controller.id,
      timerId,
    });
  }, [dismissInviteToast, navigate]);

  const ingestInvites = useCallback((rows, { notifyNew }) => {
    const known = knownInviteIdsRef.current;
    (rows || []).forEach((invite) => {
      if (!invite?.id) return;
      const wasKnown = known.has(invite.id);
      known.add(invite.id);
      if (invite.status !== 'pending') {
        dismissInviteToast(invite.id);
        return;
      }
      if (notifyNew && !wasKnown && !dismissedInviteIdsRef.current.has(invite.id)) {
        showInviteToast(invite);
      }
    });
  }, [dismissInviteToast, showInviteToast]);

  useEffect(() => {
    pathnameRef.current = location.pathname;
    if (location.pathname === '/game') {
      dismissAllInviteToasts();
    }
  }, [dismissAllInviteToasts, location.pathname]);

  useEffect(() => () => {
    dismissAllInviteToasts();
  }, [dismissAllInviteToasts]);

  useEffect(() => {
    const email = normalizeEmail(user?.email);
    dismissAllInviteToasts();
    knownInviteIdsRef.current = new Set();
    dismissedInviteIdsRef.current = new Set();
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
      if (normalizeEmail(invite?.to_email) !== email) return;
      if (invite?.id && invite.status !== 'pending') {
        knownInviteIdsRef.current.add(invite.id);
        dismissInviteToast(invite.id);
        return;
      }
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
  }, [dismissAllInviteToasts, dismissInviteToast, ingestInvites, user?.email]);

  return null;
}
