# Implementation Plan: Full Transcript Capture

**Branch**: `002-full-transcript-capture` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-full-transcript-capture/spec.md`

## Summary

Before reading the page, the content script walks the conversation's scroll container so the site
renders the parts of the transcript it has discarded, collects the turns it sees at each step, and
restores the user's reading position. The walk is bounded by time and steps, cancellable,
switchable off per site and globally, and never clicks anything. The capture it produces carries an
explicit completeness claim that reaches the exported file, because a capture that does not say
whether it is whole is the failure this repository cares most about.

## Technical Context

**Language/Version**: Modern browser JavaScript, no build step, no transpiler, same as feature 001.

**Primary Dependencies**: None. The walk is scrolling, timing, and DOM reads, all in-browser.

**Storage**: `chrome.storage.local`, extended with `walkEnabled` and `walkDisabledSites`. Still
never a transcript.

**Testing**: `node --test` with a fake scroll container: a small object exposing `scrollTop`,
`scrollHeight`, `clientHeight`, and a queue of message lists the walk reveals step by step, so the
whole algorithm, including the merge, is testable without a browser or a timer.

**Target Platform**: Desktop Chrome and Chromium, Manifest V3.

**Performance Goals**: A 200-exchange conversation completes a walk in under 8 seconds, with a
visible step, and reads the page once per step rather than once per pixel.

**Constraints**: No network request. No page mutation beyond scroll position. Scroll position and
focus restored on every path. No renderer or format change.

**Scale/Scope**: All six sites through the existing `scrollContainer` field. One conversation per
export.

## Constitution Check

| Principle | How the design satisfies it | Verdict |
| --- | --- | --- |
| I. Local-Only Data Handling | The walk issues no request. It moves the user's own scroll position, which the site answers as it already would. Nothing is transmitted and nothing new is stored. | PASS |
| II. Dependency-Free MV3 | No library, no bundler, no transpiler. Scrolling and timing only. | PASS |
| III. Minimal Permissions | No permission and no host pattern is added. The scroll containers are inside origins the extension already has. | PASS |
| IV. Honest Extraction | The completeness claim is computed, carried on the chat, and printed in the file. A walk that stops early produces `incomplete` with a reason, never `complete`. | PASS |
| V. Spec-Kit Before Code | spec.md, plan.md, data-model.md, contracts/walker.md, tasks.md exist before any of this is written. | PASS |

Complexity tracking: empty.

## Design decisions

**Two phases, because the two problems are different.** Loading older turns is a top-of-page
problem: sites fetch them when the user scrolls up, and the container grows. Reading the whole
rendered transcript is a sweep problem: step down the container, and the page is rendered a screen
at a time. So phase one loops at the top until the height stops growing, and phase two sweeps down
in viewport-sized steps to the bottom.

**Collect on every step, not once at the end.** A virtualised list recycles its elements, so the
bottom of the conversation is gone from the DOM by the time the walk reaches the top. Feature
001 read once; this feature records what each step rendered and merges. When the final read is at
least as long as the best earlier read, the final read wins, because it is the freshest and the
order is stable.

**Merge by overlap, documented as a heuristic.** Two reads are aligned on the longest overlap
between the tail of the accumulated list and the head of the new one. No overlap means the two reads
are disjoint windows, and the longer list is kept. This is a heuristic, it is tested on the shapes
that actually occur, and a merge failure degrades to "keep the longer list" rather than to
duplicated or missing turns.

**Instant scrolling only.** Positions are assigned directly, never animated, which honours a
reduced-motion preference for free and keeps the timing predictable. FR-019 is satisfied by not
implementing the alternative.

**Restoration is a best effort with a stated guarantee.** The original scroll offset is recorded, and
if the container element is replaced mid-walk it is re-queried and the offset is reapplied as a
proportion of the new scroll height. The user's window scroll is recorded and restored too, because
some sites scroll the window rather than an inner element.

**No clicking, ever.** A site that needs a "load more" control keeps today's behaviour and is
reported as a rendered-portion capture. FR-008 makes this a hard rule, not a preference.

## Project Structure

```text
src/core/walker.js      The walk: phases, bounds, cancellation, restoration
src/core/merge.js       Overlap-based merge of successive reads
src/core/chat.js        Gains the completeness claim
src/exporters/sections.js  Prints the completeness claim in the metadata block
src/content.js          Runs the walk when asked, then extracts; becomes async
src/storage.js          walkEnabled and walkDisabledSites
src/popup.*             Disclosure, progress, and the switch
test/walker.test.js     The walk against a fake scroll container
test/merge.test.js      The merge shapes
```

## Complexity Tracking

> No constitution violations. Nothing to justify.
