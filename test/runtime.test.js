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

// The content script and the service worker both listen, exactly as in the browser, so the
// stub collects them and the first listener to answer wins.
function ask(type, payload) {
  let response = null;
  let async = false;
  for (const listener of messageListeners) {
    const returned = listener({ type: type, payload: payload }, {}, (value) => {
      if (response === null) response = value;
    });
    if (returned === true) async = true;
  }
  return { response: response, async: async };
}

test('the content script answers which site it is on', () => {
  loadRuntime({
    host: 'chatgpt.com',
    href: 'https://chatgpt.com/c/abc',
    document: loadFixture('chatgpt.html')
  });

  const info = ask('site-info').response;
  assert.equal(info.supported, true);
  assert.equal(info.site, 'chatgpt');
  assert.equal(info.siteLabel, 'ChatGPT');
  assert.equal(info.verified, false, 'no site is verified yet, and the UI must say so');
  assert.ok(info.knownIssues.length > 0);
});

test('an unsupported site is refused before any DOM work', () => {
  loadRuntime({
    host: 'mail.google.com',
    href: 'https://mail.google.com/',
    document: parseHtml('<p>inbox</p>')
  });

  const info = ask('site-info').response;
  assert.equal(info.supported, false);
  assert.match(info.message, /not supported/);
  assert.deepEqual(info.sites, ['ChatGPT', 'Claude', 'Gemini', 'DeepSeek', 'Qwen', 'Kimi']);

  const extract = ask('extract').response;
  assert.equal(extract.ok, false);
  assert.match(extract.reason, /not supported/);
});

test('extraction answers with the turn count, a preview, and the real url', () => {
  loadRuntime({
    host: 'chatgpt.com',
    href: 'https://chatgpt.com/c/abc',
    document: loadFixture('chatgpt.html')
  });

  const result = ask('extract').response;
  assert.equal(result.ok, true);
  assert.equal(result.turnCount, 3);
  assert.equal(result.unreadableTurns, 0);
  assert.equal(result.chat.url, 'https://chatgpt.com/c/abc');
  assert.equal(result.chat.siteLabel, 'ChatGPT');
  assert.match(result.preview, /^You: How do I reverse a string/);
});

test('a page with no conversation reports the selectors it tried and no chat', () => {
  loadRuntime({
    host: 'chatgpt.com',
    href: 'https://chatgpt.com/',
    document: parseHtml('<main><textarea></textarea></main>')
  });

  const result = ask('extract').response;
  assert.equal(result.ok, false);
  assert.equal(result.chat, undefined, 'a failure must not carry a chat object');
  assert.match(result.reason, /No conversation messages/);
  assert.deepEqual(result.tried, window.AIChatDownloader.adapters.chatgpt.turnSelectors);
});

test('a streaming reply is reported as incomplete through the message API', () => {
  const document = parseHtml(
    '<div data-message-author-role="user">q</div>' +
      '<div data-message-author-role="assistant">partial' +
      '<button data-stop-button></button></div>'
  );
  loadRuntime({ host: 'chatgpt.com', href: 'https://chatgpt.com/c/1', document: document });

  const result = ask('extract').response;
  assert.equal(result.ok, true);
  assert.equal(result.incompleteTurns, 1);
  assert.equal(result.chat.turns[1].incomplete, true);
  assert.equal(result.chat.title, '', 'a page with no title reports an empty title, not a guess');
});

test('an unknown message type is ignored rather than answered', () => {
  loadRuntime({ host: 'claude.ai', href: 'https://claude.ai/chat/1', document: loadFixture('claude.html') });
  const result = ask('ping');
  assert.equal(result.response, null);
  assert.equal(result.async, false);
});

test('the preview is capped so a long reply cannot flood the popup', () => {
  const long = 'x'.repeat(5000);
  const document = parseHtml('<div data-message-author-role="user">' + long + '</div>');
  loadRuntime({ host: 'chatgpt.com', href: 'https://chatgpt.com/c/1', document: document });

  const result = ask('extract').response;
  assert.ok(result.preview.length < 600, 'preview was ' + result.preview.length + ' characters');
});

test('preferences round-trip and a bad stored value falls back to the default', () => {
  const NS = loadRuntime({
    host: 'chatgpt.com',
    href: 'https://chatgpt.com/c/1',
    document: loadFixture('chatgpt.html')
  });

  return (async () => {
    assert.deepEqual(await NS.storage.getSettings(), { format: 'md', disabledSites: [] });

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

test('only local preferences are stored, and storage keys are the two known ones', () => {
  loadRuntime({ host: 'chatgpt.com', href: 'https://chatgpt.com/c/1', document: loadFixture('chatgpt.html') });
  assert.deepEqual(Object.keys(window.AIChatDownloader.storage.DEFAULTS).sort(), [
    'disabledSites',
    'format'
  ]);
  assert.equal('sync' in window.AIChatDownloader.storage.DEFAULTS, false, 'sync storage is unused on purpose');
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
