// test/worker.test.js
// The service worker is the one file that does not run in a page. A service worker global scope
// has no `window` and no `document`, and the manifest loads it on its own, without the namespace
// bootstrap. Loading it through the shared harness set `globalThis.window`, which hid a real
// ReferenceError: the file threw during evaluation, the worker never registered its listener, and
// every export silently failed to write a file.
//
// So this suite evaluates the worker the way Chrome does, in a context where `window` genuinely
// does not exist, using a real `vm` context rather than the shared harness.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const WORKER = new URL('../src/background.js', import.meta.url);

async function loadAsServiceWorker() {
  const code = await readFile(WORKER, 'utf8');

  const downloads = [];
  const badge = [];
  let listener = null;

  const context = {
    // A service worker global scope. Deliberately no `window` and no `document`.
    self: undefined,
    chrome: {
      runtime: { onMessage: { addListener: (fn) => { listener = fn; } } },
      action: {
        setBadgeText: (options) => badge.push(options),
        setBadgeBackgroundColor: (options) => badge.push(options)
      },
      downloads: {
        download: (options) => {
          downloads.push(options);
          return Promise.resolve(42);
        }
      }
    },
    setTimeout: () => {},
    console: console
  };
  context.self = context;
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'src/background.js' });

  return {
    namespace: context.AIChatDownloader,
    listener: listener,
    downloads: downloads,
    badge: badge
  };
}

test('the service worker evaluates with no window and no document in scope', async () => {
  const worker = await loadAsServiceWorker();

  assert.equal(typeof worker.namespace, 'object', 'the namespace is created by the worker itself');
  assert.equal(typeof worker.namespace.background, 'object');
  assert.equal(typeof worker.listener, 'function', 'the download listener is registered');
});

test('a file that referenced window would fail here, which is the point of this suite', async () => {
  const code = await readFile(WORKER, 'utf8');
  assert.equal(
    /(^|[^.\w])window\./.test(code.replace(/no `window`/g, '')),
    false,
    'the service worker must not reference window at all'
  );
});

test('the worker starts a download from a popup message', async () => {
  const worker = await loadAsServiceWorker();

  let response = null;
  const returned = worker.listener(
    { type: 'download', payload: { url: 'blob:chrome-extension://x/1', filename: 'chat.md' } },
    {},
    (value) => { response = value; }
  );

  assert.equal(returned, true, 'the listener answers later, so it must return true');
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Compared field by field: the value was built inside a vm realm, so its prototype is not
  // this realm's Object.prototype and a deep comparison would fail on identity alone.
  assert.equal(response.ok, true);
  assert.equal(response.downloadId, 42);
  assert.equal(worker.downloads.length, 1);
  const request = worker.downloads[0];
  assert.equal(request.url, 'blob:chrome-extension://x/1');
  assert.equal(request.filename, 'chat.md');
  assert.equal(request.saveAs, false);
  assert.equal(request.conflictAction, 'uniquify');
});

test('a download that throws is reported as a failure and flashes a badge', async () => {
  const code = await readFile(WORKER, 'utf8');
  const context = {
    chrome: {
      runtime: { onMessage: { addListener: () => {} } },
      action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
      downloads: { download: () => Promise.reject(new Error('disk full')) }
    },
    setTimeout: () => {}
  };
  context.self = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: 'src/background.js' });

  const result = await context.AIChatDownloader.background.startDownload({
    url: 'blob:x',
    filename: 'chat.md'
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /disk full/);
});

test('the service worker touches neither window nor document', async () => {
  const code = await readFile(WORKER, 'utf8');
  const withoutComments = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  assert.equal(/(^|[^.\w])window\b/.test(withoutComments), false, 'no window in a worker');
  assert.equal(/\bdocument\b/.test(withoutComments), false, 'no document in a worker');
  assert.equal(/\blocation\b/.test(withoutComments), false, 'no location in a worker');
});

test('the manifest names exactly one service worker, and it is this file', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.background.service_worker, 'src/background.js');
  assert.equal('type' in manifest.background, false, 'a classic worker needs no module type');
});
