// test/options.test.js
// The options page is where a user checks which sites are trustworthy, so the wording of the
// status board matters as much as the switches. It runs against a stubbed element surface,
// like the popup suite.

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadExtension, loadSource } from './harness.js';

function makeElement(id) {
  const listeners = new Map();
  const element = {
    id: id,
    textContent: '',
    className: '',
    value: '',
    checked: false,
    children: [],
    attributes: {},
    classList: {
      names: new Set(),
      toggle(name, force) {
        const on = force === undefined ? !this.names.has(name) : Boolean(force);
        if (on) this.names.add(name); else this.names.delete(name);
        this.sync();
      },
      contains: (name) => this.names.has(name),
      sync() { this.className = Array.from(this.names).join(' '); }
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatch(type) { return Promise.all((listeners.get(type) || []).map((h) => h())); },
    querySelectorAll() { return []; }
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

/** A real element aggregates its children's text, so the stub does too when asked. */
function textOf(node) {
  if (!node) return '';
  const own = typeof node.textContent === 'string' ? node.textContent : '';
  const kids = (node.children || []).map(textOf).join(' ');
  return (own + ' ' + kids).replace(/\s+/g, ' ').trim();
}

function harness(initial, beforeLoad) {
  const elements = new Map(
    ['formats', 'sites', 'status', 'walk-global', 'walk-sites'].map((id) => [id, makeElement(id)])
  );
  const stored = Object.assign({}, initial);

  globalThis.chrome = {
    runtime: { onMessage: { addListener: () => {} } },
    storage: {
      local: {
        get: (defaults, callback) => callback(Object.assign({}, defaults, stored)),
        set: (values, callback) => { Object.assign(stored, values); callback && callback(); }
      }
    }
  };
  globalThis.document = {
    getElementById: (id) => elements.get(id) || null,
    createElement: (tag) => makeElement('created-' + tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: text })
  };
  globalThis.location = { host: 'chatgpt.com', href: 'https://chatgpt.com/c/1' };

  const NS = loadExtension({ force: true });
  if (beforeLoad) beforeLoad(NS);
  loadSource('storage.js', { force: true });
  loadSource('options.js', { force: true });

  return { elements: elements, stored: stored };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test('the page starts on the stored default format', async () => {
  const ui = harness({ format: 'pdf', disabledSites: [] });
  await flush();

  const buttons = ui.elements.get('formats').children;
  assert.deepEqual(buttons.map((b) => b.textContent), ['Markdown', 'Plain text', 'Word', 'PDF']);
  assert.equal(buttons[3].attributes['aria-pressed'], 'true');
  assert.equal(buttons[0].attributes['aria-pressed'], 'false');
});

test('choosing a format stores it and moves the pressed state', async () => {
  const ui = harness({ format: 'md', disabledSites: [] });
  await flush();

  await ui.elements.get('formats').children[2].dispatch('click');
  await flush();

  assert.equal(ui.stored.format, 'docx');
  const buttons = ui.elements.get('formats').children;
  assert.equal(buttons[2].attributes['aria-pressed'], 'true');
  assert.equal(buttons[0].attributes['aria-pressed'], 'false');
});

test('the full capture switch is on by default and can be turned off', async () => {
  const ui = harness({ format: 'md', disabledSites: [] });
  await flush();

  const button = ui.elements.get('walk-global');
  assert.equal(button.attributes['aria-pressed'], 'true');
  assert.match(button.textContent, /: on$/);

  await button.onclick();
  assert.equal(ui.stored.walkEnabled, false);
  assert.equal(ui.elements.get('walk-global').attributes['aria-pressed'], 'false');
  assert.match(ui.elements.get('walk-global').textContent, /: off$/);
});

test('per-site capture opt-outs persist and follow the global switch', async () => {
  const ui = harness({ format: 'md', disabledSites: [] });
  await flush();

  const rows = ui.elements.get('walk-sites').children;
  assert.equal(rows.length, 6, 'every site has its own capture switch');

  const claude = rows[1].children[0];
  assert.equal(claude.checked, true);
  claude.checked = false;
  await claude.dispatch('change');
  assert.deepEqual(ui.stored.walkDisabledSites, ['claude']);

  const off = ui.elements.get('walk-global');
  await off.onclick();

  const afterGlobalOff = ui.elements.get('walk-sites').children;
  for (const row of afterGlobalOff) {
    assert.equal(row.children[0].checked, false, 'the global switch overrides the per-site one');
    assert.equal(row.children[0].disabled, true);
  }
});

test('every supported site is listed with its origins', async () => {
  const ui = harness({ format: 'md', disabledSites: [] });
  await flush();

  const rows = ui.elements.get('sites').children;
  assert.equal(rows.length, 6);
  const text = rows.map((row) => row.children.map((child) => child.textContent).join(' ')).join('\n');
  for (const label of ['ChatGPT', 'Claude', 'Gemini', 'DeepSeek', 'Qwen', 'Kimi']) {
    assert.match(text, new RegExp(label));
  }
  assert.match(text, /chat\.deepseek\.com/);
});

test('a site switched off is stored and can be switched back on', async () => {
  const ui = harness({ format: 'md', disabledSites: [] });
  await flush();

  const kimiRow = ui.elements.get('sites').children[5];
  const checkbox = kimiRow.children[0];
  assert.equal(checkbox.checked, true, 'a site is on unless it is listed as disabled');

  checkbox.checked = false;
  await checkbox.dispatch('change');
  await flush();
  assert.deepEqual(ui.stored.disabledSites, ['kimi']);

  checkbox.checked = true;
  await checkbox.dispatch('change');
  await flush();
  assert.deepEqual(ui.stored.disabledSites, []);
});

test('a site stored as disabled comes back switched off', async () => {
  const ui = harness({ format: 'md', disabledSites: ['gemini'] });
  await flush();

  const geminiRow = ui.elements.get('sites').children[2];
  assert.equal(geminiRow.children[0].checked, false);
});

test('the status board says unverified and gives the date once one exists', async () => {
  const ui = harness({ format: 'md', disabledSites: [] });
  await flush();

  const rows = ui.elements.get('status').children;
  assert.equal(rows.length, 6);

  // The badge is the claim; the prose below it is explanation. Check the badge per row.
  for (const row of rows) {
    const heading = row.children[0];
    assert.equal(heading.children[0].textContent, 'unverified', textOf(row));
  }

  const text = rows.map(textOf).join('\n');
  assert.equal((text.match(/Never checked against a live conversation/g) || []).length, 6);
  assert.equal(/Last checked against a live conversation/.test(text), false);
  assert.match(text, /data attribute/);
});

test('a verified site shows its date rather than a bare claim', async () => {
  const ui = harness({ format: 'md', disabledSites: [] }, (NS) => {
    NS.adapters.chatgpt.verified = true;
    NS.adapters.chatgpt.lastVerified = '2026-09-26';
  });
  await flush();

  const rows = ui.elements.get('status').children;
  const chatgpt = textOf(rows[0]);
  assert.match(chatgpt, /verified/);
  assert.equal(/unverified/.test(chatgpt), false);
  assert.match(chatgpt, /Last checked against a live conversation on 2026-09-26/);

  const gemini = textOf(rows[2]);
  assert.match(gemini, /unverified/);
  assert.match(gemini, /Never checked against a live conversation/);
});

test('the status board is derived from the adapters, not hard-coded', async () => {
  const NS = loadExtension({ force: true });
  const fromRegistry = NS.sites.siteLabels();
  const fromAdapters = NS.adapterRegistry.allAdapters().map((a) => a.label);
  assert.deepEqual(fromRegistry, fromAdapters);
  assert.deepEqual(fromRegistry, ['ChatGPT', 'Claude', 'Gemini', 'DeepSeek', 'Qwen', 'Kimi']);
});
