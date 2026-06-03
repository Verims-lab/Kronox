import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  openNotificationCenterGameInvite,
  useNotificationCenter,
} from '@/hooks/useNotificationCenter';
import { isInviteExpired, normalizeEmail } from '@/lib/gameInviteSelectors';

// Header bell compatibility wrapper. The fetch/subscription/merge lifecycle
// now lives in useNotificationCenter so Header, toast, and Online pending
// invite surfaces cannot race each other with separate stale fetch loops.
export function useHeaderNotifications(user) {
  const navigate = useNavigate();
  const myEmail = normalizeEmail(user?.email);
  const center = useNotificationCenter(user);

  const openFriendRequests = useCallback(() => {
    navigate('/friends');
  }, [navigate]);

  const openGameInvite = useCallback(async (invite) => {
    if (!invite?.id) return { ok: false, reason: 'invalid' };
    if (isInviteExpired(invite)) {
      center.refresh({ preserveExisting: true, source: 'header_expired_retry' });
      return { ok: false, reason: 'expired' };
    }
    const res = await openNotificationCenterGameInvite(invite, {
      navigate,
      userEmail: myEmail,
      source: 'header_notifications',
      onAccepted: async () => center.refresh({ preserveExisting: true, source: 'header_accepted_followup' }),
    });
    return res;
  }, [center, myEmail, navigate]);

  return useMemo(() => ({
    friendRequests: center.friendRequests,
    gameInvites: center.gameInvites,
    totalCount: center.totalCount,
    loading: center.loading,
    error: center.error,
    refresh: center.refresh,
    openFriendRequests,
    openGameInvite,
    notificationViewModel: center.notificationViewModel,
  }), [center, openFriendRequests, openGameInvite]);
}
