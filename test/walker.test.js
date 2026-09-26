// test/walker.test.js
// The walk is the riskiest logic in the project: it moves the user's page, so a bug here is
// visible and annoying rather than silent. These tests drive it against a fake scroll container
// that reveals messages as it is scrolled, with an injected clock, so every bound and every
// failure path is exercised without a browser, a timer, or a real page.

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadExtension } from './harness.js';

const NS = loadExtension();

const ADAPTER = { id: 'chatgpt', label: 'ChatGPT', scrollContainer: 'main' };

const turn = (role, text) => ({ role: role, text: text, notes: [], incomplete: false });

/**
 * A container that behaves like a virtualised transcript: `pages` are the reads it hands over
 * depending on where it has been scrolled, and the content it reports shrinks as you scroll
 * away, the way a recycling list does.
 */
function fakeDoc(options) {
  const config = Object.assign({ clientHeight: 100, pages: [], topGrows: 0 }, options);

  const container = {
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: config.clientHeight,
    isConnected: true,
    isScrolled: false
  };

  const reads = [];

  function renderedAt(position) {
    const limit = config.clientHeight;
    if (position <= 0) return config.pages[0] || [];
    const index = Math.min(
      config.pages.length - 1,
      Math.max(0, Math.round(position / Math.max(1, limit * 0.9)))
    );
    return config.pages[index] || [];
  }

  const doc = {
    hidden: false,
    scrollY: 0,
    container: container,
    querySelector: (selector) => (selector === 'main' ? container : null),
    querySelectorAll: () => []
  };

  return {
    doc: doc,
    container: container,
    reads: reads,
    collect: () => {
      const rendered = renderedAt(container.scrollTop);
      container.isScrolled = true;
      reads.push({ scrollTop: container.scrollTop, turns: rendered });
      return rendered;
    }
  };
}

function clock() {
  let time = 0;
  return {
    now: () => (time += 10),
    sleep: () => Promise.resolve()
  };
}

test('a walk sweeps to the bottom and reports completion', async () => {
  const page = fakeDoc({
    pages: [
      [turn('user', 'a'), turn('assistant', 'b')],
      [turn('user', 'c'), turn('assistant', 'd')],
      [turn('user', 'e'), turn('assistant', 'f')]
    ]
  });

  const result = await NS.walker.walkTranscript({
    adapter: ADAPTER,
    doc: page.doc,
    collect: page.collect,
    now: clock().now,
    sleep: clock().sleep
  });

  assert.equal(result.ran, true);
  assert.equal(result.completed, true);
  assert.equal(result.stopReason, 'bottom');
  assert.ok(result.steps >= 3, 'expected several steps, got ' + result.steps);
  assert.ok(result.reads.length >= result.steps);
});

test('the reading position is restored exactly, on every path', async () => {
  const page = fakeDoc({
    pages: [[turn('user', 'a')], [turn('user', 'b')], [turn('user', 'c')]]
  });
  page.container.scrollTop = 640;
  page.doc.scrollY = 120;

  const result = await NS.walker.walkTranscript({
    adapter: ADAPTER,
    doc: page.doc,
    collect: page.collect,
    now: clock().now,
    sleep: clock().sleep
  });

  assert.equal(result.restored, true);
  assert.equal(page.container.scrollTop, 640, 'the user is back where they were reading');
  assert.equal(page.doc.scrollY, 120);
});

test('a position at the very bottom is left at the bottom', async () => {
  const page = fakeDoc({ pages: [[turn('user', 'a')]] });
  page.container.scrollTop = NS.walker.maxScroll(page.container);

  await NS.walker.walkTranscript({
    adapter: ADAPTER,
    doc: page.doc,
    collect: page.collect,
    now: clock().now,
    sleep: clock().sleep
  });

  assert.equal(page.container.scrollTop, NS.walker.maxScroll(page.container));
});

test('a page with no scroll container is skipped, and says why', async () => {
  const page = fakeDoc({ pages: [[turn('user', 'a')]] });
  const result = await NS.walker.walkTranscript({
    adapter: Object.assign({}, ADAPTER, { scrollContainer: 'section.nope' }),
    doc: page.doc,
    collect: page.collect,
    now: clock().now,
    sleep: clock().sleep
  });

  assert.equal(result.ran, false);
  assert.equal(result.completed, false);
  assert.equal(result.stopReason, 'no-container');
  assert.match(result.skippedReason, /not in a scrollable area/);
});

test('a background tab is never walked', async () => {
  const page = fakeDoc({ pages: [[turn('user', 'a')]] });
  page.doc.hidden = true;
  let collects = 0;

  const result = await NS.walker.walkTranscript({
    adapter: ADAPTER,
    doc: page.doc,
    collect: () => { collects += 1; return []; },
    now: clock().now,
    sleep: clock().sleep
  });

  assert.equal(result.ran, false);
  assert.equal(result.stopReason, 'background-tab');
  assert.match(result.skippedReason, /background tab/);
  assert.equal(collects, 0, 'a hidden page is never read');
});

test('a time limit stops the walk instead of hanging on a page that never settles', async () => {
  const page = fakeDoc({ pages: [[turn('user', 'a')], [turn('user', 'b')]] });
  let time = 0;
  const slowClock = {
    now: () => (time += 1000),
    sleep: () => Promise.resolve()
  };

  const result = await NS.walker.walkTranscript({
    adapter: ADAPTER,
    doc: page.doc,
    collect: page.collect,
    now: slowClock.now,
    sleep: slowClock.sleep,
    maxDurationMs: 2500
  });

  assert.equal(result.completed, false);
  assert.equal(result.stopReason, 'time-limit');
  assert.equal(result.restored, true, 'the position is restored even when the walk is cut short');
  assert.ok(page.reads.length > 0, 'what was read before the limit is kept');
});

test('a step limit stops a walk that would otherwise run forever', async () => {
  const page = fakeDoc({ pages: [[turn('user', 'a')]] });
  const result = await NS.walker.walkTranscript({
    adapter: ADAPTER,
    doc: page.doc,
    collect: page.collect,
    now: clock().now,
    sleep: clock().sleep,
    maxSteps: 2
  });

  assert.equal(result.completed, false);
  assert.equal(result.stopReason, 'step-limit');
});

test('a cancelled walk stops, restores, and keeps what it read', async () => {
  const page = fakeDoc({
    pages: [[turn('user', 'a'), turn('assistant', 'b')], [turn('user', 'c')]]
  });
  page.container.scrollTop = 300;

  const controller = { cancelled: false };
  const collect = () => {
    const rendered = page.collect();
    if (page.reads.length === 2) controller.cancelled = true;
    return rendered;
  };

  const result = await NS.walker.walkTranscript({
    adapter: ADAPTER,
    doc: page.doc,
    collect: collect,
    controller: controller,
    now: clock().now,
    sleep: clock().sleep
  });

  assert.equal(result.stopReason, 'cancelled');
  assert.equal(result.restored, true);
  assert.equal(page.container.scrollTop, 300);
  assert.ok(result.reads.length >= 2);
});

test('the walk reports how long it took and how far the page grew', async () => {
  let time = 0;
  const page = fakeDoc({ pages: [[turn('user', 'a')], [turn('user', 'b')]] });

  const result = await NS.walker.walkTranscript({
    adapter: ADAPTER,
    doc: page.doc,
    collect: page.collect,
    now: () => (time += 5),
    sleep: () => Promise.resolve()
  });

  assert.ok(result.durationMs > 0, 'a duration is reported, per FR-020');
  assert.equal(typeof result.grew, 'number');
});

test('captureTranscript uses the final read when it is the longest', async () => {
  const whole = [turn('user', 'a'), turn('assistant', 'b'), turn('user', 'c')];
  const page = fakeDoc({ pages: [whole, whole, whole] });

  const capture = await NS.walker.captureTranscript({
    adapter: ADAPTER,
    doc: page.doc,
    collect: page.collect,
    now: clock().now,
    sleep: clock().sleep
  });

  assert.equal(capture.source, 'final-read');
  assert.deepEqual(capture.turns.map((t) => t.text), ['a', 'b', 'c']);
});

test('captureTranscript merges windows when a virtualised list recycles its elements', async () => {
  const pages = [
    [turn('user', 'c'), turn('assistant', 'd'), turn('user', 'e')],
    [turn('assistant', 'd'), turn('user', 'e'), turn('assistant', 'f')],
    [turn('user', 'e'), turn('assistant', 'f'), turn('user', 'g')],
    [turn('assistant', 'f'), turn('user', 'g'), turn('assistant', 'h')]
  ];
  const page = fakeDoc({ pages: pages });

  const capture = await NS.walker.captureTranscript({
    adapter: ADAPTER,
    doc: page.doc,
    collect: page.collect,
    now: clock().now,
    sleep: clock().sleep
  });

  assert.equal(capture.source, 'merged', 'a recycling list is only whole if the reads are merged');
  assert.deepEqual(capture.turns.map((t) => t.text), ['c', 'd', 'e', 'f', 'g', 'h']);
});

test('a walk that never ran captures nothing and says so', async () => {
  const page = fakeDoc({ pages: [[turn('user', 'a')]] });
  page.doc.hidden = true;

  const capture = await NS.walker.captureTranscript({
    adapter: ADAPTER,
    doc: page.doc,
    collect: page.collect,
    now: clock().now,
    sleep: clock().sleep
  });

  assert.deepEqual(capture.turns, []);
  assert.equal(capture.walk.ran, false);
  assert.match(capture.walk.skippedReason, /background tab/);
});

test('the walk never animates, never clicks, and never touches the DOM', async () => {
  const page = fakeDoc({ pages: [[turn('user', 'a')], [turn('user', 'b')]] });
  const touched = [];

  // The container only has the two scroll properties. If the walk reached for anything else,
  // such as scrollTo, click, or a DOM mutation, this would throw.
  Object.defineProperty(page.container, 'click', {
    get() { touched.push('click'); throw new Error('the walk must not click'); }
  });
  Object.defineProperty(page.container, 'scrollTo', {
    get() { touched.push('scrollTo'); throw new Error('the walk must not animate'); }
  });

  const result = await NS.walker.walkTranscript({
    adapter: ADAPTER,
    doc: page.doc,
    collect: page.collect,
    now: clock().now,
    sleep: clock().sleep
  });

  assert.deepEqual(touched, []);
  assert.equal(result.completed, true);
  assert.equal(typeof page.container.scrollTop, 'number', 'positions are assigned directly');
});
