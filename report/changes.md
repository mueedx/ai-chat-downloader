# Change log

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
