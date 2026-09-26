# Tasks: Full Transcript Capture

**Input**: Design documents from `specs/002-full-transcript-capture/`
**Prerequisites**: plan.md, spec.md, research decisions in plan.md, data-model.md, contracts/walker.md
**Tests**: Included. The walk moves the user's page, so its bounds, its failure paths, and its
restoration behaviour are all covered before it is wired to anything.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 Create `specs/002-full-transcript-capture/` on branch `002-full-transcript-capture`
- [x] T002 [P] Add `src/core/merge.js` and `src/core/walker.js` to the manifest content script
      list, in dependency order, and to the test harness load order

## Phase 2: Foundational

- [x] T003 Implement `src/core/merge.js`: overlap-based merge of successive reads
- [x] T004 Write `test/merge.test.js`, including the shapes that must not corrupt a capture
- [x] T005 Implement `src/core/walker.js`: two phases, bounds, cancellation, restoration
- [x] T006 Write `test/walker.test.js` against a fake scroll container and an injected clock
- [x] T007 [P] Write `specs/002-full-transcript-capture/contracts/walker.md`

**Checkpoint**: the walk and the merge are proven in isolation, before anything calls them.

## Phase 3: User Story 1 - Export a long conversation without losing the top

- [x] T008 [P] Add the completeness claim to `src/core/chat.js`, derived, never inferred from a
      turn count
- [x] T009 [P] Print the claim in the metadata block in `src/exporters/sections.js`
- [x] T010 Make `src/content.js` async, run the walk when asked, and use the capture's turns
- [x] T011 Cover the read-without-walk, walk-complete, and walk-incomplete paths in
      `test/runtime.test.js`

## Phase 4: User Story 2 - Keep reading where you were

- [x] T012 Restore the container offset, or its proportion when the container was replaced
- [x] T013 Restore the window scroll alongside it
- [x] T014 Cover restoration on the success, cancelled, and time-limit paths

## Phase 5: User Story 3 - Say what you got

- [x] T015 Bound the walk by time and by steps, and report which bound stopped it
- [x] T016 Still produce an export when the walk is cut short
- [x] T017 Cover a walk that runs out of time, and one that exhausts its steps

## Phase 6: User Story 4 - Opt out of the page movement

- [x] T018 Add `walkEnabled` and `walkDisabledSites` to `src/storage.js` with `shouldWalk`
- [x] T019 Add the disclosure checkbox to `src/popup.html`, on by default, with a note that says
      the page will move and be returned
- [x] T020 Add the global and per-site switches to the options page
- [x] T021 Cover the on, off, and per-site-off cases in `test/popup.test.js` and
      `test/options.test.js`

## Phase 7: User Story 5 - Capture without disturbing a page you are typing in

- [x] T022 Capture the focused field and its selection before the walk, restore it after
- [x] T023 Cover the focus and selection restoration

## Phase 8: Polish

- [x] T024 [P] Document the walk in `docs/architecture.md`, including the merge heuristic
- [x] T025 [P] Add the walk to `docs/verification-checklist.md` as a step for a long conversation
- [x] T026 [P] Bump the version, add a changelog entry, and note the feature in the README
- [x] T027 Run `npm test` and `npm run check:manifest`

## Status

All tasks above are implemented and `npm test` passes. Two defects were found by the tests while
they were being written, both fixed: the walk reported `bottom` when it had actually run out of
steps, which would have put a "complete" claim in the file for a partial capture; and the final
read could win over an earlier longer read, which would have silently dropped the top of a
conversation on a list that recycles its elements.

Not covered here: no site has been run against a live long conversation, so the walk's behaviour on
a real virtualised transcript is unverified. That is the same gap the first feature has, and it is
recorded in `docs/supported-sites.md` rather than assumed away.
