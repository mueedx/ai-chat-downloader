// src/core/chat.js
// The normalised chat shape. Every adapter produces this and every renderer reads this,
// so no format can disagree with another about what was exported.

(function (NS) {
  'use strict';

  const USER = 'user';
  const ASSISTANT = 'assistant';

  // Content blocks that carry internal machinery rather than conversation. Tool invocations
  // are not listed here because they are summarised as a marker rather than dropped; see
  // textFromBlocks. One shared rule for every site, per FR-009 and Principle IV.
  const INTERNAL_BLOCK_TYPES = new Set([
    'thinking',
    'redacted_thinking',
    'reasoning',
    'analysis'
  ]);

  const TOOL_BLOCK_TYPES = new Set(['tool_use', 'tool_call', 'function_call']);

  const MAX_BLOCK_DEPTH = 6;

  const ROLE_ALIASES = {
    user: USER,
    human: USER,
    you: USER,
    prompt: USER,
    assistant: ASSISTANT,
    model: ASSISTANT,
    ai: ASSISTANT,
    bot: ASSISTANT,
    gemini: ASSISTANT,
    claude: ASSISTANT,
    chatgpt: ASSISTANT,
    deepseek: ASSISTANT,
    qwen: ASSISTANT
  };

  function isInternalBlockType(type) {
    return typeof type === 'string' && INTERNAL_BLOCK_TYPES.has(type.toLowerCase());
  }

  /**
   * Walks a content block tree and returns readable text.
   * Thinking and redacted thinking are dropped. Tool invocations collapse to a short
   * marker so the reader can see that something ran without the noise of the payload.
   */
  function textFromBlocks(content, depth) {
    const level = depth || 0;
    if (content === null || content === undefined || level > MAX_BLOCK_DEPTH) return '';

    if (typeof content === 'string') return content.trim();
    if (typeof content === 'number' || typeof content === 'boolean') return String(content);

    if (Array.isArray(content)) {
      return content
        .map((block) => textFromBlocks(block, level + 1))
        .filter(Boolean)
        .join('\n\n');
    }

    if (typeof content === 'object') {
      if (isInternalBlockType(content.type)) return '';
      if (TOOL_BLOCK_TYPES.has(String(content.type).toLowerCase())) {
        return '[tool: ' + (content.name || 'unknown') + ']';
      }
      if (typeof content.text === 'string' && content.text.trim()) return content.text.trim();
      if (content.content !== undefined) return textFromBlocks(content.content, level + 1);
    }

    return '';
  }

  function normaliseRole(role) {
    if (typeof role !== 'string') return null;
    return ROLE_ALIASES[role.trim().toLowerCase()] || null;
  }

  /**
   * Shapes one raw turn. Returns null when the container carried nothing readable, so the
   * caller can count it as unreadable rather than exporting an empty message.
   */
  function normaliseTurn(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const role = normaliseRole(raw.role);
    if (!role) return null;

    const source = raw.text !== undefined ? raw.text : raw.content;
    let text = textFromBlocks(source);
    if (typeof text !== 'string') text = '';
    text = text.replace(/\s+$/, '');
    if (text.length > 0) text = text.replace(/^\n+/, '');

    const notes = Array.isArray(raw.notes)
      ? raw.notes.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim())
      : [];

    if (!text && notes.length === 0) return null;

    return {
      role: role,
      text: text,
      notes: notes,
      incomplete: Boolean(raw.incomplete)
    };
  }

  function createChat(input) {
    const source = input || {};
    const turns = [];

    for (const raw of Array.isArray(source.turns) ? source.turns : []) {
      const turn = normaliseTurn(raw);
      if (turn) turns.push(turn);
    }

    return {
      site: String(source.site || 'unknown'),
      siteLabel: String(source.siteLabel || source.site || 'Unknown site'),
      title: typeof source.title === 'string' ? source.title.trim() : '',
      url: typeof source.url === 'string' ? source.url : '',
      exportedAt: source.exportedAt || new Date().toISOString(),
      turns: turns,
      unreadableTurns: Number.isFinite(source.unreadableTurns) ? source.unreadableTurns : 0,
      incompleteTurns: turns.filter((t) => t.incomplete).length,
      partial: Boolean(source.partial),
      selection: null
    };
  }

  function chatTurnCount(chat) {
    return chat && Array.isArray(chat.turns) ? chat.turns.length : 0;
  }

  function chatIncompleteCount(chat) {
    return chat && Array.isArray(chat.turns)
      ? chat.turns.filter((t) => t.incomplete).length
      : 0;
  }

  /**
   * Returns a copy holding only turns from..to inclusive, 1-based, clamped to the
   * conversation. An unusable range leaves the conversation untouched and unselected,
   * so a bad range can never silently produce an empty export.
   */
  function applySelection(chat, from, to) {
    const total = chatTurnCount(chat);
    const start = Math.max(1, Math.floor(Number(from) || 1));
    const end = Math.min(total, Math.floor(Number(to) || total));

    if (total === 0 || start > end) return chat;
    if (start === 1 && end === total) return chat;

    return Object.assign({}, chat, {
      turns: chat.turns.slice(start - 1, end),
      selection: { from: start, to: end, total: total }
    });
  }

  NS.chat = {
    USER: USER,
    ASSISTANT: ASSISTANT,
    INTERNAL_BLOCK_TYPES: INTERNAL_BLOCK_TYPES,
    isInternalBlockType: isInternalBlockType,
    textFromBlocks: textFromBlocks,
    normaliseRole: normaliseRole,
    normaliseTurn: normaliseTurn,
    createChat: createChat,
    chatTurnCount: chatTurnCount,
    chatIncompleteCount: chatIncompleteCount,
    applySelection: applySelection
  };
})(window.AIChatDownloader);
