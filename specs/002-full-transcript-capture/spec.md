# Feature Specification: Full Transcript Capture

**Feature Branch**: `002-full-transcript-capture`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "Feature: Full Transcript Capture. On a long conversation, a site keeps only part of the transcript in the DOM, so an export today captures only the rendered portion. Before reading the page, the extension walks the conversation's scroll container from top to bottom so the site renders the rest, waits for the DOM to settle, reads the full transcript, then restores the scroll position exactly where the user left it. If the walk cannot complete, the export still proceeds and says plainly how much was captured. Nothing is sent anywhere, no site is modified beyond scrolling, and the user's scroll position is always restored, even when the walk fails."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export a long conversation without losing the top of it (Priority: P1)

Someone is reading a conversation that has scrolled for hours. Today they export it and find that
the first forty exchanges are missing, because the site had thrown those messages away to save
memory. They want the whole thing, and they want to know whether they got it.

**Why this priority**: A partial export of a long conversation is the most damaging wrong answer
this extension can give, and it currently happens silently on every site that virtualises.

**Independent Test**: Open a conversation long enough that the site has dropped older messages,
export it, and confirm the first message on the page appears in the file and that the file says
whether the capture looks complete.

**Acceptance Scenarios**:

1. **Given** a conversation where the site keeps only part of the transcript in the page,
   **When** the user exports, **Then** the file contains the messages from the beginning of the
   conversation as well as the ones on screen.
2. **Given** a conversation with a hundred or more exchanges, **When** the user exports, **Then**
   the exported file contains every exchange, in order, with no gap.
3. **Given** an export that covered the whole conversation, **When** the user looks at the file,
   **Then** the file states that the capture was complete rather than leaving the user to guess.

---

### User Story 2 - Keep reading where you were (Priority: P1)

The user is halfway down a conversation, reading position three messages from the bottom. They
click the extension and export. When the panel closes, they want to be looking at the same
message, not at the top of a conversation that has been yanked around underneath them.

**Why this priority**: Jumping the page is the most noticeable side effect of the feature. It
would undo the user's place, and it is the kind of thing that makes an extension feel careless.

**Independent Test**: Note the message on screen, export, and confirm the same message is on
screen afterwards, on a conversation long enough for the walk to have moved it.

**Acceptance Scenarios**:

1. **Given** the user has scrolled partway through a long conversation, **When** an export runs,
   **Then** the same message is on screen when it finishes.
2. **Given** an export that fails partway, **When** it finishes, **Then** the reading position is
   still restored.
3. **Given** the user had scrolled to the very bottom, which is where new replies appear,
   **When** an export runs, **Then** the page is left at the bottom, not at the top.

---

### User Story 3 - Say what you got, even when it is short (Priority: P1)

Some conversations are so long, or their pages so slow, that the whole transcript cannot be walked
in reasonable time. The user still gets a file, and the file says exactly how much was captured, so
they can decide whether to try again or scroll through the conversation themselves.

**Why this priority**: An honest short export is usable. A silently short export is data loss, and
it is the failure this repository treats as worst.

**Independent Test**: Force a case where the walk cannot finish, export, and confirm the file and
the panel both state the shortfall rather than implying completeness.

**Acceptance Scenarios**:

1. **Given** a conversation that cannot be fully walked, **When** the user exports, **Then** a
   file is still produced from what was captured, and it states that the capture was incomplete
   and where it started or stopped.
2. **Given** an incomplete capture, **When** the user reads the file, **Then** the file does not
   present itself as the whole conversation.
3. **Given** a page that never settles, **When** the walk gives up, **Then** the user is told
   plainly that the walk stopped early, rather than waiting indefinitely.

---

### User Story 4 - Opt out of the page movement (Priority: P2)

Some users would rather the extension never touched their page position. They can switch the walk
off per site or entirely, and the extension goes back to reading only what is already rendered, and
says that is what it did.

**Why this priority**: Consent to a visible side effect, and it must be a real switch rather than a
hidden default. It cannot block the first release, because the default must be the useful
behaviour.

**Independent Test**: Turn the walk off, export a long conversation, and confirm the page does not
move and the file is marked as the rendered portion.

**Acceptance Scenarios**:

1. **Given** the walk is switched off, **When** the user exports, **Then** the page does not scroll
   and the file is marked as a capture of the rendered portion only.
2. **Given** the walk is switched off, **When** the user exports a short conversation, **Then** the
   result is the same as with the walk on, and no warning is shown that would not apply.
3. **Given** a user switches the walk off, **When** they reload the browser, **Then** the setting
   persists.

---

### User Story 5 - Capture without disturbing a page you are typing in (Priority: P3)

A user who is partway through typing a new message should not lose what they typed, and should not
find the composer moved or cleared. A capture that respects an in-progress reply is a smaller
surprise than one that does not.

**Why this priority**: Worth doing, and it must not block the main flow. If a site renders the
composer inside the scrolled area, a walk could disturb it.

**Independent Test**: Type a partial message without sending it, export, and confirm the text is
still in the composer and its focus is intact.

**Acceptance Scenarios**:

1. **Given** a message partially typed and not sent, **When** the user exports, **Then** the typed
   text is unchanged afterwards.
2. **Given** the keyboard focus is in the composer, **When** the user exports, **Then** focus
   returns to the composer, not to the page body.
3. **Given** a site that moves the composer while scrolling, **When** the user exports, **Then** the
   export still completes and the composer is still usable.

---

### Edge Cases

- The page scrolls the window rather than an inner container, or uses nested scrollers. The walk
  targets the container the conversation lives in, and the window position is restored too.
- The site uses a virtual list that recycles elements, so scrolling back to the top drops the
  bottom again. The capture must be assembled from what was seen, not from one final read.
- The conversation grows while the walk runs, because a reply is still streaming. The walk must not
  loop forever chasing new content, and a reply that was still arriving is still reported as
  incomplete.
- The site replaces the scroll container between the start and the end of the walk, for example
  after a re-render. The walk must detect this and restore the new container's position rather than
  a stale one.
- The user scrolls, clicks, or types while the walk is running. The walk is short and the user's
  input is never blocked or overwritten.
- The page is in a background tab, where scrolling may be throttled or not painted at all. The
  walk must not hang, and must report that it could not complete rather than waiting.
- The conversation is short and fits on screen. The walk does nothing measurable and no warning
  appears.
- A site with its own "load more" control at the top of the transcript, rather than infinite
  scroll. The walk must not click it, because clicking a control changes state the user did not ask
  to change.
- The user exports twice in a row. The second export must not be affected by the first walk.
- Reduced-motion preferences are set. The walk must not animate or smooth-scroll, because a
  smooth scroll defeats both the timing and the user preference.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Before reading a conversation, the system MUST attempt to render the parts of the
  transcript the site has not yet rendered, by moving through the conversation's scroll position.
- **FR-002**: The system MUST restore the user's reading position exactly as it was, on every path
  including success, partial success, and failure.
- **FR-003**: The system MUST capture what it rendered along the way, rather than relying only on a
  single read at the end, so a site that recycles elements cannot drop the tail of the conversation.
- **FR-004**: When the capture is believed complete, the exported file MUST state that it is
  complete.
- **FR-005**: When the capture is incomplete, the exported file MUST state that it is incomplete
  and describe where the captured portion begins or ends, in the user's terms.
- **FR-006**: The system MUST stop the walk within a bounded time and MUST NOT wait indefinitely on
  a page that never settles.
- **FR-007**: When the walk cannot complete, the system MUST still produce an export from what was
  captured, rather than failing the whole export.
- **FR-008**: The system MUST NOT modify the page in any way other than scroll position. It MUST NOT
  click controls, submit forms, send messages, or rewrite page content.
- **FR-009**: The system MUST NOT send any request to the site or anywhere else as part of the walk.
  The page renders itself as the user already caused it to.
- **FR-010**: The user MUST be able to switch the walk off, both for a single site and for all
  sites, and the setting MUST persist across browser restarts.
- **FR-011**: When the walk is switched off, the system MUST mark the export as a capture of the
  rendered portion only, so the user is not misled about completeness.
- **FR-012**: The system MUST report to the user, before the export, that the page will scroll and
  will be returned to its previous position.
- **FR-013**: The system MUST NOT begin the walk while the page is in a background tab, and MUST say
  why it did not.
- **FR-014**: The system MUST leave a reply that is still streaming marked as incomplete, exactly as
  it does without the walk.
- **FR-015**: The system MUST NOT move keyboard focus away from whatever the user was typing in, and
  MUST restore it afterwards.
- **FR-016**: The system MUST NOT alter any text the user has typed but not yet sent.
- **FR-017**: The system MUST produce the same normalised conversation shape as before, so no
  renderer and no export format changes as a result of this feature.
- **FR-018**: The walk MUST be cancellable by the user, and a cancelled walk MUST still restore the
  reading position and still produce an export from what was captured.
- **FR-019**: The system MUST respect a reduced-motion preference by not using animated or smooth
  scrolling during the walk.
- **FR-020**: The system MUST report, in the export result, how long the walk took and whether it
  completed, so a user reporting a problem can say which path was taken.

### Key Entities

- **Walk**: One attempt to render a complete transcript. Carries whether it completed, why it
  stopped, how long it took, and the scroll position to restore.
- **Capture record**: What a walk observed. Carries the turns seen, whether the capture is
  believed complete, and where a partial capture began or ended.
- **Completeness claim**: The statement written into the file, either complete or incomplete with a
  stated reason and boundary. There is no third state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a conversation of 200 exchanges on a site that virtualises, at least 98% of the
  exchanges appear in the exported file, against a baseline of well under half today.
- **SC-002**: In 100% of exports on conversations longer than one screen, the user finds the same
  message on screen afterwards that they were reading before.
- **SC-003**: The exported file states complete or incomplete in 100% of exports, with no file
  leaving the user to guess.
- **SC-004**: No export takes longer than 8 seconds for a 200-exchange conversation, and the user
  sees progress rather than a frozen panel.
- **SC-005**: The page is left unmodified apart from scroll position in 100% of cases, with no
  click, no form submission, and no message sent.
- **SC-006**: No request leaves the browser as part of the walk, in any circumstance.
- **SC-007**: The switch that turns the walk off is honoured in 100% of exports, and its state
  survives a browser restart.
- **SC-008**: Text the user has typed but not sent survives an export in 100% of cases.
- **SC-009**: A reply that was still streaming is never presented as finished, with or without the
  walk.
- **SC-010**: All four export formats contain the same turns after the walk as before it, so the
  feature changes completeness and nothing about format.

## Assumptions

- The conversation lives in a scrollable element the extension can identify, which each site
  adapter already declares. When no such element can be found, the walk is skipped and the export
  behaves as it does today.
- Scrolling a page the user is already reading is an acceptable side effect when it is disclosed
  first and undone afterwards, and is switchable off when it is not.
- Rendering more of a conversation is caused by the site responding to the user's own scroll, and
  needs no permission and no request from the extension.
- Virtualised transcripts render on a short delay after each scroll, so the walk must pause briefly
  at each step. A pause of tens of milliseconds is assumed to be enough; the exact value is settled
  in the plan.
- A conversation that is still growing is bounded for capture purposes, because chasing a streaming
  reply forever is not a useful behaviour.
- Sites that require clicking a "load more" control are out of scope for the walk. The extension
  does not click page controls, so such a site keeps today's behaviour and says the capture may be
  partial.
- Background tabs are not walked, because a throttled background tab produces unreliable reads and
  the user cannot see what is happening.
- The feature applies to all six supported sites through the same mechanism, with no per-site
  special case, because all six declare a scroll container.
- This feature does not change the normalised chat shape, any renderer, or any export format.
