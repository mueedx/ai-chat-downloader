// tools/make-icons.js
// Generates the three store icons with no image library: a PNG is a signature, three
// chunks, and zlib-compressed scanlines, all of which Node can produce on its own.
// Run with: node tools/make-icons.js

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const BRAND = [31, 79, 216, 255]; // #1f4fd8
const INK = [255, 255, 255, 255];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** A rounded square with a downward arrow: the download action, at every size. */
function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4, 0);
  const radius = size * 0.22;
  const put = (x, y, colour) => {
    const offset = (y * size + x) * 4;
    pixels[offset] = colour[0];
    pixels[offset + 1] = colour[1];
    pixels[offset + 2] = colour[2];
    pixels[offset + 3] = colour[3];
  };

  const insideRoundedSquare = (x, y) => {
    const min = radius;
    const max = size - 1 - radius;
    const cx = x < min ? min : x > max ? max : x;
    const cy = y < min ? min : y > max ? max : y;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  };

  // Arrow shaft.
  const shaftLeft = size * 0.42;
  const shaftRight = size * 0.58;
  const shaftTop = size * 0.22;
  const shaftBottom = size * 0.5;
  // Arrow head.
  const headTop = shaftBottom;
  const headBottom = size * 0.62;
  const headLeft = size * 0.28;
  const headRight = size * 0.72;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!insideRoundedSquare(x, y)) continue;
      put(x, y, BRAND);

      const inShaft = x >= shaftLeft && x <= shaftRight && y >= shaftTop && y <= shaftBottom;
      const inHead =
        y >= headTop &&
        y <= headBottom &&
        x >= headLeft + ((headBottom - y) / (headBottom - headTop)) * ((headRight - headLeft) / 2) &&
        x <= headRight - ((headBottom - y) / (headBottom - headTop)) * ((headRight - headLeft) / 2);

      if (inShaft || inHead) put(x, y, INK);
    }
  }

  return pixels;
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const file = path.join(outDir, 'icon' + size + '.png');
  fs.writeFileSync(file, encodePng(size, drawIcon(size)));
  console.log('wrote', path.relative(process.cwd(), file), fs.statSync(file).size, 'bytes');
}
