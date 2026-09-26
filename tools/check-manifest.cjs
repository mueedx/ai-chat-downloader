// tools/check-manifest.js
// The store rejects a manifest with a long description, a wildcard host permission, or a
// permission the project has not justified. This check runs in CI so those mistakes fail
// loudly rather than at review time. Run with: npm run check:manifest

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ALLOWED_PERMISSIONS = ['storage', 'downloads'];
const LIMITS = { name: 75, description: 132, version: 20 };

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const problems = [];

const fail = (message) => problems.push(message);

if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
if (String(manifest.name || '').length > LIMITS.name) fail('name is longer than ' + LIMITS.name);
if (String(manifest.description || '').length > LIMITS.description) {
  fail('description is longer than ' + LIMITS.description + ' characters');
}
if (!/^\d+(\.\d+){0,3}$/.test(String(manifest.version || ''))) fail('version is not a dotted number');
if (String(manifest.version || '').length > LIMITS.version) fail('version is too long');

for (const permission of manifest.permissions || []) {
  if (!ALLOWED_PERMISSIONS.includes(permission)) fail('unjustified permission: ' + permission);
}

for (const pattern of manifest.host_permissions || []) {
  if (pattern === '<all_urls>' || pattern === '*://*/*') fail('wildcard host permission: ' + pattern);
  try {
    const url = new URL(pattern);
    if (url.protocol !== 'https:') fail('non-https host permission: ' + pattern);
  } catch (error) {
    fail('unparseable host permission: ' + pattern);
  }
}

const requiredFiles = [
  'manifest.json',
  'src/background.js',
  'src/content.js',
  'src/popup.html',
  'src/options.html',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) fail('missing required file: ' + file);
}

for (const script of manifest.content_scripts || []) {
  for (const file of script.js || []) {
    if (!fs.existsSync(path.join(root, file))) fail('content script missing: ' + file);
  }
}

const source = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) source.push(full);
  }
};
walk(path.join(root, 'src'));

for (const file of source) {
  const code = fs.readFileSync(file, 'utf8');
  if (/\beval\s*\(/.test(code)) fail('eval found in ' + path.relative(root, file));
  if (/new\s+Function\s*\(/.test(code)) fail('new Function found in ' + path.relative(root, file));
  if (/\bfetch\s*\(/.test(code)) fail('fetch found in ' + path.relative(root, file));
  if (/\bXMLHttpRequest\b/.test(code)) fail('XMLHttpRequest found in ' + path.relative(root, file));
  if (/\bWebSocket\b/.test(code)) fail('WebSocket found in ' + path.relative(root, file));
  if (/\bBuffer\b/.test(code)) fail('Node Buffer used in ' + path.relative(root, file));
  if (/https?:\/\/(?!chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com|chat\.deepseek\.com|chat\.qwen\.ai|tongyi\.aliyun\.com|kimi\.com|www\.kimi\.com|kimi\.moonshot\.cn|schemas\.openxmlformats\.org)/.test(code)) {
    fail('unexpected remote URL in ' + path.relative(root, file));
  }
}

// A service worker global scope has no window, no document, and no location. A reference to any
// of them throws during evaluation, the worker never registers its listener, and every export
// silently fails to write a file. This shipped once; the check is here so it cannot again.
const workerFile = manifest.background && manifest.background.service_worker;
if (workerFile) {
  const workerPath = path.join(root, workerFile);
  if (!fs.existsSync(workerPath)) {
    fail('service worker missing: ' + workerFile);
  } else {
    const workerCode = fs
      .readFileSync(workerPath, 'utf8')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    for (const forbidden of ['window', 'document', 'location', 'navigator']) {
      const pattern = new RegExp('(^|[^.' + forbidden[0] + '\\w])' + forbidden + '\\b');
      if (pattern.test(workerCode)) {
        fail(workerFile + ' references ' + forbidden + ', which a service worker does not have');
      }
    }

    // The worker is loaded on its own, so it must not need the namespace bootstrap.
    if (/AIChatDownloader;|AIChatDownloader\)/.test(workerCode)) {
      fail(workerFile + ' must create its own namespace: the manifest does not load the bootstrap there');
    }
  }
}

// Every other entry point really is a page or a content script, so a window reference is fine
// there. This is a note, not a check, and it exists because the difference caused a real bug.
for (const script of manifest.content_scripts || []) {
  const first = (script.js || [])[0];
  if (first && !/namespace\.js$/.test(first)) {
    fail('content scripts must load src/core/namespace.js first, found ' + first);
  }
}

if (problems.length) {
  console.error('manifest check failed:');
  for (const problem of problems) console.error('  - ' + problem);
  process.exit(1);
}

console.log('manifest check passed: ' + (manifest.host_permissions || []).length + ' origins, permissions ' + (manifest.permissions || []).join(' + '));
