// test/diagnosis.test.js
// A zero-message failure costs a round trip to DevTools unless the extension says what the page
// actually contained. These cases cover the diagnostic itself and the frame fallback, because a
// transcript in a frame the content script never entered looks exactly like a stale selector.

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadExtension } from './harness.js';
import { parseHtml } from './minidom.js';

const NS = loadExtension();

const PAGE_WITHOUT_MESSAGES = parseHtml(
  '<html><body><main>' +
    '<div class="composer">Message DeepSeek</div>' +
    '<section class="thread"><div class="_84254e"><p>' +
    'Here is the text from the image, quoted at length so the container is large enough to be ' +
    'sampled as a message-sized block of text on the page.</p><p>A second paragraph.</p></div>' +
    '</section></main></body></html>'
);

const MESSAGE_TEXT = 'quoted at length so the container is large enough';

test('a failure reports how many times each selector matched', () => {
  const diag = NS.dom.diagnose(NS.adapters.deepseek, PAGE_WITHOUT_MESSAGES);

  assert.equal(diag.selectors.length, NS.adapters.deepseek.turnSelectors.length);
  for (const entry of diag.selectors) {
    assert.equal(entry.count, 0, entry.selector + ' should not have matched');
    assert.equal(typeof entry.count, 'number');
  }
});

test('a selector that does match is counted, so success is distinguishable', () => {
  const doc = parseHtml('<main><div class="ds-markdown"><p>' + MESSAGE_TEXT.repeat(3) + '</p></div></main>');
  const diag = NS.dom.diagnose(NS.adapters.deepseek, doc);

  const entry = diag.selectors.find((item) => item.selector === 'main .ds-markdown');
  assert.ok(entry, 'the adapter should still list that selector');
  assert.equal(entry.count, 1);
});

test('an unsupported selector is reported as unsupported, not as zero', () => {
  const adapter = Object.assign({}, NS.adapters.deepseek, {
    turnSelectors: ['<<<not a selector']
  });
  const diag = NS.dom.diagnose(adapter, PAGE_WITHOUT_MESSAGES);
  assert.equal(diag.selectors[0].count, -1);
  assert.match(NS.dom.describeDiagnostic(diag), /unsupported/);
});

test('the diagnosis names structure and never message text (FR-004)', () => {
  const diag = NS.dom.diagnose(NS.adapters.deepseek, PAGE_WITHOUT_MESSAGES);
  const serialised = JSON.stringify(diag);

  assert.equal(serialised.includes(MESSAGE_TEXT), false, 'message text leaked into the diagnosis');
  assert.equal(serialised.includes('Message DeepSeek'), false, 'composer text leaked');

  const tags = diag.containers.map((entry) => entry.tag);
  assert.ok(tags.includes('section') || tags.includes('main'), 'containers were sampled, got ' + tags.join(','));

  const line = NS.dom.describeDiagnostic(diag);
  assert.match(line, /0 matched \[data-message-author-role\]/);
  assert.match(line, /found <section class="thread">/);
});

test('frames are counted and the readable ones are counted separately', () => {
  const doc = parseHtml(
    '<main><iframe id="a"></iframe><iframe id="b"></iframe></main>'
  );
  const frames = doc.querySelectorAll('iframe');
  frames[1].contentDocument = parseHtml('<div>hello</div>'); // frame a stays cross-origin

  const diag = NS.dom.diagnose(NS.adapters.deepseek, doc);
  assert.equal(diag.frames, 2);
  assert.equal(diag.documentsRead, 2, 'this document plus the one readable frame');
  assert.match(NS.dom.describeDiagnostic(diag), /2 frame\(s\) present, 2 readable here/);
});

// The frame is read with an adapter whose selectors do not need a `main` ancestor. This case is
// about the frame fallback in dom.js. The DeepSeek adapter's own selector repair is a separate,
// unfinished piece of work, and a fixture written by hand must not stand in for a live page.
test('a transcript in a same-origin frame is read instead of reported missing', () => {
  const doc = parseHtml('<div id="shell"><iframe id="thread"></iframe></div>');
  const inner = parseHtml(
    '<div data-message-author-role="user">Explain recursion in two sentences.</div>' +
      '<div data-message-author-role="assistant"><div class="markdown"><p>' +
      'Recursion is a function calling itself on a smaller input until it reaches a base case.</p>' +
      '</div></div>'
  );
  doc.querySelector('iframe').contentDocument = inner;

  const result = NS.dom.extractChat(NS.adapters.chatgpt, doc, {});
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.chat.turns.length, 2);
  assert.equal(result.chat.inFrame, true, 'the chat remembers it came from a frame');
  assert.deepEqual(result.chat.turns.map((turn) => turn.role), ['user', 'assistant']);
});

test('no failure path returns a diagnostic, and no success path does either', () => {
  const failure = NS.dom.extractChat(NS.adapters.deepseek, PAGE_WITHOUT_MESSAGES, {});
  assert.equal(failure.ok, false);
  assert.ok(failure.diagnostic, 'a failure carries what the page contained');

  const doc = parseHtml(
    '<div data-message-author-role="user">question</div>' +
      '<div data-message-author-role="assistant">answer</div>'
  );
  const success = NS.dom.extractChat(NS.adapters.chatgpt, doc, {});
  assert.equal(success.ok, true);
  assert.equal(success.diagnostic, null, 'a working site is not talked about (FR-005)');
});

test('the diagnostic is cheap: it samples rather than walking everything', () => {
  let body = '';
  for (let i = 0; i < 50; i += 1) body += '<div class="n' + i + '"><p>' + 'x'.repeat(200) + '</p></div>';
  const doc = parseHtml('<main>' + body + '</main>');

  const diag = NS.dom.diagnose(NS.adapters.deepseek, doc);
  assert.ok(diag.examined <= 4000, 'sampling is bounded, examined ' + diag.examined);
  assert.ok(diag.containers.length <= 6, 'at most six containers are reported');
});
