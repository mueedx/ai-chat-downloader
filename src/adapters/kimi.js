// src/adapters/kimi.js
// Kimi's transcript uses generated class names throughout. Assistant turns hold a Markdown
// block; user turns are plain bubbles. The role comes from an explicit, reviewed fallback,
// recorded in docs/supported-sites.md as an unverified heuristic.

(function (NS) {
  'use strict';

  NS.adapters = NS.adapters || {};

  // Returns a role string or null, per contracts/adapters.md.
  function roleFromMarkup(element) {
    if (!element.querySelector) return null;
    return element.querySelector('.markdown') || element.querySelector('[class*="answer"]')
      ? 'assistant'
      : 'user';
  }

  NS.adapters.kimi = {
    id: 'kimi',
    label: 'Kimi',
    origins: ['https://kimi.com', 'https://www.kimi.com', 'https://kimi.moonshot.cn'],
    turnSelectors: [
      '[data-message-author-role]',
      'div.segment',
      'div[class*="message"]'
    ],
    roleAttributes: ['data-message-author-role', 'data-role'],
    roleMap: { user: 'user', assistant: 'assistant' },
    tagRoles: {},
    roleFallback: roleFromMarkup,
    titleSelectors: ['h1', '.chat-title'],
    streamingSelector: null,
    scrollContainer: 'main',
    attachmentSelector: null,
    verified: false,
    lastVerified: null,
    knownIssues:
      'The most layout-dependent of the six adapters. Kimi also ships several regional ' +
      'domains; only the ones listed in origins are covered.'
  };
})(window.AIChatDownloader);
