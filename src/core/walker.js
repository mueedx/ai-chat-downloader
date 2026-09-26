// src/core/walker.js
// Walks a conversation's scroll container so the site renders the transcript it has
// discarded, collecting what each step rendered, then puts the user back where they were.
//
// The contract is in specs/002-full-transcript-capture/contracts/walker.md. The short version:
// this file knows about scrolling and time, and nothing about selectors or formats. It assigns
// scroll positions directly and never animates them, so a reduced-motion preference is honoured
// by not implementing the alternative. It never clicks, submits, or types, because a capture has
// no business changing state the user did not ask to change. It returns rather than throws, and
// it always restores the reading position.

(function (NS) {
  'use strict';

  const DEFAULTS = {
    maxDurationMs: 6000,
    maxSteps: 400,
    stepRatio: 0.9,
    settleMs: 60,
    growTolerancePx: 8
  };

  function noSleep() {
    return Promise.resolve();
  }

  function nowDefault() {
    return Date.now();
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function resolveContainer(adapter, doc) {
    if (!adapter || !adapter.scrollContainer || !doc) return null;
    try {
      return doc.querySelector(adapter.scrollContainer);
    } catch (error) {
      return null;
    }
  }

  function maxScroll(element) {
    return Math.max(0, (element.scrollHeight || 0) - (element.clientHeight || 0));
  }

  function isScrollable(element) {
    return maxScroll(element) > DEFAULTS.growTolerancePx;
  }

  function resolveViewport(opts, doc) {
    // `scrollY` lives on the window, not on the document, and on a real window it is a
    // getter-only property, so restoring it has to call scrollTo rather than assign to it.
    if (opts.viewport) return opts.viewport;
    if (doc && typeof doc.scrollY === 'number') return doc;
    return null;
  }

  function snapshot(opts, container) {
    const viewport = resolveViewport(opts, opts.doc);
    return {
      container: container,
      scrollTop: container ? Number(container.scrollTop) || 0 : 0,
      ratio: container && container.scrollHeight
        ? (Number(container.scrollTop) || 0) / container.scrollHeight
        : 0,
      viewport: viewport,
      viewportY: viewport ? Number(viewport.scrollY) || 0 : 0
    };
  }

  function scrollViewport(viewport, y) {
    if (!viewport) return;
    if (typeof viewport.scrollTo === 'function') {
      viewport.scrollTo(0, y);
      return;
    }
    try {
      viewport.scrollY = y;
    } catch (error) {
      // A viewport that refuses the assignment has left the user where they were; not worth
      // failing an export over, because the transcript is already captured.
    }
  }

  /**
   * Puts the reading position back. If the container element was replaced while we walked, the
   * old offset no longer means anything, so the proportion is used instead. The window scroll is
   * restored alongside it, because some sites scroll the window rather than an inner element.
   */
  function restore(opts, before) {
    if (!before) return false;

    const container = before.container && before.container.isConnected !== false
      ? before.container
      : resolveContainer(opts.adapter, opts.doc);

    if (container) {
      const previousHeight = before.container ? before.container.scrollHeight : container.scrollHeight;
      const currentHeight = container.scrollHeight || 0;
      const target = currentHeight === previousHeight
        ? before.scrollTop
        : Math.round(before.ratio * currentHeight);
      container.scrollTop = clamp(target, 0, maxScroll(container));
    }

    scrollViewport(before.viewport, before.viewportY);

    return true;
  }

  function stopped(controller) {
    return Boolean(controller && controller.cancelled);
  }

  /**
   * One walk. Options are documented in the contract; `now` and `sleep` are injected so the
   * whole algorithm is testable without a real clock.
   */
  async function walkTranscript(options) {
    const opts = options || {};
    const now = opts.now || nowDefault;
    const sleep = opts.sleep || noSleep;
    const controller = opts.controller || { cancelled: false };
    const started = now();

    const result = {
      ran: false,
      skippedReason: null,
      completed: false,
      stopReason: null,
      steps: 0,
      durationMs: 0,
      restored: false,
      grew: 0,
      reads: []
    };

    let before = null;

    const finish = (stopReason) => {
      result.stopReason = stopReason;
      result.completed = stopReason === 'bottom';
      result.durationMs = now() - started;
      result.restored = restore(opts, before);
      return result;
    };

    const doc = opts.doc;
    const container = resolveContainer(opts.adapter, doc);

    if (doc && doc.hidden) {
      result.skippedReason = 'the page is in a background tab';
      return finish('background-tab');
    }
    if (!container) {
      result.skippedReason = 'the conversation is not in a scrollable area this site declares';
      return finish('no-container');
    }
    if (typeof opts.collect !== 'function') {
      result.skippedReason = 'nothing to read';
      return finish('no-collector');
    }

    result.ran = true;
    before = snapshot(opts, container);

    const deadline = () => now() - started >= (opts.maxDurationMs || DEFAULTS.maxDurationMs);
    const stepLimit = opts.maxSteps || DEFAULTS.maxSteps;
    const settle = opts.settleMs === undefined ? DEFAULTS.settleMs : opts.settleMs;

    const read = () => {
      const turns = opts.collect() || [];
      result.reads.push(turns);
      return turns;
    };

    // Phase one: the site loads older turns when the user scrolls up, and the container grows.
    let topHeight = container.scrollHeight || 0;
    for (let attempt = 0; attempt < stepLimit; attempt += 1) {
      if (stopped(controller)) return finish('cancelled');
      if (deadline()) return finish('time-limit');

      container.scrollTop = 0;
      await sleep(settle);
      read();

      const height = container.scrollHeight || 0;
      if (height - topHeight <= DEFAULTS.growTolerancePx) {
        topHeight = Math.max(topHeight, height);
        break;
      }
      result.grew += height - topHeight;
      topHeight = height;
    }

    // Phase two: sweep down so every rendered screen is read at least once.
    const stepSize = () =>
      Math.max(
        1,
        Math.round((container.clientHeight || 1) * (opts.stepRatio || DEFAULTS.stepRatio))
      );

    container.scrollTop = 0;
    await sleep(settle);

    let position = 0;
    let reachedBottom = false;
    for (let step = 0; step < stepLimit; step += 1) {
      if (stopped(controller)) return finish('cancelled');
      if (deadline()) return finish('time-limit');

      container.scrollTop = position;
      await sleep(settle);
      read();
      result.steps += 1;

      const limit = maxScroll(container);
      if (position >= limit) {
        reachedBottom = true;
        break;
      }
      position = Math.min(limit, position + stepSize());
    }

    // Running out of steps is not arriving at the bottom, and saying otherwise would put a
    // "complete" claim in the file for a capture that is missing whatever was never scrolled to.
    if (!reachedBottom) return finish('step-limit');

    container.scrollTop = maxScroll(container);
    await sleep(settle);
    read();
    result.steps += 1;

    return finish('bottom');
  }

  /**
   * Runs the walk and reduces the reads to one turn list.
   *
   * The final read wins only when it is genuinely the best one: either longer than every earlier
   * read, or the same length and containing the earlier one. A recycling list hands back windows
   * of equal length covering different messages, and taking the last of those would silently drop
   * the top of the conversation. That case is merged instead.
   */
  async function captureTranscript(options) {
    const result = await walkTranscript(options);

    if (!result.ran || !result.reads.length) {
      return { walk: result, turns: [], source: result.ran ? 'walk' : 'read' };
    }

    const finalRead = result.reads[result.reads.length - 1];
    const bestRead = result.reads.reduce(
      (longest, read) => (read.length > longest.length ? read : longest),
      result.reads[0]
    );

    const containsBest = NS.merge.overlapAtHead(bestRead, finalRead) === bestRead.length;
    if (finalRead.length > bestRead.length || (finalRead.length === bestRead.length && containsBest)) {
      return { walk: result, turns: finalRead, source: 'final-read' };
    }

    return { walk: result, turns: NS.merge.mergeAll(result.reads), source: 'merged' };
  }

  NS.walker = {
    DEFAULTS: DEFAULTS,
    walkTranscript: walkTranscript,
    captureTranscript: captureTranscript,
    resolveContainer: resolveContainer,
    isScrollable: isScrollable,
    maxScroll: maxScroll
  };
})(window.AIChatDownloader);
