# Contract: Site Adapter

Every site module in `src/adapters/` exports exactly one object with this shape. The registry
in `adapters/index.js` is the only consumer, and the shared engine in `core/dom.js` does the
DOM work, so an adapter is mostly data.

```js
{
  id: 'chatgpt',                 // stable key used in settings and docs
  label: 'ChatGPT',              // shown in the popup and in file metadata
  origins: ['https://chatgpt.com', 'https://chat.openai.com'],
  // Selector candidates, tried in order. First non-empty match wins.
  turnSelectors: ['[data-message-author-role]', 'article[data-testid^="conversation-turn"]'],
  roleAttributes: ['data-message-author-role'],   // attribute carrying the role
  roleValues: { user: ['user', 'human'], assistant: ['assistant', 'model'] },
  titleSelectors: ['[data-testid="conversation-title"]', 'h1'],
  streamingSelector: '[data-message-author-role="assistant"] [data-stop-button]',
  verified: false,               // true only after checking a live signed-in page
  lastVerified: null,            // ISO date of that check
  knownIssues: 'Class names on this site are generated and change without notice.'
}
```

## Contract rules

1. An adapter MUST NOT invent content. If no selector matches, it returns zero turns.
2. An adapter MUST NOT infer a role from a styling class. Roles come from the role attributes
   or from a custom element name, and nothing else.
3. An adapter MUST list every origin it needs host permission for, and the manifest origins and
   `docs/supported-sites.md` MUST agree with this list.
4. `verified` is `false` until a human has run the adapter against a live signed-in conversation.
   The flag is data, not a comment, so the popup can tell the user which sites are confirmed.
5. Changing an adapter MUST NOT change the normalised chat shape or any renderer.

## Extractor contract

`core/dom.js` exposes `extractChat(adapter, doc, options)` and returns an `ExtractResult`.
It reads the DOM only. It performs no network access and touches no storage.
