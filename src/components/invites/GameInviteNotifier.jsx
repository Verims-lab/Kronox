import React, { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/components/ui/use-toast';
import { getLobbySnapshot } from '@/lib/dbGateway/lobbyGateway';
import { useAuth } from '@/lib/AuthContext';
import {
  markAcceptedOutgoingInviteHandled,
  openNotificationCenterGameInvite,
  rememberDismissedInviteToast,
  useNotificationCenter,
} from '@/hooks/useNotificationCenter';
import { traceGameInviteLifecycle } from '@/lib/gameInviteSelectors';
import { getSafeNotificationActorName } from '@/lib/notificationIdentity';

const PERSISTENT_INVITE_TOAST_DURATION = Infinity;

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
  const hiddenOnGameInviteIdsRef = useRef(new Set());
  const activeToastByInviteIdRef = useRef(new Map());
  const handledAcceptedOutgoingInviteIdsRef = useRef(new Set());
  const bootstrappedRef = useRef(false);
  const pathnameRef = useRef(location.pathname);

  const dismissInviteToast = useCallback((inviteId, { remember = true, source = 'toast_dismiss' } = {}) => {
    if (!inviteId) return;
    const active = activeToastByInviteIdRef.current.get(inviteId);
    if (remember) rememberDismissedInviteToast(inviteId);
    active?.controller?.dismiss?.();
    activeToastByInviteIdRef.current.delete(inviteId);
    traceGameInviteLifecycle('toast_banner_dismissed', active?.invite || { id: inviteId }, {
      source,
      user,
      userEmail: user?.email,
      reason: remember ? 'remembered_visual_only' : 'source_invalidated_or_route_closed',
    });
  }, [user]);

  const dismissAllInviteToasts = useCallback((options = {}) => {
    Array.from(activeToastByInviteIdRef.current.keys()).forEach((inviteId) => {
      dismissInviteToast(inviteId, { source: 'dismiss_all', ...options });
    });
  }, [dismissInviteToast]);

  const showInviteToast = useCallback((invite) => {
    if (!invite?.id) return;
    if (pathnameRef.current === '/game') {
      hiddenOnGameInviteIdsRef.current.add(invite.id);
      traceGameInviteLifecycle('toast_banner_hidden_on_game_route', invite, {
        source: 'GameInviteNotifier',
        user,
        userEmail: user?.email,
      });
      return;
    }
    if (activeToastByInviteIdRef.current.has(invite.id)) return;

    const display = getSafeNotificationActorName(invite?.from_name, 'Bir arkadaşın');
    const target = buildInviteTarget(invite);
    const controller = toast({
      title: 'Kronox oyun daveti',
      description: `${display} seni Kronox oyununa davet etti.`,
      duration: PERSISTENT_INVITE_TOAST_DURATION,
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

    activeToastByInviteIdRef.current.set(invite.id, {
      invite,
      controller,
      toastId: controller.id,
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
      dismissAllInviteToasts({ remember: false, source: 'game_route_hidden' });
      return;
    }
    if (!center.bootstrapped) return;
    const candidates = center.notificationViewModel.bannerCandidates || [];
    candidates.forEach((invite) => {
      if (!invite?.id || !hiddenOnGameInviteIdsRef.current.has(invite.id)) return;
      hiddenOnGameInviteIdsRef.current.delete(invite.id);
      if (knownInviteIdsRef.current.has(invite.id)) return;
      knownInviteIdsRef.current.add(invite.id);
      showInviteToast(invite);
    });
  }, [center.bootstrapped, center.notificationViewModel.bannerCandidates, dismissAllInviteToasts, location.pathname, showInviteToast]);

  useEffect(() => () => {
    dismissAllInviteToasts({ remember: false, source: 'notifier_unmount' });
  }, [dismissAllInviteToasts]);

  useEffect(() => {
    dismissAllInviteToasts({ remember: false, source: 'user_changed' });
    knownInviteIdsRef.current = new Set();
    hiddenOnGameInviteIdsRef.current = new Set();
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
        getLobbySnapshot({ lobbyId: invite.lobby_ref || invite.lobby_id })
          .then((response) => {
            const acceptedLobby = response?.data?.lobby;
            if (acceptedLobby?.id) {
              navigate('/lobby', { state: { joinedLobby: acceptedLobby } });
            }
          })
          .catch(() => null);
      }
      toast({
        title: 'Davet kabul edildi',
        description: `${getSafeNotificationActorName(invite.to_name, 'Arkadaşın')} lobiye katıldı.`,
        duration: 5000,
      });
    });
  }, [center.acceptedOutgoingInvites, navigate]);

  return null;
}
