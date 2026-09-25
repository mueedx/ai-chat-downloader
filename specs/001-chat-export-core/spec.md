# Feature Specification: Chat Export Core

**Feature Branch**: `001-chat-export-core`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "Feature: Chat Export Core. A user viewing a conversation on ChatGPT, Claude, Gemini, DeepSeek, Qwen, or Kimi can export the visible conversation to Markdown, plain text, DOCX, or PDF, entirely on their machine. Per-site adapters feed one normalised chat shape. No network transmission, no accounts, no cloud storage. Multi-turn conversations, code blocks preserved, conversation title and timestamp included, safe filenames, explicit empty-state failure."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export the conversation in front of me (Priority: P1)

Someone is reading a long conversation with an assistant and wants to keep a copy. They click
the extension, choose a format, and get a file on their machine. They never sign in anywhere,
they never paste a link, and nothing about the conversation touches a network.

**Why this priority**: This is the whole product. Nothing else in the feature has value without
it.

**Independent Test**: Open any supported conversation, export it, and open the resulting file.
The file must contain every visible turn in order, in readable form, with the conversation
title on it.

**Acceptance Scenarios**:

1. **Given** a conversation open on a supported site with at least one exchange, **When** the
   user chooses a format and confirms the export, **Then** a file is written to the user's
   download folder containing that conversation.
2. **Given** an open conversation, **When** the user exports, **Then** the conversation title
   and the local time of export appear in the file.
3. **Given** an open conversation, **When** the user exports, **Then** the exported text
   matches the messages visible on the page, in the same order, with nothing dropped from the
   middle.

---

### User Story 2 - Export every supported site the same way (Priority: P1)

The same four buttons work on ChatGPT, Claude, Gemini, DeepSeek, Qwen, and Kimi, and the
resulting files are structured the same way regardless of which site the conversation came
from. A user who switches assistants does not have to relearn the tool or reformat their
archive.

**Why this priority**: Site coverage is what makes this worth installing over a single-site
script, and a consistent output shape is what makes the archive usable later.

**Independent Test**: Export the same kind of exchange from two different sites and compare
the two files. The speaker labels, ordering rules, and metadata block must be identical in
shape.

**Acceptance Scenarios**:

1. **Given** an exchange on any of the six supported sites, **When** the user exports it, **Then**
   the same four formats are offered and produce the same structure as any other site.
2. **Given** a conversation that includes a code block, **When** the user exports to Markdown or
   plain text, **Then** the code appears with its original line breaks and indentation intact.
3. **Given** a conversation from two different sites, **When** both are exported to the same
   format, **Then** speaker labels and the metadata block use identical wording and position.

---

### User Story 3 - Know when something went wrong (Priority: P2)

Sites change their layout without warning, and a silent empty file is worse than a clear
message. When extraction finds nothing, the user is told plainly that nothing was found and
which site was attempted, instead of receiving a blank document that looks like data loss.

**Why this priority**: This extension will break when a site redesigns. Honest failure is the
difference between a bug report and a user assuming their conversation was deleted.

**Independent Test**: Attempt an export on an unsupported page or a page where nothing can be
read, and confirm the message is specific and no file is silently written.

**Acceptance Scenarios**:

1. **Given** a page where no conversation can be read, **When** the user attempts an export,
   **Then** no file is written and the user is told that no messages were found.
2. **Given** a page where some turns are present but a turn is unreadable, **When** the user
   exports, **Then** the readable turns are exported and the user is told the count of turns
   that could not be read.
3. **Given** a page on a site the extension does not support, **When** the user opens the
   extension, **Then** the tool states plainly that the current site is not supported and names
   the supported sites.

---

### User Story 4 - Keep the archive tidy (Priority: P2)

Every export lands as a file whose name is readable and valid on the user's operating system,
built from the conversation title plus a timestamp, so a folder of exports does not become a
pile of files named `Untitled` or with characters the system rejects.

**Why this priority**: Downloads are the product's only output, and a broken filename means
the file is awkward or lost.

**Independent Test**: Export conversations with long titles, emoji, punctuation, and
non-Latin characters, then confirm every resulting filename saves successfully and is
distinguishable.

**Acceptance Scenarios**:

1. **Given** a conversation title containing punctuation, emoji, or characters outside the
   basic Latin range, **When** the user exports, **Then** the file is saved with a valid name
   that preserves as much of the title as the system allows.
2. **Given** two exports of the same conversation, **When** both complete, **Then** the
   filenames differ so neither overwrites the other.
3. **Given** a conversation with no usable title, **When** the user exports, **Then** the
   filename falls back to a sensible name built from the site and the timestamp.

---

### User Story 5 - Choose what gets exported (Priority: P3)

A user with a long conversation may want the whole thing, or may want to trim a range of turns
before saving. They choose the range themselves, and the export respects that choice.

**Why this priority**: Nice to have once the basic export is trustworthy. It must not block
the core flow.

**Independent Test**: Export a selected range of turns and confirm only those turns, in order,
appear in the file.

**Acceptance Scenarios**:

1. **Given** a conversation with many turns, **When** the user selects a subset of turns and
   exports, **Then** only the selected turns appear, in their original order.
2. **Given** a selection containing exactly one turn, **When** the user exports, **Then** the
   file is produced normally and the metadata reports that a selection was exported.

---

### Edge Cases

- The conversation is longer than the rendered page, because the site virtualises or paginates
  long transcripts. The export must state how many turns it read rather than implying the file
  is complete.
- A conversation contains an attachment, an image, or a generated artefact. The export must
  represent it as a labelled note, not invent a caption or a link that was never shown.
- A conversation contains internal reasoning or tool activity. That material is excluded by one
  shared, documented rule applied identically on every site.
- The assistant is still streaming a reply when the user exports. The partial turn is either
  excluded and reported, or included and marked as incomplete; it must never be saved as if it
  were a finished turn.
- The page is scrolled and older turns are not yet rendered. The export states that the visible
  portion was captured.
- The user's operating system rejects a character in the filename. The name is reduced to a
  valid form rather than the export failing.
- The site is in a language other than English. Labels in the export identify the speaker
  generically and the file is written as UTF-8 text.
- The download is blocked or the user cancels the save dialog. No error is reported as a
  successful export.
- A conversation contains text in a script the PDF format cannot represent. The limitation is
  disclosed rather than silently producing blank pages.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST offer export of the conversation currently displayed in the
  user's browser tab.
- **FR-002**: The system MUST support ChatGPT, Claude, Gemini, DeepSeek, Qwen, and Kimi, each
  handled by its own independently verifiable extraction path.
- **FR-003**: The system MUST offer exactly four output formats: Markdown, plain text, DOCX,
  and PDF.
- **FR-004**: All four formats MUST be rendered from one normalised representation of the
  conversation, so that no two formats can disagree about the content.
- **FR-005**: The normalised representation MUST preserve, for every turn, the speaker identity
  and the full message text.
- **FR-006**: The system MUST preserve the conversation's visible turns in their original
  order, and MUST NOT omit a turn from the middle of the conversation.
- **FR-007**: Every exported file MUST carry the conversation title and the local date and time
  of export.
- **FR-008**: Code blocks MUST retain their original line breaks and indentation in every
  format.
- **FR-009**: The system MUST exclude internal reasoning content and tool activity from exports
  using one shared, documented rule applied identically across all supported sites.
- **FR-010**: Attachments, images, and other non-text turns MUST be represented as a labelled
  note describing what kind of item was present, with no invented caption, filename, or link.
- **FR-011**: When no conversation content can be read, the system MUST write no file and MUST
  report that no messages were found.
- **FR-012**: When some turns are unreadable, the system MUST export the readable turns and
  MUST report the number of turns it could not read.
- **FR-013**: When a turn is incomplete because the reply was still being generated, the system
  MUST either exclude it or mark it as incomplete, and MUST NOT present it as finished.
- **FR-014**: When the captured conversation is limited to what the page had rendered, the
  system MUST disclose that limit in the result shown to the user.
- **FR-015**: The system MUST write exported text as UTF-8.
- **FR-016**: Export filenames MUST be valid on the user's operating system, MUST derive from
  the conversation title, and MUST include enough timestamp detail that repeated exports of the
  same conversation do not overwrite one another.
- **FR-017**: When a conversation has no usable title, the filename MUST fall back to a name
  built from the site and the export time.
- **FR-018**: The system MUST NOT transmit conversation content, conversation titles, message
  counts, filenames, or usage statistics to any destination outside the user's own browser.
- **FR-019**: The system MUST NOT require an account, sign-in, or any hosted service to function.
- **FR-020**: On a site the extension does not support, the system MUST say so plainly and list
  the supported sites.
- **FR-021**: The system MUST restrict its access to the supported sites' own pages, and MUST
  NOT read unrelated browsing.
- **FR-022**: The user MUST be able to select a subset of turns to export, and the export MUST
  reflect that selection in order.
- **FR-023**: When a selection was exported, the file's metadata MUST state that the content is
  a selection rather than the whole conversation.
- **FR-024**: The system MUST keep the user's format preference, and any other preference the
  user can set, in their own browser profile.
- **FR-025**: The system MUST disclose in its documentation that the PDF output cannot
  represent every script, and MUST NOT silently emit a PDF with missing text.
- **FR-026**: The system MUST NOT claim an export succeeded unless the file was actually
  written.
- **FR-027**: The DOCX and PDF outputs MUST be valid, openable files, not renamed text.

### Key Entities

- **Conversation**: A single exchange as displayed on a supported site. Carries the site, the
  conversation title, the turns, and the export timestamp.
- **Turn**: One message within a conversation. Carries the speaker (the user or the assistant),
  the message text, and, where applicable, notes about non-text content or incompleteness.
- **Export**: A produced file. Carries the conversation it came from, the chosen format, the
  filename, the turn range covered, and the outcome including any unread turns.
- **Site adapter**: The per-site knowledge that turns a page into a conversation. Independent,
  individually verifiable, and replaceable without touching the other sites or the formats.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from an open conversation to a saved file in at most three
  interactions, without leaving the page they are reading.
- **SC-002**: On every supported site, at least 95% of turns in a representative 50-turn
  conversation appear in the exported file, with none lost from the middle.
- **SC-003**: All four formats produced from the same conversation contain the same turns in the
  same order, verified turn count for turn count.
- **SC-004**: Every DOCX file opens in a standard word processor and every PDF file opens in a
  standard viewer, in 100% of cases, with no repair prompt.
- **SC-005**: No exported conversation content leaves the browser in any circumstance, verified
  by reviewing every network request the extension makes.
- **SC-006**: When extraction fails, 100% of failures state a specific reason and write no
  file; a user is never given a blank file that appears to be a successful export.
- **SC-007**: A user who changes assistants does not need to relearn the tool: the export flow
  and output structure are identical on all six sites.
- **SC-008**: Adding a repair for one site that changed layout does not require changes to any
  other site or to any output format.
- **SC-009**: All exported filenames open on Windows, macOS, and Linux without modification or
  error.
- **SC-010**: The extension requests no access to any site outside the six supported chat
  origins.

## Assumptions

- The user is already signed in to the site whose conversation they are exporting. The extension
  never signs in, and never requests credentials.
- The user has granted the extension permission to read the six supported origins, which
  Chrome prompts for on install.
- Exports are written to the user's own download folder and are the user's to keep or discard.
- Conversations are read from the page the user is already viewing. The extension does not fetch
  these sites itself and does not attempt to bypass bot protection or access restrictions.
- Sites may change their layout. Repairing a broken site is expected ongoing maintenance and is
  scoped as its own specification.
- Browser-based access means only what the page has rendered, so a very long conversation may be
  partial until the user scrolls it fully into view. This is disclosed rather than worked
  around.
- The PDF output is limited to characters representable in a basic Latin font. This limit is
  accepted for the first feature and disclosed in the documentation; font embedding is out of
  scope.
- Users are assumed to be on a current desktop Chrome or a Chromium browser. Other browsers are
  out of scope for the first feature.
- The first feature covers single conversations. Bulk or whole-history export across a user's
  account is out of scope.
