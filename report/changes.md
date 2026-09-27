# Change log

## 2026-09-27

- Fixed the popup crash on a failed extraction: the failure branch called `NS.dom.describeDiagnostic`
  in a scope where `NS.dom` does not exist, because `src/popup.html` never loads `core/dom.js`. The
  content script now words the diagnosis and the popup prints that string.
- Added `loadPage` to the test harness. The popup and options suites now load exactly the scripts
  their HTML lists, because the shared harness handed both pages modules their real scope has never
  had, which is how the missing script tag survived a green suite.
- Restored the 003 diagnostic work from the Cline checkpoint: `NS.dom.diagnose`,
  `NS.dom.describeDiagnostic`, the same-origin frame fallback in `extractChat`, the spec, and
  `test/diagnosis.test.js`.
- Taught `test/minidom.js` the universal selector and a `SyntaxError` on an unparsable selector, so
  an unsupported selector reads as unsupported rather than as a count of zero.
- Left the DeepSeek selector repair undone, and DeepSeek `verified: false`. It needs a real capture
  of a live conversation.
- Pointed `.specify/feature.json` at `specs/003-deepseek-message-detection`.

## 2026-09-26

- Initialised the repository and the `001-chat-export-core` feature branch.
- Installed GitHub Spec Kit and wrote the project constitution (v1.0.0).
- Wrote the full `001-chat-export-core` spec chain: spec, plan, research, data model, quickstart,
  adapter contract, and tasks.
- Added the Manifest V3 manifest with `storage` and `downloads` and ten explicit origins.
- Added the normalised chat, DOM engine, filename builder, and site registry under `src/core/`.
- Added six site adapters and the host lookup under `src/adapters/`.
- Added the Markdown, plain text, DOCX, and PDF renderers plus the format registry, with the DOCX
  zip and the PDF writer written by hand and no runtime dependency.
- Added the content script, service worker, popup, options page, and preference storage.
- Added 69 `node --test` cases, a test-only DOM, and one fixture transcript per site.
- Added the icon generator, manifest checker, and store packaging tools.
- Added the repository hygiene set, the GitHub templates, dependabot, and CI.
- Added the architecture, supported-sites, and store-checklist documentation.
- Added `RULES.md`, `AGENTS.md`, and `CLAUDE.md` binding the writing checklist, the constitution,
  and the spec-kit order.
- Left every adapter marked unverified, with the reason recorded in `docs/supported-sites.md`.
- Added a runtime suite covering the content script, preference store, and service worker.
- Fixed the popup throwing on a supported site when it read a removed cache variable.
- Fixed the DOM engine leaking interface chrome into exports and missing image notes, both caused
  by a case mismatch in the tag ignore list.
- Kept list markers when a message is rendered as plain text.
- Added a popup suite driving the export path, the format switch, the turn range, and the failure
  paths that must not reach the download call.
- Added the live verification checklist, so a site check is a fixed procedure with a recorded result.
- Added an options page suite covering the per-site switches, the default format, and the status
  board, including that a verified adapter really does change what the board says.
- Opened feature 002 and specified full transcript capture: two-phase walk, overlap merge,
  completeness claim, opt-out switches, and focus preservation.
- Added the walk and the merge, both proven against a fake scroll container before anything called
  them.
- Fixed two defects the new tests found: a walk that exhausted its steps reported completion, and
  the final read could win over an earlier longer read.
- Every exported file now states whether it is the whole conversation, with a reason when not.
- Added the popup disclosure and the global and per-site capture switches.
- Fixed the service worker, which threw on load because it referenced a `window` a service worker
  does not have. Every export failed silently as a result.
- Added a worker suite that evaluates the file in a vm context with no `window`, because the shared
  harness supplied one and hid the bug.
- Extended the manifest check to fail on page-only globals in the service worker and on a content
  script list that does not load the namespace first.
- Fixed window scroll restoration in the walk, which read a property the document does not have
  and would have thrown if it had used the window instead. The walk now calls scrollTo.
- Deleted the stale 0.1.0 build artifact, which still contained the broken service worker.
