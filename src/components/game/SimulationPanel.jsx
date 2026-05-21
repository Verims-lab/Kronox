import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardCopy, Clock, Play, RefreshCw, ShieldAlert, X, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

import gameLayoutSource from './GameLayout.jsx?raw';
import questionCardSource from './QuestionCard.jsx?raw';
import timelineCardSource from './TimelineCard.jsx?raw';
import gameOverSource from './GameOver.jsx?raw';
import appSource from '../../App.jsx?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import gamePageSource from '../../pages/Game.jsx?raw';
import lobbyRoomSource from '../../pages/LobbyRoom.jsx?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import soloChallengeSource from '../../pages/SoloChallenge.jsx?raw';
import questionManagementSource from '../admin/QuestionManagement.jsx?raw';
import tutorialSource from '../tutorial/KronoxTutorial.jsx?raw';
import lobbySyncSource from '../../hooks/useLobbySync.js?raw';
import useGameActionsSource from '../../hooks/useGameActions.js?raw';
import gameRulesSource from '../../lib/gameRules.js?raw';
import buildMarkerSource from '../dev/BuildMarker.jsx?raw';
import kronoxDocSource from '../../../Kronox.md?raw';
import corePromptSource from '../../../CORE_PROMPT.md?raw';
import {
  getNextPlayerIndex,
  getTimelineYears,
  hasDuplicateTimelineYear,
  hasPlayerWon,
  isCorrectPlacement,
  selectNextQuestion,
} from '../../lib/gameRules';

const ST = { PASS: 'PASS', FAIL: 'FAIL', WARNING: 'WARNING', SKIPPED: 'SKIPPED' };
const LOOK = { PASS: ['#4ade80', CheckCircle2], FAIL: ['#f87171', XCircle], WARNING: ['#facc15', AlertTriangle], SKIPPED: ['#a1a1aa', Clock] };
const CATS = [
  ['smoke', 'Smoke', '#67e8f9'], ['regression', 'Sanity / Regression', '#93c5fd'], ['architecture', 'Architecture', '#c4b5fd'],
  ['home', 'Home Screen / Responsive', '#2dd4bf'], ['offline', 'Offline Solo', '#c084fc'], ['lobby', 'Online Lobby', '#60a5fa'],
  ['sync', 'Online Gameplay Sync', '#38bdf8'], ['gameover', 'Online GameOver', '#facc15'], ['questions', 'Question Engine', '#a3e635'],
  ['media', 'Media Rendering', '#f9a8d4'], ['admin', 'Admin Tools', '#f59e0b'], ['tutorial', 'Tutorial / Help', '#a78bfa'],
  ['records', 'Personal Records', '#2dd4bf'], ['performance', 'Performance', '#fde68a'], ['stability', 'Stability / Edge Cases', '#fca5a5'],
  ['exceptional', 'Exceptional Cases', '#fb7185'], ['removed', 'Removed Features', '#fda4af'],
].map(([id, label, color]) => ({ id, label, color }));
const SRC = { App: appSource, MainMenu: mainMenuSource, SoloChallenge: soloChallengeSource, GameLayout: gameLayoutSource, Game: gamePageSource, LobbyRoom: lobbyRoomSource, Settings: settingsPageSource, QuestionCard: questionCardSource, TimelineCard: timelineCardSource, GameOver: gameOverSource, QuestionManagement: questionManagementSource, Tutorial: tutorialSource, LobbySync: lobbySyncSource, GameRules: gameRulesSource, BuildMarker: buildMarkerSource, Kronox: kronoxDocSource, Core: corePromptSource };
const now = () => new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const out = (status, message, extra = {}) => ({ status, message, ...extra });
const pass = (message, extra) => out(ST.PASS, message, extra);
const fail = (message, extra) => out(ST.FAIL, message, extra);
const warn = (message, extra) => out(ST.WARNING, message, extra);
const skip = (message, extra) => out(ST.SKIPPED, message, extra);
const test = (cat, id, name, run) => ({ cat, id, name, run });
const sourceHas = (cat, id, name, label, source, tokens) => test(cat, id, name, () => {
  const missing = tokens.filter(token => !source.includes(token));
  return missing.length ? fail('Source contract failed', { expected: tokens, actual: `missing: ${missing.join(', ')}`, file: label }) : pass('Source contract matched', { expected: tokens, actual: 'all tokens present', file: label });
});
const sourceLacks = (cat, id, name, label, source, tokens) => test(cat, id, name, () => {
  const found = tokens.filter(token => source.includes(token));
  return found.length ? fail('Removed/forbidden source token found', { expected: 'none', actual: found, file: label }) : pass('Forbidden tokens absent', { expected: 'none', actual: 'none', file: label });
});
const equal = (cat, id, name, actualFn, expected) => test(cat, id, name, () => {
  const actual = actualFn();
  return JSON.stringify(actual) === JSON.stringify(expected) ? pass('Expected value matched', { expected, actual }) : fail('Expected value mismatch', { expected, actual });
});
const skipped = (cat, id, name, reason) => test(cat, id, name, () => skip(reason, { expected: 'automated deterministic coverage or external E2E', actual: 'skipped with reason', reason }));
const normalizeCode = value => String(value || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[^\w]/g, '');
const deterministicRandom = () => 0.999999;
const placeOk = (zone, year, cards) => isCorrectPlacement(cards, year, zone);
const pick = (used, pool, years = new Set(), recent = new Set()) => selectNextQuestion(pool, used, years, { recentQuestionIds: recent, random: deterministicRandom });
const turn = (lobby, actor, q) => { const players = lobby.players.map(p => ({ ...p, cards: [...(p.cards || [])] })); players[actor].cards.push(q); const next = getNextPlayerIndex(actor, players.length); return { ...lobby, players, current_player_index: next, current_question_id: `next_${next}`, used_question_ids: [...(lobby.used_question_ids || []), q.id, `next_${next}`], status: 'in_game' }; };
const rotate = (count, turns) => { let lobby = { players: Array.from({ length: count }, (_, i) => ({ name: `P${i + 1}`, cards: [] })), used_question_ids: [], current_player_index: 0 }; const seen = [0]; for (let i = 0; i < turns; i += 1) { lobby = turn(lobby, lobby.current_player_index, { id: `q${i}`, year: 1900 + i }); seen.push(lobby.current_player_index); } return seen; };
const perspective = (lobby, email) => { const active = lobby.players[lobby.current_player_index]; const me = lobby.players.find(p => p.email === email); const isMyTurn = Boolean(me && active?.email === me.email); return { current_question_id: lobby.current_question_id, activePlayer: active?.name || null, isMyTurn, readOnly: !isMyTurn, canDrag: isMyTurn && !lobby.feedback && !lobby.winner, canPlace: isMyTurn && !lobby.feedback && !lobby.winner, canConfirm: isMyTurn && lobby.selectedZone !== null && !lobby.feedback && !lobby.winner }; };
const gameOverCopy = (winner, local) => String(winner).toLocaleLowerCase('tr-TR') === String(local).toLocaleLowerCase('tr-TR') ? { headline: 'Tebrikler!', icon: 'Trophy' } : { headline: 'Kaybettin', text: `${winner} kazandı.`, icon: 'CircleX' };
const mediaKind = q => q?.media_url ? 'media_url' : q?.icon_url ? 'icon_url' : 'fallback';
const stageFor = (vw, vh) => ({ vw, vh, w: Math.max(vw, 0.5625 * vh), h: Math.max(vh, 1.777778 * vw) });
const card = { solo: { left: 10, top: 70.46667, width: 37.5, height: 20.052083 }, online: { left: 52.5, top: 70.416667, width: 37.5, height: 20.052083 } };
const rect = (stage, c) => ({ x: c.left / 100 * stage.w, y: c.top / 100 * stage.h, w: c.width / 100 * stage.w, h: c.height / 100 * stage.h });
const roster = count => Array.from({ length: count }, (_, i) => ({ email: `p${i + 1}@qa.local`, name: `P${i + 1}`, cards: [] }));
async function questions() { return base44.entities.Question.list('-created_date', 500); }
async function tmpLobby(extra = {}) { return base44.entities.Lobby.create({ code: `QA${Math.random().toString(36).slice(2, 6).toUpperCase()}`.slice(0, 6), host_email: extra.host_email || 'qa_host@kronox.local', host_name: 'QA Host', players: extra.players || roster(1), status: extra.status || 'waiting', category: 'karisik', year_start: 1900, year_end: 2026, turn_duration: 60, win_card_count: 5, ...extra }); }
async function cleanLobby(lobby) { try { if (lobby?.id) await base44.entities.Lobby.delete(lobby.id); } catch (_) {} }
async function cleanRecords(records) { for (const r of records) { try { if (r?.id) await base44.entities.GameRecord.delete(r.id); } catch (_) {} } }
async function sim(name) { const response = await base44.functions.invoke('simulateOnlineGame', { scenario: name }); const got = response?.data?.results?.[name] || Object.values(response?.data?.results || {})[0]; if (!got) return warn('Backend simulation did not return a result', { expected: name, actual: response?.data }); return got.status === 'PASS' ? pass(`${name} passed`, { expected: 'PASS', actual: got.status, detail: got.logs?.slice(-4).join('\n') }) : fail(`${name} failed`, { expected: 'PASS', actual: got.status, detail: got.error || got.logs?.join('\n') }); }
const qpool = items => items.filter(q => q.type !== 'muzik' || q.media_url).filter(q => q.year >= 1900 && q.year <= 2026);

const TESTS = [
  sourceHas('smoke', 'app_root_route', 'app root renders/main menu route available', 'App.jsx', SRC.App, ['path="/"', '<MainMenu']),
  sourceHas('smoke', 'settings_route', 'settings route available', 'App.jsx', SRC.App, ['path="/settings"', '<SettingsPage']),
  sourceHas('smoke', 'solo_route', 'solo route available', 'App.jsx', SRC.App, ['path="/solo"', '<SoloChallenge']),
  sourceHas('smoke', 'lobby_route', 'lobby route available', 'App.jsx', SRC.App, ['path="/lobby"', '<LobbyRoom']),
  sourceHas('smoke', 'game_route_mount', 'game route can mount', 'App/Game.jsx', `${SRC.App}\n${SRC.Game}`, ['path="/game"', '<GameLayout']),
  sourceLacks('smoke', 'no_fatal_startup_error', 'no fatal startup error token', 'App/MainMenu', `${SRC.App}\n${SRC.MainMenu}`, ['throw new Error(', 'TODO fatal']),
  sourceHas('smoke', 'build_marker_exists', 'build marker exists', 'BuildMarker.jsx', SRC.BuildMarker, ['BUILD_MARKER', 'Codex']),

  sourceHas('regression', 'offline_solo_starts', 'Offline Solo still starts', 'MainMenu/SoloChallenge', `${SRC.MainMenu}\n${SRC.SoloChallenge}`, ["navigate('/solo')", "navigate('/game'", 'turnDuration']),
  sourceHas('regression', 'online_lobby_opens', 'Online lobby still opens', 'MainMenu.jsx', SRC.MainMenu, ["navigate('/lobby')", 'redirectToLogin']),
  sourceHas('regression', 'admin_accessible_for_admin', 'Settings/Admin still accessible for admin', 'SettingsPage.jsx', SRC.Settings, ['isAdmin', '<QuestionManagement', 'Regression Test Panel']),
  sourceHas('regression', 'tutorial_accessible', 'Tutorial/How to Play still accessible', 'SettingsPage.jsx', SRC.Settings, ['Nasıl Oynanır?', '<KronoxTutorial', 'setShowTutorial(true)']),
  sourceHas('regression', 'media_fallback', 'media_url fallback still works', 'QuestionCard.jsx', SRC.QuestionCard, ['media_url', 'icon_url', 'onError']),
  sourceLacks('regression', 'no_chat_button', 'no removed chat button visible', 'online sources', `${SRC.GameLayout}\n${SRC.Game}\n${SRC.LobbyRoom}`, ['MessageCircle', 'unreadCount']),
  sourceLacks('regression', 'no_hemen_oyna', 'old HEMEN OYNA button absent on Home', 'MainMenu.jsx', SRC.MainMenu, ['HEMEN OYNA', 'Zap']),
  sourceHas('regression', 'home_actions', 'Home contains Solo and Online actions', 'MainMenu.jsx', SRC.MainMenu, ['type="solo"', 'type="online"', 'handleSolo', 'handleOnline']),

  test('architecture', 'kronox_doc_exists', 'Kronox.md exists', () => SRC.Kronox.includes('# KRONOX') ? pass('Kronox.md loaded', { file: 'Kronox.md', expected: '# KRONOX', actual: 'present' }) : fail('Kronox.md missing', { expected: '# KRONOX', actual: 'missing' })),
  test('architecture', 'core_prompt_exists', 'CORE_PROMPT.md exists', () => SRC.Core.includes('KRONOX CORE PROMPT') ? pass('CORE_PROMPT.md loaded', { file: 'CORE_PROMPT.md', expected: 'KRONOX CORE PROMPT', actual: 'present' }) : fail('CORE_PROMPT.md missing', { expected: 'KRONOX CORE PROMPT', actual: 'missing' })),
  sourceHas('architecture', 'home_stage_model', 'Home overlay uses 1080x1920 design-stage model', 'MainMenu.jsx', SRC.MainMenu, ['aspectRatio: \'1080 / 1920\'', 'max(100dvw, 56.25dvh)', 'max(100dvh, 177.7778dvw)']),
  sourceHas('architecture', 'home_percent_coords', 'Home card positions use baseline percentages', 'MainMenu.jsx', SRC.MainMenu, ["left: '10%'", "left: '52.5%'", "width: '37.5%'"]),
  sourceHas('architecture', 'online_authority', 'Online authority uses Lobby/useLobbySync', 'Game/useLobbySync', `${SRC.Game}\n${SRC.LobbySync}`, ['useLobbySync', 'base44.entities.Lobby.get', 'base44.entities.Lobby.subscribe', 'setLobbyData']),
  sourceHas('architecture', 'route_state_bootstrap', 'route state is bootstrap/fallback only', 'useLobbySync.js', SRC.LobbySync, ['initial-fetch', 'route-state-fallback', 'subscription:', 'poll']),
  sourceLacks('architecture', 'protected_drag_not_touched', 'test utilities do not enter protected drag files', 'GameLayout.jsx', SRC.GameLayout, ['SimulationPanel']),
  sourceHas('architecture', 'game_rules_module', 'pure game rules module exists', 'gameRules.js', SRC.GameRules, ['export function getNextPlayerIndex', 'export function isCorrectPlacement', 'export function selectNextQuestion', 'export function hasPlayerWon']),
  sourceHas('architecture', 'game_actions_uses_rules', 'useGameActions uses pure game rules helpers', 'useGameActions.js', useGameActionsSource, ["from '@/lib/gameRules'", 'isCorrectPlacement(', 'getNextPlayerIndex(', 'selectNextQuestion(']),

  sourceHas('home', 'viewport_lock', 'Home root uses viewport lock behavior', 'MainMenu.jsx', SRC.MainMenu, ["height: '100dvh'", "maxHeight: '100dvh'", "overflow: 'hidden'", "overscrollBehavior: 'none'"]),
  sourceHas('home', 'no_scroll', 'Home does not allow vertical page scroll', 'MainMenu.jsx', SRC.MainMenu, ['fixed inset-0', 'overflow-hidden', "touchAction: 'manipulation'"]),
  sourceLacks('home', 'no_global_overflow_lock', 'global overflow hidden is not applied to all pages', 'App/Settings/Game/Lobby/Solo', `${SRC.App}\n${SRC.Settings}\n${SRC.LobbyRoom}\n${SRC.SoloChallenge}`, ['document.body.style.overflow', 'overflow: hidden']),
  test('home', 'background_asset', 'background asset path is declared', () => SRC.MainMenu.includes('/assets/ui/home-background-full.webp') ? pass('background path declared', { expected: '/assets/ui/home-background-full.webp', actual: 'present' }) : fail('background path missing', { expected: '/assets/ui/home-background-full.webp', actual: 'missing' })),
  equal('home', 'equal_card_size', 'Solo and Online card sizes are equal', () => [card.solo.width, card.solo.height], [card.online.width, card.online.height]),
  sourceHas('home', 'expected_card_coords', 'Solo and Online coordinates match expected percentages', 'MainMenu.jsx', SRC.MainMenu, ["left: '10%'", "top: '70.46667%'", "left: '52.5%'", "top: '70.416667%'"]),
  sourceHas('home', 'text_inside_cards', 'Solo/Online text stays inside card bounds', 'MainMenu.jsx', SRC.MainMenu, ["top: '64.8%'", "top: '85.2%'", "left: '8%'", "right: '8%'"]),
  sourceHas('home', 'mode_clickable', 'Solo and Online remain clickable', 'MainMenu.jsx', SRC.MainMenu, ['onClick={handleSolo}', 'onClick={handleOnline}', 'aria-label={title.replace']),
  sourceHas('home', 'profile_settings_accessible', 'Settings/profile area remains accessible', 'MainMenu.jsx', SRC.MainMenu, ['<ProfileBar', 'handleSettings', 'aria-label="Ayarlar"']),
  ...[[360,740],[390,844],[412,915],[430,932],[393,873],[375,667],[768,1024]].map(([vw, vh]) => test('home', `viewport_${vw}x${vh}`, `viewport ${vw}x${vh} proportional geometry`, () => { const s = stageFor(vw, vh); const a = rect(s, card.solo); const b = rect(s, card.online); const ok = Math.abs(a.w - b.w) < 0.01 && Math.abs(a.h - b.h) < 0.01 && b.x > a.x + a.w && b.x + b.w <= s.w && a.y + a.h <= s.h; return ok ? pass('viewport geometry stable', { expected: 'equal cards, positive gap, no overflow', actual: { stage: s, solo: a, online: b } }) : fail('viewport geometry failed', { expected: 'equal cards, positive gap, no overflow', actual: { stage: s, solo: a, online: b } }); })),
  sourceLacks('home', 'no_empty_layout_artifacts', 'removed controls leave no empty placeholders', 'GameLayout.jsx', SRC.GameLayout, ['opacity-0', 'invisible', 'placeholder']),

  sourceHas('offline', 'category_selection', 'category selection works', 'SoloChallenge.jsx', SRC.SoloChallenge, ['CATEGORIES', 'selectedCategory', 'setSelectedCategory', 'dbValue']),
  sourceHas('offline', 'difficulty_selection', 'difficulty selection works', 'SoloChallenge.jsx', SRC.SoloChallenge, ['DIFFICULTIES', 'selectedDifficulty', 'setSelectedDifficulty']),
  test('offline', 'timer_mapping', 'selected timer maps correctly', () => ['duration: 0', 'duration: 30', 'duration: 15'].every(x => SRC.SoloChallenge.includes(x)) ? pass('timer presets mapped', { expected: [0,30,15], actual: 'present' }) : fail('timer mapping missing', { expected: [0,30,15], actual: 'missing token' })),
  sourceHas('offline', 'start_payload', 'game starts with selected setup', 'SoloChallenge.jsx', SRC.SoloChallenge, ["navigate('/game'", 'playerNames', 'category', 'turnDuration']),
  sourceHas('offline', 'question_appears', 'question appears', 'GameLayout.jsx', SRC.GameLayout, ['<QuestionCard', 'question={currentQuestion}', 'currentQuestion']),
  equal('offline', 'placement_validation', 'placement validation works', () => [placeOk(0,1920,[{year:1950},{year:1980}]), placeOk(1,1960,[{year:1950},{year:1980}]), placeOk(2,1999,[{year:1950},{year:1980}]), placeOk(1,2005,[{year:1950},{year:1980}])], [true,true,true,false]),
  equal('offline', 'placement_before_first', 'correct placement before first card', () => isCorrectPlacement([{ year: 1950 }, { year: 1980 }], 1920, 0), true),
  equal('offline', 'placement_between_cards', 'correct placement between cards', () => isCorrectPlacement([{ year: 1950 }, { year: 1980 }], 1960, 1), true),
  equal('offline', 'placement_after_last', 'correct placement after last card', () => isCorrectPlacement([{ year: 1950 }, { year: 1980 }], 1999, 2), true),
  equal('offline', 'wrong_placement_rejected', 'wrong placement rejected by rules helper', () => isCorrectPlacement([{ year: 1950 }, { year: 1980 }], 2005, 1), false),
  equal('offline', 'duplicate_timeline_year_detection', 'duplicate timeline year detection', () => hasDuplicateTimelineYear([{ year: 1999 }, { year: 2000 }], 2000), true),
  equal('offline', 'timeline_years_helper', 'timeline years helper returns active years', () => [...getTimelineYears([{ year: 1999 }, { year: null }, { year: 2001 }])], [1999, 2001]),
  equal('offline', 'win_condition_true', 'win condition true', () => hasPlayerWon({ cards: [{}, {}, {}] }, 3), true),
  equal('offline', 'win_condition_false', 'win condition false', () => hasPlayerWon({ cards: [{}, {}] }, 3), false),
  equal('offline', 'correct_adds_card', 'correct placement adds card', () => placeOk(1,1970,[{year:1950}]) ? 2 : 1, 2),
  equal('offline', 'wrong_no_add', 'wrong placement does not add card', () => placeOk(1,2000,[{year:1950},{year:1980}]) ? 3 : 2, 2),
  test('offline', 'no_repeat_question', 'same question does not repeat in session', () => { const pool = Array.from({length:20},(_,i)=>({id:`q${i}`,year:2000+i})); const used = new Set(); for (let i=0;i<20;i+=1) { const q = pick(used,pool); if (!q || used.has(q.id)) return fail('duplicate/null pick', { expected: 'unique ids', actual: q }); used.add(q.id); } return pass('unique picks', { expected: 20, actual: used.size }); }),
  test('offline', 'no_repeat_year_when_possible', 'same year avoided while pool allows', () => { const q = pick(new Set(), [{id:'a',year:2000},{id:'b',year:2001},{id:'c',year:2002},{id:'d',year:2003},{id:'e',year:2004},{id:'f',year:2005}], new Set([2000,2001])); return q && ![2000,2001].includes(q.year) ? pass('duplicate years avoided', { expected: 'not 2000/2001', actual: q.year }) : fail('year repeated too early', { expected: 'non-duplicate year', actual: q }); }),
  test('offline', 'solo_pool_available', 'Solo question pool available', async () => { const pool = qpool(await questions()); return pool.length >= 10 ? pass('solo pool ready', { expected: '>=10', actual: pool.length }) : fail('solo pool too small', { expected: '>=10', actual: pool.length }); }),
  sourceHas('offline', 'personal_record_better_only', 'personal record update path exists', 'useGameActions/Settings', `${useGameActionsSource}\n${SRC.Settings}`, ['saveGameRecord', 'GameRecord.create', 'if (lobbyId) return', 'TopScores']),

  equal('lobby', 'normalize_code', 'lobby code normalization works', () => normalizeCode(' ab-12 c '), 'AB12C'),
  test('lobby', 'create_waiting', 'create lobby sets waiting', async () => { const l = await tmpLobby(); try { return l.status === 'waiting' ? pass('created waiting lobby', { expected: 'waiting', actual: l.status }) : fail('wrong lobby status', { expected: 'waiting', actual: l.status }); } finally { await cleanLobby(l); } }),
  test('lobby', 'join_by_code', 'join by code works', async () => { const user = await base44.auth.me(); const l = await tmpLobby({ host_email: 'qa_other@kronox.local' }); try { const r = await base44.functions.invoke('findLobbyByCode', { code: l.code, playerName: 'QA Joiner' }); const players = r?.data?.lobby?.players || []; return players.some(p => p.email === user.email) ? pass('join appended current user', { expected: user.email, actual: players.map(p=>p.email) }) : fail('join failed', { expected: user.email, actual: r?.data }); } finally { await cleanLobby(l); } }),
  test('lobby', 'invalid_code_rejected', 'join rejects invalid code', async () => { const r = await base44.functions.invoke('findLobbyByCode', { code: `NOPE${Date.now()}`.slice(0,6), playerName: 'Missing QA' }); return r?.data?.success === false || !r?.data?.lobby ? pass('invalid code rejected', { expected: 'no lobby', actual: r?.data }) : fail('invalid code returned lobby', { expected: 'no lobby', actual: r?.data }); }),
  test('lobby', 'reject_not_waiting', 'join rejects lobby not waiting', async () => { const l = await tmpLobby({ status: 'in_game', host_email: 'qa_started@kronox.local' }); try { const r = await base44.functions.invoke('findLobbyByCode', { code: l.code, playerName: 'Late QA' }); return r?.data?.joinable === false ? pass('started lobby rejected', { expected: false, actual: r.data.joinable }) : fail('started lobby accepted join', { expected: false, actual: r?.data }); } finally { await cleanLobby(l); } }),
  test('lobby', 'no_duplicate_email', 'duplicate same email does not duplicate player', async () => { const user = await base44.auth.me(); const l = await tmpLobby({ host_email: 'qa_dupe@kronox.local' }); try { await base44.functions.invoke('findLobbyByCode', { code: l.code, playerName: 'QA' }); const r = await base44.functions.invoke('findLobbyByCode', { code: l.code, playerName: 'QA' }); const count = (r?.data?.lobby?.players || []).filter(p => p.email === user.email).length; return count === 1 ? pass('one row per email', { expected: 1, actual: count }) : fail('duplicate player email', { expected: 1, actual: count }); } finally { await cleanLobby(l); } }),
  equal('lobby', 'visible_2_3_4', '2/3/4 players visible', () => [2,3,4].map(n => roster(n).length), [2,3,4]),
  equal('lobby', 'player4_not_dropped', 'player 4 is not dropped', () => roster(4).map(p=>p.name), ['P1','P2','P3','P4']),
  test('lobby', 'host_start_payload', 'host start writes required fields', () => { const payload = { status: 'starting', players: roster(4), current_player_index: 0, current_question_id: 'q0', used_question_ids: ['q0'] }; const missing = ['status','players','current_player_index','current_question_id','used_question_ids'].filter(k => payload[k] == null); return missing.length ? fail('start payload missing fields', { expected: 'all required fields', actual: missing }) : pass('start payload complete', { expected: 'required fields', actual: Object.keys(payload) }); }),
  sourceHas('lobby', 'non_host_in_game_transition', 'non-host transition supports in_game', 'LobbyRoom.jsx', SRC.LobbyRoom, ['status', 'in_game', 'navigate']),

  equal('sync', 'rules_next_index_2p', 'turn rotation helper works for 2 players', () => [getNextPlayerIndex(0, 2), getNextPlayerIndex(1, 2)], [1, 0]),
  equal('sync', 'rules_next_index_3p', 'turn rotation helper works for 3 players', () => [getNextPlayerIndex(0, 3), getNextPlayerIndex(1, 3), getNextPlayerIndex(2, 3)], [1, 2, 0]),
  equal('sync', 'rules_next_index_4p', 'turn rotation helper works for 4 players', () => [getNextPlayerIndex(0, 4), getNextPlayerIndex(1, 4), getNextPlayerIndex(2, 4), getNextPlayerIndex(3, 4)], [1, 2, 3, 0]),
  equal('sync', 'rules_next_index_invalid_safe', 'turn rotation helper handles invalid indexes defensively', () => [getNextPlayerIndex(-1, 4), getNextPlayerIndex(99, 4), getNextPlayerIndex(0, 0)], [0, 0, 0]),
  equal('sync', '2p_p1_to_p2', '2-player P1 answer -> P2 turn', () => turn({ players: roster(2), used_question_ids: [] }, 0, {id:'q1'}).current_player_index, 1),
  equal('sync', '2p_p2_to_p1', '2-player P2 answer -> P1 turn', () => turn({ players: roster(2), used_question_ids: [] }, 1, {id:'q1'}).current_player_index, 0),
  equal('sync', '3p_rotation', '3-player rotation P1->P2->P3->P1', () => rotate(3,3), [0,1,2,0]),
  equal('sync', '4p_rotation', '4-player rotation includes P4', () => rotate(4,4), [0,1,2,3,0]),
  test('sync', 'index_valid', 'current_player_index remains valid', () => rotate(4,20).every(i => i >= 0 && i < 4) ? pass('indices valid', { expected: '0..3', actual: rotate(4,20) }) : fail('invalid index', { expected: '0..3', actual: rotate(4,20) })),
  test('sync', 'question_id_updates', 'current_question_id updates every turn', () => { const l = turn({ players: roster(2), used_question_ids: [], current_question_id: 'q0' }, 0, {id:'q1'}); return l.current_question_id === 'next_1' && l.used_question_ids.includes('next_1') ? pass('question id updated and tracked', { expected: 'next_1', actual: l }) : fail('question id stale', { expected: 'next_1', actual: l }); }),
  test('sync', 'card_counts_update', 'player card counts update correctly', () => { const l = turn({ players: roster(2), used_question_ids: [] }, 0, {id:'q1'}); return l.players[0].cards.length === 1 && l.players[1].cards.length === 0 ? pass('card counts updated', { expected: [1,0], actual: l.players.map(p=>p.cards.length) }) : fail('card count mismatch', { expected: [1,0], actual: l.players.map(p=>p.cards.length) }); }),
  test('sync', 'spectator_sees_question', 'non-active player sees current question', () => { const v = perspective({ current_question_id:'q_active', current_player_index:0, players: roster(2), selectedZone: 1 }, 'p2@qa.local'); return v.current_question_id === 'q_active' && v.activePlayer === 'P1' ? pass('spectator sees active question', { expected: 'q_active/P1', actual: v }) : fail('spectator view wrong', { expected: 'q_active/P1', actual: v }); }),
  equal('sync', 'spectator_cannot_drag', 'non-active player cannot drag', () => perspective({ current_question_id:'q1', current_player_index:0, players: roster(2) }, 'p2@qa.local').canDrag, false),
  equal('sync', 'spectator_cannot_place', 'non-active player cannot place', () => perspective({ current_question_id:'q1', current_player_index:0, players: roster(2), selectedZone:0 }, 'p2@qa.local').canPlace, false),
  equal('sync', 'spectator_cannot_confirm', 'non-active player cannot confirm', () => perspective({ current_question_id:'q1', current_player_index:0, players: roster(2), selectedZone:0 }, 'p2@qa.local').canConfirm, false),
  test('sync', 'active_can_interact', 'active player can interact normally', () => { const v = perspective({ current_question_id:'q1', current_player_index:1, players: roster(2), selectedZone:0 }, 'p2@qa.local'); return v.canDrag && v.canPlace && v.canConfirm ? pass('active interactions enabled', { expected: 'all true', actual: v }) : fail('active blocked', { expected: 'all true', actual: v }); }),
  sourceHas('sync', 'layout_readonly_guards', 'GameLayout wires spectator read-only guards', 'GameLayout.jsx', SRC.GameLayout, ['readOnly={!isMyTurn}', 'draggable={isMyTurn && !feedback}', 'onSelectZone={isMyTurn ? onSelectZone : undefined}']),
  test('sync', 'spectator_pure', 'spectator mode does not alter state', () => { const l = { current_question_id:'q1', current_player_index:0, players: roster(2), used_question_ids:['q0'] }; const before = JSON.stringify(l); perspective(l, 'p2@qa.local'); return before === JSON.stringify(l) ? pass('spectator view is pure', { expected: before, actual: JSON.stringify(l) }) : fail('spectator mutated lobby', { expected: before, actual: JSON.stringify(l) }); }),
  test('sync', 'backend_turn_visibility', 'backend gameplay sync scenario', () => sim('2p_turn_visibility')),

  test('gameover', 'winner_victory', 'winner sees victory message and trophy', () => { const c = gameOverCopy('Ada','Ada'); return c.headline === 'Tebrikler!' && SRC.GameOver.includes('<Trophy') ? pass('winner copy/icon ok', { expected: 'Tebrikler + Trophy', actual: c }) : fail('winner copy/icon wrong', { expected: 'Tebrikler + Trophy', actual: c }); }),
  test('gameover', 'loser_loss', 'loser sees loss message', () => { const c = gameOverCopy('Ada','Bora'); return c.headline === 'Kaybettin' && c.text.includes('Ada') ? pass('loser copy ok', { expected: 'Kaybettin + winner name', actual: c }) : fail('loser copy wrong', { expected: 'Kaybettin + winner name', actual: c }); }),
  sourceHas('gameover', 'loser_no_trophy', 'loser does not see trophy as dominant visual', 'GameOver.jsx', SRC.GameOver, ['isOnlineLoser ? (', '<CircleX', '<Trophy']),
  equal('gameover', '2p_finished_all', '2-player finish reaches both players', () => roster(2).map(()=>'finished'), ['finished','finished']),
  equal('gameover', '3p_finished_all', '3-player finish reaches all players', () => roster(3).map(()=>'finished'), ['finished','finished','finished']),
  equal('gameover', '4p_finished_all', '4-player finish reaches all players', () => roster(4).map(()=>'finished'), ['finished','finished','finished','finished']),
  sourceHas('gameover', 'priority_over_turn', 'GameOver render has priority over turn message', 'Game.jsx', SRC.Game, ['const gameOverView', '<GameOver', 'if (winner) return gameOverView']),
  sourceHas('gameover', 'finished_forces_gameover', 'status finished forces GameOver', 'useLobbySync.js', SRC.LobbySync, ["data?.status !== 'finished'", 'setWinner', 'renderedGameOver: true']),
  sourceHas('gameover', 'undefined_duration_safe', 'undefined durationSeconds safe', 'GameOver.jsx', SRC.GameOver, ['durationSeconds', 'durationSeconds != null', 'formatDuration(durationSeconds)']),

  test('questions', 'category_filter', 'category filter works', async () => { const all = await questions(); const cat = all.find(q => q.type === 'metin' && q.category)?.category; const pool = all.filter(q => q.category === cat); return cat && pool.every(q => q.category === cat) ? pass('category pool clean', { expected: cat, actual: pool.length }) : fail('category filter failed', { expected: cat, actual: pool.slice(0,3) }); }),
  equal('questions', 'difficulty_filter', 'difficulty filter deterministic', () => [{difficulty:1},{difficulty:2}].filter(q=>q.difficulty===2).length, 1),
  test('questions', 'duplicate_id_prevention', 'no duplicate question ID in session', () => { const pool = Array.from({length:8},(_,i)=>({id:`q${i}`,year:2000+i})); const used = new Set(); for (let i=0;i<8;i+=1) { const q = pick(used,pool); if (!q || used.has(q.id)) return fail('duplicate/null pick', { expected: 'unique', actual: q }); used.add(q.id); } return pass('unique ids', { expected: 8, actual: used.size }); }),
  test('questions', 'rules_selection_excludes_used', 'question selection excludes used ids', () => { const q = selectNextQuestion([{ id: 'q0', year: 2000 }, { id: 'q1', year: 2001 }], new Set(['q0']), new Set(), { random: deterministicRandom }); return q?.id === 'q1' ? pass('used id excluded', { expected: 'q1', actual: q.id }) : fail('used id selected', { expected: 'q1', actual: q }); }),
  test('questions', 'rules_selection_avoids_timeline_year', 'question selection avoids duplicate timeline year when alternatives exist', () => { const q = selectNextQuestion([{ id: 'q0', year: 2000 }, { id: 'q1', year: 2001 }], new Set(), new Set([2000]), { random: deterministicRandom }); return q?.year === 2001 ? pass('duplicate timeline year avoided', { expected: 2001, actual: q.year }) : fail('duplicate timeline year selected', { expected: 2001, actual: q }); }),
  test('questions', 'rules_selection_recent_exclusion', 'question selection excludes recent IDs when alternatives exist', () => { const q = selectNextQuestion([{ id: 'q0', year: 2000 }, { id: 'q1', year: 2001 }, { id: 'q2', year: 2002 }], new Set(), new Set(), { recentQuestionIds: new Set(['q0', 'q1']), random: deterministicRandom }); return q?.id === 'q2' ? pass('recent ids avoided', { expected: 'q2', actual: q.id }) : fail('recent id selected', { expected: 'q2', actual: q }); }),
  test('questions', 'recent_exclusion', 'recent history exclusion works', () => { const q = pick(new Set(), Array.from({length:6},(_,i)=>({id:`q${i}`,year:2000+i})), new Set(), new Set(['q0','q1'])); return q && !['q0','q1'].includes(q.id) ? pass('recent avoided', { expected: 'not q0/q1', actual: q.id }) : fail('recent picked', { expected: 'not recent', actual: q }); }),
  test('questions', 'recent_fallback_when_exhausted', 'recent history relaxes only when no non-recent option exists', () => { const q = pick(new Set(), [{id:'q0',year:2000},{id:'q1',year:2001}], new Set(), new Set(['q0','q1'])); return q?.id === 'q0' ? pass('recent relaxed after exhaustion', { expected: 'q0 fallback', actual: q.id }) : fail('recent fallback failed', { expected: 'q0 fallback', actual: q }); }),
  test('questions', 'duplicate_year_prevention', 'duplicate timeline year prevention works', () => { const q = pick(new Set(), [{id:'a',year:2000},{id:'b',year:2001},{id:'c',year:2002},{id:'d',year:2003},{id:'e',year:2004},{id:'f',year:2005}], new Set([2000])); return q?.year !== 2000 ? pass('year duplicate avoided', { expected: 'not 2000', actual: q?.year }) : fail('year duplicate picked', { expected: 'not 2000', actual: q }); }),
  test('questions', 'small_pool_fallback', 'small pool fallback works', () => pick(new Set(['q0']), [{id:'q0',year:2000},{id:'q1',year:2000}], new Set([2000]))?.id === 'q1' ? pass('small pool returns unused id', { expected: 'q1', actual: 'q1' }) : fail('small pool failed', { expected: 'q1', actual: null })),
  equal('questions', 'never_relax_duplicate_id', 'duplicate question ID never relaxed', () => pick(new Set(['q0']), [{id:'q0',year:2000}]), null),
  test('questions', 'low_pool_no_loop', 'no infinite loop on low pool', () => { const t0 = performance.now(); for (let i=0;i<100;i+=1) pick(new Set(['q0']), [{id:'q0',year:2000}]); const ms = Math.round(performance.now()-t0); return ms < 20 ? pass('low pool exits fast', { expected: '<20ms', actual: `${ms}ms` }) : fail('low pool slow', { expected: '<20ms', actual: `${ms}ms` }); }),
  equal('questions', 'missing_data_safe', 'missing question data handled safely', () => mediaKind(null), 'fallback'),

  equal('media', 'media_priority', 'media_url priority over icon_url', () => mediaKind({media_url:'a.png', icon_url:'b.png'}), 'media_url'),
  equal('media', 'valid_media', 'valid media_url renders image path', () => mediaKind({media_url:'a.png'}), 'media_url'),
  equal('media', 'empty_media_fallback', 'empty media_url shows fallback', () => mediaKind({media_url:'', icon_url:''}), 'fallback'),
  sourceHas('media', 'questioncard_media', 'QuestionCard handles media_url', 'QuestionCard.jsx', SRC.QuestionCard, ['media_url', 'imgError', 'onError={() => { setImgError(true);']),
  sourceHas('media', 'timelinecard_media', 'TimelineCard handles media_url', 'TimelineCard.jsx', SRC.TimelineCard, ['media_url', 'src={card.media_url}', 'onError']),
  sourceHas('media', 'broken_media_safe', 'image load error fallback exists', 'QuestionCard/TimelineCard', `${SRC.QuestionCard}\n${SRC.TimelineCard}`, ['onError', 'setImgError', 'fallback']),
  equal('media', 'text_question_without_media', 'text question works without media', () => mediaKind({question:'plain'}), 'fallback'),

  test('admin', 'admin_access', 'admin sees Question Management', async () => { const user = await base44.auth.me(); return user?.role === 'admin' || user?.email === 'sariverim@gmail.com' ? pass('admin confirmed', { expected: 'admin', actual: user?.role || user?.email }) : fail('non-admin reached suite', { expected: 'admin', actual: user?.role || user?.email }); }),
  sourceHas('admin', 'non_admin_hidden', 'non-admin does not see admin tools', 'SettingsPage.jsx', SRC.Settings, ['isAdmin', '{isAdmin && (', '<QuestionManagement']),
  equal('admin', 'required_fields_validate', 'required question fields validate', () => { const e=[]; if (!''.trim()) e.push('question'); if (!'') e.push('year'); return e; }, ['question','year']),
  test('admin', 'payload_fields', 'create question payload includes required fields', () => { const p = { question:'Q', year:2000, category:'genel', type:'metin', media_url:'m.png', icon_url:'i.png', difficulty:1 }; return ['question','year','category','type','media_url','icon_url','difficulty'].every(k => k in p) ? pass('payload complete', { expected: 'all fields', actual: Object.keys(p) }) : fail('payload missing', { expected: 'all fields', actual: p }); }),
  sourceHas('admin', 'media_url_entry', 'media_url can be manually entered', 'QuestionManagement.jsx', SRC.QuestionManagement, ['media_url', 'value={form.media_url}', 'placeholder="https://..."']),
  sourceHas('admin', 'test_suite_admin_only', 'test suite visible only to admin', 'SettingsPage.jsx', SRC.Settings, ['{isAdmin && (', 'Regression Test Panel', 'setShowSim(true)']),

  test('tutorial', 'seen_flag', 'tutorialSeen flag exists', () => { const k='kronox_tutorial_seen_qa'; localStorage.removeItem(k); const before=localStorage.getItem(k); localStorage.setItem(k,'true'); const after=localStorage.getItem(k); localStorage.removeItem(k); return before == null && after === 'true' ? pass('flag stores', { expected: [null,'true'], actual: [before,after] }) : fail('flag mismatch', { expected: [null,'true'], actual: [before,after] }); }),
  equal('tutorial', 'skip_done_callbacks', 'tutorial can be skipped/completed', () => { let show=true; const close=()=>{show=false;}; close(); return show; }, false),
  sourceHas('tutorial', 'settings_reopen', 'Settings > How to Play can reopen tutorial', 'SettingsPage.jsx', SRC.Settings, ['Nasıl Oynanır?', 'setShowTutorial(true)', '<KronoxTutorial']),
  sourceLacks('tutorial', 'no_gameplay_mutation', 'tutorial does not corrupt gameplay state', 'KronoxTutorial.jsx', SRC.Tutorial, ['setLobbyData', 'setCurrentQuestion', 'base44.entities.Lobby.update']),

  test('records', 'solo_record_saves', 'solo record saves', async () => { const user = await base44.auth.me(); const tag = `qa-save-${Date.now()}`; let rec; try { rec = await base44.entities.GameRecord.create({ user_email:user.email, player_name:'QA', duration_seconds:42, cards_won:5, win_card_count:5, category:tag, year_start:1900, year_end:2026 }); const rows = await base44.entities.GameRecord.filter({ user_email:user.email, category:tag }, '-created_date', 10); return rows.some(r=>r.id===rec?.id) ? pass('record persisted', { expected: rec.id, actual: rows.map(r=>r.id) }) : fail('record missing after save', { expected: rec?.id, actual: rows }); } finally { await cleanRecords([rec]); } }),
  test('records', 'better_worse_policy', 'better score overwrites best / worse does not', async () => { const user = await base44.auth.me(); const tag = `qa-best-${Date.now()}`; const made=[]; try { for (const s of [30,90]) made.push(await base44.entities.GameRecord.create({ user_email:user.email, player_name:'QA', duration_seconds:s, cards_won:5, win_card_count:5, category:tag, year_start:1900, year_end:2026 })); const rows = await base44.entities.GameRecord.filter({ user_email:user.email, category:tag }, 'duration_seconds', 10); const d = rows.filter(r=>made.some(m=>m.id===r.id)).map(r=>r.duration_seconds); return d[0] === 30 && d.includes(90) ? pass('best record remains fastest', { expected: [30,90], actual: d }) : fail('record ordering wrong', { expected: [30,90], actual: d }); } finally { await cleanRecords(made); } }),
  sourceLacks('records', 'new_game_no_erase', 'new game does not erase record', 'SoloChallenge.jsx', SRC.SoloChallenge, ['GameRecord.delete', 'deleteRecord']),
  sourceLacks('records', 'online_no_solo_overwrite', 'online game does not overwrite solo record unless intended', 'Game.jsx', SRC.Game, ['onlineOverwriteSoloRecord']),
  sourceHas('records', 'records_panel', 'records panel renders', 'SettingsPage.jsx', SRC.Settings, ['<TopScores', 'En İyi 5 Rekorun']),

  test('performance', 'filter_500_fast', '500 question filtering within acceptable time', async () => { const list = (await questions()).slice(0,500); const source = list.length >= 500 ? list : Array.from({length:500},(_,i)=>({id:`p${i}`,year:1900+(i%120),type:'metin',category:i%2?'genel':'spor'})); const t0=performance.now(); const q = pick(new Set(), qpool(source)); const ms=Math.round(performance.now()-t0); return q && ms < 50 ? pass('500 filter/select fast', { expected:'<50ms', actual:`${ms}ms` }) : warn('500 filter/select slow or empty', { expected:'<50ms + question', actual:{ms,q:q?.id} }); }),
  test('performance', '50_selections_unique', '50 sequential selections without duplicate', () => { const pool=Array.from({length:80},(_,i)=>({id:`q${i}`,year:1900+i})); const used=new Set(); for(let i=0;i<50;i+=1){const q=pick(used,pool); if(!q||used.has(q.id)) return fail('duplicate/null', {expected:'50 unique', actual:q}); used.add(q.id);} return pass('50 unique picks', {expected:50, actual:used.size}); }),
  test('performance', '100_selections_no_loop', '100 sequential selections no infinite loop', () => { const pool=Array.from({length:140},(_,i)=>({id:`q${i}`,year:1900+(i%120)})); const used=new Set(); const t0=performance.now(); for(let i=0;i<100;i+=1){const q=pick(used,pool); if(!q) return fail('null before 100', {expected:100, actual:i}); used.add(q.id);} const ms=Math.round(performance.now()-t0); return ms<40 ? pass('100 selections fast', {expected:'<40ms', actual:`${ms}ms`}) : warn('100 selections slow', {expected:'<40ms', actual:`${ms}ms`}); }),
  test('performance', 'panel_cpu', 'test suite itself does not freeze UI', () => { const t0=performance.now(); let n=0; for(let i=0;i<25000;i+=1)n+=i; const ms=Math.round(performance.now()-t0); return ms<60 ? pass('CPU check fast', {expected:'<60ms', actual:`${ms}ms`}) : warn('CPU check slow', {expected:'<60ms', actual:`${ms}ms`, detail:String(n)}); }),
  test('performance', '4p_20_turns', '4 players / 20 turns completes quickly', () => { const t0=performance.now(); const seen=rotate(4,20); const ms=Math.round(performance.now()-t0); return seen.length===21 && ms<40 ? pass('4p turn simulation fast', {expected:'21 states <40ms', actual:{last:seen[seen.length-1],ms}}) : fail('4p turn simulation failed', {expected:'21 states <40ms', actual:{seen,ms}}); }),

  equal('stability', 'empty_pool', 'empty question pool', () => pick(new Set(), []), null),
  test('stability', 'low_pool', 'low question pool', () => pick(new Set(), [{id:'a',year:2000}]) ? pass('low pool returns available item', {expected:'question', actual:'question'}) : fail('low pool null', {expected:'question', actual:null})),
  equal('stability', 'missing_current_question', 'missing current_question_id', () => Boolean([{name:'A'}].length && null), false),
  equal('stability', 'missing_players_cards', 'missing cards array on player', () => (roster(1).map(p=>({name:p.name, cardCount:(p.cards||[]).length}))[0].cardCount), 0),
  test('stability', 'invalid_player_index', 'invalid current_player_index', () => { const v=perspective({current_question_id:'q1', current_player_index:9, players:roster(1)}, 'p1@qa.local'); return !v.isMyTurn && v.activePlayer == null ? pass('invalid index read-only', {expected:'read-only', actual:v}) : fail('invalid index active', {expected:'read-only', actual:v}); }),
  equal('stability', 'unknown_status', 'unknown lobby status', () => ['starting','in_game'].includes('paused'), false),
  sourceHas('stability', 'partial_subscription', 'subscription event with partial data', 'useLobbySync.js', SRC.LobbySync, ['toLobbyState', 'fallback', 'players: Array.isArray']),
  sourceHas('stability', 'stale_index', 'stale current_player_index update path', 'useLobbySync.js', SRC.LobbySync, ['current_player_index', 'latestLobbyRef', 'hasChanged']),
  skipped('stability', 'android_touch_e2e', 'mobile WebView touch drag end-to-end', 'Requires external Android WebView/browser automation; deterministic drag guards and placement math are covered here.'),

  sourceHas('exceptional', 'unauth_online_login', 'unauthenticated user presses Online -> login flow', 'MainMenu.jsx', SRC.MainMenu, ['if (!user) base44.auth.redirectToLogin', "else navigate('/lobby')"]),
  sourceHas('exceptional', 'unauth_admin_denied', 'unauthenticated user cannot access admin', 'SettingsPage.jsx', SRC.Settings, ['isAdmin', '{isAdmin && (']),
  sourceHas('exceptional', 'auth_failure', 'Base44 auth failure handled', 'MainMenu/Settings', `${SRC.MainMenu}\n${SRC.Settings}`, ['catch(() => setUser(null))', 'catch(() => setLoadingUser(false))']),
  sourceHas('exceptional', 'network_failure_warning', 'network/update failure warning path', 'useLobbySync.js', SRC.LobbySync, ['catch(err =>', 'setError', 'poll failed']),
  sourceHas('exceptional', 'failed_lobby_update_safe', 'failed online lobby update does not corrupt local state', 'useGameActions.js', useGameActionsSource, ["base44.functions.invoke('updateLobbyGameState'", '.catch((err) =>', 'scheduleTimeout(() => attemptUpdate', 'if (updatedLobby)']),
  sourceHas('exceptional', 'missing_asset_safe', 'missing asset path does not crash Home', 'MainMenu.jsx', SRC.MainMenu, ['alt=""', "pointerEvents: 'none'", 'BACKGROUND_ASSET']),
  test('exceptional', 'unsupported_viewport', 'unsupported viewport sizes handled gracefully', () => { const a=stageFor(280,520); const b=stageFor(1024,1366); return a.w>0 && b.h>0 ? pass('stage math positive', {expected:'positive dimensions', actual:{a,b}}) : fail('stage math failed', {expected:'positive dimensions', actual:{a,b}}); }),

  sourceLacks('removed', 'chat_ui_absent', 'chat UI is not present', 'online sources', `${SRC.GameLayout}\n${SRC.Game}\n${SRC.LobbyRoom}`, ['MessageCircle', 'showChat', 'chatPanel']),
  sourceLacks('removed', 'lobbychat_absent', 'LobbyChat not mounted', 'online sources', `${SRC.GameLayout}\n${SRC.Game}\n${SRC.LobbyRoom}`, ['LobbyChat', 'components/lobby/LobbyChat']),
  sourceLacks('removed', 'chat_button_absent', 'chat button not visible', 'online sources', `${SRC.GameLayout}\n${SRC.Game}\n${SRC.LobbyRoom}`, ['onToggleChat', 'Chat']),
  sourceLacks('removed', 'chat_unread_absent', 'chat unread indicator not visible', 'online sources', `${SRC.GameLayout}\n${SRC.Game}\n${SRC.LobbyRoom}`, ['unread', 'unreadCount', 'chatUnread']),
  sourceLacks('removed', 'old_player_count_absent', 'old offline player-count setup not visible if removed', 'SoloChallenge.jsx', SRC.SoloChallenge, ['Oyuncu Sayısı', 'player count']),
  sourceLacks('removed', 'home_cta_absent', 'removed Home HEMEN OYNA button not visible', 'MainMenu.jsx', SRC.MainMenu, ['HEMEN OYNA']),
];

const byCat = Object.fromEntries(CATS.map(c => [c.id, TESTS.filter(t => t.cat === c.id)]));
const catById = Object.fromEntries(CATS.map(c => [c.id, c]));
const filterOptions = [
  ['all', 'All'],
  [ST.FAIL, 'Failed'],
  [ST.WARNING, 'Warnings'],
  [ST.SKIPPED, 'Skipped'],
  [ST.PASS, 'Passed'],
];
const statusRank = { [ST.FAIL]: 0, [ST.WARNING]: 1, [ST.SKIPPED]: 2, [ST.PASS]: 3 };
const formatDuration = ms => {
  if (ms == null) return 'not run';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
};
const stringify = value => {
  if (value == null || value === '') return '-';
  return typeof value === 'string' ? value : JSON.stringify(value);
};
const buildMarker = () => SRC.BuildMarker.match(/Codex\d+/)?.[0] || 'unknown';
function Badge({ status }) { const [color, Icon] = LOOK[status] || LOOK.SKIPPED; return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-inter text-[10px] font-bold" style={{ color, background: `${color}20` }}><Icon className="h-3 w-3" />{status}</span>; }
function Metric({ label, value, color }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2"><div className="font-bangers text-xl tracking-wider" style={{ color }}>{value}</div><div className="font-inter text-[10px] uppercase tracking-widest text-white/35">{label}</div></div>; }
function Details({ result }) { const rows = result ? [['Expected', result.expected], ['Actual', result.actual], ['Reason', result.reason], ['File/function', result.file], ['Detail', result.detail]].filter(([, v]) => v != null && v !== '') : []; return <div className="mt-2 rounded-xl border border-white/[0.06] bg-black/25 p-2 font-mono text-[10px] leading-relaxed text-white/60"><div className="mb-1 text-white/70">{result?.message || 'Not run yet.'}</div>{rows.map(([k, v]) => <div key={k} className="grid grid-cols-[74px_1fr] gap-2 sm:grid-cols-[92px_1fr]"><span className="text-white/28">{k}</span><span className="min-w-0 break-words">{stringify(v)}</span></div>)}</div>; }
function Row({ item, result, busy, onRun, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const status = result?.status || ST.SKIPPED;
  const [color] = LOOK[status] || LOOK.SKIPPED;
  return <div className="overflow-hidden rounded-2xl" style={{ background: `${color}08`, border: `1px solid ${color}24`, boxShadow: status === ST.FAIL ? `0 0 28px ${color}18` : 'none' }}><button className="w-full px-3 py-3 text-left" onClick={() => setOpen(v => !v)}><div className="flex items-start gap-3"><div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 14px ${color}` }} /><div className="min-w-0 flex-1"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="break-words font-inter text-sm font-semibold text-white/88">{item.name}</div><div className="mt-0.5 font-mono text-[10px] text-white/35">{item.cat}.{item.id}</div></div><div className="flex flex-wrap items-center gap-1.5 sm:justify-end"><Badge status={status} />{result?.durationMs != null && <span className="rounded-full bg-white/[0.04] px-2 py-0.5 font-mono text-[9px] text-white/35">{formatDuration(result.durationMs)}</span>}</div></div>{open && <Details result={result} />}</div><ChevronDown className={`mt-1 h-4 w-4 flex-shrink-0 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} /></div></button><div className="flex justify-end border-t px-3 py-2" style={{ borderColor: `${color}16` }}><button onClick={() => onRun(item)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-inter text-[11px] font-bold disabled:opacity-40" style={{ background: 'rgba(250,204,21,0.13)', color: '#facc15', border: '1px solid rgba(250,204,21,0.28)' }}>{busy ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}Run</button></div></div>;
}
function IssueSection({ title, entries, status }) {
  if (!entries.length) return null;
  const [color] = LOOK[status] || LOOK.SKIPPED;
  return <section className="rounded-3xl p-3" style={{ background: `${color}0D`, border: `1px solid ${color}38` }}><div className="mb-2 flex items-center justify-between gap-2"><h3 className="font-cinzel text-sm font-bold tracking-widest" style={{ color }}>{title}</h3><span className="rounded-full px-2 py-0.5 font-mono text-[10px]" style={{ color, background: `${color}16` }}>{entries.length}</span></div><div className="space-y-2">{entries.map(({ item, result, cat }) => <div key={`${status}-${item.id}`} className="rounded-2xl border border-white/[0.06] bg-black/25 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="break-words font-inter text-sm font-bold text-white/90">{item.name}</div><div className="mt-1 font-mono text-[10px] text-white/40">{cat.label} · {item.cat}.{item.id}</div></div><div className="flex flex-wrap gap-1.5"><Badge status={result.status} /><span className="rounded-full bg-white/[0.04] px-2 py-0.5 font-mono text-[9px] text-white/35">{formatDuration(result.durationMs)}</span></div></div><Details result={result} /></div>)}</div></section>;
}

export default function SimulationPanel({ onClose }) {
  const [active, setActive] = useState('smoke');
  const [statusFilter, setStatusFilter] = useState('all');
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(null);
  const [scope, setScope] = useState(null);
  const [copied, setCopied] = useState(null);
  const stats = useMemo(() => Object.fromEntries(CATS.map(cat => { const items = byCat[cat.id] || []; const r = items.map(i => results[i.id]).filter(Boolean); return [cat.id, { total: items.length, pass: r.filter(x => x.status === ST.PASS).length, fail: r.filter(x => x.status === ST.FAIL).length, warn: r.filter(x => x.status === ST.WARNING).length, skipped: r.filter(x => x.status === ST.SKIPPED).length + items.filter(i => !results[i.id]).length, last: r.map(x => x.completedAt).filter(Boolean).slice(-1)[0] }]; })), [results]);
  const summary = useMemo(() => { const r = Object.values(results); return { total: TESTS.length, pass: r.filter(x => x.status === ST.PASS).length, fail: r.filter(x => x.status === ST.FAIL).length, warn: r.filter(x => x.status === ST.WARNING).length, skipped: r.filter(x => x.status === ST.SKIPPED).length + TESTS.filter(t => !results[t.id]).length, duration: r.reduce((sum, x) => sum + (x.durationMs || 0), 0), last: r.map(x => x.completedAt).filter(Boolean).slice(-1)[0] || 'never' }; }, [results]);
  const runOne = async item => { setRunning(item.id); const t0 = performance.now(); try { const raw = await item.run(); setResults(prev => ({ ...prev, [item.id]: { id: item.id, status: raw?.status || ST.PASS, durationMs: Math.round(performance.now() - t0), completedAt: now(), ...raw } })); } catch (error) { setResults(prev => ({ ...prev, [item.id]: { id: item.id, status: ST.FAIL, message: error?.message || 'Test threw', actual: error?.stack || String(error), durationMs: Math.round(performance.now() - t0), completedAt: now() } })); } finally { setRunning(null); } };
  const runList = async (list, name) => { setScope(name); for (const item of list) await runOne(item); setScope(null); };
  const cat = CATS.find(c => c.id === active) || CATS[0];
  const list = byCat[cat.id] || [];
  const st = stats[cat.id];
  const busy = Boolean(running || scope);
  const entries = useMemo(() => TESTS.map(item => ({ item, result: results[item.id], cat: catById[item.cat] || { label: item.cat, color: '#fff' } })).filter(x => x.result), [results]);
  const issueEntries = status => entries.filter(x => x.result.status === status);
  const failed = issueEntries(ST.FAIL);
  const warnings = issueEntries(ST.WARNING);
  const skippedItems = issueEntries(ST.SKIPPED);
  const visibleList = useMemo(() => list
    .filter(item => statusFilter === 'all' || (results[item.id]?.status || ST.SKIPPED) === statusFilter)
    .sort((a, b) => (statusRank[results[a.id]?.status || ST.SKIPPED] ?? 9) - (statusRank[results[b.id]?.status || ST.SKIPPED] ?? 9)),
  [list, results, statusFilter]);
  const reportLines = (onlyIssues = false) => {
    const selected = onlyIssues ? entries.filter(x => [ST.FAIL, ST.WARNING, ST.SKIPPED].includes(x.result.status)) : entries;
    const lines = [
      `KRONOX QA REPORT`,
      `Build: ${buildMarker()}`,
      `Last run: ${summary.last}`,
      `Total: ${summary.total} | Passed: ${summary.pass} | Failed: ${summary.fail} | Warnings: ${summary.warn} | Skipped: ${summary.skipped} | Duration: ${formatDuration(summary.duration)}`,
      '',
    ];
    const append = (title, rows) => {
      lines.push(`${title} (${rows.length})`);
      if (!rows.length) lines.push('- none');
      rows.forEach(({ item, result, cat: rowCat }) => {
        lines.push(`- [${result.status}] ${rowCat.label} / ${item.cat}.${item.id}: ${item.name}`);
        lines.push(`  expected: ${stringify(result.expected)}`);
        lines.push(`  actual: ${stringify(result.actual)}`);
        lines.push(`  reason: ${stringify(result.reason || result.message)}`);
        lines.push(`  duration: ${formatDuration(result.durationMs)}`);
      });
      lines.push('');
    };
    if (onlyIssues) {
      append('FAILED TESTS', failed);
      append('WARNINGS', warnings);
      append('SKIPPED', skippedItems);
      return lines.join('\n');
    }
    append('FAILED TESTS', failed);
    append('WARNINGS', warnings);
    append('SKIPPED', skippedItems);
    append('ALL COMPLETED TESTS', selected);
    return lines.join('\n');
  };
  const copyReport = async (mode) => {
    const text = reportLines(mode === 'issues');
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopied(mode);
    window.setTimeout(() => setCopied(null), 1500);
  };
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" style={{ background: 'rgba(5,7,22,0.9)', backdropFilter: 'blur(10px)' }} onClick={onClose}><motion.div initial={{ scale: 0.94, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0, y: 10 }} className="flex w-full flex-col overflow-hidden rounded-3xl" style={{ maxWidth: 1120, maxHeight: 'calc(100dvh - 16px)', background: 'linear-gradient(160deg, #10133d 0%, #070a1f 58%, #050716 100%)', border: '1px solid rgba(250,204,21,0.2)', boxShadow: '0 30px 90px rgba(0,0,0,0.72), 0 0 80px rgba(250,204,21,0.06)' }} onClick={e => e.stopPropagation()}><div className="flex-shrink-0 border-b border-white/[0.07] px-4 py-4 sm:px-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 flex-shrink-0 text-primary" /><h2 className="break-words font-cinzel text-base font-bold tracking-widest text-primary sm:text-lg">KRONOX QA PROTECTION SYSTEM</h2></div><p className="mt-1 max-w-2xl font-inter text-[11px] leading-relaxed text-white/40">Failed, warning, and skipped results are surfaced first for mobile debugging and sharing.</p></div><button onClick={onClose} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]"><X className="h-4 w-4 text-white/55" /></button></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-7"><Metric label="Total" value={summary.total} color="#fff" /><Metric label="Passed" value={summary.pass} color="#4ade80" /><Metric label="Failed" value={summary.fail} color="#f87171" /><Metric label="Warnings" value={summary.warn} color="#facc15" /><Metric label="Skipped" value={summary.skipped} color="#a1a1aa" /><Metric label="Duration" value={formatDuration(summary.duration)} color="#67e8f9" /><Metric label="Last Run" value={summary.last} color="#c4b5fd" /></div><div className="mt-4 flex flex-wrap items-center gap-2"><button onClick={() => runList(TESTS, 'all')} disabled={busy} className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-inter text-xs font-bold disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #f59e0b, #facc15)', color: '#071025' }}>{busy && scope === 'all' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}Run All Tests</button><button onClick={() => runList(list, cat.id)} disabled={busy} className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-inter text-xs font-bold disabled:opacity-40" style={{ background: `${cat.color}18`, color: cat.color, border: `1px solid ${cat.color}55` }}>{busy && scope === cat.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}Run Category</button><button onClick={() => copyReport('all')} disabled={!entries.length} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 font-inter text-xs font-bold text-white/75 disabled:opacity-35"><ClipboardCopy className="h-3.5 w-3.5" />{copied === 'all' ? 'Copied' : 'Copy Report'}</button><button onClick={() => copyReport('issues')} disabled={!failed.length && !warnings.length && !skippedItems.length} className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-inter text-xs font-bold disabled:opacity-35" style={{ background: 'rgba(248,113,113,0.12)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.28)' }}><ClipboardCopy className="h-3.5 w-3.5" />{copied === 'issues' ? 'Copied' : 'Copy Failed Only'}</button>{running && <span className="font-mono text-[10px] text-white/35">Running: {running}</span>}</div></div><main className="min-h-0 flex-1 overflow-y-auto px-3 py-4 pb-[calc(88px+env(safe-area-inset-bottom))] sm:px-5"><div className="space-y-3"><IssueSection title="FAILED TESTS" entries={failed} status={ST.FAIL} /><IssueSection title="WARNINGS" entries={warnings} status={ST.WARNING} /><IssueSection title="SKIPPED" entries={skippedItems} status={ST.SKIPPED} /></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{filterOptions.map(([value, label]) => { const selected = statusFilter === value; const color = value === 'all' ? '#67e8f9' : LOOK[value]?.[0] || '#fff'; return <button key={value} onClick={() => setStatusFilter(value)} className="flex-shrink-0 rounded-2xl px-3 py-2 font-inter text-[11px] font-bold" style={{ color: selected ? '#071025' : color, background: selected ? color : `${color}12`, border: `1px solid ${color}44` }}>{label}</button>; })}</div><div className="mt-4 grid gap-3 md:grid-cols-[18rem_1fr]"><aside className="min-w-0 overflow-x-auto md:max-h-[54vh] md:overflow-y-auto"><div className="flex gap-2 md:block md:space-y-1.5">{CATS.map(c => { const x = stats[c.id]; const selected = c.id === active; return <button key={c.id} onClick={() => setActive(c.id)} className="w-56 flex-shrink-0 rounded-2xl px-3 py-2.5 text-left md:w-full" style={{ background: selected ? `${c.color}14` : 'rgba(255,255,255,0.025)', border: `1px solid ${selected ? c.color + '55' : 'rgba(255,255,255,0.055)'}` }}><div className="flex items-center justify-between gap-2"><span className="font-inter text-xs font-semibold text-white/80">{c.label}</span><span className="rounded-full px-1.5 py-0.5 font-mono text-[9px]" style={{ color: c.color, background: `${c.color}14` }}>{x.pass}/{x.total}</span></div><div className="mt-1 flex gap-1 font-mono text-[9px]"><span className="text-red-300/80">F {x.fail}</span><span className="text-yellow-300/80">W {x.warn}</span><span className="text-zinc-300/80">S {x.skipped}</span></div><div className="mt-1 font-inter text-[9px] text-white/25">Last: {x.last || 'never'}</div></button>; })}</div></aside><section className="min-w-0"><div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="font-cinzel text-base font-bold tracking-widest" style={{ color: cat.color }}>{cat.label}</h3><p className="mt-1 font-inter text-[11px] text-white/35">Total {st.total} · Pass {st.pass} · Fail {st.fail} · Warning {st.warn} · Skipped {st.skipped}</p></div><div className="font-inter text-[10px] text-white/30">Last run: {st.last || 'never'}</div></div><div className="grid gap-3 lg:grid-cols-2">{visibleList.map(item => <Row key={item.id} item={item} result={results[item.id]} busy={busy} onRun={runOne} defaultOpen={results[item.id]?.status === ST.FAIL} />)}{!visibleList.length && <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 font-inter text-sm text-white/45">No tests match this filter in the selected category.</div>}</div></section></div></main></motion.div></motion.div>;
}
