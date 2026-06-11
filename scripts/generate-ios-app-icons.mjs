#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const DEFAULT_OUTPUT_DIR = 'ios/App/App/Assets.xcassets/AppIcon.appiconset';
const KRONOX_NAVY = [5, 7, 22];

const ICONS = [
  { idiom: 'iphone', size: '20x20', scale: '2x', px: 40, filename: 'AppIcon-20x20@2x.png' },
  { idiom: 'iphone', size: '20x20', scale: '3x', px: 60, filename: 'AppIcon-20x20@3x.png' },
  { idiom: 'iphone', size: '29x29', scale: '2x', px: 58, filename: 'AppIcon-29x29@2x.png' },
  { idiom: 'iphone', size: '29x29', scale: '3x', px: 87, filename: 'AppIcon-29x29@3x.png' },
  { idiom: 'iphone', size: '40x40', scale: '2x', px: 80, filename: 'AppIcon-40x40@2x.png' },
  { idiom: 'iphone', size: '40x40', scale: '3x', px: 120, filename: 'AppIcon-40x40@3x.png' },
  { idiom: 'iphone', size: '60x60', scale: '2x', px: 120, filename: 'AppIcon-60x60@2x.png' },
  { idiom: 'iphone', size: '60x60', scale: '3x', px: 180, filename: 'AppIcon-60x60@3x.png' },
  { idiom: 'ipad', size: '20x20', scale: '1x', px: 20, filename: 'AppIcon-20x20@1x.png' },
  { idiom: 'ipad', size: '20x20', scale: '2x', px: 40, filename: 'AppIcon-20x20@2x~ipad.png' },
  { idiom: 'ipad', size: '29x29', scale: '1x', px: 29, filename: 'AppIcon-29x29@1x.png' },
  { idiom: 'ipad', size: '29x29', scale: '2x', px: 58, filename: 'AppIcon-29x29@2x~ipad.png' },
  { idiom: 'ipad', size: '40x40', scale: '1x', px: 40, filename: 'AppIcon-40x40@1x.png' },
  { idiom: 'ipad', size: '40x40', scale: '2x', px: 80, filename: 'AppIcon-40x40@2x~ipad.png' },
  { idiom: 'ipad', size: '76x76', scale: '1x', px: 76, filename: 'AppIcon-76x76@1x.png' },
  { idiom: 'ipad', size: '76x76', scale: '2x', px: 152, filename: 'AppIcon-76x76@2x.png' },
  { idiom: 'ipad', size: '83.5x83.5', scale: '2x', px: 167, filename: 'AppIcon-83.5x83.5@2x.png' },
  { idiom: 'ios-marketing', size: '1024x1024', scale: '1x', px: 1024, filename: 'AppIcon-1024.png' },
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([len, name, data, crc]);
}

function readPng(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Source is not a PNG file.');
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  let offset = 8;

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth: ${bitDepth}. Expected 8-bit source.`);
  }

  const bytesPerPixelByType = { 0: 1, 2: 3, 4: 2, 6: 4 };
  const bytesPerPixel = bytesPerPixelByType[colorType];
  if (!bytesPerPixel) {
    throw new Error(`Unsupported PNG color type: ${colorType}. Use RGB/RGBA/grayscale source.`);
  }

  return {
    width,
    height,
    colorType,
    bytesPerPixel,
    raw: inflateSync(Buffer.concat(idat)),
  };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilter({ width, height, bytesPerPixel, raw }) {
  const stride = width * bytesPerPixel;
  const pixels = Buffer.alloc(height * stride);
  let input = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[input];
    input += 1;
    const rowStart = y * stride;
    const prevStart = (y - 1) * stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? pixels[rowStart + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[prevStart + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? pixels[prevStart + x - bytesPerPixel] : 0;
      const value = raw[input + x];

      let restored = value;
      if (filter === 1) restored = value + left;
      else if (filter === 2) restored = value + up;
      else if (filter === 3) restored = value + Math.floor((left + up) / 2);
      else if (filter === 4) restored = value + paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter: ${filter}`);

      pixels[rowStart + x] = restored & 0xff;
    }

    input += stride;
  }

  return pixels;
}

function flattenToRgb(source, background = KRONOX_NAVY) {
  const pixels = unfilter(source);
  const rgb = Buffer.alloc(source.width * source.height * 3);

  for (let src = 0, dst = 0; src < pixels.length; src += source.bytesPerPixel, dst += 3) {
    let r;
    let g;
    let b;
    let a = 255;

    if (source.colorType === 6) {
      r = pixels[src];
      g = pixels[src + 1];
      b = pixels[src + 2];
      a = pixels[src + 3];
    } else if (source.colorType === 2) {
      r = pixels[src];
      g = pixels[src + 1];
      b = pixels[src + 2];
    } else if (source.colorType === 4) {
      r = pixels[src];
      g = pixels[src];
      b = pixels[src];
      a = pixels[src + 1];
    } else {
      r = pixels[src];
      g = pixels[src];
      b = pixels[src];
    }

    const alpha = a / 255;
    rgb[dst] = Math.round((r * alpha) + (background[0] * (1 - alpha)));
    rgb[dst + 1] = Math.round((g * alpha) + (background[1] * (1 - alpha)));
    rgb[dst + 2] = Math.round((b * alpha) + (background[2] * (1 - alpha)));
  }

  return rgb;
}

function encodeRgbPng(width, height, rgb) {
  const stride = width * 3;
  const scanlines = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const out = y * (stride + 1);
    scanlines[out] = 0;
    rgb.copy(scanlines, out + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND'),
  ]);
}

function writeContentsJson(outputDir) {
  const images = ICONS.map(({ idiom, size, scale, filename }) => ({
    idiom,
    size,
    scale,
    filename,
  }));
  const contents = {
    images,
    info: {
      author: 'xcode',
      version: 1,
    },
  };
  writeFileSync(join(outputDir, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`);
}

function resizeIcon(masterPath, outputPath, px) {
  if (px === 1024) return;
  const result = spawnSync('sips', ['-z', String(px), String(px), masterPath, '--out', outputPath], {
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`sips failed for ${outputPath}: ${result.stderr || result.stdout}`);
  }
}

const sourcePath = process.argv[2];
const outputDir = resolve(process.argv[3] || DEFAULT_OUTPUT_DIR);

if (!sourcePath) {
  console.error('Usage: node scripts/generate-ios-app-icons.mjs <source-png> [output-appiconset-dir]');
  process.exit(2);
}

mkdirSync(outputDir, { recursive: true });

const source = readPng(readFileSync(resolve(sourcePath)));
if (source.width !== source.height) {
  throw new Error(`Source icon must be square. Got ${source.width}x${source.height}.`);
}

const master = encodeRgbPng(source.width, source.height, flattenToRgb(source));
const masterPath = join(outputDir, 'AppIcon-1024.png');
writeFileSync(masterPath, master);

for (const icon of ICONS) {
  const target = join(outputDir, icon.filename);
  if (icon.px === 1024) {
    if (target !== masterPath) writeFileSync(target, master);
  } else {
    mkdirSync(dirname(target), { recursive: true });
    resizeIcon(masterPath, target, icon.px);
  }
}

writeContentsJson(outputDir);
console.log(`Generated ${ICONS.length} opaque iOS AppIcon PNGs in ${outputDir}`);
