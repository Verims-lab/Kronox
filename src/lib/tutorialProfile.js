import { base44 } from '@/api/base44Client';

export function hasCompletedTutorial(user) {
  return user?.hasCompletedTutorial === true;
}

export function shouldShowTutorialForUser(user) {
  return Boolean(user?.email) && !hasCompletedTutorial(user);
}

export async function markTutorialCompleted(user) {
  if (!user?.email) return user || null;
  const updated = await base44.auth.updateMe({ hasCompletedTutorial: true });
  return {
    ...(user || {}),
    ...(updated || {}),
    hasCompletedTutorial: true,
  };
}
