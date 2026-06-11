#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ALPHA_COLOR_TYPES = new Set([4, 6]);
const DEFAULT_SEARCH_ROOTS = ['ios', 'public/assets/icons'];
const REQUIRED_ICON_SOURCES = [
  { path: 'public/assets/icons/kronox-app-icon-1024.png', width: 1024, height: 1024 },
  { path: 'public/assets/icons/kronox-app-icon-512.png', width: 512, height: 512 },
  { path: 'public/assets/icons/kronox-app-icon-192.png', width: 192, height: 192 },
  { path: 'public/assets/icons/kronox-apple-touch-icon-180.png', width: 180, height: 180 },
];
const ICON_REFERENCE_FILES = [
  'index.html',
  'public/manifest.json',
  'src/manifest.json',
  'src/components/SplashScreen.jsx',
];
const FORBIDDEN_TRANSPARENT_ICON_SOURCE_TOKENS = [
  '56ee45626_Kronoxuygulamaikon.png',
  'media.base44.com/images/public/69e753d5ab4c08a7c4287c25/56ee45626_Kronoxuygulamaikon.png',
];

function readPngMetadata(filePath) {
  const buffer = readFileSync(filePath);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('not a PNG');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = null;
  let hasTransparencyChunk = false;

  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) throw new Error('truncated PNG chunk');
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataOffset = offset + 8;
    offset += 12 + length;

    if (type === 'IHDR') {
      width = buffer.readUInt32BE(dataOffset);
      height = buffer.readUInt32BE(dataOffset + 4);
      bitDepth = buffer[dataOffset + 8];
      colorType = buffer[dataOffset + 9];
    } else if (type === 'tRNS') {
      hasTransparencyChunk = true;
    } else if (type === 'IEND') {
      break;
    }
  }

  return {
    width,
    height,
    bitDepth,
    colorType,
    hasAlphaChannel: ALPHA_COLOR_TYPES.has(colorType),
    hasTransparencyChunk,
  };
}

function expectedPixels(entry) {
  const [width, height] = String(entry.size || '').split('x').map(Number);
  const scale = Number(String(entry.scale || '1x').replace('x', '')) || 1;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

function expectedManifestPixels(icon) {
  const [width, height] = String(icon.sizes || '').split('x').map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
}

function walk(root, predicate, out = []) {
  if (!existsSync(root)) return out;
  const stat = lstatSync(root);
  if (stat.isFile()) {
    if (predicate(root)) out.push(root);
    return out;
  }
  if (!stat.isDirectory()) return out;

  for (const entry of readdirSync(root)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    walk(join(root, entry), predicate, out);
  }
  return out;
}

function validatePng(filePath, failures, expected = null) {
  if (!existsSync(filePath)) {
    failures.push(`${filePath}: missing file`);
    return null;
  }

  let meta;
  try {
    meta = readPngMetadata(filePath);
  } catch (err) {
    failures.push(`${filePath}: ${err.message}`);
    return null;
  }

  if (expected && (meta.width !== expected.width || meta.height !== expected.height)) {
    failures.push(`${filePath}: expected ${expected.width}x${expected.height}, got ${meta.width}x${meta.height}`);
  }

  if (meta.hasAlphaChannel || meta.hasTransparencyChunk) {
    failures.push(`${filePath}: alpha/transparency present (colorType=${meta.colorType}, tRNS=${meta.hasTransparencyChunk})`);
  }

  return meta;
}

function validateContentsJson(contentsPath, failures) {
  const appIconDir = dirname(contentsPath);
  const contents = JSON.parse(readFileSync(contentsPath, 'utf8'));
  const images = Array.isArray(contents.images) ? contents.images : [];
  let checked = 0;
  let hasMarketingIcon = false;

  for (const image of images) {
    if (!image.filename) continue;
    const filePath = join(appIconDir, image.filename);
    checked += 1;
    const meta = validatePng(filePath, failures, expectedPixels(image));
    if (image.idiom === 'ios-marketing' && meta?.width === 1024 && meta?.height === 1024) {
      hasMarketingIcon = true;
    }
  }

  if (!hasMarketingIcon) {
    failures.push(`${contentsPath}: missing 1024x1024 ios-marketing icon`);
  }
  if (checked === 0) {
    failures.push(`${contentsPath}: AppIcon catalog has no PNG filenames to validate`);
  }
  return checked;
}

function resolveManifestIcon(manifestPath, iconSrc) {
  if (/^https?:\/\//i.test(iconSrc)) return null;
  if (iconSrc.startsWith('/')) return resolve('public', iconSrc.slice(1));
  return resolve(dirname(manifestPath), iconSrc);
}

function validateManifestIconReferences(failures) {
  let checked = 0;

  for (const manifestPath of ['public/manifest.json', 'src/manifest.json']) {
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];

    for (const icon of icons) {
      if (!icon.src || !String(icon.type || '').includes('png')) continue;
      if (/^https?:\/\//i.test(icon.src)) {
        failures.push(`${manifestPath}: app icon ${icon.src} is remote; native wrapper generation must use local opaque PNGs`);
        continue;
      }
      const resolved = resolveManifestIcon(manifestPath, icon.src);
      const meta = validatePng(resolved, failures, expectedManifestPixels(icon));
      if (meta) checked += 1;
    }
  }

  return checked;
}

function validateIconSourceReferences(failures) {
  for (const filePath of ICON_REFERENCE_FILES) {
    if (!existsSync(filePath)) continue;
    const source = readFileSync(filePath, 'utf8');
    for (const token of FORBIDDEN_TRANSPARENT_ICON_SOURCE_TOKENS) {
      if (source.includes(token)) {
        failures.push(`${filePath}: still references transparent remote app-icon source ${token}`);
      }
    }
  }
}

function findAppIconContents(roots) {
  return roots.flatMap((root) => walk(resolve(root), (filePath) => (
    filePath.endsWith('AppIcon.appiconset/Contents.json')
  )));
}

function findRawAppIconPngs(roots) {
  return roots.flatMap((root) => walk(resolve(root), (filePath) => {
    const lower = filePath.toLowerCase();
    return lower.endsWith('.png') && (
      lower.includes('appicon')
      || lower.includes('app-icon')
      || lower.includes('apple-touch-icon')
      || lower.includes('kronox-app-icon')
      || lower.includes('itunesartwork')
    );
  }));
}

function findAssetsCar(roots) {
  return roots.flatMap((root) => walk(resolve(root), (filePath) => (
    filePath.endsWith('/Assets.car') || filePath.endsWith('\\Assets.car')
  )));
}

function extractIpa(ipaPath, failures) {
  const tempDir = mkdtempSync(join(tmpdir(), 'kronox-ios-icon-check-'));
  const unzip = spawnSync('unzip', ['-q', resolve(ipaPath), '-d', tempDir], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (unzip.status !== 0) {
    failures.push(`${ipaPath}: could not extract IPA with unzip (${unzip.stderr || unzip.stdout || 'unknown unzip error'})`);
    rmSync(tempDir, { recursive: true, force: true });
    return null;
  }
  return tempDir;
}

const inputRoots = process.argv.slice(2);
const failures = [];
const warnings = [];
const tempRoots = [];
const roots = [];
let checkedCatalogIcons = 0;
let checkedSourceIcons = 0;
let checkedManifestIcons = 0;

if (inputRoots.length) {
  for (const root of inputRoots) {
    if (extname(root).toLowerCase() === '.ipa') {
      const extracted = extractIpa(root, failures);
      if (extracted) {
        tempRoots.push(extracted);
        roots.push(extracted);
      }
    } else {
      roots.push(root);
    }
  }
} else {
  roots.push(...DEFAULT_SEARCH_ROOTS);
}

const contentsFiles = findAppIconContents(roots);
for (const contentsPath of contentsFiles) {
  checkedCatalogIcons += validateContentsJson(contentsPath, failures);
}

for (const source of REQUIRED_ICON_SOURCES) {
  const meta = validatePng(resolve(source.path), failures, source);
  if (meta) checkedSourceIcons += 1;
}

checkedManifestIcons += validateManifestIconReferences(failures);
validateIconSourceReferences(failures);

if (inputRoots.length) {
  const rawPngs = new Set(findRawAppIconPngs(roots));
  for (const pngPath of rawPngs) {
    const meta = validatePng(pngPath, failures);
    if (meta) checkedSourceIcons += 1;
  }

  const assetsCars = findAssetsCar(roots);
  if (assetsCars.length && rawPngs.size === 0) {
    failures.push(`Compiled Assets.car found without raw AppIcon PNGs (${assetsCars.join(', ')}). Use Xcode assetutil/final archive validation before App Store upload; this script will not falsely pass an unreadable compiled app icon.`);
  } else if (assetsCars.length) {
    warnings.push(`Compiled Assets.car present (${assetsCars.length}); raw PNGs were checked, but final App Store proof still requires archive/upload validation.`);
  }
}

if (contentsFiles.length === 0 && !inputRoots.length) {
  failures.push(`No AppIcon.appiconset/Contents.json found under: ${roots.join(', ')}`);
}

for (const tempRoot of tempRoots) {
  rmSync(tempRoot, { recursive: true, force: true });
}

if (failures.length) {
  console.error('iOS icon validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  if (warnings.length) {
    console.error('Warnings:');
    warnings.forEach((warning) => console.error(`- ${warning}`));
  }
  process.exit(1);
}

if (warnings.length) {
  console.warn('iOS icon validation warnings:');
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

console.log(`iOS icon validation passed: ${checkedCatalogIcons} AppIcon catalog PNGs, ${checkedSourceIcons} source/final PNGs, and ${checkedManifestIcons} manifest icon PNGs contain no alpha channel.`);
