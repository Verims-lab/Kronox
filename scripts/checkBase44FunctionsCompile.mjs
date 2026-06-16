#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const rootDir = process.cwd();
const functionsDir = path.join(rootDir, 'base44', 'functions');

const DUPLICATE_DECLARATION_CODES = new Set([
  2300, // Duplicate identifier
  2393, // Duplicate function implementation
  2451, // Cannot redeclare block-scoped variable
]);

const DEPLOY_RISK_IMPORT_TOKENS = [
  '_shared/adminAuth',
  '../_shared',
  './_shared',
  'file:///__shared',
];

const ALLOWED_EMAIL_LITERAL_SUFFIXES = [
  '@example.com',
  '@example.test',
  '@kronos.local',
  '@test.local',
];

const EMAIL_LITERAL_REGEX = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}\b/g;

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function walkEntryFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkEntryFiles(fullPath);
    return entry.isFile() && entry.name === 'entry.ts' ? [fullPath] : [];
  }).sort();
}

function relativeFile(filePath) {
  return path.relative(rootDir, filePath);
}

function formatDiagnostic(filePath, diagnostic) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
  const sourceFile = diagnostic.file;
  if (sourceFile && typeof diagnostic.start === 'number') {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
    return `${relativeFile(filePath)}:${line + 1}:${character + 1} TS${diagnostic.code}: ${message}`;
  }
  return `${relativeFile(filePath)} TS${diagnostic.code}: ${message}`;
}

function compileDiagnostics(filePath, source) {
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    strict: false,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);

  host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (path.resolve(name) === path.resolve(filePath) || name === filePath) {
      return ts.createSourceFile(filePath, source, languageVersion, true, ts.ScriptKind.TS);
    }
    return originalGetSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile);
  };
  host.fileExists = (name) => name === filePath || path.resolve(name) === path.resolve(filePath) || originalFileExists(name);
  host.readFile = (name) => (name === filePath || path.resolve(name) === path.resolve(filePath) ? source : originalReadFile(name));
  host.writeFile = () => {};

  const program = ts.createProgram([filePath], options, host);
  const sourceFile = program.getSourceFile(filePath);
  const syntactic = program.getSyntacticDiagnostics(sourceFile);
  const duplicateDeclarations = program
    .getSemanticDiagnostics(sourceFile)
    .filter((diagnostic) => DUPLICATE_DECLARATION_CODES.has(diagnostic.code));
  return [...syntactic, ...duplicateDeclarations].map((diagnostic) => formatDiagnostic(filePath, diagnostic));
}

function isAllowedDenoImport(specifier) {
  return specifier.startsWith('npm:') || specifier.startsWith('jsr:') || specifier.startsWith('node:');
}

function resolveRelativeImport(fromFile, specifier) {
  const basePath = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, 'entry.ts'),
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.js'),
  ];
  return candidates.some((candidate) => fs.existsSync(candidate));
}

function importDiagnostics(filePath, source) {
  const diagnostics = [];
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  sourceFile.forEachChild((node) => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return;
    const specifier = node.moduleSpecifier.text;
    if (DEPLOY_RISK_IMPORT_TOKENS.some((token) => specifier.includes(token))) {
      diagnostics.push(`${relativeFile(filePath)}: deploy-risk import '${specifier}'`);
      return;
    }
    if (specifier.startsWith('.')) {
      if (!resolveRelativeImport(filePath, specifier)) {
        diagnostics.push(`${relativeFile(filePath)}: unresolved relative import '${specifier}'`);
      }
      return;
    }
    if (!isAllowedDenoImport(specifier)) {
      diagnostics.push(`${relativeFile(filePath)}: unsupported Base44/Deno import '${specifier}'`);
    }
  });
  return diagnostics;
}

function forbiddenTokenDiagnostics(filePath, source) {
  return DEPLOY_RISK_IMPORT_TOKENS
    .filter((token) => source.includes(token))
    .map((token) => `${relativeFile(filePath)}: forbidden deploy-risk token '${token}'`);
}

function emailDiagnostics(filePath, source) {
  const matches = Array.from(new Set(source.match(EMAIL_LITERAL_REGEX) || []));
  return matches
    .filter((value) => {
      const normalized = value.toLowerCase();
      return !ALLOWED_EMAIL_LITERAL_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
    })
    .map((value) => `${relativeFile(filePath)}: hardcoded email literal '${value}'`);
}

function getQuestionsDiagnostics(entryFiles) {
  const filePath = entryFiles.find((file) => relativeFile(file) === path.join('base44', 'functions', 'getQuestions', 'entry.ts'));
  if (!filePath) return ['base44/functions/getQuestions/entry.ts: missing getQuestions entry file'];
  const source = readText(filePath);
  const required = [
    'requestPayload',
    'responsePayload',
    'req.clone().json()',
    'pong: true',
    'getServiceEntity(base44, \'Question\')',
    'getServiceEntity(base44, \'Category\')',
    'base44_client_create_failed',
    'if (!user?.email)',
    'Giris yapmaniz gerekiyor.',
    'authenticated_minimal_playable_projection',
    'getQuestionsRuntimeMarker',
    'getQuestions-live-per-category-v7-Codex343',
    'per_category_projection_v2',
    'MAX_AUTH_GAMEPLAY_RESPONSE_LIMIT',
    'SERVER_ATTEMPT_SELECTION_MODE',
    'server_attempt_candidate_buffer_v1',
    'sourcePoolCapRemoved',
    'responseCapApplied',
    'buildServerAttemptCandidateBuffer',
    'filterSoloAttemptCandidatePool',
    'projectionDiagnostics',
    'buildProjectionDiagnostics',
  ];
  const forbidden = [
    'const payload = await req.json()',
    'const payload = await req.json().catch',
    'let payload = await req.json()',
    'var payload = await req.json()',
    'const payload: Record<string, unknown>',
    'MAX_GAMEPLAY_LIMIT = 1200',
    'FALLBACK_ACTIVE_CATEGORY_IDS = [1, 2, 3, 4, 5, 6]',
    'Question.list(\'-created_date\', 500)',
    'Question.list("-created_date", 500)',
    'public_minimal_playable_projection',
  ];
  return [
    ...required
      .filter((token) => !source.includes(token))
      .map((token) => `${relativeFile(filePath)}: missing getQuestions contract token '${token}'`),
    ...forbidden
      .filter((token) => source.includes(token))
      .map((token) => `${relativeFile(filePath)}: forbidden getQuestions regression token '${token}'`),
  ];
}

const entryFiles = walkEntryFiles(functionsDir);
const failures = [];

for (const filePath of entryFiles) {
  const source = readText(filePath);
  failures.push(...compileDiagnostics(filePath, source));
  failures.push(...importDiagnostics(filePath, source));
  failures.push(...forbiddenTokenDiagnostics(filePath, source));
  failures.push(...emailDiagnostics(filePath, source));
}
failures.push(...getQuestionsDiagnostics(entryFiles));

if (failures.length) {
  console.error(`Base44 function compile/deploy gate failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Base44 function compile/deploy gate passed for ${entryFiles.length} function entry files.`);
