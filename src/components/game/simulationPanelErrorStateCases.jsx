// A2 Error / Empty / Loading State source-connected contracts.
import statePanelSource from '../ui/KronoxStatePanel.jsx?raw';
import onlineSource from '../lobby/OnlineChallengeScreen.jsx?raw';
import playerModalSource from '../lobby/FriendSelectModal.jsx?raw';
import friendsSource from '../../pages/FriendsPage.jsx?raw';
import incomingSource from '../friends/IncomingRequestItem.jsx?raw';
import leaderboardSource from '../../pages/LeaderboardPage.jsx?raw';
import rankingSource from '../leaderboard/KronoxRankingSection.jsx?raw';
import wheelHookSource from '../../hooks/useDailyWheel.js?raw';
import wheelSource from '../dailyWheel/DailyWheelCard.jsx?raw';
import marketSource from '../../pages/MarketPage.jsx?raw';
import profileSource from '../../pages/ProfilePage.jsx?raw';
import dailySource from '../../pages/DailyPage.jsx?raw';

const SUITE_ID = 'error_state_health';
const SUITE_NAME = 'Error Empty Loading State Health Suite';
const makeCase = (id, name, run) => ({ key: `${SUITE_ID}.${id}`, suiteId: SUITE_ID, suiteName: SUITE_NAME, id, name, critical: false, run });
const pass = (reason) => ({ status: 'PASS', reason, verification: 'STATIC_CONTRACT', actionType: 'CODE_FIX' });
const fail = (reason, actual) => ({ status: 'FAIL', reason, actual, verification: 'STATIC_CONTRACT', classification: 'REAL_PRODUCT_RISK', actionType: 'CODE_FIX' });
const requireTokens = (source, tokens, reason) => {
  const missing = tokens.filter((token) => !String(source).includes(token));
  return missing.length ? fail(reason, { missing }) : pass(reason);
};

export const EXTRA_SUITES = [{ id: SUITE_ID, name: SUITE_NAME, critical: false, color: '#7dd3fc' }];

export const EXTRA_TESTS = [
  makeCase('no_raw_backend_errors_rendered', 'Public state surfaces use safe copy instead of raw backend errors', () => {
    const sources = `${onlineSource}\n${playerModalSource}\n${dailySource}\n${wheelSource}\n${marketSource}\n${profileSource}\n${rankingSource}`;
    const forbidden = ['AxiosError', 'Request failed with status code 500', '[object Object]', 'stack trace'].filter((token) => sources.includes(token));
    return forbidden.length ? fail('Raw backend error copy can reach a public state surface.', { forbidden }) : requireTokens(statePanelSource, ['title', 'message', 'actionLabel', 'break-words'], 'Shared state surfaces accept safe display copy only.');
  }),
  makeCase('online_social_failure_is_local', 'Online social failure stays inside player selection', () => requireTokens(`${onlineSource}\n${playerModalSource}`, [
    'title="Oyuncular yüklenemedi."',
    'Davet listesi şu anda güncellenemedi.',
    'label="Rastgele Eşleş"',
    'const ctaDisabledRandom = loading || creating;',
  ], 'Online player-list failure is local and Random Matchmaking remains independently enabled.')),
  makeCase('online_empty_players_not_global_error', 'Online empty players is a useful empty state', () => requireTokens(`${playerModalSource}\n${onlineSource}`, [
    'kind="empty"',
    'Davet edilecek oyuncu bulunamadı.',
    'Arkadaşlarını ekledikten sonra davet edebilirsin.',
    'label="Rastgele Eşleş"',
  ], 'An empty invite list is not treated as a global Online error.')),
  makeCase('friend_accept_failure_preserves_row', 'Friend accept failure preserves the actionable row', () => requireTokens(incomingSource, [
    'await onAccept(request)',
    'Arkadaşlık isteği kabul edilemedi. Lütfen tekrar dene.',
    'setBusy(null)',
    '{error &&',
  ], 'Failed friend acceptance stays on the existing row with safe retryable feedback.')),
  makeCase('leaderboard_friend_hydration_failure_nonblocking', 'Leaderboard enrichment failure does not block ranking rows', () => requireTokens(`${leaderboardSource}\n${rankingSource}`, [
    'applySnapshot(snapshot)',
    'sanitized friend enrichment unavailable',
    'catch (enrichmentError)',
    'leaderboard.topRows.map',
  ], 'Friend/avatar enrichment remains a second nonblocking pass after ranking rows render.')),
  makeCase('daily_wheel_claim_failure_no_fake_reward', 'Daily Wheel failure cannot render a fake granted reward', () => requireTokens(`${wheelHookSource}\n${wheelSource}`, [
    'applyClaimSuccessBody(body)',
    "setStatus('error')",
    'setShowResult(true)',
    'Ödül alınamadı. Lütfen tekrar dene.',
    "reason: 'daily_wheel_claim_success'",
  ], 'Only verified claim success marks the wheel/Daily cache successful; failure renders safe retry copy.')),
  makeCase('store_purchase_failure_local_safe_copy', 'Store purchase failure stays local with safe Turkish copy', () => requireTokens(marketSource, [
    "text: 'Satın alma tamamlanamadı. Lütfen tekrar dene.'",
    'notice={notice}',
    'notice?.text && <div className="mt-4">',
    'data-kronox-market-modal-purchase',
  ], 'Store purchase failure is shown inside the open package modal without changing prices or grants.')),
  makeCase('profile_secondary_failure_local', 'Profile secondary inventory failure stays local', () => requireTokens(profileSource, [
    '<IdentityCard',
    '<JokerPocketSection',
    'Joker ve İpucu bilgileri yüklenemedi.',
    'Profilinin diğer bölümlerini kullanmaya devam edebilirsin.',
  ], 'Inventory failure is contained to Joker Çantası while Profile identity and navigation remain available.')),
  makeCase('no_private_identifiers_in_error_surfaces', 'State surfaces do not render private identifiers', () => {
    const publicStates = `${statePanelSource}\n${onlineSource}\n${playerModalSource}\n${dailySource}\n${wheelSource}\n${marketSource}\n${profileSource}\n${incomingSource}`;
    const forbidden = ['{guest_token}', '{owner_key}', '{actor_key_hash}', '{user_email}', '{provider_id}'].filter((token) => publicStates.includes(token));
    return forbidden.length ? fail('A private identifier is interpolated into a state surface.', { forbidden }) : pass('Error, empty, and loading surfaces contain no private identifier interpolation.');
  }),
  makeCase('retry_buttons_are_scoped', 'Retry actions reload only their affected section', () => requireTokens(`${playerModalSource}\n${friendsSource}\n${dailySource}\n${profileSource}`, [
    'loadOnlinePlayerSelection({ guestCredentials })',
    'onAction={() => refresh(user.email)}',
    'daily.refresh({ ignoreCache: true })',
    'onAction={onRetry}',
  ], 'Player list, Friends data, Daily tasks, and Profile inventory retries remain section-scoped.')),
];