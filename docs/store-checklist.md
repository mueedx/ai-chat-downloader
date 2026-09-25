# Chrome Web Store submission checklist

Everything to do before uploading, and the exact text to paste where the store asks for it.

## Before uploading

- [ ] `npm test` is green.
- [ ] `npm run check:manifest` passes.
- [ ] `npm run package` produced `dist/ai-chat-downloader-<version>.zip`.
- [ ] The version in `manifest.json` is bumped and `CHANGELOG.md` has an entry.
- [ ] The zip contains only `manifest.json`, `src/`, `icons/`, and the three documents.
- [ ] Each site in `docs/supported-sites.md` has been checked against a live conversation, or the
      page says plainly that it has not. Do not mark a site verified without doing the check.

## Store listing

**Category:** Productivity

**Summary, 132 characters, already the value in `manifest.json`:**

> Save the AI chat on screen as Markdown, text, Word, or PDF. Works on ChatGPT, Claude, Gemini, DeepSeek, Qwen, Kimi. No tracking.

**Description:**

AI Chat Downloader saves the conversation you are reading as a file you own. Open a chat, click the toolbar icon, choose Markdown, plain text, Word, or PDF, and the file lands in your downloads folder with a readable name built from the conversation title, the site, and the time.

It works the same way on ChatGPT, Claude, Gemini, DeepSeek, Qwen, and Kimi, and it produces the same structure on every one of them: the same speaker labels, the same metadata block, the same ordering. You can export a single turn or a range if a conversation is long.

Everything happens on your machine. There is no account, no server, no analytics, and no network request from the extension. It reads the page you already have open and writes a file. Nothing about your conversation is stored by the extension or sent anywhere.

The extension says so when something is wrong. If a site changes its layout and the export finds nothing, you get a clear message and the list of selectors it tried, not a blank file. If some messages could not be read, if a reply was still being written, or if only part of a long conversation had been rendered, the file and the popup both say that plainly.

One honest limit: the PDF format uses the fonts built into the PDF format itself, which cannot draw characters outside Latin-1. Chinese, Japanese, and Korean text shows as question marks in PDF. Markdown, plain text, and Word keep it correctly, and the popup warns you before exporting a PDF that would lose characters.

Permissions, and why each one is needed:

- storage: remembers your format choice and which sites you switched off. Nothing else is stored.
- downloads: writes the file you asked for.
- access to the six supported chat sites: reads the conversation on the page you are viewing.

MIT licensed. Source code included in the listing.

## Permission justification, for the store form

- `storage`: stores the user's preferred export format and per-site enablement flags. No
  conversation content is written to storage.
- `downloads`: saves the exported conversation to the user's own download folder at the user's
  request. Without it the extension could not produce a file.
- Host permission, `chatgpt.com` and `chat.openai.com`: reads the rendered conversation so it can
  be exported. Content is processed locally and never transmitted.
- Host permission, `claude.ai`: as above.
- Host permission, `gemini.google.com`: as above.
- Host permission, `chat.deepseek.com`: as above.
- Host permission, `chat.qwen.ai` and `tongyi.aliyun.com`: as above.
- Host permission, `kimi.com`, `www.kimi.com`, and `kimi.moonshot.cn`: as above.

No remote code is loaded or executed. No data is collected, transmitted, or sold. There is no
single purpose declaration needed for a user-data-handling feature beyond the privacy policy
above, because no user data leaves the device.

## Privacy practices, for the store form

- Single purpose: export a conversation the user is reading to a local file.
- No data is collected, transmitted, sold, or shared. Not for the developer either.
- The extension makes no network request at all.
- A privacy policy is published in the repository and linked from the listing.

## Data safety declarations

Answer honestly, in these terms:

- Data types collected: none.
- Data types sold: none.
- Data used for tracking: none.
- Data used for purposes unrelated to the single purpose: none.
- Data transferred off the device: none, because nothing is transmitted.

## After upload

- [ ] Note the review outcome and the extension ID in `CHANGELOG.md`.
- [ ] If a reviewer flags a selector as broken, that becomes a new spec under `specs/`, not a
      silent patch.
- [ ] If the review flags the host permissions as broader than needed, narrow the origin list
      before arguing. A narrower list is always the better answer.
