# AI Chat Downloader

A Manifest V3 Chrome extension that saves the AI conversation you are reading as Markdown,
plain text, Word, or PDF. It works on ChatGPT, Claude, Gemini, DeepSeek, Qwen, and Kimi, and it
does the same thing on all six.

No account. No server. No analytics. No network requests of its own. The extension reads the
page you already have open and writes a file to your downloads folder. Permissions are `storage`
and `downloads`, and host access is limited to the nine origins listed in
[`docs/supported-sites.md`](docs/supported-sites.md). MIT licensed.

## Install from source

Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and pick this
folder. Chrome asks for permission to read the six chat sites. Accept.

## Use it

Open a conversation, click the toolbar icon, and the panel shows the site, the conversation
title, and how many messages it read from the page. Pick a format, press **Export**, and the
file lands in your downloads folder with a name built from the title, the site, and the time.

If nothing can be read, no file is written and the panel says so, with the selectors that were
tried. A blank document that looks like data loss is the one outcome this project is built to
avoid.

## Long conversations

A long conversation is not all in the page: the site discards older messages and renders them again
when you scroll. Before reading, the extension walks the conversation's scroll area so the site
renders the rest, then puts your reading position back exactly where it was, including when the walk
stops early or you cancel it. Nothing is clicked, typed, or sent; the only thing that changes on the
page is where it is scrolled to.

Every exported file states whether it is the whole conversation. If the walk could not finish, the
file says so and says why, rather than presenting a partial capture as the conversation. You can
switch the walk off in the popup, or globally and per site in the options page, and the file will say
that only the rendered portion was exported.

## Formats

| Format | Good for | Note |
| --- | --- | --- |
| Markdown | notes, diffs, Obsidian, any repo | Code stays fenced with its language |
| Plain text | pasting anywhere | Fixed-width labels, no markup |
| Word (`.docx`) | Word, LibreOffice, Google Docs | Code runs use a monospace font |
| PDF | sharing and printing | Base-14 fonts, no external files |

PDF is the one format with a real limit: the built-in PDF fonts cannot draw characters outside
Latin-1, so a Chinese, Japanese, or Korean conversation will show question marks in the PDF and
keep its text in the other three. The popup warns you before it exports a PDF that would lose
characters. See [`docs/architecture.md`](docs/architecture.md).

## What it will not do

- It will not read a conversation you are not looking at, and it will not ask for a share link.
- It will not send anything anywhere. There is no code path that could.
- It will not silently drop a message from the middle of a conversation. If some turns cannot be
  read, it exports the readable ones and tells you how many it skipped.
- It will not claim a download finished when it was interrupted.
- It will not click a page control to load more of a conversation, and it will not claim a capture
  is complete when the walk did not reach the end.
- It will not invent a caption, a filename, or a link for an image or attachment. Those become a
  labelled note such as `[image]`.
- It will not mark a site as working when its selectors have not been checked against a live
  page. See the status column in [`docs/supported-sites.md`](docs/supported-sites.md).

## Why it exists

Chat sites change their markup without warning, and when they do, most exporters fail quietly.
This one is built so that a break is visible: each site is an independent adapter, each adapter
carries a verification flag and a known-issues note, and the options page shows which sites have
actually been checked against a live conversation. When a site changes, the repair touches one
file and one fixture.

## Development

Requires Node 20 or newer. There are no dependencies, so there is no install step.

```bash
npm test                 # node --test suite, no browser needed
npm run check:manifest   # manifest limits, permissions, and a no-network source scan
npm run package          # dist/ai-chat-downloader-<version>.zip, ready to upload
npm run icons            # regenerate icons/icon16,48,128.png
```

`src/` is exactly what Chrome loads. There is no bundler, no transpiler, and no runtime library,
because Manifest V3 forbids remote code and the store rejects it. `package.json` exists for
`node --test` and CI only.

## Project layout

```text
manifest.json            MV3 manifest
src/core/                namespace, normalised chat, DOM engine, filenames, site registry
src/adapters/            one file per site: selectors and role rules, no logic
src/exporters/           sections, Markdown, text, zip, DOCX, PDF, format registry
src/content.js           content script for the supported origins
src/background.js        service worker, owns the download
src/popup.*              format picker and export panel
src/options.*            preferences and per-site status
test/                    node --test suite, one fixture per site
tools/                   icon generator, manifest check, store packaging
specs/                   Spec Kit artifacts, one directory per feature
docs/                    architecture, supported sites, store checklist
```

## Spec-driven development

This repository is developed with [GitHub Spec Kit](https://github.com/github/spec-kit). Every
feature starts as a specification in [`specs/`](specs), becomes a plan and a task list, and only
then becomes code. The project constitution is
[`.specify/memory/constitution.md`](.specify/memory/constitution.md), and
[`AGENTS.md`](AGENTS.md) requires that order.

The current feature is `specs/001-chat-export-core`.

## Verifying a site

No adapter has been checked against a live signed-in conversation yet, so every site shows as
unverified in the options page. The procedure for changing that, and the privacy rules it asks you
to follow, is in [`docs/verification-checklist.md`](docs/verification-checklist.md).

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`RULES.md`](RULES.md) first. Bug reports are most
useful with the site, the selector that used to work, and a sanitised snippet of the markup.

## Security

Report a vulnerability privately as described in [`SECURITY.md`](SECURITY.md). Do not open a
public issue for one.

## License

[MIT](LICENSE). Copyright 2026 Mueed Mubashar.
