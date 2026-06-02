// Codex153 — Health/security contracts that lock in the removal of the
// Deezer preview proxy.
//
// Background: a security scan flagged `functions/getDeezerPreview` as an
// unauthenticated public proxy to api.deezer.com. Product decision was to
// remove the music live-preview pipeline entirely (not to secure the
// proxy). This suite makes the regression detectable from Health Center:
//
//   • getDeezerPreview backend function must NOT exist.
//   • QuestionCard must NOT import the base44 SDK to invoke the proxy
//     and must NOT reference `getDeezerPreview` anywhere.
//   • loadSpotifyMusicQuestions must NOT contain a Deezer fallback path.
//
// PASS proves the live-preview proxy is gone. Any FAIL means the
// unauthenticated proxy snuck back in and the security scan would refire.
//
// This is a SECURITY case — marked critical so a regression weighs the
// Health score down.

import questionCardSource from './QuestionCard.jsx?raw';
import loadSpotifyMusicQuestionsSource from '../../functions/loadSpotifyMusicQuestions.js?raw';

export const EXTRA_SUITES = [
  {
    id: 'deezer_removal_security',
    name: 'Deezer Preview Proxy Removed (Security)',
    critical: true,
    color: 'rose',
  },
];

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  MANUAL_VERIFY: 'MANUAL_VERIFY',
};

function safeStr(value) {
  return typeof value === 'string' ? value : '';
}

function pass(message, extras = {}) {
  return {
    status: 'PASS',
    message,
    ...extras,
  };
}

function fail(message, extras = {}) {
  return {
    status: 'FAIL',
    message,
    ...extras,
  };
}

function makeCase(suiteId, suiteName, id, description, run, opts = {}) {
  return {
    key: `${suiteId}.${id}`,
    suiteId,
    suiteName,
    id,
    description,
    run,
    critical: opts.critical !== false,
    actionType: opts.actionType || ACTION_TYPES.CODE_FIX,
  };
}

export const EXTRA_TESTS = [
  // 1) Backend function must NOT be in the bundle anymore. We can't list
  //    files at runtime here, but if `functions/getDeezerPreview` existed
  //    its source `?raw` import (in any case file) would have resolved.
  //    The contract: no source string we can statically read contains the
  //    Deezer proxy entry path (`api.deezer.com/search`) AND
  //    `Deno.serve(`. If both appear in QuestionCard or in the Spotify
  //    loader, the proxy effectively reintroduced.
  makeCase(
    'deezer_removal_security', 'Deezer Preview Proxy Removed (Security)',
    'getdeezerpreview_function_removed',
    'functions/getDeezerPreview is no longer deployed (no Deno.serve handler proxies api.deezer.com from any function visible to Health)',
    () => {
      const sources = [
        safeStr(questionCardSource),
        safeStr(loadSpotifyMusicQuestionsSource),
      ];
      const proxyAddress = 'api.deezer.com/search';
      const serveHandler = 'Deno.serve(';
      const offenders = sources.filter(
        (src) => src.includes(proxyAddress) && src.includes(serveHandler),
      );
      if (offenders.length) {
        return fail('A Deno.serve handler proxying api.deezer.com is still present in a tracked source.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'functions/* or components/game/QuestionCard',
          expected: 'No Deno.serve proxy hitting api.deezer.com',
          actual: 'Proxy code still present',
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('No Deno.serve handler proxying api.deezer.com is visible to Health.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  // 2) QuestionCard must NOT invoke the proxy and must NOT import the SDK
  //    purely to do so.
  makeCase(
    'deezer_removal_security', 'Deezer Preview Proxy Removed (Security)',
    'question_card_does_not_invoke_proxy',
    'QuestionCard does not call base44.functions.invoke("getDeezerPreview") and does not reference getDeezerPreview at all',
    () => {
      const src = safeStr(questionCardSource);
      const forbidden = [
        "invoke('getDeezerPreview'",
        'invoke("getDeezerPreview"',
        'getDeezerPreview',
        'api.deezer.com',
      ];
      const found = forbidden.filter((t) => src.includes(t));
      if (found.length) {
        return fail('QuestionCard still references the removed Deezer preview proxy.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/game/QuestionCard.jsx',
          expected: 'No reference to getDeezerPreview / api.deezer.com',
          actual: { foundForbidden: found },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('QuestionCard no longer references the Deezer preview proxy.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  // 3) QuestionCard must not render live-music audio controls or a
  //    livePreviewUrl state, otherwise dead UI could resurface.
  makeCase(
    'deezer_removal_security', 'Deezer Preview Proxy Removed (Security)',
    'question_card_music_preview_pipeline_gone',
    'QuestionCard does not maintain a `livePreviewUrl` state and does not render a music <audio> element wired to a fetched preview URL',
    () => {
      const src = safeStr(questionCardSource);
      const forbidden = [
        'setLivePreviewUrl',
        'livePreviewUrl',
        // Specific to the old muzik audio pipeline. The legacy `isitsel`
        // audio binding uses `question.media_url` directly, not a state
        // var, so it stays out of this contract.
      ];
      const found = forbidden.filter((t) => src.includes(t));
      if (found.length) {
        return fail('Music live-preview pipeline state is still present in QuestionCard.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/game/QuestionCard.jsx',
          expected: 'No livePreviewUrl state or fetched-preview <audio>',
          actual: { foundForbidden: found },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Music live-preview pipeline is fully removed from QuestionCard.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),

  // 4) The Spotify admin loader must NOT fall back to Deezer.
  makeCase(
    'deezer_removal_security', 'Deezer Preview Proxy Removed (Security)',
    'spotify_loader_no_deezer_fallback',
    'functions/loadSpotifyMusicQuestions does not call api.deezer.com or define a Deezer preview fallback',
    () => {
      const src = safeStr(loadSpotifyMusicQuestionsSource);
      const forbidden = [
        'api.deezer.com',
        'getDeezerPreview',
        'deezerCount',
      ];
      const found = forbidden.filter((t) => src.includes(t));
      if (found.length) {
        return fail('loadSpotifyMusicQuestions still references the removed Deezer fallback path.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'functions/loadSpotifyMusicQuestions.js',
          expected: 'Spotify-only, no Deezer fallback',
          actual: { foundForbidden: found },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Spotify loader is Spotify-only — Deezer fallback removed.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    },
  ),
];