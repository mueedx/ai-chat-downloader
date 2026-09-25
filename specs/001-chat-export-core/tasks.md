# Tasks: Chat Export Core

**Input**: Design documents from `specs/001-chat-export-core/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/adapters.md
**Tests**: Included, because the constitution requires `node --test` coverage of every pure
logic path, and because the format writers are the risk in this feature.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel, different files, no dependencies
- **[Story]**: User story this task belongs to

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Create the directory layout from `plan.md`: `src/{core,adapters,exporters}`, `test/fixtures`, `docs`, `icons`, `.github/workflows`
- [x] T002 Write `manifest.json` (MV3) with `storage` + `downloads`, six origins, popup, options, service worker
- [x] T003 Write `package.json` with no `dependencies` block, `npm test` wired to `node --test`, and a `package` script
- [x] T004 [P] Create icon placeholders at 16, 48, and 128 px
- [x] T005 [P] Write `test/harness.js` to load `src/` files into a `vm` context with a fake `window`

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T006 Create `src/core/namespace.js` global bootstrap
- [x] T007 Create `src/core/chat.js`: `normaliseTurn`, block filtering, `createChat`, `applySelection`
- [x] T008 Create `src/core/filename.js`: slug, timestamp, collision-safe name
- [x] T009 Create `src/core/dom.js`: `textFromElement` with code-block fencing, `extractChat`
- [x] T010 Create `src/exporters/sections.js`: the one section list every renderer consumes
- [x] T011 Create `src/exporters/index.js`: the four-format registry with MIME types and extensions
- [x] T012 Write `test/core.test.js` and `test/filename.test.js`

**Checkpoint**: Foundation ready, user stories can begin.

## Phase 3: User Story 1 - Export the conversation in front of me (Priority: P1) MVP

**Goal**: One click on a supported page yields a correct file.
**Independent Test**: Open a conversation, export Markdown, open the file.

- [x] T013 [P] [US1] Write `test/fixtures/chatgpt.html` fixture transcript
- [x] T014 [P] [US1] Write `test/exporters.test.js` asserting Markdown and text content turn by turn
- [x] T015 [US1] Implement `src/exporters/markdown.js`
- [x] T016 [US1] Implement `src/exporters/text.js`
- [x] T017 [US1] Implement `src/content.js`: detect site, run adapter, answer the popup
- [x] T018 [US1] Implement `src/background.js`: `downloads.download` with a revoked blob URL
- [x] T019 [US1] Implement `src/popup.html/js/css`: format picker, live turn count, export button
- [x] T020 [US1] Implement `src/storage.js` preference defaults and validation

## Phase 4: User Story 2 - Export every supported site the same way (Priority: P1)

**Goal**: Six adapters, one output shape.
**Independent Test**: Export from two different sites and compare structure.

- [x] T021 [P] [US2] Write fixtures for claude, gemini, deepseek, qwen, kimi
- [x] T022 [P] [US2] Write `test/adapters.test.js` covering every adapter against its fixture
- [x] T023 [P] [US2] Implement `src/adapters/chatgpt.js`
- [x] T024 [P] [US2] Implement `src/adapters/claude.js`
- [x] T025 [P] [US2] Implement `src/adapters/gemini.js`
- [x] T026 [P] [US2] Implement `src/adapters/deepseek.js`
- [x] T027 [P] [US2] Implement `src/adapters/qwen.js`
- [x] T028 [P] [US2] Implement `src/adapters/kimi.js`
- [x] T029 [US2] Implement `src/adapters/index.js` host lookup and `src/core/sites.js` registry

## Phase 5: User Story 3 - Know when something went wrong (Priority: P2)

**Goal**: No silent blank files.
**Independent Test**: Export on a page with no conversation and confirm no file and a clear message.

- [x] T045 [US3] Surface `unreadableTurns`, `incompleteTurns`, and `partial` in the popup result panel
- [x] T030 [US3] Show the unsupported-site message with the list of supported sites
- [x] T031 [US3] Report download interruption as failure, never success

## Phase 6: User Story 4 - Keep the archive tidy (Priority: P2)

**Goal**: Valid, distinct, readable filenames.
**Independent Test**: Export emoji and CJK titles and confirm the files save.

- [x] T032 [US4] Ensure `filename.js` keeps Unicode letters, strips path and control characters, and appends a timestamp
- [x] T033 [US4] Title fallback to site label plus timestamp when the site exposes no title
- [x] T034 [US4] Cover filename cases in `test/filename.test.js`

## Phase 7: User Story 5 - Choose what gets exported (Priority: P3)

**Goal**: Export a turn range.
**Independent Test**: Export turns 3 to 5 of a conversation and confirm only those appear.

- [x] T035 [US5] Implement `applySelection` in `src/core/chat.js`
- [x] T036 [US5] Add the range control to the popup
- [x] T037 [US5] Mark selection exports in the file metadata
- [x] T038 [US5] Cover selection in `test/core.test.js`

## Phase 8: Polish and release readiness

- [x] T046 [P] Implement `src/options.html/js/css` with per-site switches and format default
- [x] T047 [P] Write `docs/architecture.md` including the PDF Latin-1 limit
- [x] T048 [P] Write `docs/supported-sites.md` with per-site selector status and last-verified dates
- [x] T049 [P] Write `docs/store-checklist.md` with the permission justification text
- [x] T050 [P] Add `.github/workflows/ci.yml` running `npm test` plus a manifest sanity check
- [x] T051 Run `npm test` and confirm every task above is done

## Dependencies and Execution Order

- Phase 1 and Phase 2 block everything.
- US1 and US2 are both P1 and can proceed in parallel after Phase 2, except T029 which
  consolidates the adapters written in US2.
- US3, US4, and US5 depend on the extraction result shape from Phase 2 and the popup from US1.
- Polish depends on all stories.

### Parallel Opportunities

- T004, T005, T013, T014, T021 to T028, T046 to T050 are all independent.
- The six adapters in T023 to T028 touch separate files and are fully parallel.

## Implementation Strategy

1. Phase 1 and Phase 2.
2. Phase 3 gives a working single-site Markdown export. Validate it.
3. Phase 4 widens to six sites and the same output shape. Validate by comparing two sites.
4. Phases 5 to 7 add honesty, tidiness, and selection.
5. Phase 8 prepares the store submission.

## Status

All tasks above are implemented and `npm test` passes 69 cases. One thing is not covered by a
task and is not done: no adapter has been run against a live signed-in conversation, because that
needs accounts and a browser session. Every site therefore stays `verified: false` with no date,
`docs/supported-sites.md` says so, and the options page shows it. Live verification is the next
spec and it gates the store submission.

## Task numbering note

Task ids shifted once during writing, when a task was added to the failure-reporting phase after
the ids below it had already been used. Ids are stable now; do not renumber them, because pull
requests and the change log refer to them.
