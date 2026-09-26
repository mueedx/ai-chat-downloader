// test/exporters.test.js
// All four formats render from one chat, so they must agree turn for turn, and the two
// binary formats must be real files rather than renamed text.

import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

import { loadExtension } from './harness.js';
import { loadFixture } from './minidom.js';

const NS = loadExtension();
const AT = new Date(2026, 8, 26, 9, 5, 3);
const decoder = new TextDecoder();

function sampleChat() {
  return NS.chat.createChat({
    site: 'chatgpt',
    siteLabel: 'ChatGPT',
    title: 'Reverse a string',
    url: 'https://chatgpt.com/c/abc',
    exportedAt: AT.toISOString(),
    turns: [
      { role: 'user', text: 'How do I reverse a string in Python?' },
      {
        role: 'assistant',
        text: 'Use slicing:\n\n```python\ns = "abc"\nprint(s[::-1])\n```\n\nThat prints cba.'
      },
      { role: 'user', text: '', notes: ['image'] },
      { role: 'assistant', text: 'Still typing', incomplete: true }
    ]
  });
}

function render(chat, format) {
  return NS.exporters.renderExport(chat, format, AT);
}

test('exactly four formats are offered, each with an extension and a MIME type', () => {
  const formats = NS.exporters.listFormats();
  assert.deepEqual(formats.map((f) => f.id), ['md', 'txt', 'docx', 'pdf']);
  for (const format of NS.exporters.FORMATS) {
    assert.ok(format.extension);
    assert.ok(format.mime);
    assert.equal(typeof format.description, 'string');
  }
});

test('an unknown format is refused rather than silently defaulted', () => {
  assert.throws(() => render(sampleChat(), 'exe'), /Unsupported format/);
});

test('markdown carries the title, the source, and every turn in order', () => {
  const text = decoder.decode(render(sampleChat(), 'md').bytes);
  assert.match(text, /^# Reverse a string/);
  assert.match(text, /> Source: https:\/\/chatgpt\.com\/c\/abc/);
  assert.match(text, /> Exported: 2026-09-26 09:05/);
  assert.match(text, /> Messages: 4/);
  assert.match(text, /## You\n\nHow do I reverse a string in Python\?/);
  assert.match(text, /## ChatGPT\n\nUse slicing:/);
  assert.ok(text.indexOf('How do I reverse') < text.indexOf('Use slicing'), 'order is kept');
});

test('markdown keeps code fenced and language-tagged', () => {
  const text = decoder.decode(render(sampleChat(), 'md').bytes);
  assert.match(text, /```python\ns = "abc"\nprint\(s\[::\-1\]\)\n```/);
});

test('markdown marks notes and the incomplete turn without inventing content', () => {
  const text = decoder.decode(render(sampleChat(), 'md').bytes);
  assert.match(text, /_\[image\]_/);
  assert.match(text, /_\[message was still being written\]_/);
});

test('plain text uses the same order with fixed-width labels', () => {
  const text = decoder.decode(render(sampleChat(), 'txt').bytes);
  assert.match(text, /--- YOU ---/);
  assert.match(text, /--- CHATGPT ---/);
  assert.ok(text.indexOf('How do I reverse') < text.indexOf('Use slicing'));
  assert.match(text, /```python/);
});

test('all four formats contain the same turns in the same order (SC-003)', () => {
  const chat = sampleChat();
  const probes = ['How do I reverse a string', 'Use slicing', '[image]', 'Still typing'];

  for (const format of ['md', 'txt', 'docx', 'pdf']) {
    const bytes = render(chat, format).bytes;
    // The PDF writer maps non-Latin-1 characters, but ASCII probes survive verbatim.
    const haystack = format === 'pdf' ? decoder.decode(bytes) : decoder.decode(bytes);
    let cursor = -1;
    for (const probe of probes) {
      const at = haystack.indexOf(probe);
      assert.ok(at >= 0, format + ' is missing ' + probe);
      assert.ok(at > cursor, format + ' has ' + probe + ' out of order');
      cursor = at;
    }
  }
});

test('the docx is a real zip with the three OOXML parts (FR-027)', () => {
  const bytes = render(sampleChat(), 'docx').bytes;
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);

  const entries = readStoredZip(bytes);
  assert.deepEqual(Object.keys(entries).sort(), [
    '[Content_Types].xml',
    '_rels/.rels',
    'word/document.xml'
  ]);

  const document = entries['word/document.xml'];
  assert.match(document, /<w:document/);
  assert.match(document, /print\(s\[::\-1\]\)/);
  assert.match(document, /&quot;abc&quot;/, 'quotes are XML-escaped');
  assert.match(document, /w:ascii="Consolas"/, 'code runs use a monospace font');
});

test('the pdf has a correct header, xref, and trailer (FR-027)', () => {
  const bytes = render(sampleChat(), 'pdf').bytes;
  const text = decoder.decode(bytes);

  assert.equal(text.slice(0, 8), '%PDF-1.4');
  assert.match(text, /\/Type \/Catalog/);
  assert.match(text, /\/BaseFont \/Helvetica/);
  assert.match(text, /\/BaseFont \/Courier/);
  assert.ok(text.trimEnd().endsWith('%%EOF'));

  const startxref = Number(text.slice(text.lastIndexOf('startxref') + 9).trim().split(/\s/)[0]);
  assert.equal(text.slice(startxref, startxref + 4), 'xref');

  const lines = text.slice(startxref).split('\n');
  const count = Number(lines[1].split(' ')[1]);
  for (let object = 1; object < count; object += 1) {
    const offset = Number(lines[2 + object].slice(0, 10));
    assert.ok(
      text.startsWith(object + ' 0 obj', offset),
      'xref entry ' + object + ' points at the wrong offset'
    );
  }
});

test('a long conversation is split across several pages', () => {
  const turns = [];
  for (let i = 0; i < 120; i += 1) {
    turns.push({ role: i % 2 ? 'assistant' : 'user', text: 'Turn ' + i + '. ' + 'filler text '.repeat(10) });
  }
  const chat = NS.chat.createChat({ site: 'kimi', siteLabel: 'Kimi', title: 'Long', turns: turns });
  const text = decoder.decode(render(chat, 'pdf').bytes);
  const pages = Number(/\/Count (\d+)/.exec(text)[1]);
  assert.ok(pages > 1, 'expected more than one page, got ' + pages);
});

test('parentheses and backslashes in a message cannot break the pdf', () => {
  const chat = NS.chat.createChat({
    site: 'claude',
    siteLabel: 'Claude',
    title: 'Escapes',
    turns: [{ role: 'user', text: 'a (b) c \\ d ) Tj ( nested' }]
  });
  const text = decoder.decode(render(chat, 'pdf').bytes);
  const strings = text.match(/\([^)]*\) Tj/g) || [];
  assert.ok(strings.length > 0);
  assert.ok(text.includes('\\(b\\)'));
});

test('pdf warns before it loses characters the font cannot draw (FR-025)', () => {
  const chat = NS.chat.createChat({
    site: 'qwen',
    siteLabel: 'Qwen',
    title: '中文标题',
    turns: [{ role: 'user', text: '这是一个中文问题' }]
  });

  const pdf = render(chat, 'pdf');
  assert.equal(pdf.warnings.length, 1);
  assert.match(pdf.warnings[0], /outside Latin-1/);

  for (const format of ['md', 'txt', 'docx']) {
    assert.deepEqual(render(chat, format).warnings, [], format + ' should lose nothing');
  }
});

test('common typography is transliterated rather than dropped as question marks', () => {
  const chat = NS.chat.createChat({
    site: 'gemini',
    siteLabel: 'Gemini',
    turns: [{ role: 'user', text: 'curly ‘quotes’ and an ellipsis…' }]
  });
  const text = decoder.decode(render(chat, 'pdf').bytes);
  assert.match(text, /curly 'quotes' and an ellipsis\.\.\./);
  assert.equal(NS.pdf.countUnsupported('café'), 0, 'é is inside Latin-1');
  assert.equal(NS.pdf.countUnsupported('中'), 1);
});

test('an unbalanced fence is treated as prose, not swallowed content', () => {
  const runs = NS.sections.splitFences('before\n```js\nconst a = 1;\nafter');
  assert.ok(runs.length >= 1);
  assert.equal(runs.every((run) => run.code === false), true);
  assert.match(runs.map((run) => run.text).join('\n'), /after/);
});

test('a selection is stated in the file metadata (FR-023)', () => {
  const chat = NS.chat.applySelection(sampleChat(), 1, 2);
  const text = decoder.decode(render(chat, 'md').bytes);
  assert.match(text, /> Selection: turns 1 to 2 of 4/);
  assert.equal(text.includes('Still typing'), false);
});

test('a partial capture is disclosed in the exported file (FR-014)', () => {
  const chat = NS.chat.createChat({
    site: 'deepseek',
    siteLabel: 'DeepSeek',
    title: 'Partial',
    partial: true,
    unreadableTurns: 2,
    turns: [{ role: 'user', text: 'hello' }]
  });
  const text = decoder.decode(render(chat, 'txt').bytes);
  assert.match(text, /Capture: only the messages the page had rendered were read/);
  assert.match(text, /2 message\(s\) could not be read/);
});

test('a walked but incomplete capture is disclosed with its reason (FR-005)', () => {
  const chat = NS.chat.createChat({
    site: 'claude',
    siteLabel: 'Claude',
    title: 'Very long',
    turns: [{ role: 'user', text: 'one' }, { role: 'assistant', text: 'two' }],
    completeness: { state: 'incomplete', walked: true, captured: 2, reason: 'the walk ran out of time' }
  });

  const text = decoder.decode(render(chat, 'md').bytes);
  assert.match(text, /Capture: incomplete\. The conversation is longer than the walk could read\./);
  assert.match(text, /Reason: the walk ran out of time\./);
  assert.match(text, /> Note: scroll to the top of the conversation and export again/);
});

test('a complete capture says so and carries no warning note (FR-004)', () => {
  const chat = NS.chat.createChat({
    site: 'gemini',
    siteLabel: 'Gemini',
    title: 'Whole thing',
    turns: [{ role: 'user', text: 'one' }],
    completeness: { state: 'complete', walked: true, captured: 1, steps: 2, durationMs: 300 }
  });

  const text = decoder.decode(render(chat, 'md').bytes);
  assert.match(text, /> Capture: the whole conversation was read\./);
  assert.equal(/scroll to the top/.test(text), false);
});

test('the exported filename carries the title, the site, and the extension', () => {
  const exported = render(sampleChat(), 'pdf');
  assert.equal(exported.filename, 'Reverse-a-string_ChatGPT_2026-09-26-090503.pdf');
});

test('a chat extracted from a fixture renders in every format', () => {
  const result = NS.dom.extractChat(NS.adapters.chatgpt, loadFixture('chatgpt.html'), {
    url: 'https://chatgpt.com/c/abc'
  });
  assert.equal(result.ok, true);
  for (const format of ['md', 'txt', 'docx', 'pdf']) {
    assert.ok(render(result.chat, format).bytes.length > 0, format + ' produced no bytes');
  }
});

/** Minimal reader for the STORE-method archives this repo writes. */
function readStoredZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoderUtf8 = new TextDecoder();
  const entries = {};
  let offset = 0;

  while (view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoderUtf8.decode(bytes.subarray(nameStart, nameStart + nameLength));

    assert.equal(method, 0, 'expected a stored entry for ' + name);
    entries[name] = decoderUtf8.decode(bytes.subarray(dataStart, dataStart + compressedSize));
    offset = dataStart + compressedSize;
  }

  return entries;
}
