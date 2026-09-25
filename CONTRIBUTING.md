# Contributing

Thanks for helping. This is a zero-dependency, build-step-free Manifest V3 extension: the files
in `src/` are exactly what Chrome loads. Before you start, read [`RULES.md`](RULES.md) and
[`.specify/memory/constitution.md`](.specify/memory/constitution.md).

## Ground rules

1. **Spec first.** Anything beyond a trivial fix starts as a spec in `specs/`, using the Spec Kit
   skills: `speckit-specify`, then `speckit-plan`, then `speckit-tasks`, then
   `speckit-implement`. A pull request that implements an unspecified behaviour will be asked to
   split.
2. **No runtime dependencies.** There is no `package.json` dependency, no bundler, and no
   transpiler. Plain browser JavaScript only. `Buffer`, `eval`, `new Function`, and remote code
   are all rejected by `npm run check:manifest`.
3. **No network.** Extension code must not call `fetch`, `XMLHttpRequest`, or `WebSocket`, and
   must not load a remote resource. The store review checks this, and so does CI.
4. **Minimal permissions.** `storage` and `downloads`, plus the explicit origins in
   `manifest.json`. Do not add a permission or a host pattern in the same pull request as a
   feature; that needs a constitution amendment first.
5. **Honest extraction.** If an adapter matched nothing, return a failure. Do not return an empty
   chat, and do not fill a gap with a plausible guess.
6. **Tests.** Pure logic is covered by `node --test`. A new site needs a fixture and a case in
   `test/adapters.test.js`.

## Local development

```bash
npm test
npm run check:manifest
```

Then open `chrome://extensions`, enable **Developer mode**, and **Load unpacked** this folder.
The popup prints the selectors it tried, which is the fastest way to see why an adapter missed a
page.

## Manual test bench

`test/fixtures/*.html` are saved transcript fragments in the markup shape each adapter reads.
Open one in a browser after loading the extension to exercise a single adapter without a live
account. They prove the engine and the contract; they do not prove a live site still matches.

## Reporting a broken site

Open an issue with:

- the site and its adapter id
- what the export produced: nothing, partial, or wrong roles
- the popup message, which includes the selectors that were tried
- a sanitised snippet of the message container's outer HTML, with your own text removed

## Adding a site

1. Write the spec first, and say why the existing behaviour does not cover it.
2. Add `src/adapters/<id>.js` following
   [`specs/001-chat-export-core/contracts/adapters.md`](specs/001-chat-export-core/contracts/adapters.md).
3. Add the origins to `manifest.json`, in both `host_permissions` and
   `content_scripts.matches`.
4. Add `test/fixtures/<id>.html` and a case in `test/adapters.test.js`.
5. Add a row to [`docs/supported-sites.md`](docs/supported-sites.md) with `verified: false` and
   no date, unless you have actually run an export against a live signed-in conversation.
6. Add the id to `ORDER` in `src/adapters/index.js`.

## Style

Two-space indent, single quotes, semicolons, `const` and `let`. Comments explain why, not what.
Keep functions small enough to read in one screen. Run `npm test` and `npm run check:manifest`
before you push.

## Prose

Documentation, specs, changelog entries, and issue text follow the writing rules in
[`RULES.md`](RULES.md). They are not suggestions.
