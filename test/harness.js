// test/harness.js
// Loads the extension's classic scripts into the current Node context, with `window`
// aliased to `globalThis`, so the same source files the browser runs are what the tests
// exercise. No build step, no module loader shim in src/.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, '..', 'src');

const loaded = new Set();

export function loadSource(relativePath) {
  if (loaded.has(relativePath)) return;
  const file = path.join(srcDir, relativePath);
  const code = readFileSync(file, 'utf8');
  // eslint-disable-next-line no-new-func -- test harness, not extension code
  new Function('window', code)(globalThis);
  loaded.add(relativePath);
}

export function loadExtension() {
  globalThis.window = globalThis;
  for (const file of [
    'core/namespace.js',
    'core/chat.js',
    'core/filename.js',
    'core/dom.js',
    'core/sites.js',
    'adapters/chatgpt.js',
    'adapters/claude.js',
    'adapters/gemini.js',
    'adapters/deepseek.js',
    'adapters/qwen.js',
    'adapters/kimi.js',
    'adapters/index.js',
    'exporters/sections.js',
    'exporters/markdown.js',
    'exporters/text.js',
    'exporters/zip.js',
    'exporters/docx.js',
    'exporters/pdf.js',
    'exporters/index.js'
  ]) {
    loadSource(file);
  }
  return globalThis.AIChatDownloader;
}

export function fixturePath(name) {
  return path.join(here, 'fixtures', name);
}
