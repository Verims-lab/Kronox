export const RUNTIME_E2E_CAPABILITY = Object.freeze({
  BROWSER: 'browser',
  APP_DOCUMENT: 'appDocument',
  UI_ONLY: 'uiOnly',
  APP_CONFIG: 'appConfig',
  BASE44_BACKEND: 'base44Backend',
  GUEST_BOOTSTRAP: 'guestBootstrap',
  COMPLETED_ACTOR: 'completedActor',
  AUTHENTICATED_STORAGE: 'authenticatedStorage',
  QUESTION_BOOTSTRAP: 'questionBootstrap',
  SOLO_QUESTION_SERVICE: 'soloQuestionService',
  ONLINE_MATCHMAKING: 'onlineMatchmaking',
  SAFE_MATCHMAKING_QUEUE: 'safeMatchmakingQueue',
  MUTATION_SAFE_WHEEL_ACTOR: 'mutationSafeWheelActor',
  MUTATION_SAFE_STORE_ACTOR: 'mutationSafeStoreActor',
  TWO_BROWSER_CONTEXTS: 'twoBrowserContexts',
  TWO_ISOLATED_ACTORS: 'twoIsolatedActors',
  DETERMINISTIC_TWO_ACTOR_PAIRING: 'deterministicTwoActorPairing',
  DETERMINISTIC_CLAIM_FIXTURE: 'deterministicClaimFixture',
});

export const RUNTIME_E2E_CAPABILITY_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  PROBE_REQUIRED: 'PROBE_REQUIRED',
  MISSING: 'MISSING',
  MANUAL_EXTERNAL: 'MANUAL_EXTERNAL',
});

export const RUNTIME_E2E_TARGET_KIND = Object.freeze({
  LOCAL_DEV: 'LOCAL_DEV',
  BASE44_PREVIEW: 'BASE44_PREVIEW',
  PRODUCTION_CUSTOM_DOMAIN: 'PRODUCTION_CUSTOM_DOMAIN',
  UNKNOWN_EXTERNAL: 'UNKNOWN_EXTERNAL',
});

export function classifyRuntimeE2ETarget(baseUrl) {
  try {
    const parsed = new URL(String(baseUrl));
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '::1' || /^127(?:\.\d{1,3}){3}$/.test(hostname)) {
      return RUNTIME_E2E_TARGET_KIND.LOCAL_DEV;
    }
    if (/base44\.(?:app|com)$/.test(hostname) || hostname.endsWith('.base44.app')) {
      return RUNTIME_E2E_TARGET_KIND.BASE44_PREVIEW;
    }
    if (parsed.protocol === 'https:') return RUNTIME_E2E_TARGET_KIND.PRODUCTION_CUSTOM_DOMAIN;
    return RUNTIME_E2E_TARGET_KIND.UNKNOWN_EXTERNAL;
  } catch (_) {
    return RUNTIME_E2E_TARGET_KIND.UNKNOWN_EXTERNAL;
  }
}

const capability = (status, reason, nextAction = null) => Object.freeze({
  status,
  reason,
  nextAction,
});

export function buildRuntimeCapabilitySummary({
  browserAvailable,
  preflight,
  environment,
}) {
  const documentLoaded = Boolean(preflight?.documentLoaded);
  const backendAvailable = preflight?.status === 'REACHABLE';
  const runtimeProbeAllowed = Boolean(preflight?.canRunRuntimeProbes);
  const appConfigAvailable = Boolean(preflight?.appConfigAvailable);
  const hasStorageState = Boolean(environment?.hasStorageState);
  const hasTwoStorageStates = Boolean(environment?.hasStorageStateA && environment?.hasStorageStateB);

  return Object.freeze({
    [RUNTIME_E2E_CAPABILITY.BROWSER]: capability(
      browserAvailable ? RUNTIME_E2E_CAPABILITY_STATUS.AVAILABLE : RUNTIME_E2E_CAPABILITY_STATUS.MISSING,
      browserAvailable ? 'A real Chromium browser is available.' : 'A Chromium browser could not be launched.',
      browserAvailable ? null : 'Install Playwright Chromium or provide a supported system Chromium browser.',
    ),
    [RUNTIME_E2E_CAPABILITY.APP_DOCUMENT]: capability(
      documentLoaded ? RUNTIME_E2E_CAPABILITY_STATUS.AVAILABLE : RUNTIME_E2E_CAPABILITY_STATUS.MISSING,
      documentLoaded ? 'The app document loaded.' : 'The configured app document did not load.',
      documentLoaded ? null : 'Verify KRONOX_E2E_BASE_URL or the local Vite server.',
    ),
    [RUNTIME_E2E_CAPABILITY.UI_ONLY]: capability(
      documentLoaded ? RUNTIME_E2E_CAPABILITY_STATUS.AVAILABLE : RUNTIME_E2E_CAPABILITY_STATUS.MISSING,
      documentLoaded ? 'Browser-only UI assertions may run and are labeled UI-only.' : 'UI-only checks need a loaded app document.',
    ),
    [RUNTIME_E2E_CAPABILITY.APP_CONFIG]: capability(
      appConfigAvailable ? RUNTIME_E2E_CAPABILITY_STATUS.AVAILABLE : RUNTIME_E2E_CAPABILITY_STATUS.MISSING,
      appConfigAvailable
        ? 'A Base44 app ID is configured without exposing its value.'
        : 'Base44 app ID configuration is missing; an app base URL alone did not identify the app.',
      appConfigAvailable ? null : 'Set VITE_BASE44_APP_ID or supply app_id through the approved runtime bootstrap.',
    ),
    [RUNTIME_E2E_CAPABILITY.BASE44_BACKEND]: capability(
      backendAvailable
        ? RUNTIME_E2E_CAPABILITY_STATUS.AVAILABLE
        : runtimeProbeAllowed
          ? RUNTIME_E2E_CAPABILITY_STATUS.PROBE_REQUIRED
          : RUNTIME_E2E_CAPABILITY_STATUS.MISSING,
      backendAvailable
        ? 'The configured Base44 app responded to direct preflight.'
        : runtimeProbeAllowed
          ? 'Production custom-domain direct preflight is limited; scenario-level backend proof is required.'
          : `Base44 preflight is ${preflight?.status || 'OBSERVATION_INCONCLUSIVE'}.`,
      backendAvailable || runtimeProbeAllowed ? null : preflight?.nextAction || 'Repair Base44 app configuration/reachability and rerun preflight.',
    ),
    [RUNTIME_E2E_CAPABILITY.GUEST_BOOTSTRAP]: capability(
      preflight?.guestBootstrapAvailable
        ? RUNTIME_E2E_CAPABILITY_STATUS.AVAILABLE
        : backendAvailable || runtimeProbeAllowed
          ? RUNTIME_E2E_CAPABILITY_STATUS.PROBE_REQUIRED
          : RUNTIME_E2E_CAPABILITY_STATUS.MISSING,
      preflight?.guestBootstrapAvailable
        ? 'Guest/auth bootstrap reached a usable actor surface.'
        : backendAvailable || runtimeProbeAllowed
          ? 'The scenario must prove guest/auth bootstrap or restored-session state at runtime.'
          : 'Guest/auth bootstrap cannot be proved while Base44 preflight is unavailable.',
      preflight?.guestBootstrapAvailable || backendAvailable || runtimeProbeAllowed ? null : 'Fix app configuration before guest/auth scenarios run.',
    ),
    [RUNTIME_E2E_CAPABILITY.COMPLETED_ACTOR]: capability(
      hasStorageState
        ? RUNTIME_E2E_CAPABILITY_STATUS.AVAILABLE
        : documentLoaded
          ? RUNTIME_E2E_CAPABILITY_STATUS.PROBE_REQUIRED
          : RUNTIME_E2E_CAPABILITY_STATUS.MISSING,
      hasStorageState
        ? 'An external storage-state fixture exists.'
        : 'No storage-state fixture exists; a completed local guest must be proved by the scenario.',
      hasStorageState ? null : 'Provide KRONOX_E2E_STORAGE_STATE if the fresh context reaches onboarding.',
    ),
    [RUNTIME_E2E_CAPABILITY.AUTHENTICATED_STORAGE]: capability(
      hasStorageState ? RUNTIME_E2E_CAPABILITY_STATUS.AVAILABLE : RUNTIME_E2E_CAPABILITY_STATUS.MISSING,
      hasStorageState ? 'An authenticated external storage-state fixture exists.' : 'Authenticated Online storage state is missing.',
      hasStorageState ? null : 'Provide a non-production KRONOX_E2E_STORAGE_STATE file.',
    ),
    [RUNTIME_E2E_CAPABILITY.QUESTION_BOOTSTRAP]: capability(
      backendAvailable || runtimeProbeAllowed ? RUNTIME_E2E_CAPABILITY_STATUS.PROBE_REQUIRED : RUNTIME_E2E_CAPABILITY_STATUS.MISSING,
      backendAvailable || runtimeProbeAllowed ? 'Question bootstrap must be proved by opening real Solo gameplay.' : 'Question bootstrap cannot run without the configured Base44 app.',
      backendAvailable || runtimeProbeAllowed ? null : 'Fix Base44 app configuration and rerun the Solo scenario.',
    ),
    [RUNTIME_E2E_CAPABILITY.SOLO_QUESTION_SERVICE]: capability(
      backendAvailable || runtimeProbeAllowed ? RUNTIME_E2E_CAPABILITY_STATUS.PROBE_REQUIRED : RUNTIME_E2E_CAPABILITY_STATUS.MISSING,
      backendAvailable || runtimeProbeAllowed ? 'The Solo scenario must prove the real question service response.' : 'The Solo question service cannot be probed while Base44 is unavailable.',
      backendAvailable || runtimeProbeAllowed ? null : 'Run against a valid Base44 app with its question service deployed.',
    ),
    [RUNTIME_E2E_CAPABILITY.ONLINE_MATCHMAKING]: capability(
      backendAvailable || runtimeProbeAllowed ? RUNTIME_E2E_CAPABILITY_STATUS.PROBE_REQUIRED : RUNTIME_E2E_CAPABILITY_STATUS.MISSING,
      backendAvailable || runtimeProbeAllowed ? 'Online matchmaking must be proved by the gated scenario.' : 'Online matchmaking cannot be probed while Base44 is unavailable.',
    ),
    [RUNTIME_E2E_CAPABILITY.SAFE_MATCHMAKING_QUEUE]: capability(
      environment?.allowMatchmaking ? RUNTIME_E2E_CAPABILITY_STATUS.AVAILABLE : RUNTIME_E2E_CAPABILITY_STATUS.MISSING,
      environment?.allowMatchmaking ? 'The explicit safe matchmaking gate is enabled.' : 'The shared queue mutation gate is disabled.',
      environment?.allowMatchmaking ? null : 'Use a non-production actor and set KRONOX_E2E_ALLOW_MATCHMAKING=true.',
    ),
    [RUNTIME_E2E_CAPABILITY.MUTATION_SAFE_WHEEL_ACTOR]: capability(
      environment?.allowWheelSpin ? RUNTIME_E2E_CAPABILITY_STATUS.AVAILABLE : RUNTIME_E2E_CAPABILITY_STATUS.MISSING,
      environment?.allowWheelSpin ? 'The optional safe wheel mutation gate is enabled.' : 'Optional wheel mutation remains disabled.',
      environment?.allowWheelSpin ? null : 'Use a resettable actor and set KRONOX_E2E_ALLOW_WHEEL_SPIN=true.',
    ),
    [RUNTIME_E2E_CAPABILITY.MUTATION_SAFE_STORE_ACTOR]: capability(
      environment?.allowDiamondPurchase ? RUNTIME_E2E_CAPABILITY_STATUS.AVAILABLE : RUNTIME_E2E_CAPABILITY_STATUS.MISSING,
      environment?.allowDiamondPurchase ? 'The optional Diamond purchase gate is enabled.' : 'Optional Diamond purchase remains disabled.',
      environment?.allowDiamondPurchase ? null : 'Use an isolated funded actor and set KRONOX_E2E_ALLOW_DIAMOND_PURCHASE=true.',
    ),
    [RUNTIME_E2E_CAPABILITY.TWO_BROWSER_CONTEXTS]: capability(
      hasTwoStorageStates ? RUNTIME_E2E_CAPABILITY_STATUS.PROBE_REQUIRED : RUNTIME_E2E_CAPABILITY_STATUS.MANUAL_EXTERNAL,
      hasTwoStorageStates ? 'Two external actor fixtures exist, but two real contexts still need runtime proof.' : 'Two isolated actor fixtures are not configured.',
      'Provide distinct KRONOX_E2E_STORAGE_STATE_A and KRONOX_E2E_STORAGE_STATE_B fixtures.',
    ),
    [RUNTIME_E2E_CAPABILITY.TWO_ISOLATED_ACTORS]: capability(
      hasTwoStorageStates ? RUNTIME_E2E_CAPABILITY_STATUS.PROBE_REQUIRED : RUNTIME_E2E_CAPABILITY_STATUS.MANUAL_EXTERNAL,
      hasTwoStorageStates ? 'Two fixture files exist; actor distinctness still requires safe runtime proof.' : 'Two distinct actors are unavailable.',
      'Provide and verify two distinct non-production actors without exporting their identities.',
    ),
    [RUNTIME_E2E_CAPABILITY.DETERMINISTIC_TWO_ACTOR_PAIRING]: capability(
      hasTwoStorageStates ? RUNTIME_E2E_CAPABILITY_STATUS.PROBE_REQUIRED : RUNTIME_E2E_CAPABILITY_STATUS.MANUAL_EXTERNAL,
      hasTwoStorageStates
        ? 'Two isolated actor fixtures are configured; the same-session Duello pairing must now be proved at runtime.'
        : 'The repository has no configured two-actor Duello pairing fixtures.',
      'Provide distinct KRONOX_E2E_STORAGE_STATE_A and KRONOX_E2E_STORAGE_STATE_B fixtures.',
    ),
    [RUNTIME_E2E_CAPABILITY.DETERMINISTIC_CLAIM_FIXTURE]: capability(
      RUNTIME_E2E_CAPABILITY_STATUS.MANUAL_EXTERNAL,
      'The repository has no deterministic correct-claim race fixture.',
      'Keep the claim-race proof manual until a safe deterministic fixture exists.',
    ),
  });
}

export function evaluateScenarioCapabilities(definition, capabilitySummary) {
  const required = (definition.requiredCapabilities || []).map((name) => ({
    name,
    ...(capabilitySummary?.[name] || capability(
      RUNTIME_E2E_CAPABILITY_STATUS.MISSING,
      'Capability is not represented by preflight.',
      'Add an explicit preflight capability before running this scenario.',
    )),
  }));
  const optional = (definition.optionalCapabilities || []).map((name) => ({
    name,
    ...(capabilitySummary?.[name] || capability(RUNTIME_E2E_CAPABILITY_STATUS.MISSING, 'Optional capability is unavailable.')),
  }));
  const blockers = required.filter((item) => (
    item.status === RUNTIME_E2E_CAPABILITY_STATUS.MISSING
    || item.status === RUNTIME_E2E_CAPABILITY_STATUS.MANUAL_EXTERNAL
  ));
  const manual = blockers.some((item) => item.status === RUNTIME_E2E_CAPABILITY_STATUS.MANUAL_EXTERNAL);
  const runtimeProbes = required.filter((item) => item.status === RUNTIME_E2E_CAPABILITY_STATUS.PROBE_REQUIRED);
  return {
    canRun: blockers.length === 0,
    status: manual ? 'AUTOMATION_MANUAL_EXTERNAL' : 'AUTOMATION_NOT_AUTOMATABLE',
    decision: blockers.length
      ? (manual ? 'MANUAL_EXTERNAL_REQUIRED' : 'BLOCKED_BY_SETUP_GAP')
      : runtimeProbes.length
        ? 'RUN_WITH_RUNTIME_PROBES'
        : 'RUN',
    required,
    optional,
    blockers,
    runtimeProbes,
    reason: blockers.length
      ? blockers.map((item) => `${item.name}: ${item.reason}`).join(' ')
      : runtimeProbes.length
        ? `Runtime proof required for: ${runtimeProbes.map((item) => item.name).join(', ')}.`
        : 'All required preflight capabilities are available.',
    nextAction: blockers.map((item) => item.nextAction).filter(Boolean).join(' ')
      || definition.manualFallback,
  };
}
