// test/popup.test.js
// The popup is the whole user flow: read the page, pick a format, write a file. It needs a
// DOM, so this suite supplies the small element surface popup.js actually touches, then
// drives the real click handlers. The point is to prove the export path end to end, and to
// prove a failed extraction never reaches the download call.

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadExtension, loadPage } from './harness.js';
import { loadFixture } from './minidom.js';

const IDS = [
  'unsupported', 'unsupported-text', 'site', 'title', 'count', 'preview', 'formats',
  'format-note', 'walk', 'walk-note', 'selection-mode', 'selection-fields', 'range-from',
  'range-to', 'warnings', 'warning-list', 'export', 'status', 'refresh'
];

function makeElement(id) {
  const listeners = new Map();
  const element = {
    id: id,
    tagName: 'DIV',
    textContent: '',
    className: '',
    value: '',
    checked: false,
    disabled: false,
    children: [],
    attributes: {},
    classList: {
      names: new Set(),
      toggle(name, force) {
        const on = force === undefined ? !this.names.has(name) : Boolean(force);
        if (on) this.names.add(name); else this.names.delete(name);
        this.sync();
        return on;
      },
      add(name) { this.names.add(name); this.sync(); },
      remove(name) { this.names.delete(name); this.sync(); },
      contains(name) { return this.names.has(name); },
      sync() {
        element.className = Array.from(this.names).join(' ');
      }
    },
    setAttribute(name, value) { element.attributes[name] = value; },
    getAttribute(name) { return element.attributes[name] === undefined ? null : element.attributes[name]; },
    appendChild(child) { element.children.push(child); return child; },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    removeEventListener(type, handler) {
      const list = listeners.get(type) || [];
      const at = list.indexOf(handler);
      if (at !== -1) list.splice(at, 1);
    },
    dispatch(type) {
      return Promise.all((listeners.get(type) || []).map((handler) => handler()));
    },
    querySelectorAll(selector) {
      return selector === 'button' ? element.children : [];
    }
  };

    // In a real element, assigning innerHTML drops the existing children. The stub has to do
    // the same or a re-render looks like an append.
    let _innerHTML = '';
    Object.defineProperty(element, 'innerHTML', {
      enumerable: true,
      get() { return _innerHTML; },
      set(value) { _innerHTML = value; if (value === '') element.children.length = 0; }
    });

  return element;
}

function harness(initial, site = SUPPORTED, extract = goodExtract) {
  const elements = new Map(IDS.map((id) => [id, makeElement(id)]));
  const downloads = [];
  const extracts = [];
  const stored = Object.assign({}, initial);

  globalThis.chrome = {
    runtime: {
      onMessage: { addListener: () => {} },
      sendMessage: (message, callback) => {
        if (message.type === 'download') downloads.push(message.payload);
        callback && callback({ ok: true, downloadId: 11 });
      }
    },
    storage: {
      local: {
        get: (defaults, callback) => callback(Object.assign({}, defaults, stored)),
        set: (values, callback) => { Object.assign(stored, values); callback && callback(); }
      }
    },
    downloads: { onChanged: { addListener: () => {}, removeListener: () => {} } },
    tabs: {
      query: (_query, callback) => callback([{ id: 7, url: 'https://example.test/c/1' }]),
      sendMessage: (_id, message, callback) => {
        if (message.type === 'site-info') {
          callback(site);
          return;
        }
        extracts.push(message.payload);
        callback(extract());
      }
    }
  };

  globalThis.document = {
    getElementById: (id) => elements.get(id) || null,
    createElement: (tag) => makeElement('created-' + tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: text }),
    addEventListener: () => {}
  };
  globalThis.location = { host: 'chatgpt.com', href: 'https://example.test/c/1' };
  globalThis.URL.createObjectURL = () => 'blob:chrome-extension://test/' + downloads.length;
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.Blob = class {
    constructor(parts) { this.parts = parts; }
  };

  // Only what popup.html lists, and re-evaluated per case because the popup resolves its
  // elements once, at load time. A global the real popup scope lacks is exactly how a missing
  // script tag stays hidden until someone opens the popup.
  loadPage('popup.html', { force: true });

  return { elements: elements, downloads: downloads, stored: stored, extracts: extracts };
}

const SUPPORTED = {
  supported: true,
  site: 'chatgpt',
  siteLabel: 'ChatGPT',
  verified: false,
  knownIssues: 'note'
};

function goodExtract() {
  // The content script is the side that reads a document, so it runs with the manifest's files.
  loadExtension();
  const NS = window.AIChatDownloader;
  const result = NS.dom.extractChat(NS.adapters.chatgpt, loadFixture('chatgpt.html'), {
    url: 'https://example.test/c/1'
  });
  // The content script adds these summary fields; the stub plays its part here.
  result.turnCount = NS.chat.chatTurnCount(result.chat);
  result.unreadableTurns = result.chat.unreadableTurns;
  result.incompleteTurns = result.chat.incompleteTurns;
  result.partial = result.chat.partial;
  result.preview = result.chat.turns
    .slice(0, 2)
    .map((turn) => (turn.role === 'user' ? 'You' : 'ChatGPT') + ': ' + turn.text.slice(0, 240))
    .join('\n\n');
  return result;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test('the walk is disclosed before the export, and the page is told it will move', async () => {
  const ui = harness({}, SUPPORTED, goodExtract);
  await flush();

  const note = ui.elements.get('walk-note');
  assert.equal(ui.elements.get('walk').checked, true, 'the walk is on by default');
  assert.match(note.textContent, /will scroll to load the rest/);
  assert.match(note.textContent, /return to where you are/);

  // The preview read must not walk the page: that would move the page before the user asked.
  assert.deepEqual(ui.extracts[0], {});

  await ui.elements.get('export').dispatch('click');
  await flush();
  assert.deepEqual(ui.extracts[ui.extracts.length - 1], { walk: true });
});

test('turning the walk off says the page will not move, and the export respects it', async () => {
  const ui = harness({}, SUPPORTED, goodExtract);
  await flush();

  const toggle = ui.elements.get('walk');
  toggle.checked = false;
  await toggle.dispatch('change');
  assert.match(ui.elements.get('walk-note').textContent, /page has already rendered/);

  await ui.elements.get('export').dispatch('click');
  await flush();
  assert.deepEqual(ui.extracts[ui.extracts.length - 1], { walk: false });
});

test('a site switched off in the options page is not walked, and the popup says why', async () => {
  const ui = harness({ walkEnabled: true, walkDisabledSites: ['chatgpt'] }, SUPPORTED, goodExtract);
  await flush();

  assert.equal(ui.elements.get('walk').checked, true, 'the global switch is still on');
  assert.match(ui.elements.get('walk-note').textContent, /Off for this site in the options page/);

  await ui.elements.get('export').dispatch('click');
  await flush();
  assert.deepEqual(ui.extracts[ui.extracts.length - 1], { walk: false });
});

test('the popup offers four formats and marks the site as unverified', async () => {
  const ui = harness({}, SUPPORTED, goodExtract);
  await flush();

  assert.equal(ui.elements.get('formats').children.length, 4);
  assert.deepEqual(
    ui.elements.get('formats').children.map((button) => button.textContent),
    ['Markdown', 'Plain text', 'Word document', 'PDF']
  );
  assert.match(ui.elements.get('site').textContent, /^ChatGPT \(selectors unverified\)$/);
  assert.match(ui.elements.get('title').textContent, /Reverse a string/);
  assert.equal(ui.elements.get('count').textContent, '3');
  assert.equal(ui.elements.get('export').disabled, false);
});

test('an unsupported site disables the export and lists the sites that work', async () => {
  const ui = harness({}, { supported: false, message: 'This site is not supported. AI Chat Downloader works on: ChatGPT, Claude, Gemini, DeepSeek, Qwen, Kimi.', sites: [] },
    () => ({ ok: false, reason: 'not supported', tried: [] }));
  await flush();

  assert.equal(ui.elements.get('unsupported').classList.contains('hidden'), false);
  assert.match(ui.elements.get('unsupported-text').textContent, /not supported/);
  assert.equal(ui.elements.get('export').disabled, true);
  assert.equal(ui.downloads.length, 0, 'nothing is written when the site is unsupported');
});

test('exporting hands the file to the download path with a real filename', async () => {
  const ui = harness({}, SUPPORTED, goodExtract);
  await flush();

  await ui.elements.get('export').dispatch('click');
  await flush();

  assert.equal(ui.downloads.length, 1);
  assert.match(ui.downloads[0].url, /^blob:/);
  assert.match(ui.downloads[0].filename, /^Reverse-a-string_ChatGPT_\d{4}-\d{2}-\d{2}-\d{6}\.md$/);
  assert.match(ui.elements.get('status').textContent, /Saving /);
  assert.match(ui.elements.get('status').className, /status/);
});

test('choosing a format changes the file that is written and is remembered', async () => {
  const ui = harness({}, SUPPORTED, goodExtract);
  await flush();

  const pdfButton = ui.elements.get('formats').children[3];
  pdfButton.dispatch('click');
  await flush();

  assert.equal(ui.stored.format, 'pdf');
  await ui.elements.get('export').dispatch('click');
  await flush();

  assert.match(ui.downloads[0].filename, /\.pdf$/);
});

test('a failed extraction never reaches the download call and names the selectors', async () => {
  const ui = harness({}, SUPPORTED, () => ({
    ok: false,
    reason: 'No conversation messages were found on this page.',
    tried: ['[data-message-author-role]', 'article[data-testid^="conversation-turn"]']
  }));
  await flush();

  assert.equal(ui.elements.get('export').disabled, true);
  assert.match(ui.elements.get('status').textContent, /No conversation messages/);
  assert.match(ui.elements.get('status').textContent, /Tried: \[data-message-author-role\]/);
  assert.match(ui.elements.get('status').className, /error/);
  assert.equal(ui.downloads.length, 0);
});

test('a diagnosis worded by the content script reaches the panel as it was sent', async () => {
  const ui = harness({}, SUPPORTED, () => ({
    ok: false,
    reason: 'No conversation messages were found on this page.',
    tried: ['main div[class*="message"]'],
    detail: '0 matched main div[class*="message"] | found <section class="thread">'
  }));
  await flush();

  const status = ui.elements.get('status').textContent;
  assert.match(status, /No conversation messages/);
  assert.match(status, /0 matched main div\[class\*="message"\]/);
  assert.match(status, /found <section class="thread">/);
  assert.equal(ui.downloads.length, 0);
});

test('warnings for unreadable, incomplete, and partial captures reach the panel', async () => {
  const ui = harness({}, SUPPORTED, () => {
    const result = goodExtract();
    result.unreadableTurns = 2;
    result.incompleteTurns = 1;
    result.partial = true;
    return result;
  });
  await flush();

  const warnings = ui.elements.get('warning-list').children.map((li) => li.textContent);
  assert.equal(warnings.length, 3);
  assert.match(warnings[0], /2 message\(s\) could not be read/);
  assert.match(warnings[1], /1 message\(s\) were still being written/);
  assert.match(warnings[2], /Only the messages the page had rendered/);
});

test('a selection exports only the chosen turns and says so in the status line', async () => {
  const ui = harness({}, SUPPORTED, goodExtract);
  await flush();

  const toggle = ui.elements.get('selection-mode');
  toggle.checked = true;
  await toggle.dispatch('change');
  assert.equal(ui.elements.get('selection-fields').classList.contains('hidden'), false);

  ui.elements.get('range-from').value = '2';
  ui.elements.get('range-to').value = '2';

  await ui.elements.get('export').dispatch('click');
  await flush();

  assert.match(ui.downloads[0].filename, /_turns-2-2_/);
  assert.match(ui.elements.get('status').textContent, /Saving /);
});

test('a download the browser refuses is reported as a failure, not a success', async () => {
  const ui = harness({}, SUPPORTED, goodExtract);
  globalThis.chrome.runtime.sendMessage = (_message, callback) =>
    callback({ ok: false, error: 'The download could not be started.' });
  await flush();

  await ui.elements.get('export').dispatch('click');
  await flush();

  assert.match(ui.elements.get('status').textContent, /could not be started/);
  assert.match(ui.elements.get('status').className, /error/);
});
