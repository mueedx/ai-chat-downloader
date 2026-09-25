// src/adapters/qwen.js
// Qwen renders assistant Markdown inside a qk-markdown container and user turns in plain
// bubbles. The role comes from an explicit, reviewed fallback, recorded in
// docs/supported-sites.md as an unverified heuristic.

(function (NS) {
  'use strict';

  NS.adapters = NS.adapters || {};

  // Returns a role string or null, per contracts/adapters.md.
  function roleFromMarkup(element) {
    if (!element.querySelector) return null;
    return element.querySelector('.qk-markdown') || element.querySelector('.qk-thinking')
      ? 'assistant'
      : 'user';
  }

  NS.adapters.qwen = {
    id: 'qwen',
    label: 'Qwen',
    origins: ['https://chat.qwen.ai', 'https://tongyi.aliyun.com'],
    turnSelectors: [
      '[data-message-author-role]',
      'chat-message',
      'main div[class*="message"]'
    ],
    roleAttributes: ['data-message-author-role', 'data-author'],
    roleMap: { human: 'user', ai: 'assistant' },
    tagRoles: { 'chat-message': null },
    roleFallback: roleFromMarkup,
    titleSelectors: ['.qk-title', 'h1'],
    streamingSelector: null,
    scrollContainer: 'main',
    attachmentSelector: null,
    verified: false,
    lastVerified: null,
    knownIssues:
      'Both the selector list and the role fallback are heuristics against generated class ' +
      'names. Verify against a live conversation before trusting a Qwen export.'
  };
})(window.AIChatDownloader);
