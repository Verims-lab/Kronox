#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const DEFAULT_CONTENTS = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json';
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ALPHA_COLOR_TYPES = new Set([4, 6]);

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

const contentsPath = resolve(process.argv[2] || DEFAULT_CONTENTS);
const appIconDir = dirname(contentsPath);

if (!existsSync(contentsPath)) {
  console.error(`iOS AppIcon Contents.json not found: ${contentsPath}`);
  process.exit(1);
}

const contents = JSON.parse(readFileSync(contentsPath, 'utf8'));
const images = Array.isArray(contents.images) ? contents.images : [];
const failures = [];
let checked = 0;
let hasMarketingIcon = false;

for (const image of images) {
  if (!image.filename) continue;
  const filePath = join(appIconDir, image.filename);
  checked += 1;

  if (!existsSync(filePath)) {
    failures.push(`${image.filename}: missing file`);
    continue;
  }

  let meta;
  try {
    meta = readPngMetadata(filePath);
  } catch (err) {
    failures.push(`${image.filename}: ${err.message}`);
    continue;
  }

  const expected = expectedPixels(image);
  if (expected && (meta.width !== expected.width || meta.height !== expected.height)) {
    failures.push(`${image.filename}: expected ${expected.width}x${expected.height}, got ${meta.width}x${meta.height}`);
  }

  if (meta.hasAlphaChannel || meta.hasTransparencyChunk) {
    failures.push(`${image.filename}: alpha/transparency present (colorType=${meta.colorType}, tRNS=${meta.hasTransparencyChunk})`);
  }

  if (image.idiom === 'ios-marketing' && meta.width === 1024 && meta.height === 1024) {
    hasMarketingIcon = true;
  }
}

if (!hasMarketingIcon) {
  failures.push('AppIcon catalog is missing a 1024x1024 ios-marketing icon');
}

if (checked === 0) {
  failures.push('AppIcon catalog has no PNG filenames to validate');
}

if (failures.length) {
  console.error('iOS AppIcon validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`iOS AppIcon validation passed: ${checked} PNGs are dimension-correct and contain no alpha channel.`);
