import React, { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  markAcceptedOutgoingInviteHandled,
  openNotificationCenterGameInvite,
  rememberDismissedInviteToast,
  useNotificationCenter,
} from '@/hooks/useNotificationCenter';
import { traceGameInviteLifecycle } from '@/lib/gameInviteSelectors';

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
  const center = useNotificationCenter(user);
  const knownInviteIdsRef = useRef(new Set());
  const activeToastByInviteIdRef = useRef(new Map());
  const handledAcceptedOutgoingInviteIdsRef = useRef(new Set());
  const bootstrappedRef = useRef(false);
  const pathnameRef = useRef(location.pathname);

  const dismissInviteToast = useCallback((inviteId, { remember = true, source = 'toast_dismiss' } = {}) => {
    if (!inviteId) return;
    const active = activeToastByInviteIdRef.current.get(inviteId);
    if (remember) rememberDismissedInviteToast(inviteId);
    if (active?.timerId) window.clearTimeout(active.timerId);
    active?.controller?.dismiss?.();
    activeToastByInviteIdRef.current.delete(inviteId);
    traceGameInviteLifecycle('toast_banner_dismissed', active?.invite || { id: inviteId }, {
      source,
      user,
      userEmail: user?.email,
      reason: remember ? 'remembered_visual_only' : 'timeout_visual_only',
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
    if (activeToastByInviteIdRef.current.has(invite.id)) return;

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
            const res = await openNotificationCenterGameInvite(invite, {
              navigate,
              userEmail: user?.email,
              source: 'toast',
            });
            if (!res.ok) {
              toast({
                title: 'Davet açılamadı',
                description: res.reason || 'Davet kabul edilemedi. Lütfen tekrar dene.',
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
    dismissAllInviteToasts();
    knownInviteIdsRef.current = new Set();
    handledAcceptedOutgoingInviteIdsRef.current = new Set();
    bootstrappedRef.current = false;
  }, [dismissAllInviteToasts, user?.email]);

  useEffect(() => {
    if (!center.bootstrapped) return;
    const candidates = center.notificationViewModel.bannerCandidates || [];
    if (!bootstrappedRef.current) {
      candidates.forEach((invite) => {
        if (invite?.id) knownInviteIdsRef.current.add(invite.id);
      });
      bootstrappedRef.current = true;
      return;
    }
    candidates.forEach((invite) => {
      if (!invite?.id || knownInviteIdsRef.current.has(invite.id)) return;
      knownInviteIdsRef.current.add(invite.id);
      showInviteToast(invite);
    });
  }, [center.bootstrapped, center.notificationViewModel.bannerCandidates, showInviteToast]);

  useEffect(() => {
    const activeIds = new Set((center.gameInvites || []).map((invite) => invite.id).filter(Boolean));
    Array.from(activeToastByInviteIdRef.current.keys()).forEach((inviteId) => {
      if (!activeIds.has(inviteId)) {
        dismissInviteToast(inviteId, { remember: false, source: 'active_invite_removed' });
      }
    });
  }, [center.gameInvites, dismissInviteToast]);

  useEffect(() => {
    (center.acceptedOutgoingInvites || []).forEach((invite) => {
      if (!invite?.id || handledAcceptedOutgoingInviteIdsRef.current.has(invite.id)) return;
      handledAcceptedOutgoingInviteIdsRef.current.add(invite.id);
      markAcceptedOutgoingInviteHandled(invite.id);
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
    });
  }, [center.acceptedOutgoingInvites, navigate]);

  return null;
}
