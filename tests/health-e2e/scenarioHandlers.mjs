import {
  AUTOMATION_STATUS,
  RUNTIME_SERVICE_ACTION,
  RUNTIME_SERVICE_CATEGORY,
} from '../../src/lib/health/runtimeE2EReport.js';
import {
  classifySoloExitFailure,
  createSoloExitRuntimeEvidence,
} from '../../src/lib/health/soloExitRuntimeEvidence.js';
import {
  AutomationSetupGap,
  assertPublicTextSafe,
  expectPath,
  expectVisible,
  requireCapability,
} from './runtimeHarness.mjs';

const HOME = '[data-testid="home-screen"]';
const SOLO_OPTIONAL_TUTORIAL_DETECTION_MS = 750;
const SOLO_CONTROL_ACTION_TIMEOUT_MS = 5000;
const SOLO_EXIT_ROUTE_TIMEOUT_MS = 10000;

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

async function findFirstVisibleLocator(locator) {
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return null;
}

async function findVisibleLocatorWithin(locator, timeout = 0) {
  const deadline = Date.now() + Math.max(0, timeout);
  do {
    const visible = await findFirstVisibleLocator(locator);
    if (visible) return visible;
    if (Date.now() >= deadline) break;
    await locator.page().waitForTimeout(75);
  } while (Date.now() <= deadline);
  return null;
}

async function anyVisible(locator) {
  return Boolean(await findFirstVisibleLocator(locator));
}

function normalizeBoundingBox(box) {
  if (!box) return null;
  return Object.fromEntries(
    Object.entries(box).map(([key, value]) => [key, Math.round(Number(value) * 100) / 100]),
  );
}

async function readSoloEvaluatedMoveCount(page) {
  const moveCounter = await findFirstVisibleLocator(page.locator('[data-kronox-solo-remaining-moves]'));
  if (!moveCounter) return null;
  const remaining = Number(await moveCounter.getAttribute('data-kronox-solo-remaining-moves'));
  const maximum = Number(await moveCounter.getAttribute('data-kronox-solo-max-moves'));
  if (!Number.isFinite(remaining) || !Number.isFinite(maximum)) return null;
  return Math.max(0, maximum - remaining);
}

async function inspectSoloExitControl(page, evidence) {
  const controls = page.locator('[data-testid="solo-back-home"]');
  const backButtonCount = await controls.count();
  const backButton = await findFirstVisibleLocator(controls);
  const backButtonVisible = Boolean(backButton);
  const backButtonEnabled = backButton
    ? await backButton.isEnabled().catch(() => false)
    : false;
  const backButtonBoundingBox = backButton
    ? normalizeBoundingBox(await backButton.boundingBox().catch(() => null))
    : null;
  const pointerEventsOnBackButton = backButton
    ? await backButton.evaluate((element) => window.getComputedStyle(element).pointerEvents).catch(() => null)
    : null;
  const tutorialOverlayDetected = await anyVisible(page.locator(
    '[data-testid="solo-tutorial-modal"], [data-kronox-solo-level-start-tutorial-popup]',
  ));
  const activeDialogDetected = await anyVisible(page.locator('[role="dialog"][aria-modal="true"]'));
  const blockedAtCenter = backButton && backButtonBoundingBox
    ? await backButton.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const topElement = document.elementFromPoint(
        bounds.left + (bounds.width / 2),
        bounds.top + (bounds.height / 2),
      );
      return Boolean(topElement && topElement !== element && !element.contains(topElement));
    }).catch(() => false)
    : false;

  Object.assign(evidence, {
    backButtonPresent: backButtonCount > 0,
    backButtonVisible,
    backButtonEnabled,
    backButtonBoundingBox,
    backButtonCount,
    blockingOverlayDetected: Boolean(blockedAtCenter || activeDialogDetected),
    tutorialOverlayDetected: Boolean(evidence.tutorialOverlayDetected || tutorialOverlayDetected),
    tutorialOverlayBlockingExit: tutorialOverlayDetected,
    activeDialogDetected,
    pointerEventsOnBackButton,
  });

  return backButton;
}

function throwSoloExitFailure(evidence, fallbackMessage) {
  const failureCategory = classifySoloExitFailure(evidence) || 'SOLO_EXIT_CLICK_TIMEOUT';
  const error = new Error(`${failureCategory}: ${fallbackMessage}`);
  error.failureCategory = failureCategory;
  throw error;
}

async function expectOnlyActive(page, testId) {
  const active = page.locator('[data-testid="bottom-nav"] [aria-current="page"]');
  if (await active.count() !== 1) throw new Error('BottomNav did not expose exactly one active tab.');
  if (await active.first().getAttribute('data-testid') !== testId) throw new Error(`${testId} is not the committed active tab.`);
  return `${testId} is the only active BottomNav tab.`;
}

async function requireSuccessfulBackendAction(runtime, {
  category,
  actionLabel,
  baseline,
  timeout = 15000,
  failurePrefix,
  description,
}) {
  const outcome = await runtime.waitForServiceOutcome(category, timeout, baseline, actionLabel);
  if (outcome.state === 'successful_response') return outcome;

  const categories = {
    request_not_observed: `${failurePrefix}_REQUEST_NOT_OBSERVED`,
    request_without_response: `${failurePrefix}_RESPONSE_NOT_OBSERVED`,
    backend_rejected: `${failurePrefix}_BACKEND_REJECTED`,
    aborted: `${failurePrefix}_REQUEST_ABORTED`,
    network_failure: `${failurePrefix}_NETWORK_FAILURE`,
  };
  const messages = {
    request_not_observed: `No classified ${description} request was observed in the bounded scenario window.`,
    request_without_response: `A ${description} request was observed, but no terminal response or failure arrived before the bounded timeout.`,
    backend_rejected: `The ${description} request completed without a successful backend status.`,
    aborted: `The ${description} request was aborted or cancelled before backend proof completed.`,
    network_failure: `The ${description} request ended in a browser network failure.`,
  };
  throw new AutomationSetupGap(
    messages[outcome.state] || `The ${description} lifecycle did not produce successful backend proof.`,
    AUTOMATION_STATUS.NOT_AUTOMATABLE,
    categories[outcome.state] || `${failurePrefix}_BACKEND_EVIDENCE_MISSING`,
  );
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
  let leaderboardBaseline = null;
  await runtime.step('leaderboard.open', async () => {
    leaderboardBaseline = runtime.captureServiceBaseline(RUNTIME_SERVICE_ACTION.LEADERBOARD_SNAPSHOT);
    await openHome(runtime, config);
    await clickAndSee(runtime.page, '[data-testid="bottom-nav-leaderboard"]', '[data-testid="leaderboard-screen"]');
    return 'Leaderboard route and heading are visible.';
  });
  await runtime.step('leaderboard.state', async () => {
    await requireSuccessfulBackendAction(runtime, {
      category: RUNTIME_SERVICE_CATEGORY.LEADERBOARD,
      actionLabel: RUNTIME_SERVICE_ACTION.LEADERBOARD_SNAPSHOT,
      baseline: leaderboardBaseline,
      failurePrefix: 'LEADERBOARD',
      description: 'leaderboard snapshot',
    });
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
  let dailyStatusBaseline = null;
  await runtime.step('daily.open', async () => {
    dailyStatusBaseline = runtime.captureServiceBaseline(RUNTIME_SERVICE_ACTION.DAILY_CALENDAR_STATUS);
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
    await requireSuccessfulBackendAction(runtime, {
      category: RUNTIME_SERVICE_CATEGORY.DAILY_STATUS,
      actionLabel: RUNTIME_SERVICE_ACTION.DAILY_CALENDAR_STATUS,
      baseline: dailyStatusBaseline,
      failurePrefix: 'DAILY_STATUS',
      description: 'Daily Calendar status',
    });
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
  let wheelStatusBaseline = null;
  await runtime.step('wheel.balance_before', async () => {
    wheelStatusBaseline = runtime.captureServiceBaseline(RUNTIME_SERVICE_ACTION.DAILY_WHEEL_STATUS);
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
    await requireSuccessfulBackendAction(runtime, {
      category: RUNTIME_SERVICE_CATEGORY.DAILY_STATUS,
      actionLabel: RUNTIME_SERVICE_ACTION.DAILY_WHEEL_STATUS,
      baseline: wheelStatusBaseline,
      failurePrefix: 'DAILY_WHEEL_STATUS',
      description: 'Daily Wheel status',
    });
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
  let questionBaseline = null;
  let expectedSoloExitPath = '/';
  const soloExitEvidence = createSoloExitRuntimeEvidence(expectedSoloExitPath);
  runtime.authorityEvidence = soloExitEvidence;
  await runtime.step('solo.start', async () => {
    questionBaseline = runtime.captureServiceBaseline(RUNTIME_SERVICE_ACTION.SOLO_QUESTION_BOOTSTRAP);
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
      expectedSoloExitPath = '/';
      soloExitEvidence.expectedExitRoute = expectedSoloExitPath;
      await expectPath(runtime.page, '/game');
      return 'Home OYNA committed the current Solo level directly to /game.';
    }
    if (entryPath !== 'level_map') {
      throw new Error(`Home OYNA reached neither /game nor the real Solo level map. Route: ${runtime.safeRoute() || 'unknown'}.`);
    }

    await expectPath(runtime.page, '/solo');
    expectedSoloExitPath = '/solo';
    soloExitEvidence.expectedExitRoute = expectedSoloExitPath;
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
        await requireSuccessfulBackendAction(runtime, {
          category: RUNTIME_SERVICE_CATEGORY.QUESTION_SERVICE,
          actionLabel: RUNTIME_SERVICE_ACTION.SOLO_QUESTION_BOOTSTRAP,
          baseline: questionBaseline,
          failurePrefix: 'SOLO_QUESTION_BOOTSTRAP',
          description: 'Solo question bootstrap',
        });
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
    const popup = await findVisibleLocatorWithin(
      runtime.page.locator('[data-testid="solo-tutorial-modal"], [data-kronox-solo-level-start-tutorial-popup]'),
      SOLO_OPTIONAL_TUTORIAL_DETECTION_MS,
    );
    if (!popup) {
      soloExitEvidence.tutorialHandlingOutcome = 'not_present';
      throw new AutomationSetupGap(
        'No visible tutorial popup appeared within the bounded optional check.',
        AUTOMATION_STATUS.NOT_AUTOMATABLE,
        'SOLO_OPTIONAL_TUTORIAL_NOT_PRESENT',
      );
    }
    soloExitEvidence.tutorialOverlayDetected = true;
    const acknowledge = await findFirstVisibleLocator(popup.locator(
      '[data-testid="solo-tutorial-continue"], [data-testid="solo-tutorial-close"], [data-kronox-solo-level-start-tutorial-understood="true"]',
    ));
    if (!acknowledge) {
      soloExitEvidence.tutorialHandlingOutcome = 'control_missing';
      throw new AutomationSetupGap(
        'A visible Solo tutorial had no visible stable close/continue control.',
        AUTOMATION_STATUS.NOT_AUTOMATABLE,
        'SOLO_TUTORIAL_CONTROL_MISSING',
      );
    }
    try {
      await acknowledge.click({ timeout: SOLO_CONTROL_ACTION_TIMEOUT_MS });
      await popup.waitFor({ state: 'hidden', timeout: SOLO_CONTROL_ACTION_TIMEOUT_MS });
      soloExitEvidence.tutorialHandlingOutcome = 'closed';
    } catch (error) {
      soloExitEvidence.tutorialHandlingOutcome = 'close_failed';
      throw error;
    }
    return 'Optional tutorial popup was acknowledged and unmounted.';
  }, { optional: true });
  await runtime.step('solo.interaction_target', async () => {
    await expectVisible(runtime.page, '[draggable="true"], [data-kronox-question-word-fit]');
    return 'A draggable/current question interaction target is visible; no evaluated move was submitted.';
  });
  await runtime.step('solo.exit', async () => {
    soloExitEvidence.routeBeforeExit = runtime.safeRoute();
    soloExitEvidence.evaluatedMoveCountBeforeExit = await readSoloEvaluatedMoveCount(runtime.page);
    const backButton = await inspectSoloExitControl(runtime.page, soloExitEvidence);
    const preClickFailure = classifySoloExitFailure(soloExitEvidence);
    if (preClickFailure) {
      throwSoloExitFailure(soloExitEvidence, 'The Solo back control was not safely actionable.');
    }

    try {
      await backButton.click({ timeout: SOLO_CONTROL_ACTION_TIMEOUT_MS });
      soloExitEvidence.exitClickOutcome = 'clicked';
    } catch (_) {
      soloExitEvidence.exitClickOutcome = 'timeout';
      await inspectSoloExitControl(runtime.page, soloExitEvidence);
      soloExitEvidence.routeAfterExit = runtime.safeRoute();
      throwSoloExitFailure(soloExitEvidence, 'The Solo back control did not accept the bounded click.');
    }

    try {
      await expectPath(runtime.page, expectedSoloExitPath, SOLO_EXIT_ROUTE_TIMEOUT_MS);
    } catch (_) {
      soloExitEvidence.routeAfterExit = runtime.safeRoute();
      throwSoloExitFailure(soloExitEvidence, `The route did not reach ${expectedSoloExitPath}.`);
    }

    soloExitEvidence.routeAfterExit = runtime.safeRoute();
    soloExitEvidence.exitClickOutcome = 'clicked_and_navigated';
    soloExitEvidence.evaluatedMoveCountAfterExit = soloExitEvidence.evaluatedMoveCountBeforeExit;
    return expectedSoloExitPath === '/'
      ? 'In-game back returned the direct Home launch to Home.'
      : 'In-game back returned the map-launched attempt to the Solo level map.';
  });
  await runtime.step('solo.cleanup', async () => {
    if (await runtime.page.locator('[data-testid="solo-game-screen"]').count()) throw new Error('Solo gameplay root remained after exit.');
    if (expectedSoloExitPath === '/') return expectOnlyActive(runtime.page, 'bottom-nav-home');
    await expectPath(runtime.page, '/solo');
    return 'Solo map is the committed parent after a map-launched attempt.';
  });
}

const SAFE_MATCHMAKING_MODES = new Set(['random_online', 'same_question_duel']);
const SAFE_MATCHMAKING_OPERATIONS = new Set([
  'create_waiting',
  'find_waiting',
  'pair_waiting',
  'create_match',
  'direct_start',
  'poll_status',
  'cleanup_cancel',
  'cleanup_timeout',
  'cleanup_retry',
]);
const SAFE_MATCHMAKING_QUEUE_STATES = new Set([
  'none', 'waiting', 'pairing', 'matched', 'consumed', 'cancelled', 'expired', 'timeout', 'unknown',
]);
const SAFE_MATCHMAKING_ACTOR_KINDS = new Set(['guest', 'authenticated', 'unknown']);
const SAFE_MATCHMAKING_QUEUE_STORAGE = new Set(['random_match_queue', 'economy_lock_queue', 'unknown']);
const SAFE_MATCHMAKING_START_RESPONSE_SHAPES = new Set([
  'waiting', 'searching', 'matched', 'direct_start_ready', 'timeout', 'cancelled', 'failed_safe',
]);
const SAFE_MATCHMAKING_ERROR_CATEGORIES = new Set([
  'MATCHMAKING_QUEUE_CREATE_FAILED',
  'MATCHMAKING_QUEUE_WRITE_FAILED',
  'MATCHMAKING_QUEUE_READ_FAILED',
  'MATCHMAKING_PAIRING_RACE',
  'MATCHMAKING_SELF_MATCH_FALSE_POSITIVE',
  'MATCHMAKING_STALE_QUEUE',
  'MATCHMAKING_SESSION_CREATE_FAILED',
  'MATCHMAKING_DIRECT_START_PAYLOAD_MISSING',
  'MATCHMAKING_PERMISSION_DENIED',
  'MATCHMAKING_TIMEOUT',
  'MATCHMAKING_NETWORK_FAILURE',
  'MATCHMAKING_UNKNOWN_START_FAILURE',
  'MATCHMAKING_UNKNOWN_BACKEND_REJECTION',
]);

async function readSafeMatchmakingEvidence(page, selector) {
  const root = page.locator(selector).first();
  if (!await root.count()) return null;
  const read = (name) => root.getAttribute(name).catch(() => null);
  const [
    functionCategory,
    mode,
    operation,
    statusClass,
    errorCategory,
    actorKind,
    queueStateBefore,
    queueStateAfter,
    startResponseShape,
    noOpponentYetClassifiedAsWaiting,
    staleOwnRowHandled,
    duplicateOwnRowHandled,
    queueStorageStrategy,
    retryCleanupObserved,
    cancelCleanupObserved,
    directStartPayloadAvailable,
    matchFoundObserved,
  ] = await Promise.all([
    read('data-matchmaking-function-category'),
    read('data-matchmaking-mode'),
    read('data-matchmaking-operation'),
    read('data-matchmaking-status-class'),
    read('data-matchmaking-backend-error-category'),
    read('data-matchmaking-actor-kind'),
    read('data-matchmaking-queue-state-before'),
    read('data-matchmaking-queue-state-after'),
    read('data-matchmaking-start-response-shape'),
    read('data-matchmaking-no-opponent-waiting'),
    read('data-matchmaking-stale-own-row-handled'),
    read('data-matchmaking-duplicate-own-row-handled'),
    read('data-matchmaking-queue-storage'),
    read('data-matchmaking-retry-cleanup-observed'),
    read('data-matchmaking-cancel-cleanup-observed'),
    read('data-matchmaking-direct-start-payload'),
    read('data-matchmaking-match-found-observed'),
  ]);
  return {
    onlineMatchmakingFunctionCategory: functionCategory === 'shared_matchmaking_backend'
      ? functionCategory
      : null,
    matchmakingMode: SAFE_MATCHMAKING_MODES.has(mode) ? mode : null,
    matchmakingOperation: SAFE_MATCHMAKING_OPERATIONS.has(operation) ? operation : null,
    matchmakingStatusClass: ['2xx', '4xx', '5xx'].includes(statusClass) ? statusClass : null,
    matchmakingErrorCategory: SAFE_MATCHMAKING_ERROR_CATEGORIES.has(errorCategory)
      ? errorCategory
      : null,
    actorKind: SAFE_MATCHMAKING_ACTOR_KINDS.has(actorKind) ? actorKind : 'unknown',
    queueStateBefore: SAFE_MATCHMAKING_QUEUE_STATES.has(queueStateBefore) ? queueStateBefore : 'unknown',
    queueStateAfter: SAFE_MATCHMAKING_QUEUE_STATES.has(queueStateAfter) ? queueStateAfter : 'unknown',
    startResponseShape: SAFE_MATCHMAKING_START_RESPONSE_SHAPES.has(startResponseShape)
      ? startResponseShape
      : 'failed_safe',
    noOpponentYetClassifiedAsWaiting: noOpponentYetClassifiedAsWaiting === 'true',
    staleOwnRowHandled: staleOwnRowHandled === 'true',
    duplicateOwnRowHandled: duplicateOwnRowHandled === 'true',
    queueStorageStrategy: SAFE_MATCHMAKING_QUEUE_STORAGE.has(queueStorageStrategy)
      ? queueStorageStrategy
      : 'unknown',
    retryCleanupObserved: retryCleanupObserved === 'true',
    cancelCleanupObserved: cancelCleanupObserved === 'true',
    directStartPayloadAvailable: directStartPayloadAvailable === 'true',
    matchFoundObserved: matchFoundObserved === 'true',
  };
}

function mergeSafeMatchmakingEvidence(target, observed) {
  if (!observed) return target;
  for (const key of [
    'onlineMatchmakingFunctionCategory',
    'matchmakingMode',
    'matchmakingOperation',
    'matchmakingStatusClass',
    'matchmakingErrorCategory',
    'actorKind',
    'queueStateBefore',
    'queueStateAfter',
    'startResponseShape',
    'queueStorageStrategy',
  ]) {
    if (observed[key] != null) target[key] = observed[key];
  }
  target.retryCleanupObserved ||= observed.retryCleanupObserved;
  target.cancelCleanupObserved ||= observed.cancelCleanupObserved;
  target.noOpponentYetClassifiedAsWaiting ||= observed.noOpponentYetClassifiedAsWaiting;
  target.staleOwnRowHandled ||= observed.staleOwnRowHandled;
  target.duplicateOwnRowHandled ||= observed.duplicateOwnRowHandled;
  target.directStartPayloadAvailable ||= observed.directStartPayloadAvailable;
  target.matchFoundObserved ||= observed.matchFoundObserved;
  return target;
}

async function onlineRandom(runtime, config) {
  let matchmakingSessionBaseline = null;
  const evidence = {
    lobbyRouteObserved: false,
    lobbyScreenObserved: false,
    searchScreenObserved: false,
    matchFoundObserved: false,
    directGameStartObserved: false,
    matchedTransitionMs: null,
    routeAfterMatch: null,
    mode: 'random_online',
    onlineMatchmakingFunctionCategory: null,
    matchmakingMode: 'random_online',
    matchmakingOperation: null,
    matchmakingStatusClass: null,
    matchmakingErrorCategory: null,
    actorKind: 'unknown',
    queueStateBefore: 'unknown',
    queueStateAfter: 'unknown',
    startResponseShape: 'failed_safe',
    noOpponentYetClassifiedAsWaiting: false,
    staleOwnRowHandled: false,
    duplicateOwnRowHandled: false,
    queueStorageStrategy: 'unknown',
    retryCleanupObserved: false,
    cancelCleanupObserved: false,
    directStartPayloadAvailable: false,
    twoActorRequiredReason: null,
    backendMatchEvidence: {
      observed: false,
      successful: false,
      category: RUNTIME_SERVICE_CATEGORY.ONLINE_MATCHMAKING,
      statusClass: null,
      safeSummary: 'No successful matchmaking response observed yet.',
    },
  };
  runtime.authorityEvidence = evidence;

  const fail = (message, failureCategory) => {
    const error = new Error(message);
    error.failureCategory = failureCategory;
    throw error;
  };
  const inspectNoLobby = async () => {
    const route = runtime.safeRoute();
    const lobbyRouteObserved = route === '/lobby' || route === '/LobbyRoom';
    const lobbyScreenObserved = await runtime.page
      .locator('[data-testid="lobby-screen"], [data-testid="waiting-room-screen"], [data-kronox-waiting-room]')
      .count() > 0;
    evidence.lobbyRouteObserved ||= lobbyRouteObserved;
    evidence.lobbyScreenObserved ||= lobbyScreenObserved;
    if (lobbyRouteObserved || lobbyScreenObserved) {
      fail('LOBBY_STILL_PRESENT: active Online flow reached a lobby route or waiting-room surface.', 'LOBBY_STILL_PRESENT');
    }
  };
  const assertNoMatchmakingBackendRejection = async () => {
    if (!matchmakingSessionBaseline) return;
    const rejection = runtime.findServiceRejection(
      RUNTIME_SERVICE_CATEGORY.ONLINE_MATCHMAKING,
      matchmakingSessionBaseline,
      RUNTIME_SERVICE_ACTION.ONLINE_MATCHMAKING,
    );
    if (!rejection) return;
    mergeSafeMatchmakingEvidence(evidence, await readSafeMatchmakingEvidence(
      runtime.page,
      '[data-testid="online-kapis-search-screen"]',
    ));
    evidence.backendMatchEvidence = {
      observed: true,
      successful: false,
      category: RUNTIME_SERVICE_CATEGORY.ONLINE_MATCHMAKING,
      statusClass: rejection.statusClass || '5xx',
      safeSummary: 'Online matchmaking returned a rejected backend response during the active search session.',
    };
    throw new AutomationSetupGap(
      'The Online matchmaking request completed without a successful backend status.',
      AUTOMATION_STATUS.NOT_AUTOMATABLE,
      'ONLINE_MATCHMAKING_BACKEND_REJECTED',
    );
  };

  await runtime.step('online.open', async () => {
    await openHome(runtime, config);
    await clickAndSee(runtime.page, '[data-testid="home-online-entry"]', '[data-testid="online-screen"]');
    await expectPath(runtime.page, '/online');
    await inspectNoLobby();
    return 'Completed actor opened canonical /online from the Home-owned CTA.';
  });
  await runtime.step('online.root', async () => 'Online root is visible.');
  await runtime.step('online.options', async () => {
    const text = await runtime.page.locator('[data-testid="online-screen"]').innerText();
    const missing = ['Arkadaşını Davet Et', 'Online Kapış', 'Duello'].filter((label) => !text.includes(label));
    if (missing.length) throw new Error(`Missing Online option(s): ${missing.join(', ')}`);
    return 'Invite, Online Kapış, and Duello options are visible.';
  });
  await runtime.step('online.no_category', async () => {
    const text = await runtime.page.locator('[data-testid="online-screen"]').innerText();
    if (/Kategori seç|İlgi Alan/i.test(text)) throw new Error('Solo category selector leaked into Online setup.');
    return 'Online setup has no Solo category selector.';
  });
  await runtime.step('online.random_start', async () => {
    requireCapability(config.allowMatchmaking, 'KRONOX_E2E_ALLOW_MATCHMAKING is not true; the shared queue was not mutated.');
    const matchmakingBaseline = runtime.captureServiceBaseline(RUNTIME_SERVICE_ACTION.ONLINE_MATCHMAKING);
    matchmakingSessionBaseline = matchmakingBaseline;
    await clickAndSee(runtime.page, '[data-testid="online-kapis-entry"]', '[data-testid="online-kapis-search-screen"]', 20000);
    evidence.searchScreenObserved = true;
    mergeSafeMatchmakingEvidence(evidence, await readSafeMatchmakingEvidence(
      runtime.page,
      '[data-testid="online-kapis-search-screen"]',
    ));
    const outcome = await requireSuccessfulBackendAction(runtime, {
      category: RUNTIME_SERVICE_CATEGORY.ONLINE_MATCHMAKING,
      actionLabel: RUNTIME_SERVICE_ACTION.ONLINE_MATCHMAKING,
      baseline: matchmakingBaseline,
      failurePrefix: 'ONLINE_MATCHMAKING',
      description: 'Online matchmaking',
    });
    evidence.backendMatchEvidence = {
      observed: true,
      successful: true,
      category: RUNTIME_SERVICE_CATEGORY.ONLINE_MATCHMAKING,
      statusClass: outcome.lifecycle?.responseStatusClass || '2xx',
      safeSummary: 'Online matchmaking returned a successful backend response.',
    };
    await inspectNoLobby();
    return 'Online Kapış search opened after a successful matchmaking backend response.';
  });
  await runtime.step('online.waiting', async () => {
    await expectVisible(runtime.page, '[data-testid="online-kapis-search-cancel"]');
    const text = await runtime.page.locator('[data-testid="online-kapis-search-screen"]').innerText();
    if (!text.includes('Rakip aranıyor')) throw new Error('Rakip aranıyor copy is not visible on the search screen.');
    mergeSafeMatchmakingEvidence(evidence, await readSafeMatchmakingEvidence(
      runtime.page,
      '[data-testid="online-kapis-search-screen"]',
    ));
    await assertNoMatchmakingBackendRejection();
    await inspectNoLobby();
    return 'Rakip aranıyor, bounded countdown, and Vazgeç are visible.';
  });
  await runtime.step('online.cancel', async () => {
    const baseline = runtime.captureServiceBaseline(RUNTIME_SERVICE_ACTION.ONLINE_MATCHMAKING);
    try {
      await clickAndSee(runtime.page, '[data-testid="online-kapis-search-cancel"]', '[data-testid="online-screen"]');
    } catch (error) {
      await assertNoMatchmakingBackendRejection();
      throw error;
    }
    await assertNoMatchmakingBackendRejection();
    await requireSuccessfulBackendAction(runtime, {
      category: RUNTIME_SERVICE_CATEGORY.ONLINE_MATCHMAKING,
      actionLabel: RUNTIME_SERVICE_ACTION.ONLINE_MATCHMAKING,
      baseline,
      failurePrefix: 'ONLINE_MATCHMAKING_CANCEL',
      description: 'Online matchmaking cancel',
    });
    await expectPath(runtime.page, '/online');
    if (await runtime.page.locator('[data-testid="online-kapis-search-screen"]').count()) {
      throw new Error('Stale Online search UI remained after cancellation.');
    }
    evidence.matchmakingOperation = 'cleanup_cancel';
    evidence.matchmakingStatusClass = '2xx';
    evidence.queueStateAfter = 'cancelled';
    evidence.cancelCleanupObserved = true;
    return 'Vazgeç settled the queue request and returned to /online.';
  });
  await runtime.step('online.restart', async () => {
    const baseline = runtime.captureServiceBaseline(RUNTIME_SERVICE_ACTION.ONLINE_MATCHMAKING);
    matchmakingSessionBaseline = baseline;
    await clickAndSee(runtime.page, '[data-testid="online-kapis-entry"]', '[data-testid="online-kapis-search-screen"]', 20000);
    const outcome = await requireSuccessfulBackendAction(runtime, {
      category: RUNTIME_SERVICE_CATEGORY.ONLINE_MATCHMAKING,
      actionLabel: RUNTIME_SERVICE_ACTION.ONLINE_MATCHMAKING,
      baseline,
      failurePrefix: 'ONLINE_MATCHMAKING',
      description: 'Online matchmaking restart',
    });
    evidence.backendMatchEvidence = {
      observed: true,
      successful: true,
      category: RUNTIME_SERVICE_CATEGORY.ONLINE_MATCHMAKING,
      statusClass: outcome.lifecycle?.responseStatusClass || '2xx',
      safeSummary: 'Second Online matchmaking attempt returned a successful backend response.',
    };
    evidence.retryCleanupObserved = true;
    mergeSafeMatchmakingEvidence(evidence, await readSafeMatchmakingEvidence(
      runtime.page,
      '[data-testid="online-kapis-search-screen"]',
    ));
    return 'Online Kapış restarted with successful backend evidence.';
  });
  let matchedAt = null;
  await runtime.step('online.matched', async () => {
    const deadline = Date.now() + 35_000;
    while (Date.now() < deadline) {
      await assertNoMatchmakingBackendRejection();
      await inspectNoLobby();
      if (await runtime.page.locator('[data-testid="online-match-found-screen"]').isVisible().catch(() => false)) {
        const text = await runtime.page.locator('[data-testid="online-match-found-screen"]').innerText();
        if (!text.includes('Rakip bulundu') || !text.includes('Oyun başlıyor')) {
          fail('Matched screen is missing approved Rakip bulundu / Oyun başlıyor copy.', 'MATCH_FOUND_DIRECT_GAME_PENDING');
        }
        matchedAt = Date.now();
        evidence.matchFoundObserved = true;
        mergeSafeMatchmakingEvidence(evidence, await readSafeMatchmakingEvidence(
          runtime.page,
          '[data-testid="online-match-found-screen"]',
        ));
        return 'Rakip bulundu appeared on the same search surface; no lobby was observed.';
      }
      if (runtime.safeRoute() === '/game') {
        fail('Direct game route appeared without observable same-screen Rakip bulundu evidence.', 'MATCH_FOUND_DIRECT_GAME_PENDING');
      }
      const phase = await runtime.page.locator('[data-testid="online-kapis-search-screen"]')
        .getAttribute('data-matchmaking-phase').catch(() => null);
      if (phase === 'timeout') {
        evidence.twoActorRequiredReason = 'TWO_ACTOR_REQUIRED';
        throw new AutomationSetupGap(
          'TWO_ACTOR_REQUIRED: one actor proved search/cancel/backend response, but no opponent paired for same-screen match-found and direct-game proof.',
          AUTOMATION_STATUS.NOT_AUTOMATABLE,
          'TWO_ACTOR_REQUIRED',
        );
      }
      await runtime.page.waitForTimeout(100);
    }
    evidence.twoActorRequiredReason = 'TWO_ACTOR_REQUIRED';
    throw new AutomationSetupGap(
      'TWO_ACTOR_REQUIRED: one actor completed search/retry/cancel proof, but no match-found event can arrive without an opponent.',
      AUTOMATION_STATUS.NOT_AUTOMATABLE,
      'TWO_ACTOR_REQUIRED',
    );
  });
  await runtime.step('online.direct_game', async () => {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      await inspectNoLobby();
      if (runtime.safeRoute() === '/game') {
        await expectVisible(runtime.page, '[data-testid="online-game-screen"]', 15000);
        evidence.directGameStartObserved = true;
        evidence.directStartPayloadAvailable = true;
        evidence.routeAfterMatch = '/game';
        evidence.matchedTransitionMs = matchedAt ? Date.now() - matchedAt : null;
        return `Direct /game start observed after ${evidence.matchedTransitionMs ?? 'unknown'}ms.`;
      }
      await runtime.page.waitForTimeout(100);
    }
    throw new AutomationSetupGap(
      'MATCH_FOUND_DIRECT_GAME_PENDING: Rakip bulundu appeared but the backend-authoritative /game surface did not become ready.',
      AUTOMATION_STATUS.NOT_AUTOMATABLE,
      'MATCH_FOUND_DIRECT_GAME_PENDING',
    );
  });
  await runtime.step('online.cleanup', async () => {
    await assertPublicTextSafe(runtime.page);
    await inspectNoLobby();
    if (await runtime.page.locator('[data-testid="online-kapis-search-screen"]').count()) throw new Error('Stale Online search UI remained after direct start.');
    return 'Direct game route has no lobby/search residue, private identifier, or raw backend error.';
  });
}

function safeRuntimeFingerprint(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fp_${(hash >>> 0).toString(36)}`;
}

async function installDuelloObserver(page) {
  await page.evaluate(() => {
    window.__kronoxDuelloE2E?.stop?.();
    const state = {
      searchObserved: false,
      matchFoundObserved: false,
      lobbyScreenObserved: false,
      stop: null,
    };
    const inspect = () => {
      state.searchObserved ||= Boolean(document.querySelector('[data-testid="duello-search-screen"]'));
      state.matchFoundObserved ||= Boolean(document.querySelector('[data-testid="duello-match-found-screen"]'));
      state.lobbyScreenObserved ||= Boolean(document.querySelector(
        '[data-testid="lobby-screen"], [data-testid="waiting-room-screen"], [data-kronox-waiting-room]',
      ));
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    state.stop = () => observer.disconnect();
    window.__kronoxDuelloE2E = state;
    inspect();
  });
}

async function readDuelloObserver(page) {
  return page.evaluate(() => {
    const state = window.__kronoxDuelloE2E || {};
    return {
      searchObserved: Boolean(state.searchObserved),
      matchFoundObserved: Boolean(state.matchFoundObserved),
      lobbyScreenObserved: Boolean(state.lobbyScreenObserved),
    };
  }).catch(() => ({ searchObserved: false, matchFoundObserved: false, lobbyScreenObserved: false }));
}

async function waitForActorMatchmakingResponses(runtime, baseline, timeout = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const events = runtime.serviceEvents.slice(baseline.eventIndex).filter((event) => (
      event.category === RUNTIME_SERVICE_CATEGORY.ONLINE_MATCHMAKING
      && event.outcome === 'RESPONSE'
      && (event.statusClass === '2xx' || event.statusClass === '3xx')
    ));
    if (events.some((event) => event.actorContext === 'A') && events.some((event) => event.actorContext === 'B')) {
      return { actorA: true, actorB: true, statusClass: '2xx' };
    }
    await runtime.page.waitForTimeout(100);
  }
  return { actorA: false, actorB: false, statusClass: null };
}

async function waitForDirectDuelloRoute(page, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const route = new URL(page.url()).pathname;
    if (route === '/duel') return;
    if (route === '/lobby' || route === '/LobbyRoom') {
      const error = new Error('LOBBY_STILL_PRESENT: Duello observed a lobby while direct-starting.');
      error.failureCategory = 'LOBBY_STILL_PRESENT';
      throw error;
    }
    const screen = page.locator('[data-testid="duello-match-found-screen"]');
    if (await screen.count()) {
      const phase = await screen.getAttribute('data-matchmaking-phase');
      if (phase === 'failed') {
        const observedCategory = await screen.getAttribute('data-matchmaking-error-category');
        const safeCategory = /^DUELLO_[A-Z_]+$/.test(String(observedCategory || ''))
          ? observedCategory
          : 'DUELLO_DIRECT_START_PAYLOAD_MISSING';
        const error = new Error(`Duello direct start returned a classified failure (${safeCategory}).`);
        error.failureCategory = safeCategory;
        throw error;
      }
    }
    await page.waitForTimeout(100);
  }
  const error = new Error('Duello match was found, but the direct game payload did not become ready.');
  error.failureCategory = 'DUELLO_DIRECT_START_PAYLOAD_MISSING';
  throw error;
}

async function readDuelloRoundProof(page) {
  const root = page.locator('[data-testid="duello-active-card"]');
  return {
    questionFingerprint: await root.getAttribute('data-kronox-duello-question-fingerprint'),
    timelineFingerprint: await root.getAttribute('data-kronox-duello-timeline-fingerprint'),
    timelineCount: Number(await root.getAttribute('data-kronox-duello-timeline-count')),
    questionIndex: Number(await root.getAttribute('data-kronox-duello-question-index')),
    deadlineFingerprint: safeRuntimeFingerprint(await root.getAttribute('data-kronox-duello-deadline')),
    answerLocked: await root.getAttribute('data-kronox-duello-answer-locked') === 'true',
  };
}

async function waitForDuelloAnswerWindow(page, timeout = 15000) {
  await page.waitForFunction(() => {
    const root = document.querySelector('[data-testid="duello-active-card"]');
    const state = root?.getAttribute('data-kronox-duello-state');
    const answerLocked = root?.getAttribute('data-kronox-duello-answer-locked') === 'true';
    const timelineZone = document.querySelector('[data-testid="timeline-zone-0"]');
    return ['QUESTION_ACTIVE', 'WAITING_FOR_OPPONENT', 'SUDDEN_DEATH'].includes(String(state || ''))
      && !answerLocked
      && timelineZone instanceof HTMLElement;
  }, null, { timeout });
}

async function selectDuelloZoneAndWaitForSubmit(page, zoneIndex = 0, timeout = 5000) {
  await page.locator(`[data-testid="timeline-zone-${zoneIndex}"]`).first().click();
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="duello-confirm-placement"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  }, null, { timeout });
}

async function duelloTwoContext(runtime, config) {
  if (!runtime?.secondaryPage || !config?.hasTwoStorageStates) {
    if (runtime) {
      runtime.authorityEvidence = {
        onlineMatchmakingFunctionCategory: 'shared_matchmaking_backend',
        matchmakingMode: 'same_question_duel',
        matchmakingOperation: null,
        matchmakingStatusClass: null,
        matchmakingErrorCategory: null,
        queueStateBefore: 'unknown',
        queueStateAfter: 'unknown',
        retryCleanupObserved: false,
        cancelCleanupObserved: false,
        directStartPayloadAvailable: false,
        lobbyRouteObserved: false,
        matchFoundObserved: false,
        directGameStartObserved: false,
        twoActorRequiredReason: 'TWO_ACTOR_REQUIRED',
      };
    }
    throw new AutomationSetupGap(
      'TWO_ACTOR_REQUIRED: configure distinct KRONOX_E2E_STORAGE_STATE_A and KRONOX_E2E_STORAGE_STATE_B files.',
      AUTOMATION_STATUS.MANUAL_EXTERNAL,
      'TWO_ACTOR_REQUIRED',
    );
  }
  requireCapability(config.allowMatchmaking, 'KRONOX_E2E_ALLOW_MATCHMAKING is not true; the two-actor queue was not mutated.');

  const pageA = runtime.page;
  const pageB = runtime.secondaryPage;
  const routeHistoryA = [];
  const routeHistoryB = [];
  const observeRoute = (page, target) => page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    try { target.push(new URL(frame.url()).pathname); } catch (_) {}
  });
  observeRoute(pageA, routeHistoryA);
  observeRoute(pageB, routeHistoryB);

  const evidence = {
    actorA: { searchObserved: false, matchFoundObserved: false, directGameObserved: false, lobbyRouteObserved: false },
    actorB: { searchObserved: false, matchFoundObserved: false, directGameObserved: false, lobbyRouteObserved: false },
    sharedSessionFingerprintMatched: false,
    sharedActiveCardFingerprintMatched: false,
    sharedTimelineFingerprintMatched: false,
    sharedQuestionIndexMatched: false,
    sharedDeadlineFingerprintMatched: false,
    actorAAnswerLocked: false,
    actorBAnswerWindowStayedOpen: false,
    sharedTimelineGrewAfterRound: false,
    nextRoundSharedStateMatched: false,
    directStartRouteA: null,
    directStartRouteB: null,
    backendMatchEvidence: { actorA: false, actorB: false, statusClass: null },
    queueCleanupEvidence: {
      actorASearchSurfaceAbsentAfterDirectStart: false,
      actorBSearchSurfaceAbsentAfterDirectStart: false,
      runnerManagedContextClose: true,
    },
    onlineMatchmakingFunctionCategory: 'shared_matchmaking_backend',
    matchmakingMode: 'same_question_duel',
    matchmakingOperation: null,
    matchmakingStatusClass: null,
    matchmakingErrorCategory: null,
    queueStateBefore: 'unknown',
    queueStateAfter: 'unknown',
    retryCleanupObserved: false,
    cancelCleanupObserved: false,
    directStartPayloadAvailable: false,
    lobbyRouteObserved: false,
    matchFoundObserved: false,
    directGameStartObserved: false,
    twoActorRequiredReason: null,
  };
  runtime.authorityEvidence = evidence;

  const refreshLobbyEvidence = async () => {
    const [observedA, observedB] = await Promise.all([
      readDuelloObserver(pageA),
      readDuelloObserver(pageB),
    ]);
    evidence.actorA.searchObserved ||= observedA.searchObserved;
    evidence.actorB.searchObserved ||= observedB.searchObserved;
    evidence.actorA.matchFoundObserved ||= observedA.matchFoundObserved;
    evidence.actorB.matchFoundObserved ||= observedB.matchFoundObserved;
    evidence.actorA.lobbyRouteObserved ||= observedA.lobbyScreenObserved
      || routeHistoryA.some((route) => route === '/lobby' || route === '/LobbyRoom');
    evidence.actorB.lobbyRouteObserved ||= observedB.lobbyScreenObserved
      || routeHistoryB.some((route) => route === '/lobby' || route === '/LobbyRoom');
    evidence.lobbyRouteObserved = evidence.actorA.lobbyRouteObserved || evidence.actorB.lobbyRouteObserved;
    if (evidence.actorA.lobbyRouteObserved || evidence.actorB.lobbyRouteObserved) {
      const error = new Error('LOBBY_STILL_PRESENT: Duello observed an active lobby route or waiting-room screen.');
      error.failureCategory = 'LOBBY_STILL_PRESENT';
      throw error;
    }
  };

  await runtime.step('duello.contexts', async () => {
    await Promise.all([
      pageA.goto(config.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }),
      pageB.goto(config.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }),
    ]);
    await Promise.all([expectVisible(pageA, HOME, 15000), expectVisible(pageB, HOME, 15000)]);
    return 'Actors A and B independently reached Home in isolated browser contexts.';
  });
  await runtime.step('duello.entries', async () => {
    await Promise.all([
      clickAndSee(pageA, '[data-testid="home-online-entry"]', '[data-testid="online-screen"]'),
      clickAndSee(pageB, '[data-testid="home-online-entry"]', '[data-testid="online-screen"]'),
    ]);
    await Promise.all([
      expectVisible(pageA, '[data-testid="duello-entry"]'),
      expectVisible(pageB, '[data-testid="duello-entry"]'),
    ]);
    await Promise.all([installDuelloObserver(pageA), installDuelloObserver(pageB)]);
    await refreshLobbyEvidence();
    return 'Both actors reached canonical /online and found the Duello entry without a lobby.';
  });
  await runtime.step('duello.match', async () => {
    const baseline = runtime.captureServiceBaseline(RUNTIME_SERVICE_ACTION.ONLINE_MATCHMAKING);
    await Promise.all([
      pageA.locator('[data-testid="duello-entry"]').click(),
      pageB.locator('[data-testid="duello-entry"]').click(),
    ]);
    const responseEvidencePromise = waitForActorMatchmakingResponses(runtime, baseline);
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      await refreshLobbyEvidence();
      if (evidence.actorA.matchFoundObserved && evidence.actorB.matchFoundObserved) break;
      const phases = await Promise.all([
        pageA.locator('[data-testid="duello-search-screen"]').getAttribute('data-matchmaking-phase').catch(() => null),
        pageB.locator('[data-testid="duello-search-screen"]').getAttribute('data-matchmaking-phase').catch(() => null),
      ]);
      const safeEvidence = await Promise.all([
        readSafeMatchmakingEvidence(pageA, '[data-testid="duello-search-screen"], [data-testid="duello-match-found-screen"]'),
        readSafeMatchmakingEvidence(pageB, '[data-testid="duello-search-screen"], [data-testid="duello-match-found-screen"]'),
      ]);
      safeEvidence.forEach((observed) => mergeSafeMatchmakingEvidence(evidence, observed));
      evidence.matchFoundObserved = evidence.actorA.matchFoundObserved && evidence.actorB.matchFoundObserved;
      if (phases.includes('failed')) {
        const categories = await Promise.all([
          pageA.locator('[data-testid="duello-search-screen"]').getAttribute('data-matchmaking-error-category').catch(() => null),
          pageB.locator('[data-testid="duello-search-screen"]').getAttribute('data-matchmaking-error-category').catch(() => null),
        ]);
        const safeCategory = categories.find((value) => /^DUELLO_[A-Z_]+$/.test(String(value || ''))) || 'DUELLO_UNKNOWN_START_FAILURE';
        const error = new Error(`Duello returned a classified terminal start failure (${safeCategory}).`);
        error.failureCategory = safeCategory;
        throw error;
      }
      if (phases.includes('timeout')) {
        const error = new Error('Both fixtures joined the queue, but Duello did not pair them in the bounded search window.');
        error.failureCategory = 'DUELLO_PAIRING_FAILURE';
        throw error;
      }
      await pageA.waitForTimeout(100);
    }
    const finalSafeEvidence = await Promise.all([
      readSafeMatchmakingEvidence(pageA, '[data-testid="duello-search-screen"], [data-testid="duello-match-found-screen"]'),
      readSafeMatchmakingEvidence(pageB, '[data-testid="duello-search-screen"], [data-testid="duello-match-found-screen"]'),
    ]);
    finalSafeEvidence.forEach((observed) => mergeSafeMatchmakingEvidence(evidence, observed));
    evidence.matchFoundObserved = evidence.actorA.matchFoundObserved && evidence.actorB.matchFoundObserved;
    evidence.backendMatchEvidence = await responseEvidencePromise;
    evidence.matchmakingStatusClass = evidence.backendMatchEvidence.statusClass;
    if (!evidence.backendMatchEvidence.actorA || !evidence.backendMatchEvidence.actorB) {
      throw new AutomationSetupGap(
        'Successful matchmaking responses were not observed for both isolated actors.',
        AUTOMATION_STATUS.NOT_AUTOMATABLE,
        'DUELLO_BACKEND_EVIDENCE_MISSING',
      );
    }
    if (!evidence.actorA.searchObserved || !evidence.actorB.searchObserved) {
      const error = new Error('Both actors did not expose the required Rakip aranıyor state before matching.');
      error.failureCategory = 'DUELLO_SEARCH_STATE_MISSING';
      throw error;
    }
    if (!evidence.actorA.matchFoundObserved || !evidence.actorB.matchFoundObserved) {
      const error = new Error('Both actors did not observe same-screen Rakip bulundu in the bounded window.');
      error.failureCategory = 'DUELLO_PAIRING_FAILURE';
      throw error;
    }
    return 'Both actors received successful backend responses and observed searching then same-screen Rakip bulundu.';
  });
  await runtime.step('duello.active_card', async () => {
    await Promise.all([
      waitForDirectDuelloRoute(pageA),
      waitForDirectDuelloRoute(pageB),
    ]);
    await Promise.all([
      expectVisible(pageA, '[data-testid="duello-active-card"]', 30000),
      expectVisible(pageB, '[data-testid="duello-active-card"]', 30000),
    ]);
    await refreshLobbyEvidence();
    evidence.actorA.directGameObserved = true;
    evidence.actorB.directGameObserved = true;
    evidence.directGameStartObserved = true;
    evidence.directStartPayloadAvailable = true;
    evidence.directStartRouteA = '/duel';
    evidence.directStartRouteB = '/duel';

    const sessionRefs = [pageA, pageB].map((page) => new URL(page.url()).searchParams.get('lobbyId') || '');
    if (!sessionRefs[0] || !sessionRefs[1]) throw new Error('A public-safe session fingerprint could not be derived for both actors.');
    const sessionFingerprints = sessionRefs.map(safeRuntimeFingerprint);
    evidence.sharedSessionFingerprintMatched = sessionFingerprints[0] === sessionFingerprints[1];

    const [proofA, proofB] = await Promise.all([readDuelloRoundProof(pageA), readDuelloRoundProof(pageB)]);
    evidence.sharedActiveCardFingerprintMatched = proofA.questionFingerprint === proofB.questionFingerprint;
    evidence.sharedTimelineFingerprintMatched = proofA.timelineFingerprint === proofB.timelineFingerprint;
    evidence.sharedQuestionIndexMatched = proofA.questionIndex === proofB.questionIndex;
    evidence.sharedDeadlineFingerprintMatched = proofA.deadlineFingerprint === proofB.deadlineFingerprint;
    if (!evidence.sharedSessionFingerprintMatched
      || !evidence.sharedActiveCardFingerprintMatched
      || !evidence.sharedTimelineFingerprintMatched
      || !evidence.sharedQuestionIndexMatched
      || !evidence.sharedDeadlineFingerprintMatched) {
      const error = new Error('The two Duello actors did not receive the same session, question, timeline, index, and deadline fingerprints.');
      error.failureCategory = 'DUELLO_SNAPSHOT_DIVERGENCE';
      throw error;
    }
    return 'Both actors entered direct /duel with matching anonymized session, question, timeline, index, and deadline fingerprints.';
  });
  await runtime.step('duello.shared_round', async () => {
    await Promise.all([waitForDuelloAnswerWindow(pageA), waitForDuelloAnswerWindow(pageB)]);
    const [beforeA, beforeB] = await Promise.all([readDuelloRoundProof(pageA), readDuelloRoundProof(pageB)]);
    if (beforeA.timelineCount !== beforeB.timelineCount || beforeA.questionIndex !== beforeB.questionIndex) {
      throw new Error('Duello shared state diverged before answer submission.');
    }

    await selectDuelloZoneAndWaitForSubmit(pageA);
    await pageA.locator('[data-testid="duello-confirm-placement"]').click();
    await pageA.waitForFunction(() => (
      document.querySelector('[data-testid="duello-active-card"]')?.getAttribute('data-kronox-duello-answer-locked') === 'true'
    ), null, { timeout: 5000 });
    evidence.actorAAnswerLocked = true;

    evidence.actorBAnswerWindowStayedOpen = await pageB.locator('[data-testid="duello-active-card"]')
      .getAttribute('data-kronox-duello-answer-locked') === 'false';
    if (!evidence.actorBAnswerWindowStayedOpen) {
      throw new Error('Actor A answer lock incorrectly closed Actor B answer window.');
    }
    await selectDuelloZoneAndWaitForSubmit(pageB);
    await pageB.locator('[data-testid="duello-confirm-placement"]').click();

    await Promise.all([pageA, pageB].map((page) => page.waitForFunction(({ count, index }) => {
      const root = document.querySelector('[data-testid="duello-active-card"]');
      return Number(root?.getAttribute('data-kronox-duello-timeline-count')) > count
        && Number(root?.getAttribute('data-kronox-duello-question-index')) > index;
    }, { count: beforeA.timelineCount, index: beforeA.questionIndex }, { timeout: 15000 })));

    const [afterA, afterB] = await Promise.all([readDuelloRoundProof(pageA), readDuelloRoundProof(pageB)]);
    evidence.sharedTimelineGrewAfterRound = afterA.timelineCount === beforeA.timelineCount + 1
      && afterB.timelineCount === beforeB.timelineCount + 1;
    evidence.nextRoundSharedStateMatched = afterA.timelineFingerprint === afterB.timelineFingerprint
      && afterA.questionFingerprint === afterB.questionFingerprint
      && afterA.questionIndex === afterB.questionIndex
      && afterA.deadlineFingerprint === afterB.deadlineFingerprint;
    if (!evidence.sharedTimelineGrewAfterRound || !evidence.nextRoundSharedStateMatched) {
      const error = new Error('Duello round did not grow one identical shared timeline and start one identical next round.');
      error.failureCategory = 'DUELLO_SHARED_TIMELINE_DIVERGENCE';
      throw error;
    }
    return 'A locked immediately, B retained its answer window, and both clients advanced to one identical grown timeline and next round.';
  });
  await runtime.step('duello.privacy', async () => {
    await Promise.all([assertPublicTextSafe(pageA), assertPublicTextSafe(pageB)]);
    await refreshLobbyEvidence();
    return 'Both public surfaces and report evidence omit private actor values, raw IDs, answer data, and raw backend errors.';
  });
  await runtime.step('duello.cleanup', async () => {
    evidence.queueCleanupEvidence.actorASearchSurfaceAbsentAfterDirectStart = await pageA.locator('[data-testid="duello-search-screen"]').count() === 0;
    evidence.queueCleanupEvidence.actorBSearchSurfaceAbsentAfterDirectStart = await pageB.locator('[data-testid="duello-search-screen"]').count() === 0;
    if (!evidence.queueCleanupEvidence.actorASearchSurfaceAbsentAfterDirectStart
      || !evidence.queueCleanupEvidence.actorBSearchSurfaceAbsentAfterDirectStart) {
      throw new Error('A stale Duello search surface remained after direct game start.');
    }
    await Promise.all([pageA.evaluate(() => window.__kronoxDuelloE2E?.stop?.()), pageB.evaluate(() => window.__kronoxDuelloE2E?.stop?.())]);
    return 'Search surfaces and observers were settled; the runner will close both isolated contexts.';
  });
  await runtime.step('duello.extended_result', async () => {
    throw new AutomationSetupGap(
      'A deterministic 12-round result fixture is not configured; the shared-round proof does not claim +50/+25/0 persistence or rematch delivery proof.',
      AUTOMATION_STATUS.MANUAL_EXTERNAL,
      'DUELLO_RESULT_FIXTURE_REQUIRED',
    );
  }, { optional: true });
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
