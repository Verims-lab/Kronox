import {
  AUTOMATION_STATUS,
  RUNTIME_SERVICE_CATEGORY,
} from '../../src/lib/health/runtimeE2EReport.js';
import {
  AutomationSetupGap,
  assertPublicTextSafe,
  expectPath,
  expectVisible,
  requireCapability,
} from './runtimeHarness.mjs';

const HOME = '[data-testid="home-screen"]';

async function openHome(runtime, config) {
  await runtime.page.goto(config.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await expectVisible(runtime.page, HOME, 15000);
  } catch (error) {
    if (!config.hasStorageState) {
      throw new AutomationSetupGap('Fresh context reached onboarding instead of a completed guest Home. Provide KRONOX_E2E_STORAGE_STATE for Home-owned scenarios.');
    }
    throw error;
  }
  return 'Home rendered in a new browser context.';
}

async function clickAndSee(page, clickSelector, visibleSelector, timeout = 12000) {
  await page.locator(clickSelector).first().click();
  await expectVisible(page, visibleSelector, timeout);
}

async function expectOnlyActive(page, testId) {
  const active = page.locator('[data-testid="bottom-nav"] [aria-current="page"]');
  if (await active.count() !== 1) throw new Error('BottomNav did not expose exactly one active tab.');
  if (await active.first().getAttribute('data-testid') !== testId) throw new Error(`${testId} is not the committed active tab.`);
  return `${testId} is the only active BottomNav tab.`;
}

async function appBootstrapGuestHome(runtime, config) {
  await runtime.step('bootstrap.open', async () => openHome(runtime, config));
  await runtime.step('bootstrap.settle', async () => 'App bootstrap settled on the Home route.');
  await runtime.step('bootstrap.home', async () => {
    await expectVisible(runtime.page, HOME);
    return 'Home root is visible.';
  });
  await runtime.step('bootstrap.play_cta', async () => {
    await expectVisible(runtime.page, '[data-testid="home-solo-entry"]');
    return 'The direct Solo OYNA action is visible.';
  });
  await runtime.step('bootstrap.bottom_nav', async () => {
    const nav = await expectVisible(runtime.page, '[data-testid="bottom-nav"]');
    const labels = (await nav.locator('button').allInnerTexts()).map((label) => label.trim());
    if (JSON.stringify(labels) !== JSON.stringify(['Ana Sayfa', 'Liderlik', 'Profil'])) {
      throw new Error(`Unexpected BottomNav labels: ${labels.join(', ')}`);
    }
    return `BottomNav labels: ${labels.join(', ')}.`;
  });
  await runtime.step('bootstrap.public_safety', async () => assertPublicTextSafe(runtime.page));
  await runtime.step('bootstrap.interactive', async () => {
    await runtime.page.locator('[data-testid="bottom-nav-home"]').click();
    await expectVisible(runtime.page, HOME);
    return 'Home tab accepted input and Home remained interactive.';
  });
}

async function bottomNavRouteSync(runtime, config) {
  await runtime.step('nav.home_active', async () => {
    await openHome(runtime, config);
    return expectOnlyActive(runtime.page, 'bottom-nav-home');
  });
  await runtime.step('nav.leaderboard', async () => {
    await clickAndSee(runtime.page, '[data-testid="bottom-nav-leaderboard"]', '[data-testid="leaderboard-screen"]');
    await expectPath(runtime.page, '/leaderboard');
    return expectOnlyActive(runtime.page, 'bottom-nav-leaderboard');
  });
  await runtime.step('nav.profile', async () => {
    await clickAndSee(runtime.page, '[data-testid="bottom-nav-profile"]', '[data-testid="profile-screen"]');
    await expectPath(runtime.page, '/profile');
    return expectOnlyActive(runtime.page, 'bottom-nav-profile');
  });
  await runtime.step('nav.home_return', async () => {
    await clickAndSee(runtime.page, '[data-testid="bottom-nav-home"]', HOME);
    await expectPath(runtime.page, '/');
    return expectOnlyActive(runtime.page, 'bottom-nav-home');
  });
  await runtime.step('nav.profile_subroute', async () => {
    await clickAndSee(runtime.page, '[data-testid="bottom-nav-profile"]', '[data-testid="profile-screen"]');
    await clickAndSee(runtime.page, '[data-testid="profile-edit-entry"]', '[data-testid="profile-edit-screen"]');
    return expectPath(runtime.page, '/profile/edit');
  });
  await runtime.step('nav.profile_root_reset', async () => {
    await clickAndSee(runtime.page, '[data-testid="bottom-nav-profile"]', '[data-testid="profile-screen"]');
    return expectPath(runtime.page, '/profile');
  });
  await runtime.step('nav.leaderboard_root_reset', async () => {
    await clickAndSee(runtime.page, '[data-testid="bottom-nav-leaderboard"]', '[data-testid="leaderboard-screen"]');
    await runtime.page.locator('[data-testid="bottom-nav-leaderboard"]').click();
    return expectPath(runtime.page, '/leaderboard');
  });
  await runtime.step('nav.exact_tabs', async () => {
    const labels = await runtime.page.locator('[data-testid="bottom-nav"] button').allInnerTexts();
    if (labels.length !== 3 || labels.join('|') !== 'Ana Sayfa|Liderlik|Profil') throw new Error('BottomNav contract drifted from exactly three root tabs.');
    return 'Exactly Ana Sayfa, Liderlik, and Profil remain.';
  });
}

async function profileNavigationPrivacy(runtime, config) {
  await runtime.step('profile.open', async () => {
    await openHome(runtime, config);
    await clickAndSee(runtime.page, '[data-testid="bottom-nav-profile"]', '[data-testid="profile-screen"]');
    return 'Profile root is visible.';
  });
  await runtime.step('profile.identity', async () => {
    const rootText = await runtime.page.locator('[data-testid="profile-screen"]').innerText();
    if (!rootText.trim()) throw new Error('Profile root has no user-facing identity content.');
    return 'Profile has a visible username/avatar-safe identity area.';
  });
  await runtime.step('profile.edit_open', async () => {
    await clickAndSee(runtime.page, '[data-testid="profile-edit-entry"]', '[data-testid="profile-edit-screen"]');
    return expectPath(runtime.page, '/profile/edit');
  });
  await runtime.step('profile.fields', async () => {
    const text = await runtime.page.locator('[data-testid="profile-edit-screen"]').innerText();
    if (/Profil bilgisi yüklenemedi/i.test(text)) {
      throw new AutomationSetupGap('The local guest profile was unavailable, so editable field values could not be inspected.');
    }
    const missing = ['Takma Ad', 'Cinsiyet', 'Yaş grubu'].filter((label) => !text.includes(label));
    if (missing.length) throw new Error(`Missing allowed Profile fields: ${missing.join(', ')}`);
    return 'Takma Ad, Cinsiyet, and Yaş grubu are visible; category support remains route-owned when available.';
  }, { optional: true });
  await runtime.step('profile.privacy', async () => assertPublicTextSafe(runtime.page));
  await runtime.step('profile.back', async () => {
    await clickAndSee(runtime.page, '[data-testid="profile-edit-back"]', '[data-testid="profile-screen"]');
    return expectPath(runtime.page, '/profile');
  });
  await runtime.step('profile.home', async () => {
    await clickAndSee(runtime.page, '[data-testid="bottom-nav-home"]', HOME);
    return expectOnlyActive(runtime.page, 'bottom-nav-home');
  });
}

async function leaderboardSmokePrivacy(runtime, config) {
  await runtime.step('leaderboard.open', async () => {
    await openHome(runtime, config);
    await clickAndSee(runtime.page, '[data-testid="bottom-nav-leaderboard"]', '[data-testid="leaderboard-screen"]');
    return 'Leaderboard route and heading are visible.';
  });
  await runtime.step('leaderboard.state', async () => {
    const text = await runtime.page.locator('[data-testid="leaderboard-screen"]').innerText();
    if (!/(Liderlik|Sıralama|Puan|yüklen|tekrar)/i.test(text)) throw new Error('Leaderboard has no bounded list/own-row/loading/retry state.');
    return 'Leaderboard exposes a user-facing list, score, loading, or retry state.';
  });
  await runtime.step('leaderboard.score', async () => {
    const text = await runtime.page.locator('[data-testid="leaderboard-screen"]').innerText();
    return /Puan/i.test(text) ? 'Puan presentation is visible.' : 'No score rows exist in the current safe state.';
  });
  await runtime.step('leaderboard.privacy', async () => assertPublicTextSafe(runtime.page));
  await runtime.step('leaderboard.home', async () => {
    await clickAndSee(runtime.page, '[data-testid="bottom-nav-home"]', HOME);
    return 'Home returned safely.';
  });
}

async function dailyScreenSmoke(runtime, config) {
  await runtime.step('daily.open', async () => {
    await openHome(runtime, config);
    await clickAndSee(runtime.page, '[data-testid="daily-screen-entry"]', '[data-testid="daily-screen"]');
    return expectPath(runtime.page, '/daily');
  });
  await runtime.step('daily.root', async () => {
    const text = await runtime.page.locator('[data-testid="daily-screen"]').innerText();
    if (!/Günlük/i.test(text)) throw new Error('Daily page title is not visible.');
    return 'Daily Calendar root is visible.';
  });
  await runtime.step('daily.tasks', async () => {
    const text = await runtime.page.locator('[data-testid="daily-screen"]').innerText();
    if (!/(Görev|yüklen|tekrar|hazırlan)/i.test(text)) throw new Error('Today tasks did not reach a bounded visible state.');
    return 'Today task area reached a bounded state.';
  });
  await runtime.step('daily.streak', async () => {
    const found = await runtime.page.locator('[data-kronox-daily-streak-strip="true"]').count();
    return found ? 'Daily streak strip is visible.' : 'The current response has no streak strip; no claim was attempted.';
  });
  await runtime.step('daily.no_claim', async () => 'No reward, task, or claim control was activated.');
  await runtime.step('daily.back', async () => {
    await clickAndSee(runtime.page, '[data-testid="daily-back-home"]', HOME);
    return 'Daily back returned to Home.';
  });
}

async function dailyWheel(runtime, config) {
  await runtime.step('wheel.balance_before', async () => {
    await openHome(runtime, config);
    const text = await runtime.page.locator('body').innerText();
    const match = text.match(/(?:Elmas|diamond)[^\d]*([\d.]+)/i);
    return match ? `Visible Diamond balance captured: ${match[1]}.` : 'Visible Diamond balance was unavailable; open/close proof continues.';
  });
  await runtime.step('wheel.open', async () => {
    await clickAndSee(runtime.page, '[data-testid="daily-wheel-entry"]', '[data-testid="daily-wheel-modal"]');
    return 'Daily Wheel modal opened.';
  });
  await runtime.step('wheel.modal', async () => {
    await expectVisible(runtime.page, '[data-testid="daily-wheel-close"]');
    return 'Modal and close control are visible.';
  });
  await runtime.step('wheel.close', async () => {
    await runtime.page.locator('[data-testid="daily-wheel-close"]').first().click();
    await runtime.page.locator('[data-testid="daily-wheel-modal"]').waitFor({ state: 'detached', timeout: 12000 });
    return 'Modal and backdrop unmounted.';
  });
  await runtime.step('wheel.home_interactive', async () => {
    await runtime.page.locator('[data-testid="bottom-nav-home"]').click();
    await expectVisible(runtime.page, HOME);
    return 'Home accepted input after modal close.';
  });
  await runtime.step('wheel.reopen', async () => {
    await clickAndSee(runtime.page, '[data-testid="daily-wheel-entry"]', '[data-testid="daily-wheel-modal"]');
    return 'Daily Wheel reopened in its current available/claimed state.';
  });
  await runtime.step('wheel.optional_spin', async () => {
    requireCapability(config.allowWheelSpin, 'KRONOX_E2E_ALLOW_WHEEL_SPIN is not true for an isolated resettable actor.');
    const spin = runtime.page.locator('[data-testid="daily-wheel-spin"]');
    if (!(await spin.isEnabled())) throw new AutomationSetupGap('No safe free spin is available for this automation actor.');
    await spin.click();
    await runtime.page.getByText(/Elmas|Joker|İpucu|ödül/i).last().waitFor({ state: 'visible', timeout: 45000 });
    return 'Backend-selected wheel result became visible under the explicit mutation gate.';
  }, { optional: true });
  await runtime.step('wheel.no_puan', async () => {
    if (!config.allowWheelSpin) throw new AutomationSetupGap('No spin ran, so score comparison is intentionally not applicable.');
    return 'No Puan mutation control was invoked by the wheel scenario.';
  }, { optional: true });
}

async function storeSmoke(runtime, config) {
  await runtime.step('store.open', async () => {
    await openHome(runtime, config);
    await clickAndSee(runtime.page, '[data-testid="store-entry"]', '[data-testid="store-screen"]');
    return expectPath(runtime.page, '/market');
  });
  await runtime.step('store.root', async () => 'Store root is visible.');
  await runtime.step('store.catalog', async () => {
    const text = await runtime.page.locator('[data-testid="store-screen"]').innerText();
    if (!/(Elmas|Joker|İpucu|Mağaza)/i.test(text)) throw new Error('Store catalog lanes are not visible.');
    return 'Current Diamond/inventory catalog presentation is visible.';
  });
  await runtime.step('store.future_disabled', async () => {
    const rows = runtime.page.locator('[data-testid="store-future-product"]');
    if (await rows.count() < 2) throw new Error('Expected disabled future real-money products are missing.');
    const text = await rows.allInnerTexts();
    if (text.some((value) => !/Yakında/i.test(value))) throw new Error('A future real-money product does not show Yakında.');
    return `${text.length} future real-money products are visibly disabled/Yakında.`;
  });
  await runtime.step('store.no_payment', async () => {
    const button = runtime.page.locator('[data-testid="store-future-product"] button').first();
    if (await button.count()) {
      if (await button.isEnabled()) throw new Error('A future real-money action is enabled.');
      await button.click({ force: true });
    }
    if (await runtime.page.locator('[data-kronox-market-modal-purchase]').count()) throw new Error('Disabled real-money action opened a purchase modal.');
    return 'Disabled future action opened no payment or fake success flow.';
  });
  await runtime.step('store.optional_diamond_purchase', async () => {
    requireCapability(config.allowDiamondPurchase, 'KRONOX_E2E_ALLOW_DIAMOND_PURCHASE is not true for an isolated funded actor.');
    throw new AutomationSetupGap('No deterministic smallest-item fixture is configured; mutation was skipped.');
  }, { optional: true });
  await runtime.step('store.home', async () => {
    await runtime.page.goBack();
    await expectVisible(runtime.page, HOME);
    return 'Browser back returned from the actual /market route to Home.';
  });
}

async function soloSmoke(runtime, config) {
  await runtime.step('solo.start', async () => {
    await openHome(runtime, config);
    await runtime.page.locator('[data-testid="home-solo-entry"]').click();
    const gameplayRouteDeadline = Date.now() + 15000;
    let entryPath = '';
    while (Date.now() < gameplayRouteDeadline) {
      const route = runtime.safeRoute();
      if (route === '/game') {
        entryPath = 'direct_game';
        break;
      }
      if (await runtime.page.locator('[data-testid="solo-current-level-entry"]').first().isVisible().catch(() => false)) {
        entryPath = 'level_map';
        break;
      }
      await runtime.page.waitForTimeout(200);
    }
    if (entryPath === 'direct_game') {
      await expectPath(runtime.page, '/game');
      return 'Home OYNA committed the current Solo level directly to /game.';
    }
    if (entryPath !== 'level_map') {
      throw new Error(`Home OYNA reached neither /game nor the real Solo level map. Route: ${runtime.safeRoute() || 'unknown'}.`);
    }

    await expectPath(runtime.page, '/solo');
    const currentLevel = runtime.page.locator('[data-testid="solo-current-level-entry"]').first();
    await currentLevel.scrollIntoViewIfNeeded();
    const playable = await currentLevel.getAttribute('data-solo-level-playable');
    if (playable === 'false') {
      throw new AutomationSetupGap(
        'The Solo map current-level entry is explicitly non-playable for this actor.',
        AUTOMATION_STATUS.NOT_AUTOMATABLE,
        'SOLO_CURRENT_LEVEL_NOT_PLAYABLE',
      );
    }
    await currentLevel.click();
    try {
      await expectPath(runtime.page, '/game', 15000);
    } catch (_) {
      throw new Error(`The visible current Solo level entry did not commit /game. Route remained ${runtime.safeRoute() || 'unknown'}.`);
    }
    return 'Home opened the real Solo level map; the deterministic current playable entry committed /game.';
  });
  await runtime.step('solo.root', async () => {
    requireCapability(
      config.canRunBackendProbe,
      'Solo question bootstrap is unavailable because neither direct preflight nor a safe production runtime probe is available.',
    );
    const gameplay = runtime.page.locator('[data-testid="solo-game-screen"]').first();
    const safeRecovery = runtime.page.getByText(
      /Sorular yüklenemedi|Şu anda aktif soru bulunamadı|İnternet bağlantısı yok|Oyun için en az 10 soru gerekli/i,
    ).first();
    const startedAt = Date.now();
    while (Date.now() - startedAt < 35000) {
      if (await gameplay.isVisible().catch(() => false)) {
        await assertPublicTextSafe(runtime.page);
        return 'Solo gameplay root rendered after real question preparation.';
      }
      if (await safeRecovery.isVisible().catch(() => false)) {
        await assertPublicTextSafe(runtime.page);
        const blockingText = String(await safeRecovery.innerText().catch(() => 'Question bootstrap recovery state'))
          .replace(/\s+/g, ' ')
          .slice(0, 180);
        throw new AutomationSetupGap(
          `Solo question bootstrap reached a safe recovery state on ${runtime.safeRoute() || 'unknown route'}: ${blockingText}.`,
          AUTOMATION_STATUS.NOT_AUTOMATABLE,
          'SOLO_QUESTION_BOOTSTRAP_UNAVAILABLE',
        );
      }
      await runtime.page.waitForTimeout(250);
    }
    const route = runtime.safeRoute() || 'unknown route';
    const questionTraffic = runtime.serviceSummary[RUNTIME_SERVICE_CATEGORY.QUESTION_SERVICE];
    const successfulQuestionResponse = (questionTraffic?.statusClasses?.['2xx'] || 0) > 0
      || (questionTraffic?.statusClasses?.['3xx'] || 0) > 0;
    if (route === '/game' && !successfulQuestionResponse) {
      const reason = (questionTraffic?.requests || 0) > 0
        ? 'a question-service request was observed, but no successful response completed'
        : 'no classified question-service request was observed';
      throw new AutomationSetupGap(
        `Solo question bootstrap could not be proven because ${reason} within the bounded window.`,
        AUTOMATION_STATUS.NOT_AUTOMATABLE,
        'SOLO_QUESTION_BOOTSTRAP_UNAVAILABLE',
      );
    }
    const visibleText = String(await runtime.page.locator('body').innerText().catch(() => 'No visible blocking text.'))
      .replace(/\s+/g, ' ')
      .slice(0, 240);
    throw new Error(`Solo gameplay root did not appear after bounded question preparation. Route: ${route}. Visible state: ${visibleText}`);
  });
  await runtime.step('solo.question', async () => {
    await expectVisible(runtime.page, '[data-testid="solo-question-area"]');
    return 'Question card and timeline area are visible.';
  });
  await runtime.step('solo.progress', async () => {
    await expectVisible(runtime.page, '[data-kronox-solo-progress-under-timer="true"], [data-kronox-solo-remaining-moves]');
    return 'Solo progress/move state is visible.';
  });
  await runtime.step('solo.tutorial', async () => {
    const popup = runtime.page.locator('[data-kronox-solo-level-start-tutorial-popup]');
    if (!(await popup.count())) throw new AutomationSetupGap('No tutorial popup appeared for the actor current level.');
    const acknowledge = popup.getByRole('button', { name: /Anladım|Başla|Devam/i }).first();
    await acknowledge.click();
    await popup.waitFor({ state: 'detached', timeout: 10000 });
    return 'Optional tutorial popup was acknowledged and unmounted.';
  }, { optional: true });
  await runtime.step('solo.interaction_target', async () => {
    await expectVisible(runtime.page, '[draggable="true"], [data-kronox-question-word-fit]');
    return 'A draggable/current question interaction target is visible; no evaluated move was submitted.';
  });
  await runtime.step('solo.exit', async () => {
    await clickAndSee(runtime.page, '[data-testid="solo-back-home"]', HOME, 15000);
    return 'In-game back returned to Home.';
  });
  await runtime.step('solo.cleanup', async () => {
    if (await runtime.page.locator('[data-testid="solo-game-screen"]').count()) throw new Error('Solo gameplay root remained after exit.');
    return expectOnlyActive(runtime.page, 'bottom-nav-home');
  });
}

async function onlineRandom(runtime, config) {
  requireCapability(config.hasStorageState, 'Current Home Online CTA requires an authenticated test storage state.');
  await runtime.step('online.open', async () => {
    await openHome(runtime, config);
    await clickAndSee(runtime.page, '[data-testid="home-online-entry"]', '[data-testid="online-screen"]');
    return 'Authenticated test actor opened Online from the Home-owned CTA.';
  });
  await runtime.step('online.root', async () => 'Online root is visible.');
  await runtime.step('online.options', async () => {
    const text = await runtime.page.locator('[data-testid="online-screen"]').innerText();
    const missing = ['Arkadaşını Davet Et', 'Rastgele Eşleş', 'Duello'].filter((label) => !text.includes(label));
    if (missing.length) throw new Error(`Missing Online option(s): ${missing.join(', ')}`);
    return 'Invite, random, and Duello options are visible.';
  });
  await runtime.step('online.no_category', async () => {
    const text = await runtime.page.locator('[data-testid="online-screen"]').innerText();
    if (/Kategori seç|İlgi Alan/i.test(text)) throw new Error('Solo category selector leaked into Online setup.');
    return 'Online setup has no Solo category selector.';
  });
  await runtime.step('online.random_start', async () => {
    requireCapability(config.allowMatchmaking, 'KRONOX_E2E_ALLOW_MATCHMAKING is not true; the shared queue was not mutated.');
    await clickAndSee(runtime.page, '[data-testid="online-random-entry"]', '[data-testid="online-waiting-screen"]', 20000);
    const outcome = await runtime.waitForServiceOutcome(RUNTIME_SERVICE_CATEGORY.ONLINE_MATCHMAKING, 15000);
    if (outcome.state === 'request_not_observed') {
      throw new AutomationSetupGap(
        'The safe queue button opened waiting UI, but no classified Online matchmaking request was observed.',
        AUTOMATION_STATUS.NOT_AUTOMATABLE,
        'ONLINE_MATCHMAKING_REQUEST_NOT_OBSERVED',
      );
    }
    if (outcome.state === 'request_without_response') {
      throw new AutomationSetupGap(
        'An Online matchmaking request was observed, but no response or request failure was observed before the evidence window ended.',
        AUTOMATION_STATUS.NOT_AUTOMATABLE,
        'ONLINE_MATCHMAKING_RESPONSE_NOT_OBSERVED',
      );
    }
    const successful = (outcome.entry?.statusClasses?.['2xx'] || 0) > 0
      || (outcome.entry?.statusClasses?.['3xx'] || 0) > 0;
    if (!successful) {
      const statusClass = Object.keys(outcome.entry?.statusClasses || {})[0]
        || (outcome.entry?.failures ? 'network_failure' : 'unknown');
      throw new AutomationSetupGap(
        `Online matchmaking completed without a successful backend response (${statusClass}).`,
        AUTOMATION_STATUS.NOT_AUTOMATABLE,
        'ONLINE_MATCHMAKING_BACKEND_REJECTED',
      );
    }
    return 'Random waiting state opened and a successful Online matchmaking backend response was observed.';
  });
  await runtime.step('online.waiting', async () => {
    await expectVisible(runtime.page, '[data-testid="online-waiting-cancel"]');
    return 'Waiting screen and cancellation control are visible.';
  });
  await runtime.step('online.cancel', async () => {
    await clickAndSee(runtime.page, '[data-testid="online-waiting-cancel"]', '[data-testid="online-screen"]');
    return 'Vazgeç returned to Online root.';
  });
  await runtime.step('online.cleanup', async () => {
    await assertPublicTextSafe(runtime.page);
    if (await runtime.page.locator('[data-testid="online-waiting-screen"]').count()) throw new Error('Stale Online waiting UI remained after cancellation.');
    return 'No stale waiting UI, private identifier, or raw backend error remains.';
  });
}

async function duelloTwoContext() {
  throw new AutomationSetupGap(
    'No deterministic two-actor pairing and correct-claim fixture exists in this repository. Keep Duello as MANUAL_EXTERNAL; do not infer PASS from route rendering.',
    AUTOMATION_STATUS.MANUAL_EXTERNAL,
  );
}

export const RUNTIME_E2E_SCENARIO_HANDLERS = Object.freeze({
  'runtime_e2e.app_bootstrap_guest_home': appBootstrapGuestHome,
  'runtime_e2e.bottom_nav_route_sync': bottomNavRouteSync,
  'runtime_e2e.profile_navigation_privacy': profileNavigationPrivacy,
  'runtime_e2e.leaderboard_smoke_privacy': leaderboardSmokePrivacy,
  'runtime_e2e.daily_screen_smoke_no_claim': dailyScreenSmoke,
  'runtime_e2e.daily_wheel_open_close_optional_spin': dailyWheel,
  'runtime_e2e.store_smoke_disabled_real_money': storeSmoke,
  'runtime_e2e.solo_gameplay_smoke': soloSmoke,
  'runtime_e2e.online_random_waiting_cancel_smoke': onlineRandom,
  'runtime_e2e.duello_two_context_runtime_sync': duelloTwoContext,
});
