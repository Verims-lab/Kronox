import { useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getCompletedGuestCredentialsPayload } from '@/lib/guestProfile';
import { isAdminUser } from '@/lib/admin';

export function useCurrentPlayerProfile() {
  const auth = useAuth();
  const linkedUser = auth.user?.email || auth.user?.user_email ? auth.user : null;
  const guestProfile = linkedUser ? null : (auth.guestProfile || null);
  const player = linkedUser || guestProfile;
  const guestCredentials = useMemo(
    () => (guestProfile ? getCompletedGuestCredentialsPayload(guestProfile) : null),
    [guestProfile],
  );

  return {
    linkedUser,
    guestProfile,
    player,
    playerType: linkedUser ? 'linked' : (guestProfile ? 'guest' : 'unknown'),
    guestCredentials,
    authChecked: auth.authChecked,
    loading: auth.isLoadingAuth || !auth.authChecked,
    isAdmin: auth.adminStatus?.allowed === true || isAdminUser(linkedUser),
    adminStatus: auth.adminStatus,
    setUser: auth.setUser,
    logout: auth.logout,
    navigateToLogin: auth.navigateToLogin,
    refresh: auth.checkUserAuth,
  };
}
