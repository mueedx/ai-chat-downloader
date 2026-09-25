# AI Chat Downloader Constitution

<!-- Sync Impact Report
     Version change: (template) -> 1.0.0
     Added principles:
       I.   Local-Only Data Handling
       II.  Dependency-Free Manifest V3
       III. Minimal Permissions and Narrow Host Scope
       IV.  Honest Extraction
       V.   Spec-Kit Before Code
     Added sections: Feature Scope, Extension-Specific Constraints, Development Workflow
     Removed sections: none
     Deferred items: none
-->

## Core Principles

### I. Local-Only Data Handling (NON-NEGOTIABLE)
A user's chat transcript never leaves their machine. Extension code MUST NOT transmit
conversation content, titles, message counts, or usage statistics to any endpoint, including
the extension's own. No analytics, no telemetry, no remote logging, no conversion beacons, no
error reporting service. The extension has no server and no backend. Reading a page the user
is already signed in to is permitted because the user initiated it; exporting what was read to
a local file is permitted because the file stays local. Any feature that would require an
outbound request is out of scope until this constitution is amended.

### II. Dependency-Free Manifest V3
The files in `src/` are exactly what Chrome loads. There is no runtime dependency, no bundler,
no transpiler, no `eval`, no `new Function`, and no remote code, because Manifest V3 forbids
remote code and the Chrome Web Store rejects it. `package.json` exists for developer tooling
and CI only; adding a runtime dependency to it is a constitution violation, not a review
comment. Plain browser JavaScript is the only runtime language: `const`/`let`, async/await,
template literals, and standard Web APIs.

### III. Minimal Permissions and Narrow Host Scope
The extension requests `storage` and `downloads` only. Host access is limited to the exact
origins of the supported AI chat sites, enumerated in `docs/supported-sites.md`. A new
permission or a wildcard such as `<all_urls>` requires an amendment to this constitution with
a written justification of why a narrower option fails. Every permission must be defensible in
the Chrome Web Store permission justification form.

### IV. Honest Extraction
A chat is either extracted completely and accurately, or the failure is stated plainly. The
extension MUST NOT silently drop messages, truncate mid-conversation, or report success when an
adapter matched nothing. Empty extraction surfaces an explicit "no messages found" state with
the selectors that were tried. Internal reasoning blocks, tool invocations, and UI chrome are
filtered by a documented shared rule, not by per-site guesswork, so exports read consistently
across sites. Known limits, such as the Latin-1-only PDF writer, are documented rather than
hidden.

### V. Spec-Kit Before Code
Every feature follows the Spec Kit order: constitution, then specify (what and why), then plan
(how), then tasks, then implement. `spec.md` stays technology-agnostic with no file paths or
stack choices; stack decisions live in `plan.md` and `tasks.md`. Implementation of an
unspecified behaviour is not permitted. Enhancement skills (`speckit-clarify`,
`speckit-analyze`, `speckit-checklist`) are used when a spec is ambiguous or when artifacts
disagree. The spec chain is the record of why a feature exists.

## Feature Scope

Supported sites for the first feature: ChatGPT, Claude, Gemini, DeepSeek, Qwen, Kimi. Each is
an independent adapter module behind one interface, so one site breaking does not break the
others and each can be verified and repaired on its own.

Export formats: Markdown, plain text, DOCX, PDF. All four render from one normalised chat
shape and one shared section list, so no format can drift from the others.

Out of scope: sync or cloud storage, accounts, team sharing, uploading transcripts anywhere,
reading private API traffic beyond what the visible page already renders, and adding a site
without a spec.

## Extension-Specific Constraints

- Formats are written by hand, without libraries. DOCX is a minimal OOXML zip built by an
  in-repo CRC32 and STORE-method zip writer. PDF is a minimal multi-page Helvetica document
  with a correct xref table. Both are pure functions of the normalised chat, and both must be
  covered by tests that assert real file signatures.
- Node globals are unavailable in the extension. `Buffer` must not be used; latin1 encoding
  goes through `TextEncoder` and manual byte construction.
- Host permissions are declared per origin in the manifest, and every origin in the manifest
  MUST appear in `docs/supported-sites.md` with a last-verified date.
- The extension reads the page the user is looking at. It does not re-request sites over the
  network, does not replay the user's session, and does not attempt to defeat bot protection.

## Development Workflow

1. Spec Kit order: constitution, specify, plan, tasks, implement. No code before a spec exists.
2. `spec.md` states requirements and acceptance scenarios without naming files or libraries.
3. `plan.md` records the file layout, the adapter contract, and the test strategy.
4. Pure logic (normalisation, filtering, filename sanitising, all four writers) is covered by
   `node --test` with no browser required, including at least one fixture transcript per site.
5. `npm test` must be green before a commit. CI runs the same command plus a manifest and
   permission sanity check.
6. Adapters carry a documented known-issues note. When a site changes its DOM, the repair is a
   new spec, not a silent patch.

## Governance

This constitution supersedes informal shortcuts. Specifically, it forbids faking a successful
export, adding a runtime dependency, widening host permissions, or transmitting conversation
content off-machine. Amendments require editing this file with a version bump, the ISO date,
and a one-line rationale in the Sync Impact Report. Any complexity not justified against
Principles I through V must be cut. Reviewers verify compliance on every pull request; a
violation is a blocking change, not a nit.

**Version**: 1.0.0 | **Ratified**: 2026-09-26 | **Last Amended**: 2026-09-26

