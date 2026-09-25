# Implementation Plan: Chat Export Core

**Branch**: `001-chat-export-core` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-chat-export-core/spec.md`

## Summary

Turn the open conversation on the current tab into a file on disk. A content script detects
the site, runs that site's adapter to turn the rendered page into one normalised chat object,
and the popup asks the user for a format. Four renderers (Markdown, text, DOCX, PDF) all read
that one object, so the formats cannot disagree. DOCX and PDF are written by hand in this
repo, ported from the working zero-dependency writers in the sibling `nicekit-app`, with Node's
`Buffer` replaced by `TextEncoder` and manual byte construction.

## Technical Context

**Language/Version**: Modern browser JavaScript (ES2022). No transpiler, no build step. The
files in `src/` are exactly what Chrome loads.

**Primary Dependencies**: None at runtime. `package.json` exists only for `node --test` and CI.

**Storage**: `chrome.storage.local` for user preferences only (chosen format, per-site enable
flags). No transcript is ever persisted by the extension.

**Testing**: `node --test` with a fixture harness that loads the browser sources into a
`vm` context. No browser and no test framework dependency.

**Target Platform**: Desktop Chrome and Chromium browsers, Manifest V3, Chrome Web Store.

**Project Type**: Browser extension (content script + service worker + popup + options page).

**Performance Goals**: Extraction and file generation complete in under 500 ms for a
50-turn conversation, on the main thread, without freezing the page.

**Constraints**: Zero network requests from extension code. `storage` and `downloads`
permissions only. Host access limited to the six supported origins. No `eval`, no
`new Function`, no remote code. No Node globals in extension code.

**Scale/Scope**: 6 sites, 4 formats, 1 conversation per export. Bulk history export is out of
scope for this feature.

## Constitution Check

_GATE: Passed before Phase 0 research and re-checked after Phase 1 design._

| Principle | How the design satisfies it | Verdict |
| --- | --- | --- |
| I. Local-Only Data Handling | Extraction reads the live DOM; the file is written through the browser's own download path. The extension makes zero network requests, so there is no code path that could transmit a transcript. | PASS |
| II. Dependency-Free MV3 | No bundler, no transpiler, no runtime library. `package.json` has no `dependencies` block. DOCX and PDF are written in-repo. | PASS |
| III. Minimal Permissions | `storage` and `downloads` only. Six explicit origins, no wildcards. Both permissions are justified in `docs/store-checklist.md`. | PASS |
| IV. Honest Extraction | `extractChat` returns a result object carrying `unreadableTurns`, `incompleteTurns`, and `partial`. Zero readable turns is a hard failure that writes no file. Adapters carry a `verified` flag and the docs carry a last-verified date. | PASS |
| V. Spec-Kit Before Code | spec.md, plan.md, data-model.md, research.md, contracts/, tasks.md all exist before implementation. | PASS |

Complexity tracking: empty. No principle is violated, so no exception is claimed.

## Project Structure

### Documentation (this feature)

```text
specs/001-chat-export-core/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── adapters.md
└── tasks.md
```

### Source Code (repository root)

```text
manifest.json
src/
├── background.js          Service worker: download delegation, badge
├── content.js             Detects site, runs adapter, replies to popup
├── storage.js             Preference defaults, validation, get/save
├── popup.html/js/css      Format picker, preview, export button
├── options.html/js/css    Per-site switches, format default, backup
├── core/
│   ├── namespace.js       Global namespace bootstrap for classic scripts
│   ├── chat.js            Normalised chat type, block filtering, turn shaping
│   ├── sites.js           Site registry: id, label, origins, adapter lookup
│   ├── filename.js        Filename sanitising and timestamping
│   └── dom.js             Shared DOM text walker, code-block extraction
├── adapters/
│   ├── index.js           Adapter lookup by host
│   ├── chatgpt.js
│   ├── claude.js
│   ├── gemini.js
│   ├── deepseek.js
│   ├── qwen.js
│   └── kimi.js
└── exporters/
    ├── index.js           Format registry, MIME types, extensions
    ├── markdown.js
    ├── text.js
    ├── sections.js        Shared section list all renderers consume
    ├── zip.js             CRC32 + STORE-method zip writer
    ├── docx.js
    └── pdf.js
test/
├── harness.js             Loads src/ files into a vm context
├── fixtures/              One transcript fixture per site
├── core.test.js
├── filename.test.js
├── exporters.test.js
└── adapters.test.js
```

**Structure Decision**: Single project, no bundler, no build output. Adapters are one file per
site so a broken site is repaired without touching the other five or any renderer. Renderers
sit behind one shared section list so a change to output shape lands in one place. Classic
scripts under a single `window.AIChatDownloader` namespace, because a content script cannot use
ES module imports in Manifest V3.

## Complexity Tracking

> No constitution violations. Nothing to justify.
