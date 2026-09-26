// src/core/merge.js
// The walk reads the page once per step, because a virtualised list recycles its elements and
// the bottom of the conversation is gone from the DOM by the time the walk reaches the top.
// Those successive reads have to become one list. This is that, and it is a heuristic:
// two reads are aligned on the longest overlap between the tail of what we have and the head
// of what we just read. No overlap means the two are disjoint windows, and the longer read is
// kept, because an unaligned merge is worse than one coherent read.

(function (NS) {
  'use strict';

  function sameTurn(a, b) {
    if (!a || !b) return false;
    return a.role === b.role && a.text === b.text && sameNotes(a.notes, b.notes);
  }

  function sameNotes(a, b) {
    const left = a || [];
    const right = b || [];
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return false;
    }
    return true;
  }

  /** Longest k where previous.slice(-k) equals next.slice(0, k). */
  function overlapAtHead(previous, next) {
    const max = Math.min(previous.length, next.length);
    for (let size = max; size > 0; size -= 1) {
      let matches = true;
      for (let i = 0; i < size; i += 1) {
        if (!sameTurn(previous[previous.length - size + i], next[i])) {
          matches = false;
          break;
        }
      }
      if (matches) return size;
    }
    return 0;
  }

  /**
   * Returns one list holding the turns of both reads, in page order.
   * `previous` is what has been accumulated, `next` is the most recent read.
   *
   * The one shape that matters is a read window that moved down the conversation: the tail of
   * `previous` is the head of `next`, so the overlap is where the join goes. The other shape is a
   * site that loaded older turns, where `next` already contains everything in `previous` and more.
   * Anything else is two disjoint windows, and the longer read is kept, because an unaligned
   * merge would duplicate or drop turns.
   */
  function mergeTurnLists(previous, next) {
    const left = Array.isArray(previous) ? previous : [];
    const right = Array.isArray(next) ? next : [];

    if (!left.length) return right.slice();
    if (!right.length) return left.slice();

    const overlap = overlapAtHead(left, right);

    if (overlap === left.length && right.length >= left.length) return right.slice();
    if (overlap === right.length && left.length > right.length) return left.slice();
    if (overlap > 0) return left.concat(right.slice(overlap));

    return right.length > left.length ? right.slice() : left.slice();
  }

  /** Merges a list of successive reads, left to right. */
  function mergeAll(lists) {
    return (Array.isArray(lists) ? lists : []).reduce(
      (accumulated, list) => mergeTurnLists(accumulated, list),
      []
    );
  }

  NS.merge = {
    sameTurn: sameTurn,
    overlapAtHead: overlapAtHead,
    mergeTurnLists: mergeTurnLists,
    mergeAll: mergeAll
  };
})(window.AIChatDownloader);
