# Contract: Transcript Walker

`src/core/walker.js` exposes one function. It knows about scrolling and time. It knows nothing about
selectors, roles, formats, or storage.

```js
walkTranscript({
  adapter,        // the site adapter, for its scrollContainer selector
  doc,            // the document
  collect,        // () => Turn[] - reads what is currently rendered
  controller,     // { cancelled: boolean } - set by the user to stop early
  now,            // () => number - injected clock, so tests do not sleep
  sleep,          // (ms) => Promise<void> - injected wait
  maxDurationMs,  // default 6000
  maxSteps,       // default 400
  stepRatio,      // default 0.9 of the viewport height
  settleMs        // default 60
}) -> Promise<WalkResult>
```

## Contract rules

1. The walker MUST assign scroll positions directly and MUST NOT animate them.
2. The walker MUST NOT click, submit, type, dispatch input events, or modify any node.
3. The walker MUST restore the scroll offset, as an absolute offset or as a proportion if the
   container was replaced, and MUST restore the window scroll, on every return path.
4. The walker MUST return, never throw, for a missing container, a non-scrollable page, a cancelled
   walk, or an exhausted time or step budget.
5. The walker MUST leave the `collect` callback's output order untouched. Merging happens outside.
6. The walker MUST NOT perform any network operation, directly or indirectly.

## Merge contract

`src/core/merge.js` exposes `mergeTurnLists(previous, next)`. It returns a list containing the
turns from both, in page order, with no duplicate of a turn already present. Two lists are aligned
on the longest overlap between the tail of `previous` and the head of `next`. When there is no
overlap, the longer list is returned unchanged, because an unaligned merge is worse than keeping
one coherent read.
