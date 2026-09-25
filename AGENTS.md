# Agent instructions

Read this file, then `RULES.md`, then `.specify/memory/constitution.md`, before changing anything
in this repository. All three are binding. Where they appear to conflict, the constitution wins
on engineering questions and `RULES.md` wins on writing questions.

## Order of work

1. Read `.specify/memory/constitution.md`. It is the source of truth for privacy, dependencies,
   permissions, and honest extraction.
2. Read `RULES.md`. It governs every piece of prose produced here, including docs and specs.
3. Use Spec Kit for anything that is not a trivial fix. The skills are installed in
   `.claude/skills` and the order is: `speckit-constitution`, `speckit-specify`, `speckit-plan`,
   `speckit-tasks`, then `speckit-implement`. Use `speckit-clarify` when a requirement is
   ambiguous, `speckit-analyze` when artifacts disagree, and `speckit-checklist` before
   implementation.
4. Set `.specify/feature.json` to the feature directory you are working in, so the next agent
   knows where the work lives.

## Hard limits

- No runtime dependency, no bundler, no build step. `src/` is loaded by Chrome as written.
- No `eval`, no `new Function`, no remote code, no Node globals in `src/`.
- No network request from extension code. This is not negotiable and covers analytics, logging,
  error reporting, and beacons.
- Permissions stay `storage` and `downloads`. Host access stays the explicit origin list in
  `manifest.json`.
- Never widen host access with `<all_urls>` or `*://*/*`.
- Never write a file and report success unless the file was actually written.

## Honesty requirements

- An adapter that has not been run against a live signed-in conversation must keep
  `verified: false` and `lastVerified: null`, and `docs/supported-sites.md` must say so. Do not
  mark a site verified to make a report look better.
- When a site changes its markup, the repair is a new spec plus a fixture, not a quiet patch.
- If a task cannot be finished as asked, say which part is unfinished and why, in the final
  response and in the report. Partial delivery described as complete is the failure mode this
  repository is most careful about, because the product itself is about not losing a
  conversation.

## Checks before you finish

```bash
npm test
npm run check:manifest
```

Both must pass. Then update the reports described in `RULES.md`: `report/YYYY-MM-DD.md` and
`report/changes.md`.

## Layout

```text
manifest.json               MV3 manifest: permissions, content scripts, popup, options
src/core/                   Namespace, normalised chat, DOM engine, filenames, site registry
src/adapters/               One file per site, data only, behind one contract
src/exporters/              Markdown, text, sections, zip, DOCX, PDF, and the format registry
src/content.js              Runs on the supported origins, answers the popup
src/background.js           Service worker, owns the download call
src/popup.*                 Format picker, preview, export
src/options.*               Preferences and per-site status
test/                       node --test suite, one fixture per site
test/minidom.js             A small DOM, tests only
tools/                      Icon generator, manifest check, store packaging
specs/                      Spec Kit artifacts per feature
docs/                       Architecture, supported sites, store checklist
```

## Adding a site

Read `specs/001-chat-export-core/contracts/adapters.md` first. Then add the adapter file, add
its origins to `manifest.json` in both `host_permissions` and `content_scripts.matches`, add a
fixture, add a row to `docs/supported-sites.md`, and add a case to `test/adapters.test.js`. No
renderer changes. No other adapter changes.
