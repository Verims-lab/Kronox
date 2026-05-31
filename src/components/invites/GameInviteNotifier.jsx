import React, { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { loadIncomingInvites } from '@/lib/inviteApi';
import { normalizeEmail } from '@/lib/friendsApi';
// Codex135 — Shared active-invite selector. The toast UI now defers to
// the same predicate the header bell and Online panel use, so a fresh
// invite that the toast already dismissed is never erased from the
// other surfaces.
import { isActiveIncomingGameInvite } from '@/lib/gameInviteSelectors';

// Codex130 — Banner auto-dismiss: 10 seconds (product spec). Dismissing
// the banner does NOT delete the invite — it stays pending in the database
// and remains visible in IncomingInvitesPanel on the Online screen.
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

  // Codex135 — INVARIANT: dismissInviteToast ONLY closes the visual
  // toast. It NEVER calls GameInvite.update(...). It NEVER affects the
  // header bell, Online IncomingInvitesPanel, or any other surface that
  // reads the GameInvite entity. `remember=true` only prevents the same
  // toast instance from re-popping for the same invite id while the
  // invite is still pending.
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
      const toEmail = normalizeEmail(invite?.to_email);
      const fromEmail = normalizeEmail(invite?.from_email);
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
        dismissInviteToast(invite.id);
        return;
      }
      ingestInvites([invite], { notifyNew: bootstrappedRef.current });
    });

    intervalId = window.setInterval(() => {
      refresh({ notifyNew: true });
    }, 20000);

    // Codex130 — App resume / focus recheck.
    // When the app is opened from background (PWA, Android WebView, tab
    // switch), neither the polling interval nor the realtime subscription
    // is guaranteed to fire immediately. We hook visibilitychange + focus
    // so pending invites that arrived while the app was closed surface
    // their in-app banner the moment the user returns. Expired invites
    // are still filtered out by loadIncomingInvites (lazy cleanup).
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
  }, [dismissAllInviteToasts, dismissInviteToast, ingestInvites, user?.email]);

  return null;
}