// test/filename.test.js
// Filenames have to survive three operating systems and never collide.

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadExtension } from './harness.js';

const NS = loadExtension();
const AT = new Date(2026, 8, 26, 9, 5, 3);

const WINDOWS_FORBIDDEN = /[\\/:*?"<>|]/;

test('path separators and characters Windows rejects are removed', () => {
  const slug = NS.filename.slugify('a/b\\c:d*e?f"g<h>i|j');
  assert.equal(WINDOWS_FORBIDDEN.test(slug), false);
});

test('a title cannot escape the download folder', () => {
  const name = NS.filename.buildFilename({
    title: '../../etc/passwd',
    siteLabel: 'Claude',
    extension: 'md',
    date: AT
  });
  assert.equal(name.includes('/'), false);
  assert.equal(name.includes('..'), false);
});

test('letters and numbers from other scripts survive', () => {
  assert.equal(NS.filename.slugify('咖啡 配方'), '咖啡-配方');
  assert.equal(NS.filename.slugify('Café 中文'), 'Café-中文');
});

test('emoji are kept and never split in half', () => {
  const long = '😀'.repeat(40);
  const slug = NS.filename.slugify(long);
  assert.equal(Array.from(slug).every((char) => char === '😀'), true);
  assert.ok(Array.from(slug).length <= NS.filename.MAX_SLUG_LENGTH);
});

test('the timestamp is local, zero padded, and sorts chronologically', () => {
  const stamp = NS.filename.timestamp(AT);
  assert.equal(stamp, '2026-09-26-090503');
  assert.ok(stamp > NS.filename.timestamp(new Date(2026, 8, 26, 9, 5, 2)));
});

test('two exports of the same conversation get different names', () => {
  const options = { title: 'Same chat', siteLabel: 'ChatGPT', extension: 'md' };
  const first = NS.filename.buildFilename(Object.assign({}, options, { date: AT }));
  const second = NS.filename.buildFilename(
    Object.assign({}, options, { date: new Date(2026, 8, 26, 9, 5, 4) })
  );
  assert.notEqual(first, second);
});

test('a conversation with no usable title falls back to the site and the time', () => {
  const name = NS.filename.buildFilename({
    title: '   ',
    siteLabel: 'DeepSeek',
    extension: 'txt',
    date: AT
  });
  assert.equal(name, 'chat_DeepSeek_2026-09-26-090503.txt');
});

test('a selection is visible in the filename', () => {
  const name = NS.filename.buildFilename({
    title: 'Long chat',
    siteLabel: 'Kimi',
    extension: 'pdf',
    selection: { from: 3, to: 9, total: 40 },
    date: AT
  });
  assert.match(name, /_turns-3-9_/);
  assert.match(name, /\.pdf$/);
});

test('a very long title is trimmed without a trailing dash', () => {
  const slug = NS.filename.slugify('word '.repeat(40));
  assert.ok(slug.length <= NS.filename.MAX_SLUG_LENGTH);
  assert.equal(slug.endsWith('-'), false);
});
