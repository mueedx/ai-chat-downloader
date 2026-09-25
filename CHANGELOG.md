# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses semantic
versioning.

## [Unreleased]

Nothing yet.

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

[Unreleased]: https://github.com/mueedx/ai-chat-downloader/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mueedx/ai-chat-downloader/releases/tag/v0.1.0
