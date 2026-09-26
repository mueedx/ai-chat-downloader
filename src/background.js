// src/background.js
// Service worker. Owns the download call so the popup never needs the downloads API
// itself, and holds no state. It makes no network requests (Constitution Principle I).
//
// This is the one file that does not run in a page. A service worker has no `window` and no
// `document`, and the manifest loads it on its own, without the namespace bootstrap, so it
// resolves the global scope itself and creates the namespace if it is not there. Referencing
// `window` here throws during evaluation, which stops the worker registering its listener and
// silently disables every export. See test/worker.test.js.

(function (NS) {
  'use strict';

  const BADGE_OK = 'OK';
  const BADGE_FAIL = '!';
  const BADGE_RESET_MS = 4000;

  function setBadge(text, colour) {
    chrome.action.setBadgeText({ text: text });
    if (colour) chrome.action.setBadgeBackgroundColor({ color: colour });
  }

  function flash(text, colour) {
    setBadge(text, colour);
    setTimeout(() => setBadge(''), BADGE_RESET_MS);
  }

  async function startDownload(request) {
    if (!request || typeof request.url !== 'string' || typeof request.filename !== 'string') {
      return { ok: false, error: 'Nothing to download.' };
    }

    try {
      const downloadId = await chrome.downloads.download({
        url: request.url,
        filename: request.filename,
        saveAs: false,
        conflictAction: 'uniquify'
      });
      flash(BADGE_OK, '#1f7a3d');
      return { ok: true, downloadId: downloadId };
    } catch (error) {
      flash(BADGE_FAIL, '#a32020');
      return { ok: false, error: (error && error.message) || 'The download could not be started.' };
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'download') return false;
    startDownload(message.payload).then(sendResponse);
    return true;
  });

  NS.background = { startDownload: startDownload, flash: flash };
})((typeof globalThis !== 'undefined' ? globalThis : self).AIChatDownloader ||
  ((typeof globalThis !== 'undefined' ? globalThis : self).AIChatDownloader = {}));
