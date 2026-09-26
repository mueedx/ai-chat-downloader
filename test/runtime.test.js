// test/runtime.test.js
// The content script and the preference store, driven through the same message API the
// popup uses, with a fake chrome and a real parsed document. Node's test runner gives each
// file its own process, so the globals here do not leak into the other suites.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { loadExtension, loadSource } from './harness.js';
import { parseHtml, loadFixture } from './minidom.js';

// --- a fake chrome, installed before the extension sources are loaded -------------

const store = {};
const messageListeners = [];
const downloadCalls = [];

globalThis.chrome = {
  runtime: {
    onMessage: { addListener: (fn) => { messageListeners.push(fn); } },
    sendMessage: (message, callback) => callback && callback({ ok: true, downloadId: 3 })
  },
  storage: {
    local: {
      get: (defaults, callback) => callback(Object.assign({}, defaults, store)),
      set: (values, callback) => { Object.assign(store, values); callback && callback(); }
    }
  },
  action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
  downloads: { download: (options) => { downloadCalls.push(options); return Promise.resolve(3); } },
  tabs: { query: () => {}, sendMessage: () => {} }
};

function loadRuntime({ host, href, document }) {
  globalThis.location = { host: host, href: href };
  globalThis.document = document;
  loadExtension();
  loadSource('storage.js');
  loadSource('content.js');
  loadSource('background.js');
  return window.AIChatDownloader;
}

// The content script and the service worker both listen, exactly as in the browser, so the stub
// collects them and the first listener to answer wins. Extraction is asynchronous now that it
// can walk a transcript, so a listener returning true means the answer arrives later.
function ask(type, payload) {
  return new Promise((resolve) => {
    let response = null;
    let async = false;
    const send = (value) => { if (response === null) response = value; };

    for (const listener of messageListeners) {
      if (listener({ type: type, payload: payload }, {}, send) === true) async = true;
    }

    if (!async) {
      resolve({ response: response, async: false });
      return;
    }
    setTimeout(() => resolve({ response: response, async: true }), 0);
  });
}

test('the content script answers which site it is on', async () => {
  loadRuntime({
    host: 'chatgpt.com',
    href: 'https://chatgpt.com/c/abc',
    document: loadFixture('chatgpt.html')
  });

  const info = (await ask('site-info')).response;
  assert.equal(info.supported, true);
  assert.equal(info.site, 'chatgpt');
  assert.equal(info.siteLabel, 'ChatGPT');
  assert.equal(info.verified, false, 'no site is verified yet, and the UI must say so');
  assert.ok(info.knownIssues.length > 0);
});

test('an unsupported site is refused before any DOM work', async () => {
  loadRuntime({
    host: 'mail.google.com',
    href: 'https://mail.google.com/',
    document: parseHtml('<p>inbox</p>')
  });

  const info = (await ask('site-info')).response;
  assert.equal(info.supported, false);
  assert.match(info.message, /not supported/);
  assert.deepEqual(info.sites, ['ChatGPT', 'Claude', 'Gemini', 'DeepSeek', 'Qwen', 'Kimi']);

  const extract = (await ask('extract')).response;
  assert.equal(extract.ok, false);
  assert.match(extract.reason, /not supported/);
});

test('extraction answers with the turn count, a preview, and the real url', async () => {
  loadRuntime({
    host: 'chatgpt.com',
    href: 'https://chatgpt.com/c/abc',
    document: loadFixture('chatgpt.html')
  });

  const result = (await ask('extract')).response;
  assert.equal(result.ok, true);
  assert.equal(result.turnCount, 3);
  assert.equal(result.unreadableTurns, 0);
  assert.equal(result.chat.url, 'https://chatgpt.com/c/abc');
  assert.equal(result.chat.siteLabel, 'ChatGPT');
  assert.match(result.preview, /^You: How do I reverse a string/);
});

test('a page with no conversation reports the selectors it tried and no chat', async () => {
  loadRuntime({
    host: 'chatgpt.com',
    href: 'https://chatgpt.com/',
    document: parseHtml('<main><textarea></textarea></main>')
  });

  const result = (await ask('extract')).response;
  assert.equal(result.ok, false);
  assert.equal(result.chat, undefined, 'a failure must not carry a chat object');
  assert.match(result.reason, /No conversation messages/);
  assert.deepEqual(result.tried, window.AIChatDownloader.adapters.chatgpt.turnSelectors);
});

test('a streaming reply is reported as incomplete through the message API', async () => {
  const document = parseHtml(
    '<div data-message-author-role="user">q</div>' +
      '<div data-message-author-role="assistant">partial' +
      '<button data-stop-button></button></div>'
  );
  loadRuntime({ host: 'chatgpt.com', href: 'https://chatgpt.com/c/1', document: document });

  const result = (await ask('extract')).response;
  assert.equal(result.ok, true);
  assert.equal(result.incompleteTurns, 1);
  assert.equal(result.chat.turns[1].incomplete, true);
  assert.equal(result.chat.title, '', 'a page with no title reports an empty title, not a guess');
});

test('an unknown message type is ignored rather than answered', async () => {
  loadRuntime({ host: 'claude.ai', href: 'https://claude.ai/chat/1', document: loadFixture('claude.html') });
  const result = await ask('ping');
  assert.equal(result.response, null);
  assert.equal(result.async, false);
});

test('the preview is capped so a long reply cannot flood the popup', async () => {
  const long = 'x'.repeat(5000);
  const document = parseHtml('<div data-message-author-role="user">' + long + '</div>');
  loadRuntime({ host: 'chatgpt.com', href: 'https://chatgpt.com/c/1', document: document });

  const result = (await ask('extract')).response;
  assert.ok(result.preview.length < 600, 'preview was ' + result.preview.length + ' characters');
});

test('preferences round-trip and a bad stored value falls back to the default', () => {
  const NS = loadRuntime({
    host: 'chatgpt.com',
    href: 'https://chatgpt.com/c/1',
    document: loadFixture('chatgpt.html')
  });

  return (async () => {
    assert.deepEqual(await NS.storage.getSettings(), {
      format: 'md',
      disabledSites: [],
      walkEnabled: true,
      walkDisabledSites: []
    });

    assert.equal(await NS.storage.setFormat('pdf'), 'pdf');
    assert.equal((await NS.storage.getSettings()).format, 'pdf');

    // A corrupted or hand-edited value must not become an unusable default.
    assert.equal(await NS.storage.setFormat('exe'), 'md');
    store.format = 'docx';
    assert.equal((await NS.storage.getSettings()).format, 'docx');

    assert.equal(await NS.storage.isSiteDisabled('kimi'), false);
    await NS.storage.setSiteDisabled('kimi', true);
    assert.deepEqual((await NS.storage.getSettings()).disabledSites, ['kimi']);
    assert.equal(await NS.storage.isSiteDisabled('kimi'), true);

    await NS.storage.setSiteDisabled('kimi', false);
    assert.deepEqual((await NS.storage.getSettings()).disabledSites, []);

    // Garbage in the disabled list is filtered rather than trusted.
    store.disabledSites = ['kimi', 42, null, 'gemini'];
    assert.deepEqual((await NS.storage.getSettings()).disabledSites, ['kimi', 'gemini']);
  })();
});

test('only local preferences are stored, and nothing else', () => {
  loadRuntime({ host: 'chatgpt.com', href: 'https://chatgpt.com/c/1', document: loadFixture('chatgpt.html') });
  assert.deepEqual(Object.keys(window.AIChatDownloader.storage.DEFAULTS).sort(), [
    'disabledSites',
    'format',
    'walkDisabledSites',
    'walkEnabled'
  ]);
  assert.equal('sync' in window.AIChatDownloader.storage.DEFAULTS, false, 'sync storage is unused on purpose');
  assert.equal(
    JSON.stringify(window.AIChatDownloader.storage.DEFAULTS).includes('chat'),
    false,
    'no key looks like a transcript'
  );
});

test('the walk switches work per site and globally, and both persist', async () => {
  const NS = loadRuntime({
    host: 'chatgpt.com',
    href: 'https://chatgpt.com/c/1',
    document: loadFixture('chatgpt.html')
  });

  assert.equal(await NS.storage.shouldWalk('chatgpt'), true, 'on by default');

  await NS.storage.setWalkDisabled('chatgpt', true);
  assert.equal(await NS.storage.shouldWalk('chatgpt'), false, 'a single site can be opted out');
  assert.equal(await NS.storage.shouldWalk('claude'), true, 'other sites are unaffected');

  await NS.storage.setWalkEnabled(false);
  assert.equal(await NS.storage.shouldWalk('claude'), false, 'the global switch wins everywhere');

  await NS.storage.setWalkEnabled(true);
  await NS.storage.setWalkDisabled('chatgpt', false);
  assert.equal(await NS.storage.shouldWalk('chatgpt'), true);
  assert.deepEqual((await NS.storage.getSettings()).walkDisabledSites, []);
});

test('a read without a walk never claims the file is complete', async () => {
  loadRuntime({ host: 'chatgpt.com', href: 'https://chatgpt.com/c/1', document: loadFixture('chatgpt.html') });
  const result = (await ask('extract', {})).response;

  assert.equal(result.ok, true);
  assert.equal(result.completeness.state, 'incomplete');
  assert.equal(result.completeness.walked, false);
  assert.equal(result.walk, null);
  assert.match(result.completeness.reason, /preview read/);
  assert.equal(result.chat.partial, true);
});

test('a walk that runs to the bottom claims the capture is complete', async () => {
  const doc = loadFixture('chatgpt.html');
  const main = doc.querySelector('main');
  // A short but genuinely scrollable transcript: the walk sweeps it and puts the user back.
  main.scrollHeight = 400;
  main.clientHeight = 100;
  main.scrollTop = 120;

  loadRuntime({ host: 'chatgpt.com', href: 'https://chatgpt.com/c/1', document: doc });
  const result = (await ask('extract', { walk: true })).response;

  assert.equal(result.ok, true);
  assert.equal(result.walk.ran, true);
  assert.equal(result.walk.completed, true);
  assert.equal(result.completeness.state, 'complete');
  assert.equal(result.chat.partial, false);
  assert.equal(main.scrollTop, 120, 'the reading position is back where it started');
});

test('a walk that is switched off says so in the file', async () => {
  loadRuntime({ host: 'chatgpt.com', href: 'https://chatgpt.com/c/1', document: loadFixture('chatgpt.html') });
  const result = (await ask('extract', { walk: false })).response;

  assert.equal(result.completeness.state, 'incomplete');
  assert.match(result.completeness.reason, /switched off/);
  assert.equal(result.turnCount, 3, 'the rendered part is still exported');
});

test('the background service worker refuses a download request with no payload', async () => {
  const NS = loadRuntime({
    host: 'chatgpt.com',
    href: 'https://chatgpt.com/c/1',
    document: loadFixture('chatgpt.html')
  });

  assert.deepEqual(await NS.background.startDownload(null), { ok: false, error: 'Nothing to download.' });
  assert.deepEqual(await NS.background.startDownload({ url: 'blob:x' }), {
    ok: false,
    error: 'Nothing to download.'
  });

  const started = await NS.background.startDownload({ url: 'blob:x', filename: 'chat.md' });
  assert.equal(started.ok, true);
  assert.equal(started.downloadId, 3);
  assert.deepEqual(downloadCalls, [{ url: 'blob:x', filename: 'chat.md', saveAs: false, conflictAction: 'uniquify' }]);
});

test('every script a page loads exists on disk', async () => {
  for (const page of ['src/popup.html', 'src/options.html']) {
    const html = await readFile(new URL('../' + page, import.meta.url), 'utf8');
    const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(references.length > 0, page + ' references nothing');
    for (const reference of references) {
      const full = new URL('../src/' + reference, import.meta.url);
      await readFile(full, 'utf8');
    }
  }
});

test('the manifest content script list matches the files that exist', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
  const listed = manifest.content_scripts.flatMap((entry) => entry.js);

  assert.ok(listed.includes('src/core/namespace.js'), 'the namespace must load first');
  assert.equal(listed[0], 'src/core/namespace.js');
  assert.equal(listed[listed.length - 1], 'src/content.js');

  for (const file of listed) await readFile(new URL('../' + file, import.meta.url), 'utf8');
});
