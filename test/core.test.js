// test/core.test.js
// The normalised chat, the shared DOM shaper, and the site registry.

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadExtension } from './harness.js';
import { loadFixture, parseHtml } from './minidom.js';

const NS = loadExtension();

const CHAT_GPT = { role: 'user', text: 'hi' };

test('role aliases normalise to the two speaker roles', () => {
  assert.equal(NS.chat.normaliseRole('Human'), 'user');
  assert.equal(NS.chat.normaliseRole('user'), 'user');
  assert.equal(NS.chat.normaliseRole('model'), 'assistant');
  assert.equal(NS.chat.normaliseRole('Assistant'), 'assistant');
  assert.equal(NS.chat.normaliseRole('narrator'), null);
  assert.equal(NS.chat.normaliseRole(undefined), null);
});

test('thinking and redacted thinking blocks are dropped by the shared rule', () => {
  const text = NS.chat.textFromBlocks([
    { type: 'thinking', text: 'secret reasoning' },
    { type: 'redacted_thinking', data: 'more' },
    { type: 'text', text: 'the answer' }
  ]);
  assert.equal(text, 'the answer');
});

test('tool use collapses to a marker instead of dumping its payload', () => {
  const text = NS.chat.textFromBlocks([
    { type: 'tool_use', name: 'web_search', input: { query: 'huge payload' } },
    { type: 'text', text: 'Found it.' }
  ]);
  assert.equal(text, '[tool: web_search]\n\nFound it.');
});

test('a turn with no readable content is dropped rather than exported empty', () => {
  assert.equal(NS.chat.normaliseTurn({ role: 'user', text: '   ' }), null);
  assert.equal(NS.chat.normaliseTurn({ role: 'user', text: '', notes: [] }), null);
  assert.equal(NS.chat.normaliseTurn({ role: 'narrator', text: 'hi' }), null);
});

test('a turn made only of notes survives, because the content was real', () => {
  const turn = NS.chat.normaliseTurn({ role: 'user', text: '', notes: ['image'] });
  assert.deepEqual(turn.notes, ['image']);
  assert.equal(turn.text, '');
});

test('createChat counts incomplete turns from the turns themselves', () => {
  const chat = NS.chat.createChat({
    site: 'chatgpt',
    siteLabel: 'ChatGPT',
    turns: [CHAT_GPT, { role: 'assistant', text: 'typing', incomplete: true }]
  });
  assert.equal(chat.incompleteTurns, 1);
  assert.equal(NS.chat.chatTurnCount(chat), 2);
});

test('applySelection keeps the chosen range in order and records it', () => {
  const chat = NS.chat.createChat({
    site: 'kimi',
    siteLabel: 'Kimi',
    turns: [
      { role: 'user', text: 'one' },
      { role: 'assistant', text: 'two' },
      { role: 'user', text: 'three' },
      { role: 'assistant', text: 'four' }
    ]
  });

  const sliced = NS.chat.applySelection(chat, 2, 3);
  assert.deepEqual(sliced.turns.map((t) => t.text), ['two', 'three']);
  assert.deepEqual(sliced.selection, { from: 2, to: 3, total: 4 });
  assert.equal(chat.turns.length, 4, 'the original chat is untouched');
});

test('an unusable range leaves the whole conversation rather than exporting nothing', () => {
  const chat = NS.chat.createChat({
    site: 'qwen',
    siteLabel: 'Qwen',
    turns: [{ role: 'user', text: 'one' }, { role: 'assistant', text: 'two' }]
  });
  assert.equal(NS.chat.applySelection(chat, 2, 1), chat);
  assert.equal(NS.chat.applySelection(chat, 1, 2), chat);
  const clamped = NS.chat.applySelection(chat, 1, 99);
  assert.equal(clamped.turns.length, 2);
  assert.equal(clamped.selection, null);
});

test('text shaping drops interface chrome but keeps code verbatim', () => {
  const doc = parseHtml(
    '<div data-message-author-role="assistant">' +
      '<p>Answer:</p>' +
      '<pre><code class="language-js">if (a) {\n    b();\n\n    c();\n}</code></pre>' +
      '<button>Copy</button>' +
      '<span aria-hidden="true">thumb up</span>' +
      '</div>'
  );
  const text = NS.dom.shapeText(doc.querySelector('div'));
  assert.match(text, /Answer:/);
  assert.match(text, /```js\nif \(a\) \{\n {4}b\(\);\n\n {4}c\(\);\n\}\n```/);
  assert.doesNotMatch(text, /Copy/);
  assert.doesNotMatch(text, /thumb up/);
});

test('a hidden reasoning block is ignored, so it cannot leak into an export', () => {
  const doc = parseHtml(
    '<div data-message-author-role="assistant">' +
      '<div class="thinking" aria-hidden="true">internal chain of thought</div>' +
      '<p>The short answer.</p>' +
      '</div>'
  );
  const text = NS.dom.shapeText(doc.querySelector('div'));
  assert.equal(text, 'The short answer.');
});

test('media become notes and never an invented caption or link', () => {
  const doc = parseHtml('<div data-message-author-role="user"><img src="blob:x" alt="chart" /></div>');
  const notes = NS.dom.collectNotes(doc.querySelector('div'), {});
  assert.deepEqual(notes, ['image']);
});

test('extractChat reports failure and the selectors tried when nothing matches', () => {
  const doc = parseHtml('<main><p>Nothing here.</p></main>');
  const result = NS.dom.extractChat(NS.adapters.chatgpt, doc, {});
  assert.equal(result.ok, false);
  assert.equal(result.chat, null);
  assert.match(result.reason, /No conversation messages/);
  assert.deepEqual(result.tried, NS.adapters.chatgpt.turnSelectors);
});

test('extractChat counts containers whose role cannot be resolved', () => {
  const doc = loadFixture('chatgpt.html');
  const adapter = Object.assign({}, NS.adapters.claude, {
    roleAttributes: ['data-missing'],
    roleMap: {},
    tagRoles: {},
    roleFallback: null
  });
  const result = NS.dom.extractChat(adapter, doc, {});
  assert.equal(result.ok, false, 'a chat with no readable role is not a successful export');
});

test('a transcript read without a walk never claims completeness, and says why', () => {
  const doc = loadFixture('chatgpt.html');
  const main = doc.querySelector('main');
  main.scrollHeight = 5000;
  main.clientHeight = 800;
  main.scrollTop = 1200;

  const scrolled = NS.dom.extractChat(NS.adapters.chatgpt, doc, {});
  assert.equal(scrolled.ok, true);
  assert.equal(scrolled.chat.partial, true);
  assert.equal(scrolled.chat.completeness.state, 'incomplete');
  assert.equal(scrolled.chat.completeness.walked, false);
  assert.match(scrolled.chat.completeness.reason, /scrolled away from the top/);

  main.scrollTop = 0;
  const atTop = NS.dom.extractChat(NS.adapters.chatgpt, doc, {});
  assert.equal(atTop.chat.completeness.state, 'incomplete', 'being at the top is not completeness');
  assert.match(atTop.chat.completeness.reason, /was not walked/);
});

test('a walk result overrides the read-only completeness claim', () => {
  const doc = loadFixture('chatgpt.html');
  const result = NS.dom.extractChat(NS.adapters.chatgpt, doc, {
    completeness: { state: 'complete', walked: true, captured: 3, steps: 4, durationMs: 800 }
  });

  assert.equal(result.chat.completeness.state, 'complete');
  assert.equal(result.chat.partial, false);
  assert.match(NS.chat.completenessLine(result.chat.completeness), /whole conversation was read/);
});

test('a streaming reply is marked incomplete instead of looking finished', () => {
  const doc = parseHtml(
    '<div data-message-author-role="user">question</div>' +
      '<div data-message-author-role="assistant">half a sen' +
      '<button data-stop-button></button></div>'
  );
  const result = NS.dom.extractChat(NS.adapters.chatgpt, doc, {});
  assert.equal(result.chat.turns[1].incomplete, true);
  assert.equal(result.chat.incompleteTurns, 1);
});

test('the site registry matches origins and refuses unknown hosts', () => {
  assert.equal(NS.adapterRegistry.adapterForUrl('https://chatgpt.com/c/1').id, 'chatgpt');
  assert.equal(NS.adapterRegistry.adapterForUrl('https://claude.ai/chat/1').id, 'claude');
  assert.equal(NS.adapterRegistry.adapterForUrl('https://gemini.google.com/app').id, 'gemini');
  assert.equal(NS.adapterRegistry.adapterForUrl('https://chat.deepseek.com/a').id, 'deepseek');
  assert.equal(NS.adapterRegistry.adapterForUrl('https://chat.qwen.ai/c/1').id, 'qwen');
  assert.equal(NS.adapterRegistry.adapterForUrl('https://kimi.com/chat/1').id, 'kimi');
  assert.equal(NS.adapterRegistry.adapterForUrl('https://mail.google.com'), null);
  assert.equal(NS.adapterRegistry.adapterForUrl('not a url'), null);
});

test('the unsupported message names every supported site', () => {
  const message = NS.sites.unsupportedMessage();
  for (const label of ['ChatGPT', 'Claude', 'Gemini', 'DeepSeek', 'Qwen', 'Kimi']) {
    assert.match(message, new RegExp(label));
  }
});

test('every adapter declares the contract fields the extractor relies on', () => {
  for (const adapter of NS.sites.siteList()) {
    assert.ok(adapter.origins.length, adapter.id + ' has no origins');
    assert.ok(adapter.label, adapter.id + ' has no label');
    assert.ok(adapter.knownIssues, adapter.id + ' has no known-issues note');
    assert.equal(typeof adapter.verified, 'boolean');
  }
});
