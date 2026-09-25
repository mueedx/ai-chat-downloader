// src/background.js
// Service worker. Owns the download call so the popup never needs the downloads API
// itself, and holds no state. It makes no network requests (Constitution Principle I).

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
})(window.AIChatDownloader);
