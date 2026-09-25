// test/adapters.test.js
// One fixture per site, one shared contract. The fixtures are the markup shape each adapter
// is written against; they prove the engine and the contract, not the live sites. Live
// verification is tracked per site in docs/supported-sites.md.

import test from 'node:test';
import assert from 'node:assert/strict';

import { loadExtension } from './harness.js';
import { loadFixture, parseHtml } from './minidom.js';

const NS = loadExtension();

const CASES = [
  {
    id: 'chatgpt',
    file: 'chatgpt.html',
    turns: 3,
    roles: ['user', 'assistant', 'user'],
    title: 'Reverse a string',
    probes: ['How do I reverse a string in Python?', 'Use slicing:', 'Can you explain this diagram?']
  },
  {
    id: 'claude',
    file: 'claude.html',
    turns: 3,
    roles: ['user', 'assistant', 'user'],
    title: 'Factorial in Rust',
    probes: ['Write a factorial function in Rust.', 'Here is an iterative version:', 'Now show the recursive one.']
  },
  {
    id: 'gemini',
    file: 'gemini.html',
    turns: 4,
    roles: ['user', 'assistant', 'user', 'assistant'],
    title: 'Coffee brewing ratio',
    probes: ['What ratio do I use for pour over coffee?', 'Start with a 1:16 ratio', 'Use a 1:2 ratio']
  },
  {
    id: 'deepseek',
    file: 'deepseek.html',
    turns: 3,
    roles: ['user', 'assistant', 'user'],
    title: 'DeepSeek fixture',
    probes: ['Explain recursion in two sentences.', 'Recursion is a function calling itself', 'Give an example.']
  },
  {
    id: 'qwen',
    file: 'qwen.html',
    turns: 2,
    roles: ['user', 'assistant'],
    title: 'Qwen fixture',
    probes: ['Translate "good morning" into Japanese.', 'おはようございます']
  },
  {
    id: 'kimi',
    file: 'kimi.html',
    turns: 2,
    roles: ['user', 'assistant'],
    title: 'Kimi fixture',
    probes: ['Summarise the CAP theorem.', 'You can have two of']
  }
];

for (const testCase of CASES) {
  test(testCase.id + ' extracts the fixture transcript in order', () => {
    const result = NS.dom.extractChat(NS.adapters[testCase.id], loadFixture(testCase.file), {
      url: 'https://example.test/c/1'
    });

    assert.equal(result.ok, true, result.reason);
    assert.equal(result.chat.site, testCase.id);
    assert.equal(result.chat.siteLabel, NS.adapters[testCase.id].label);
    assert.deepEqual(result.chat.turns.map((t) => t.role), testCase.roles);
    assert.equal(result.chat.unreadableTurns, 0);
  });

  test(testCase.id + ' keeps the code block and drops interface chrome', () => {
    const result = NS.dom.extractChat(NS.adapters[testCase.id], loadFixture(testCase.file), {});
    const joined = result.chat.turns.map((t) => t.text).join('\n');
    assert.doesNotMatch(joined, /Copy/);
    assert.doesNotMatch(joined, /internal chain of thought/);
  });

  test(testCase.id + ' produces the same output shape as every other site', () => {
    const result = NS.dom.extractChat(NS.adapters[testCase.id], loadFixture(testCase.file), {});
    const sections = NS.sections.chatToSections(result.chat);
    assert.equal(sections[0].kind, 'title');
    assert.equal(sections[0].text, testCase.title);

    const meta = sections.filter((s) => s.kind === 'meta').map((s) => s.text);
    assert.equal(meta.length >= 3, true);
    assert.match(meta[0], /^Source: /);
    assert.match(meta[1], /^Exported: /);
    assert.match(meta[2], /^Messages: \d+$/);

    const headings = sections.filter((s) => s.kind === 'heading');
    assert.equal(headings.length, result.chat.turns.length);
    for (const heading of headings) {
      assert.ok(['You', NS.adapters[testCase.id].label].includes(heading.heading));
    }
  });
}

test('every adapter round-trips a code block through the shared DOM shaper', () => {
  const code = 'def f():\n    return 1\n\nprint(f())';
  const expected = '```python\n' + code + '\n```';

  const documents = {
    chatgpt: '<div data-message-author-role="assistant"><pre><code class="language-python">' + code + '</code></pre></div>',
    claude: '<div data-testid="assistant-message"><pre><code class="language-python">' + code + '</code></pre></div>',
    gemini: '<model-response><pre><code class="language-python">' + code + '</code></pre></model-response>',
    qwen: '<chat-message data-author="ai"><div class="qk-markdown"><pre><code class="language-python">' + code + '</code></pre></div></chat-message>',
    deepseek: '<div class="fbb737a4 message"><div class="ds-markdown"><pre><code class="language-python">' + code + '</code></pre></div></div>',
    kimi: '<div class="segment"><div class="markdown"><pre><code class="language-python">' + code + '</code></pre></div></div>'
  };

  for (const [id, html] of Object.entries(documents)) {
    const result = NS.dom.extractChat(NS.adapters[id], parseHtml('<main>' + html + '</main>'), {});
    assert.equal(result.ok, true, id + ' failed to extract');
    assert.equal(result.chat.turns[0].role, 'assistant', id + ' role');
    assert.equal(result.chat.turns[0].text, expected, id + ' code block');
  }
});

test('an image in a user turn becomes a note on every site', () => {
  const documents = {
    chatgpt: '<div data-message-author-role="user"><img src="blob:a" alt="chart" /></div>',
    claude: '<div data-testid="user-message"><img src="blob:a" /></div>',
    gemini: '<user-query><img src="blob:a" /></user-query>',
    qwen: '<chat-message data-author="human"><img src="blob:a" /></chat-message>',
    deepseek: '<div class="fbb737a4 message"><img src="blob:a" /></div>',
    kimi: '<div class="segment"><img src="blob:a" /></div>'
  };

  for (const [id, html] of Object.entries(documents)) {
    const result = NS.dom.extractChat(NS.adapters[id], parseHtml('<main>' + html + '</main>'), {});
    assert.equal(result.ok, true, id + ' produced no turns');
    assert.deepEqual(result.chat.turns[0].notes, ['image'], id + ' image note');
    assert.equal(result.chat.turns[0].text, '', id + ' must not invent a caption');
  }
});

test('a page with no conversation fails honestly on every site', () => {
  const empty = parseHtml('<main><p>Ask anything.</p></main>');
  for (const id of NS.adapterRegistry.ORDER) {
    const result = NS.dom.extractChat(NS.adapters[id], empty, {});
    assert.equal(result.ok, false, id + ' should not claim success');
    assert.equal(result.chat, null);
    assert.match(result.reason, /No conversation messages/);
    assert.ok(result.tried.length > 0, id + ' must report what it tried');
  }
});

test('an unsupported site is refused before any DOM work happens', () => {
  assert.equal(NS.dom.extractChat(null, loadFixture('chatgpt.html'), {}).ok, false);
  assert.match(NS.dom.extractChat(NS.adapters.chatgpt, null, {}).reason, /No page to read/);
});

test('a selector that the browser would reject is skipped, not fatal', () => {
  const adapter = Object.assign({}, NS.adapters.chatgpt, {
    turnSelectors: ['<<<not a selector', '[data-message-author-role]']
  });
  const result = NS.dom.extractChat(adapter, loadFixture('chatgpt.html'), {});
  assert.equal(result.ok, true);
  assert.equal(result.chat.turns.length, 3);
});

test('every manifest origin is covered by an adapter (FR-021, SC-010)', async () => {
  const { readFile } = await import('node:fs/promises');
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));

  for (const pattern of manifest.host_permissions) {
    const host = new URL(pattern).host;
    assert.ok(NS.adapterRegistry.adapterForHost(host), 'no adapter for ' + host);
  }

  for (const adapter of NS.sites.siteList()) {
    const pattern = new URL(adapter.origins[0]).origin + '/*';
    assert.ok(
      manifest.host_permissions.includes(pattern),
      adapter.id + ' origin is missing from the manifest'
    );
  }

  assert.deepEqual(manifest.permissions, ['storage', 'downloads']);
  assert.equal(manifest.host_permissions.includes('<all_urls>'), false);
});
