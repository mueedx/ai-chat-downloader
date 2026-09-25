// src/adapters/deepseek.js
// DeepSeek does not expose a role attribute. The role is read from an explicit, reviewed
// fallback: a container holding rendered Markdown is the assistant, everything else in the
// transcript is the user. Recorded in docs/supported-sites.md as an unverified heuristic.

(function (NS) {
  'use strict';

  NS.adapters = NS.adapters || {};

  // Returns a role string or null, per contracts/adapters.md.
  function roleFromMarkup(element) {
    if (!element.querySelector) return null;
    return element.querySelector('.ds-markdown') ? 'assistant' : 'user';
  }

  NS.adapters.deepseek = {
    id: 'deepseek',
    label: 'DeepSeek',
    origins: ['https://chat.deepseek.com'],
    turnSelectors: [
      '[data-message-author-role]',
      'main div[class*="message"]',
      'main .ds-markdown'
    ],
    roleAttributes: ['data-message-author-role'],
    roleMap: {},
    tagRoles: {},
    roleFallback: roleFromMarkup,
    // Never a message container here: a title selector that matches a bubble would export
    // the first user message as the conversation title.
    titleSelectors: ['.ds-title', 'h1'],
    streamingSelector: null,
    scrollContainer: 'main',
    attachmentSelector: null,
    verified: false,
    lastVerified: null,
    knownIssues:
      'Class names are generated and change without notice, so both the selector and the ' +
      'role fallback are heuristics. Treat a DeepSeek export as unverified until a live ' +
      'check is recorded in docs/supported-sites.md.'
  };
})(window.AIChatDownloader);
