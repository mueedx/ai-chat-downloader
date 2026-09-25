// src/content.js
// Runs on the six supported origins. Answers the popup with a preview and, on request, the
// normalised chat. Reads the DOM only: no fetch, no storage, no network (FR-018, FR-021).

(function (NS) {
  'use strict';

  function currentAdapter() {
    return NS.adapterRegistry.adapterForHost(location.host);
  }

  function siteInfo() {
    const adapter = currentAdapter();
    if (!adapter) {
      return { supported: false, message: NS.sites.unsupportedMessage(), sites: NS.sites.siteLabels() };
    }
    return {
      supported: true,
      site: adapter.id,
      siteLabel: adapter.label,
      verified: Boolean(adapter.verified),
      knownIssues: adapter.knownIssues || ''
    };
  }

  function extract(options) {
    const adapter = currentAdapter();
    if (!adapter) {
      return { ok: false, reason: NS.sites.unsupportedMessage(), tried: [] };
    }

    const result = NS.dom.extractChat(adapter, document, {
      url: location.href,
      partial: options && options.partial
    });

    if (!result.ok) {
      return { ok: false, reason: result.reason, tried: result.tried, siteLabel: adapter.label };
    }

    const chat = result.chat;
    return {
      ok: true,
      chat: chat,
      turnCount: NS.chat.chatTurnCount(chat),
      unreadableTurns: chat.unreadableTurns,
      incompleteTurns: chat.incompleteTurns,
      partial: chat.partial,
      tried: result.tried
    };
  }

  function previewText(chat) {
    const first = chat.turns.slice(0, 2).map((turn) => {
      const who = turn.role === NS.chat.USER ? 'You' : chat.siteLabel;
      return who + ': ' + turn.text.slice(0, 240);
    });
    return first.join('\n\n');
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') return false;

    if (message.type === 'site-info') {
      sendResponse(siteInfo());
      return false;
    }

    if (message.type === 'extract') {
      let payload;
      try {
        payload = extract(message.payload);
      } catch (error) {
        payload = {
          ok: false,
          reason: 'The page could not be read: ' + ((error && error.message) || 'unknown error'),
          tried: []
        };
      }
      if (payload.ok) payload.preview = previewText(payload.chat);
      sendResponse(payload);
      return false;
    }

    return false;
  });

  NS.content = { siteInfo: siteInfo, extract: extract, previewText: previewText };
})(window.AIChatDownloader);
