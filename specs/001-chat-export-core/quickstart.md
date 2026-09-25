# Quickstart: Chat Export Core

## Load the extension

```bash
git clone git@github.com:mueedx/ai-chat-downloader.git
cd ai-chat-downloader
```

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the
repository root. Chrome will ask for permission to read the six chat origins. Accept.

## Run the tests

Node 20 or newer. No install step is needed, because there are no dependencies.

```bash
npm test
```

## Try an export

1. Open a conversation on a supported site.
2. Click the extension icon in the toolbar.
3. The panel shows the site, the conversation title, and a turn count read from the page.
4. Pick Markdown, text, DOCX, or PDF, then press **Export**.
5. The panel reports the filename, the turn count, and any warnings. The file is in the
   browser's download folder.

## Try the failure path

Open any page on a supported site that has no conversation, such as the new-chat screen, and
press **Export**. No file is written and the panel says that no messages were found, with the
selectors that were tried.

## Manual test bench

`test/fixtures/*.html` are saved transcript fragments with the markup shape each adapter reads.
Open one in a browser after loading the extension to exercise a specific adapter without a live
account. For example:

```bash
xdg-open test/fixtures/chatgpt.html
```

## Package for the store

```bash
npm run package
```

The script writes `dist/ai-chat-downloader-<version>.zip` containing only the files the
extension needs. `dist/` is git-ignored, so the archive never lands in history.
