# Privacy Policy - AI Chat Downloader

**Last updated:** 26 September 2026

AI Chat Downloader is a Manifest V3 Chrome extension that saves the AI conversation open in your
browser to a file on your machine. This policy explains what it stores, what it sends, and what it
cannot do.

## Short version

- No data is collected.
- No data is transmitted anywhere. The extension makes no network requests of its own.
- No analytics, no telemetry, no tracking, no ads, no third-party servers, no error reporting.
- Your conversations are never stored by the extension. The file is written to your own
  downloads folder and is yours.

## What the extension reads

When you open the popup, it reads the conversation rendered in the tab you are looking at, using
the permissions you granted for the six supported chat sites. It reads the message text, the
conversation title, and whether the page is scrolled away from the top of the transcript. It does
not read your form data, your cookies, your other tabs, or anything on sites outside the supported
origins.

## What the extension stores

Only your preferences, in `chrome.storage.local`:

- the format you last exported in
- which sites you have switched off

`chrome.storage.local` stays in your browser profile. It is not synced to your Google account, and
no conversation, title, message count, filename, or usage statistic is ever written to it.

## What the extension sends

Nothing. There is no request in the extension code, and `npm run check:manifest` fails the build
if a `fetch`, `XMLHttpRequest`, `WebSocket`, remote script, or unexpected remote URL appears in
`src/`. The file you export is created in your browser from the page already in front of you and
handed to Chrome's own download mechanism.

## The exported file

The file is written to your browser's download folder. It contains the conversation text, the
conversation title, the page address, and the time of the export. Once written, that file is
outside the extension's control: deleting the extension does not delete files you already
exported.

## Permissions and why

| Permission | Why |
| --- | --- |
| `storage` | Remembers your format choice and per-site switches. Nothing else. |
| `downloads` | Writes the file you asked for into your downloads folder. |
| Host access to the supported chat origins | Reads the conversation on the page you are looking at. |

Host access is a fixed list of the nine origins for ChatGPT, Claude, Gemini, DeepSeek, Qwen, and
Kimi. There is no wildcard access and no access to any other site.

## Children

The extension is a developer tool and collects no data from anyone, including children.

## Changes

Any change to what the extension stores or sends will be reflected here and in the release notes
before it ships.

## Contact

Open an issue on the repository for a privacy question that is not a vulnerability. For a
vulnerability, follow [`SECURITY.md`](SECURITY.md).
