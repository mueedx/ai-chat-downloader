// src/core/dom.js
// Shared DOM engine. Adapters supply selectors as data; the walking, role resolution,
// code-block handling, and text shaping happen here once, so every site exports the same
// way. Reads the DOM only: no network, no storage.

(function (NS) {
  'use strict';

  const chat = NS.chat;

  // Chrome, buttons, and inputs inside a message are interface, not conversation.
  const IGNORED_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'TEMPLATE',
    'BUTTON',
    'SELECT',
    'OPTION',
    'INPUT',
    'TEXTAREA',
    'NAV',
    'FORM',
    'svg',
    'path'
  ]);

  const BLOCK_TAGS = new Set([
    'P',
    'DIV',
    'SECTION',
    'ARTICLE',
    'UL',
    'OL',
    'LI',
    'BLOCKQUOTE',
    'TABLE',
    'TR',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6'
  ]);

  const MEDIA_NOTES = {
    IMG: 'image',
    PICTURE: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    IFRAME: 'embedded content',
    SVG: 'image'
  };

  const CODE_TOKEN_PREFIX = '\u0000';
  const CODE_TOKEN_SUFFIX = '\u0000';

  function tagOf(element) {
    if (!element) return '';
    if (typeof element.tagName === 'string') return element.tagName.toLowerCase();
    return String(element.nodeName || '').toLowerCase();
  }

  function isHidden(element) {
    if (!element || typeof element.getAttribute !== 'function') return false;
    if (element.hasAttribute('hidden')) return true;
    if (element.getAttribute('aria-hidden') === 'true') return true;
    return false;
  }

  function isIgnored(element) {
    const tag = tagOf(element).toUpperCase();
    if (IGNORED_TAGS.has(tag)) return true;
    return isHidden(element);
  }

  function codeLanguage(pre) {
    const code = pre.querySelector ? pre.querySelector('code') : null;
    const source = code || pre;
    const className = (source.getAttribute && source.getAttribute('class')) || '';
    const match =
      className.match(/language-([A-Za-z0-9+#_-]+)/) || className.match(/lang-([A-Za-z0-9+#_-]+)/);
    if (match) return match[1];
    const dataLang = source.getAttribute && source.getAttribute('data-language');
    return dataLang || '';
  }

  function fence(text, language) {
    const body = String(text).replace(/\r\n/g, '\n').replace(/\s+$/, '');
    return '```' + (language || '') + '\n' + body + '\n```';
  }

  /**
   * Renders one message element as plain text with fenced code blocks.
   * Code is lifted out behind a token before whitespace is tidied, so indentation and
   * internal blank lines inside a code block survive untouched (FR-008).
   */
  function textFromElement(element, state) {
    const ctx = state || { codeBlocks: [] };
    if (!element) return '';

    const tag = tagOf(element);

    if (tag === 'br') return '\n';
    if (tag === 'pre') {
      const code = fence(element.textContent || '', codeLanguage(element));
      const token = CODE_TOKEN_PREFIX + ctx.codeBlocks.length + CODE_TOKEN_SUFFIX;
      ctx.codeBlocks.push(code);
      return '\n\n' + token + '\n\n';
    }

    let out = '';
    const children = element.childNodes || [];
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (child.nodeType === 3) {
        out += child.nodeValue || '';
      } else if (child.nodeType === 1) {
        if (isIgnored(child)) continue;
        const inner = textFromElement(child, ctx);
        const childTag = tagOf(child);
        if (childTag === 'li' && inner) {
          // Keep the list marker so items still read as a list in plain text.
          out += '\n- ' + inner.replace(/\n/g, '\n  ') + '\n';
          continue;
        }
        if (BLOCK_TAGS.has(childTag) && inner) out += '\n\n';
        out += inner;
        if (BLOCK_TAGS.has(childTag) && inner) out += '\n\n';
      }
    }

    return out;
  }

  function shapeText(element) {
    const state = { codeBlocks: [] };
    const raw = textFromElement(element, state);

    // Whitespace is tidied only outside the code tokens, so HTML indentation never leaks
    // into prose and code indentation is never touched (FR-008).
    let out = raw
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    state.codeBlocks.forEach((code, index) => {
      out = out.split(CODE_TOKEN_PREFIX + index + CODE_TOKEN_SUFFIX).join(code);
    });

    return out;
  }

  /**
   * Role resolution order: an explicit attribute or custom element name first, then the
   * adapter's own reviewed fallback. Never styling alone, and never a guess outside the
   * adapter that declares it. Returns null when the role is unknown, and the caller counts
   * that container as unreadable rather than guessing (FR-011, FR-012).
   */
  function resolveRole(element, adapter) {
    const attributes = (adapter && adapter.roleAttributes) || [];
    for (let i = 0; i < attributes.length; i += 1) {
      const value = element.getAttribute(attributes[i]);
      if (!value) continue;
      const mapped = (adapter.roleMap && adapter.roleMap[value]) || chat.normaliseRole(value);
      if (mapped) return mapped;
    }

    const tagRoles = (adapter && adapter.tagRoles) || {};
    if (Object.prototype.hasOwnProperty.call(tagRoles, tagOf(element))) {
      const tagRole = tagRoles[tagOf(element)];
      if (tagRole) return chat.normaliseRole(tagRole) || tagRole;
    }

    if (adapter && typeof adapter.roleFallback === 'function') {
      try {
        const fallback = chat.normaliseRole(adapter.roleFallback(element));
        if (fallback) return fallback;
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  function collectNotes(element, adapter) {
    const notes = [];

    const walk = (node) => {
      const tag = tagOf(node).toUpperCase();
      if (MEDIA_NOTES[tag]) {
        const label = MEDIA_NOTES[tag];
        if (!notes.includes(label)) notes.push(label);
        return;
      }
      const children = node.childNodes || [];
      for (let i = 0; i < children.length; i += 1) {
        if (children[i].nodeType === 1) walk(children[i]);
      }
    };

    walk(element);

    if (adapter && adapter.attachmentSelector && element.querySelector) {
      const attachments = element.querySelectorAll(adapter.attachmentSelector);
      for (let i = 0; i < attachments.length; i += 1) {
        if (!notes.includes('attachment')) notes.push('attachment');
      }
    }

    return notes;
  }

  function firstText(doc, selectors) {
    for (let i = 0; i < selectors.length; i += 1) {
      const element = doc.querySelector(selectors[i]);
      if (!element) continue;
      const content = element.getAttribute && element.getAttribute('content');
      const text = (content || shapeText(element) || '').trim();
      if (text) return text;
    }
    return '';
  }

  /**
   * A scrollable transcript that the user has scrolled down from means older turns may
   * have been dropped by the site. Reported as partial rather than presented as complete
   * (FR-014). A heuristic, and documented as one in docs/supported-sites.md.
   */
  function detectPartial(doc, adapter) {
    if (!adapter || !adapter.scrollContainer) return false;
    const scroller = doc.querySelector(adapter.scrollContainer);
    if (!scroller) return false;
    const scrollTop = Number(scroller.scrollTop) || 0;
    const scrollHeight = Number(scroller.scrollHeight) || 0;
    const clientHeight = Number(scroller.clientHeight) || 0;
    if (scrollHeight <= clientHeight + 200) return false;
    return scrollTop > 200;
  }

  function buildChat(adapter, doc, nodes, options) {
    const opts = options || {};
    const turns = [];
    let unreadableTurns = 0;

    for (let i = 0; i < nodes.length; i += 1) {
      const element = nodes[i];
      if (isIgnored(element)) continue;

      const role = resolveRole(element, adapter);
      if (!role) {
        unreadableTurns += 1;
        continue;
      }

      turns.push({
        role: role,
        text: shapeText(element),
        notes: collectNotes(element, adapter),
        incomplete: false
      });
    }

    const streaming = adapter.streamingSelector ? doc.querySelector(adapter.streamingSelector) : null;
    if (streaming && turns.length) {
      for (let i = turns.length - 1; i >= 0; i -= 1) {
        if (turns[i].role === chat.ASSISTANT) {
          turns[i].incomplete = true;
          break;
        }
      }
    }

    const title =
      firstText(doc, adapter.titleSelectors || []) ||
      (doc.querySelector('meta[property="og:title"]') || {}).content ||
      (typeof doc.title === 'string' ? doc.title : '') ||
      '';

    return chat.createChat({
      site: adapter.id,
      siteLabel: adapter.label,
      title: String(title).trim(),
      url: opts.url || (typeof location !== 'undefined' ? location.href : ''),
      turns: turns,
      unreadableTurns: unreadableTurns,
      partial: opts.partial === undefined ? detectPartial(doc, adapter) : Boolean(opts.partial)
    });
  }

  /**
   * Runs one adapter against a document. Never throws for the normal failure cases: an
   * unmatched selector is reported as a failure with the selectors that were tried, and no
   * file may be written from that result (FR-011).
   */
  function extractChat(adapter, doc, options) {
    if (!adapter) {
      return { ok: false, chat: null, reason: 'No adapter for this site.', tried: [] };
    }
    if (!doc) {
      return { ok: false, chat: null, reason: 'No page to read.', tried: [] };
    }

    const selectors = adapter.turnSelectors || [];
    const tried = [];

    for (let i = 0; i < selectors.length; i += 1) {
      tried.push(selectors[i]);
      let nodes = [];
      try {
        nodes = doc.querySelectorAll(selectors[i]) || [];
      } catch (error) {
        nodes = [];
      }
      if (!nodes.length) continue;

      const result = buildChat(adapter, doc, nodes, options);
      if (chat.chatTurnCount(result) > 0) {
        return { ok: true, chat: result, reason: null, tried: tried };
      }
    }

    return {
      ok: false,
      chat: null,
      reason: 'No conversation messages were found on this page.',
      tried: tried
    };
  }

  NS.dom = {
    IGNORED_TAGS: IGNORED_TAGS,
    codeLanguage: codeLanguage,
    fence: fence,
    textFromElement: textFromElement,
    shapeText: shapeText,
    resolveRole: resolveRole,
    collectNotes: collectNotes,
    detectPartial: detectPartial,
    extractChat: extractChat
  };
})(window.AIChatDownloader);
