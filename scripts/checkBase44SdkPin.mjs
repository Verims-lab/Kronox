import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_SDK_VERSION = '0.8.34';
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const checks = [
  ['package.json dependency', packageJson?.dependencies?.['@base44/sdk']],
  ['package-lock.json root dependency', packageLock?.packages?.['']?.dependencies?.['@base44/sdk']],
  ['package-lock.json installed package', packageLock?.packages?.['node_modules/@base44/sdk']?.version],
];
const failures = checks
  .filter(([, actual]) => actual !== EXPECTED_SDK_VERSION)
  .map(([label, actual]) => `${label}: expected ${EXPECTED_SDK_VERSION}, received ${String(actual || 'missing')}`);

if (failures.length) {
  console.error('Base44 SDK install gate failed. Restore the exact supported pin before installing dependencies.');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Base44 SDK install gate passed: exact ${EXPECTED_SDK_VERSION}.`);
