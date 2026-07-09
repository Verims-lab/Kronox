export const SOLO_ONBOARDING_ANALYTICS_EVENTS = Object.freeze({
  LEVEL_START: 'solo_onboarding_level_start',
  FIRST_DRAG: 'solo_onboarding_first_drag',
  DROP: 'solo_onboarding_drop',
  CORRECT: 'solo_onboarding_correct',
  WRONG: 'solo_onboarding_wrong',
  COMPLETE: 'solo_onboarding_complete',
  FAIL: 'solo_onboarding_fail',
  BEFORE_AFTER_TUTORIAL_SKIP: 'before_after_tutorial_skip',
  BEFORE_AFTER_JOKER_TUTORIAL_SKIP: 'before_after_joker_tutorial_skip',
  BEFORE_AFTER_HINT_TUTORIAL_SKIP: 'before_after_hint_tutorial_skip',
  TIMELINE_BASIC_TUTORIAL_SKIP: 'timeline_basic_tutorial_skip',
  NORMAL_TIMELINE_TUTORIAL_SKIP: 'normal_timeline_tutorial_skip',
});

const PRIVATE_PAYLOAD_KEYS = new Set([
  'email',
  'owner_key',
  'ownerKey',
  'guest_id',
  'guestId',
  'player_key',
  'playerKey',
  'provider_id',
  'providerId',
]);

function sanitizePayload(payload = {}) {
  const safe = {};
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (PRIVATE_PAYLOAD_KEYS.has(key)) return;
    if (value === undefined || typeof value === 'function') return;
    safe[key] = value;
  });
  return safe;
}

export function recordSoloOnboardingAnalyticsEvent(eventType, payload = {}) {
  try {
    if (!eventType) return false;
    const event = {
      event_type: String(eventType),
      source: 'solo_onboarding',
      created_at: new Date().toISOString(),
      ...sanitizePayload(payload),
    };
    if (typeof window !== 'undefined') {
      window.__KRONOX_SOLO_ONBOARDING_ANALYTICS_LAST_EVENT__ = event;
    }
    return true;
  } catch {
    return false;
  }
}
