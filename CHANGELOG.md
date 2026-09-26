# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic
versioning.

## [Unreleased]

Nothing yet.

## [0.2.0] - 2026-09-26

Full transcript capture, specified as `002-full-transcript-capture`.

### Added

- Before reading a long conversation, the page is walked from the top down so the site renders the
  transcript it had discarded, and the reading position is restored afterwards on every path,
  including cancellation and a walk that runs out of time.
- Successive reads are merged, so a conversation whose list recycles its elements is no longer
  captured from whichever window happened to be on screen last.
- Every exported file now states whether it is the whole conversation, with a reason when it is
  not: the walk was switched off, the page was in a background tab, the walk ran out of time, or
  the site does not expose a scrollable transcript. Nothing infers completeness from a turn count.
- A disclosure in the popup, on by default, and a global and per-site switch in the options page.
- Preservation of keyboard focus and of text typed but not yet sent, across the walk.

### Changed

- The content script's extraction is asynchronous, since it can now walk a page.
- A read without a walk never claims completeness, and says which of the two incomplete cases it
  is, rather than a single shared note.

### Known limitations

- A site that needs a "load more" control, rather than scrolling, is not walked. The extension does
  not click page controls, so such a site keeps the previous behaviour and is reported as an
  incomplete capture.
- The walk has not been run against a live long conversation on any of the six sites.

## [0.1.0] - 2026-09-26

First release candidate, built to the `001-chat-export-core` specification.

### Added

- Chat export for ChatGPT, Claude, Gemini, DeepSeek, Qwen, and Kimi, one independent adapter per
  site behind a shared contract.
- Four export formats rendered from one normalised conversation: Markdown, plain text, DOCX, and
  PDF. The DOCX and PDF writers are hand-written in this repository, with no library.
- Popup panel showing the site, the conversation title, and the message count read from the page,
  with a format picker, an optional turn range, and warnings for unreadable, incomplete, or
  partial captures.
- Options page with the default format, per-site switches, and a per-site verification status
  board.
- Failure reporting that names the reason and the selectors tried, and writes no file when nothing
  could be read.
- `npm test`, `npm run check:manifest`, `npm run package`, and `npm run icons`.
- Spec Kit artifacts for feature `001-chat-export-core`, a project constitution, and repository
  rules for agents and prose.

### Known limitations

- PDF output uses the base-14 fonts, which cannot draw characters outside Latin-1. CJK text
  becomes question marks in PDF only. The popup warns before such an export.
- No adapter has been verified against a live signed-in conversation yet. Each site shows as
  unverified in the options page until someone records a check date in `docs/supported-sites.md`.
- Only the part of a conversation the page has rendered can be captured.

[Unreleased]: https://github.com/mueedx/ai-chat-downloader/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/mueedx/ai-chat-downloader/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mueedx/ai-chat-downloader/releases/tag/v0.1.0
