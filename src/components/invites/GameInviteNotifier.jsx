import React, { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { loadIncomingInviteSnapshot, openGameInvite } from '@/lib/inviteApi';
import { buildNotificationViewModel } from '@/lib/notificationViewModel';
import {
  getGameInviteActiveFilterReason,
  getInviteRecipientEmail,
  getInviteSenderEmail,
  normalizeEmail,
  traceGameInviteLifecycle,
} from '@/lib/gameInviteSelectors';

const INVITE_TOAST_DURATION_MS = 10000;

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
  const handledAcceptedOutgoingInviteIdsRef = useRef(new Set());
  const bootstrappedRef = useRef(false);
  const pathnameRef = useRef(location.pathname);

  const dismissInviteToast = useCallback((inviteId, { remember = true, source = 'toast_dismiss' } = {}) => {
    if (!inviteId) return;
    const active = activeToastByInviteIdRef.current.get(inviteId);
    if (remember) dismissedInviteIdsRef.current.add(inviteId);
    if (active?.timerId) window.clearTimeout(active.timerId);
    active?.controller?.dismiss?.();
    activeToastByInviteIdRef.current.delete(inviteId);
    traceGameInviteLifecycle('toast_banner_dismissed', active?.invite || { id: inviteId }, {
      source,
      user,
      userEmail: user?.email,
      reason: remember ? 'remembered' : 'visual_only',
    });
  }, [user]);

  const dismissAllInviteToasts = useCallback(() => {
    Array.from(activeToastByInviteIdRef.current.keys()).forEach((inviteId) => {
      dismissInviteToast(inviteId, { source: 'dismiss_all' });
    });
  }, [dismissInviteToast]);

  const showInviteToast = useCallback((invite) => {
    if (!invite?.id) return;
    if (pathnameRef.current === '/game') {
      knownInviteIdsRef.current.add(invite.id);
      traceGameInviteLifecycle('toast_banner_hidden_on_game_route', invite, {
        source: 'GameInviteNotifier',
        user,
        userEmail: user?.email,
      });
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
      onDismiss: () => dismissInviteToast(invite.id, { remember: true, source: 'toast_close_button' }),
      action: (
        <ToastAction
          onClick={async () => {
            dismissInviteToast(invite.id, { remember: true, source: 'toast_open_action' });
            try {
              await openGameInvite(invite, {
                navigate,
                userEmail: user?.email,
                source: 'toast',
              });
            } catch (error) {
              toast({
                title: 'Davet açılamadı',
                description: error?.message || 'Davet kabul edilemedi. Lütfen tekrar dene.',
                duration: 5000,
              });
            }
          }}
        >
          Aç
        </ToastAction>
      ),
    });

    const timerId = window.setTimeout(() => {
      dismissInviteToast(invite.id, { remember: false, source: 'toast_timeout' });
    }, INVITE_TOAST_DURATION_MS);

    activeToastByInviteIdRef.current.set(invite.id, {
      invite,
      controller,
      toastId: controller.id,
      timerId,
    });
    traceGameInviteLifecycle('toast_banner_shown', invite, {
      source: 'GameInviteNotifier',
      user,
      userEmail: user?.email,
      reason: target,
    });
  }, [dismissInviteToast, navigate, user]);

  const ingestInvites = useCallback((rows, { notifyNew }) => {
    const known = knownInviteIdsRef.current;
    const viewModel = buildNotificationViewModel({
      currentUser: user,
      gameInvites: rows,
      dismissedToastIds: dismissedInviteIdsRef.current,
    });
    (rows || []).forEach((invite) => {
      if (!invite?.id) return;
      const wasKnown = known.has(invite.id);
      known.add(invite.id);
      const reason = getGameInviteActiveFilterReason(invite, user?.email);
      traceGameInviteLifecycle(reason.startsWith('active') ? 'invite_passed_active_filter' : 'invite_failed_active_filter', invite, {
        source: 'GameInviteNotifier.ingest',
        user,
        userEmail: user?.email,
        reason,
      });
      if (!reason.startsWith('active')) {
        if (reason.startsWith('terminal_') || reason === 'expired') {
          dismissInviteToast(invite.id, { source: `status_${invite.status || reason}` });
        }
        return;
      }
      const canShowBanner = viewModel.bannerCandidates.some((item) => item.id === invite.id);
      if (notifyNew && !wasKnown && canShowBanner) {
        showInviteToast(invite);
      }
    });
  }, [dismissInviteToast, showInviteToast, user]);

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
      const snapshot = await loadIncomingInviteSnapshot(email).catch(() => ({ rows: [], activeInvites: [] }));
      if (cancelled) return;
      traceGameInviteLifecycle('invite_loaded_by_polling_fetch', { id: `count:${snapshot.activeInvites?.length || 0}`, status: 'pending', to_email: email }, {
        source: 'GameInviteNotifier.refresh',
        user,
        userEmail: email,
        reason: 'fetch_complete',
      });
      ingestInvites(snapshot.rows || [], { notifyNew });
      bootstrappedRef.current = true;
    };

    refresh({ notifyNew: false });

    const unsub = base44.entities.GameInvite.subscribe((event) => {
      const eventType = event?.type || event?.eventType || 'update';
      const invite = event?.data || event;
      if (eventType === 'delete') return;
      const toEmail = getInviteRecipientEmail(invite);
      const fromEmail = getInviteSenderEmail(invite);
      traceGameInviteLifecycle('invite_received_by_subscription', invite, {
        source: `GameInviteNotifier.subscription:${eventType}`,
        user,
        userEmail: email,
      });
      if (
        fromEmail === email
        && invite?.status === 'accepted'
        && invite?.id
        && !handledAcceptedOutgoingInviteIdsRef.current.has(invite.id)
      ) {
        handledAcceptedOutgoingInviteIdsRef.current.add(invite.id);
        if (pathnameRef.current !== '/game' && pathnameRef.current !== '/lobby' && invite.lobby_id) {
          base44.entities.Lobby.get(invite.lobby_id)
            .then((acceptedLobby) => {
              if (acceptedLobby?.id) {
                navigate('/lobby', { state: { joinedLobby: acceptedLobby } });
              }
            })
            .catch(() => null);
        }
        toast({
          title: 'Davet kabul edildi',
          description: `${invite.to_email || 'Arkadaşın'} lobiye katıldı.`,
          duration: 5000,
        });
        return;
      }
      if (toEmail !== email) return;
      if (invite?.id && invite.status !== 'pending') {
        knownInviteIdsRef.current.add(invite.id);
        dismissInviteToast(invite.id, { source: `subscription_${invite.status}` });
        return;
      }
      ingestInvites([invite], { notifyNew: bootstrappedRef.current });
    });

    intervalId = window.setInterval(() => {
      refresh({ notifyNew: true });
    }, 20000);

    const onFocus = () => { refresh({ notifyNew: true }); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh({ notifyNew: true });
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (typeof unsub === 'function') unsub();
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [dismissAllInviteToasts, dismissInviteToast, ingestInvites, navigate, user, user?.email]);

  return null;
}
