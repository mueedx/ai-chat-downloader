// tools/package.cjs
// Builds the uploadable zip: only the files Chrome loads, plus the store documents. No
// tests, no tooling, no specs. Store-method zip, the same writer the extension uses.
// Run with: npm run package

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

const INCLUDE_FILES = ['manifest.json', 'PRIVACY.md', 'README.md', 'LICENSE'];
const INCLUDE_DIRS = ['src', 'icons'];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const u16 = (v) => [v & 0xff, (v >> 8) & 0xff];
const u32 = (v) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff];

function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = entry.data;
    const crc = crc32(data);

    const local = Buffer.from([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(name.length), ...u16(0), ...name, ...data
    ]);
    locals.push(local);

    centrals.push(Buffer.from([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
      ...u32(offset), ...name
    ]));

    offset += local.length;
  }

  const centralSize = centrals.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = Buffer.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(entries.length), ...u16(entries.length),
    ...u32(centralSize), ...u32(offset), ...u16(0)
  ]);

  return Buffer.concat([...locals, ...centrals, end]);
}

const entries = [];

for (const file of INCLUDE_FILES) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  entries.push({ name: file, data: fs.readFileSync(full) });
}

for (const dir of INCLUDE_DIRS) {
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|html|css|png|json)$/.test(entry.name)) {
        entries.push({ name: path.relative(root, full), data: fs.readFileSync(full) });
      }
    }
  };
  walk(path.join(root, dir));
}

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'ai-chat-downloader-' + manifest.version + '.zip');
fs.writeFileSync(outFile, buildZip(entries));

console.log('wrote ' + path.relative(root, outFile) + ' with ' + entries.length + ' files, ' + fs.statSync(outFile).size + ' bytes');
