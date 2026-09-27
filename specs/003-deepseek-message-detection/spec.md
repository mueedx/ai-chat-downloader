# Feature Specification: DeepSeek Message Detection Repair

**Feature Branch**: `003-deepseek-message-detection`

**Created**: 2026-09-26

**Status**: Partly built. The diagnostic and frame-fallback requirements (FR-001 to FR-005) are
implemented and covered. The DeepSeek selector repair (FR-006, FR-009) and the verification record
(FR-008) are outstanding and need a capture of a live conversation.

**Input**: User report with a screenshot. A conversation is open on
`chat.deepseek.com/a/chat/s/<id>` and the messages are visible on screen, but the popup reports
`Messages 0` and fails with `No conversation messages were found on this page. Tried:
[data-message-author-role] | main div[class*="message"] | main .ds-markdown`. The site is
detected correctly, so the content script is running on the right document.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The adapter finds the messages that are on screen (Priority: P1)

The user opens a conversation and reads messages in front of them. The extension must locate those
same messages. Nothing else in the product matters while a supported site reads as zero messages.

**Why this priority**: Every other requirement assumes extraction works. A site that returns zero is
the failure the whole honesty machinery exists to report, and reporting it correctly is already
working. Finding the messages is the repair.

**Independent Test**: Open a live DeepSeek conversation, export it, and confirm the turn count on
the panel matches the number of exchanges on screen, in order.

**Acceptance Scenarios**:

1. **Given** a live conversation with exchanges visible, **When** the user exports, **Then** the
   panel reports a non-zero count and the file contains those exchanges in order.
2. **Given** the same conversation, **When** it is exported, **Then** user turns and assistant
   turns are each attributed to the right speaker, not all to one side.
3. **Given** a page on a site whose markup changed, **When** extraction finds nothing, **Then** the
   failure names which selectors matched nothing and what the page actually contains, so the next
   repair needs no guesswork.

---

### User Story 2 - A broken site diagnoses itself (Priority: P1)

A zero-message failure costs a round trip to DevTools unless the extension says what it saw. The
user should be able to read the failure and know whether the page has no transcript, a different
attribute, a frame the content script did not reach, or a container shape the adapter did not
anticipate.

**Why this priority**: This repair is the second selector failure in as many days. The tool has to
tell the maintainer what the page looks like, because a report without it is a screenshot and a
guess.

**Independent Test**: Force a failure on a page that does have messages, and confirm the reported
diagnosis distinguishes "selector matched nothing" from "no messages exist here".

**Acceptance Scenarios**:

1. **Given** a page with messages that no selector matched, **When** the user exports, **Then** the
   panel reports the match count for each selector tried, not only its name.
2. **Given** a page where the content script is in the top frame but the transcript is in an
   iframe, **When** extraction runs, **Then** the diagnosis says how many frames exist, so the
   frame case is visible rather than silent.
3. **Given** a page where no selector matched, **When** the diagnosis runs, **Then** it names the
   class names and tag names of the largest text-bearing containers it found, so a repair can be
   written from the panel alone.
4. **Given** a successful extraction, **When** the panel renders, **Then** no diagnostic noise is
   shown, because a working site should not talk about itself.

---

### Edge Cases

- The site is detected but the conversation has not finished loading. The diagnosis must not claim
  the markup changed when the answer is simply not on screen yet.
- The transcript is inside an iframe on a different origin. The content script cannot read it, and
  the diagnosis must say so rather than reporting a stale selector list.
- A page with many large containers, so the diagnosis must pick a small representative set rather
  than dumping the class list of the whole page.
- A page where extraction succeeds on a later selector in the list. Counts for earlier selectors
  are still reported as zero, which is correct and should not read as failure.
- The diagnosis itself must not be expensive enough to feel like a hang, so it samples rather than
  walking the entire document.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When extraction fails on a supported site, the reported failure MUST include the
  match count for every selector that was tried.
- **FR-002**: The failure report MUST state how many frames exist on the page, so a transcript in
  a frame the content script cannot reach is distinguishable from a stale selector.
- **FR-003**: The failure report MUST name a small representative sample of the largest
  text-bearing containers on the page, with their tag name and class attribute.
- **FR-004**: The diagnosis MUST NOT include the user's message text, only structural names.
- **FR-005**: The diagnosis MUST run only when extraction has already failed.
- **FR-006**: The adapter MUST read a live DeepSeek conversation with a correct turn count and
  correct speaker attribution.
- **FR-007**: The adapter MUST continue to fall back through an ordered selector list, so one
  changed selector is not a total failure.
- **FR-008**: The adapter's status in `docs/supported-sites.md` MUST reflect what was actually run.
  A selector found by reading a live page counts as a verification only for that page and date.
- **FR-009**: The fixture MUST be updated to the markup the repair was tested against, so the test
  proves the new selectors rather than the old ones.
- **FR-010**: Extraction MUST remain unable to invent a speaker it cannot resolve, so a
  half-detected conversation is reported as unreadable turns rather than attributed by guess.

### Key Entities

- **Diagnostic**: What the page contained when extraction failed. Carries per-selector match counts,
  frame count, and representative structural names. Never carries message text.
- **Selector tier**: One entry in an adapter's ordered candidate list, reported with its count.
- **Verification**: A live check with a date, distinct from a selector that merely looks plausible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A live DeepSeek conversation exports with a turn count equal to the exchanges on
  screen, in order, on the first attempt after the repair.
- **SC-002**: Speaker attribution is correct on every exported turn, with no turn attributed to the
  wrong side.
- **SC-003**: A failure report alone, with no DevTools, is enough to identify which selector tier
  matched and what the page actually uses, tested by diagnosing a page deliberately given a
  broken selector.
- **SC-004**: Zero text from the conversation appears in any diagnosis.
- **SC-005**: A page with no transcript at all is distinguishable from a page whose markup changed,
  because the frame count and container sample differ.
- **SC-006**: The repair changes one adapter, one fixture, and the diagnostic support. No renderer,
  no other adapter, and no export format changes.

## Assumptions

- DeepSeek's markup has changed or differs from the selector table last verified in May 2026,
  which reports `data-message-author-role` for this site. The live report contradicts that
  candidate matching, so the table is stale or the messages sit elsewhere.
- The content script is running on the right document, because the site was detected by host.
- Reading a public page's own structure is within the extension's existing permissions.
- The user can be asked to read one line out of the panel or run one console expression; a repair
  that requires DevTools archaeology is acceptable only as a fallback.
- This repair does not widen permissions, add a dependency, or change the normalised chat shape.
