# Research: Chat Export Core

## Decision 1: How the conversation is obtained

Options considered:

1. Re-request the site's own API from the extension with the user's session. Rejected. It needs
   host permissions on API paths, it re-implements each site's private API, and it breaks the
   moment a site changes an endpoint. It also means the extension fetches the site on its own,
   which brushes against Principle I.
2. Parse the live rendered DOM from a content script. Chosen. The user is already looking at
   the conversation, the page has already loaded it, and the extension never issues a request.
3. Ask the user to paste a share link. Rejected. Only some of the six sites have share links
   that expose a full transcript, and it forces the user to publish a private conversation.

Consequence: extraction can only see what the page has rendered. Very long transcripts that
the site virtualises may be partial. The chat object carries `partial: true` when this is
detected, and the result panel says so (FR-014).

## Decision 2: What counts as one turn

A turn is one message container found in the page. The role comes from the site adapter.
Text is a plain-text rendering of the message element where code blocks become fenced blocks,
preserving line breaks and indentation (FR-008). Reasoning blocks and tool activity are
dropped by one shared rule in `core/chat.js` rather than per site, so exports read the same
way everywhere (FR-009, Principle IV).

Non-text content becomes a labelled note such as `[image]` or `[attachment]`. Nothing is
invented (FR-010).

## Decision 3: File writing

`chrome.downloads.download` with a `blob:` URL created in the extension page, because
`downloads` is the only permission that writes a file and the blob never leaves the browser.
An object URL is revoked on completion and on failure. If the download is interrupted, the
result reports failure, never success (FR-026).

## Decision 4: DOCX and PDF without libraries

Both writers are ported from the working implementation in the sibling `nicekit-app`
(`lib/exporters.ts`), which writes a minimal OOXML zip and a minimal multi-page Helvetica PDF
with a correct xref table and no dependencies. Porting is preferable to linking because this
repository ships standalone and cannot depend on a sibling app.

Two changes are required for an extension: `Buffer` does not exist, so latin1 output is built
with `TextEncoder` for the text part and manual byte writes for the binary parts; and object
sizes are read with `byteLength()` from a `TextEncoder` rather than `Buffer.byteLength`.

Known limits, carried over deliberately and documented rather than hidden:

- PDF uses the base-14 Helvetica fonts with WinAnsi encoding, so characters outside Latin-1
  cannot be represented. CJK transcripts will lose glyphs in PDF. Markdown, text, and DOCX are
  unaffected. Font embedding is out of scope for this feature (FR-025, SC-004 is about
  openability, not glyph coverage).
- The zip writer uses STORE, so DOCX files are larger than a deflated equivalent.

## Decision 5: Where per-site knowledge lives

One adapter file per site, each exporting the same shape: id, label, origins, role selectors,
title selectors, a streaming selector, and a `verified` flag. `adapters/index.js` maps host to
adapter. A site that changes layout is repaired by editing one file, with no change to the other
five adapters or to any renderer (SC-008).

Each adapter lists several selector candidates and tries them in order, because site markup uses
generated class names that change without notice. Role is never inferred from styling classes
alone; if no candidate selector matches, the adapter returns zero turns and the failure is
reported (FR-011).
