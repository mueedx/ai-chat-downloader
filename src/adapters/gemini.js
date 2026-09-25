// src/adapters/gemini.js
// Gemini renders each side of the conversation as its own custom element, so the element
// name carries the role. This is the most robust signal on the site.

(function (NS) {
  'use strict';

  NS.adapters = NS.adapters || {};

  NS.adapters.gemini = {
    id: 'gemini',
    label: 'Gemini',
    origins: ['https://gemini.google.com'],
    turnSelectors: ['user-query, model-response', 'div.user-query-container, div.model-response-text'],
    roleAttributes: [],
    roleMap: {},
    tagRoles: {
      'user-query': 'user',
      'model-response': 'assistant',
      'user-query-container': 'user',
      'model-response-text': 'assistant'
    },
    titleSelectors: ['.conversation-title', 'h1'],
    streamingSelector: null,
    scrollContainer: 'main',
    attachmentSelector: '.image-container',
    verified: false,
    lastVerified: null,
    knownIssues:
      'No streaming indicator selector has been confirmed, so a reply that is still being ' +
      'written cannot be marked incomplete yet. It is exported as read.'
  };
})(window.AIChatDownloader);
