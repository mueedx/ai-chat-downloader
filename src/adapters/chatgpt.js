// src/adapters/chatgpt.js
// ChatGPT marks every message container with the author's role, which is the most stable
// signal any of the six sites expose. Selectors are data, not logic, per
// specs/001-chat-export-core/contracts/adapters.md.

(function (NS) {
  'use strict';

  NS.adapters = NS.adapters || {};

  NS.adapters.chatgpt = {
    id: 'chatgpt',
    label: 'ChatGPT',
    origins: ['https://chatgpt.com', 'https://chat.openai.com'],
    turnSelectors: ['[data-message-author-role]', 'article[data-testid^="conversation-turn"]'],
    roleAttributes: ['data-message-author-role', 'data-author-role'],
    roleMap: {},
    tagRoles: {},
    titleSelectors: ['[data-testid="conversation-title"]', 'h1'],
    streamingSelector: '[data-message-author-role="assistant"] [data-stop-button]',
    scrollContainer: 'main',
    attachmentSelector: '[data-testid="wysiwyg-image-dash"]',
    verified: false,
    lastVerified: null,
    knownIssues:
      'Role comes from a data attribute, not a class name, so restyling is safe. Layout ' +
      'wrappers and the copy/regenerate button row live inside the message container and are ' +
      'filtered by the shared ignore rules.'
  };
})(window.AIChatDownloader);
