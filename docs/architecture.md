# Architecture

## The one shape everything shares

A content script reads the page, an adapter turns it into one normalised chat object, and four
renderers turn that object into a file. Nothing else crosses those boundaries.

```text
page DOM
  -> src/adapters/<site>.js     selectors and role rules, data only
  -> src/core/dom.js            walking, role resolution, code fencing, notes
  -> normalised chat            src/core/chat.js
  -> src/exporters/sections.js  one ordered section list
  -> markdown.js | text.js | docx.js | pdf.js
  -> bytes -> blob URL -> chrome.downloads
```

Because all four formats render from the same section list, they cannot disagree about what was
exported. A test asserts that: the same probes appear in the same order in all four outputs.

## The normalised chat

```js
{
  site, siteLabel, title, url, exportedAt,
  turns: [{ role, text, notes, incomplete }],
  unreadableTurns, incompleteTurns, partial, selection
}
```

A turn with neither text nor notes is not a turn. It is counted as unreadable and reported, so a
broken selector produces a stated failure rather than a file full of empty paragraphs.

## Why the DOCX and PDF writers are in this repository

Manifest V3 forbids remote code, and adding a bundler or a runtime library would mean shipping a
build step and a dependency tree for a tool whose whole promise is that it does nothing but read
a page. Both writers are therefore written by hand:

- **DOCX** is a ZIP with three OOXML parts. `src/exporters/zip.js` holds a CRC32 table and a
  STORE-method writer. Entries are uncompressed, so a Word file is larger than it needs to be.
  That is the trade for having no dependency.
- **PDF** is a multi-page document in the base-14 fonts with a real cross-reference table. Code
  runs are set in Courier. `src/exporters/pdf.js` transliterates common typography and replaces
  anything else outside Latin-1 with `?`.

Both were ported from a working zero-dependency implementation in a sibling project rather than
written from scratch, then adapted: `Buffer` does not exist in an extension, so latin1 output is
built byte by byte and string lengths come from `TextEncoder`.

## The PDF Latin-1 limit, stated plainly

The base-14 fonts with WinAnsi encoding cover Latin-1. A Chinese, Japanese, or Korean
conversation will render as question marks in the PDF. Markdown, plain text, and DOCX keep the
text intact, because they are UTF-8.

This is disclosed in three places rather than hidden: this document, the options page, and a
warning in the popup that appears before the export when characters would be lost. Fixing it
properly means embedding a font subset, which is a real project and is scoped separately rather
than bolted on here.

## Scripts, not modules

A Manifest V3 content script cannot use `ES module` imports, so every file in `src/` attaches to
one global, `window.AIChatDownloader`, in load order defined by `manifest.json`. `npm test` loads
the same files into a Node context through `new Function('window', code)`, so the tests exercise
the files the browser runs rather than a parallel build. `test/minidom.js` provides just enough
DOM for that.

## Reading the page, not the site

The extension never fetches a chat site. It reads the DOM of the page the user already has open,
which is why it needs no credentials, cannot leak a session, and cannot be used to pull a
conversation the user is not allowed to see. The cost is stated in the spec: only rendered
content is available, so a long virtualised transcript may be partial, and the popup says so.

## What is stored

`chrome.storage.local` holds the last used format and the per-site switches. Nothing else, and
never a transcript. `chrome.storage.sync` is deliberately unused, so a preference cannot travel
between profiles through a Google account.

## Permissions

`storage` and `downloads`, plus the nine origins in `manifest.json`. `npm run check:manifest`
fails on a wildcard, a non-HTTPS pattern, an unlisted permission, a missing file, and on any
`fetch`, `XMLHttpRequest`, `WebSocket`, `Buffer`, `eval`, or unexpected remote URL in `src/`.
