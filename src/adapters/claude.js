// src/adapters/claude.js
// Claude labels its message containers with a test id rather than a role attribute, so the
// role is read from the test id through roleMap. No class names are trusted.

(function (NS) {
  'use strict';

  NS.adapters = NS.adapters || {};

  NS.adapters.claude = {
    id: 'claude',
    label: 'Claude',
    origins: ['https://claude.ai'],
    turnSelectors: [
      '[data-testid="user-message"], [data-testid="assistant-message"]',
      'div[data-testid^="chat-message"]'
    ],
    roleAttributes: ['data-testid'],
    roleMap: {
      'user-message': 'user',
      'assistant-message': 'assistant'
    },
    tagRoles: {},
    titleSelectors: ['[data-testid="chat-menu-trigger"]', 'h1'],
    streamingSelector: '[data-testid="stop-button"]',
    scrollContainer: 'main',
    attachmentSelector: '[data-testid="attachment"]',
    verified: false,
    lastVerified: null,
    knownIssues:
      'Thinking blocks are rendered inside the assistant container. The shared ignore rules ' +
      'drop elements marked aria-hidden, so the thinking disclosure must stay hidden in the ' +
      'DOM for reasoning to be excluded.'
  };
})(window.AIChatDownloader);
