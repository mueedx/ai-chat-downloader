// src/exporters/sections.js
// One intermediate shape that all four renderers consume. Because Markdown, text, DOCX,
// and PDF are all built from this list, no format can drift from another about the content
// (FR-004). Nothing here escapes or formats for a specific target.

(function (NS) {
  'use strict';

  const USER_LABEL = 'You';

  const KIND = {
    TITLE: 'title',
    META: 'meta',
    HEADING: 'heading',
    BODY: 'body',
    CODE: 'code',
    NOTE: 'note'
  };

  function assistantLabel(chat) {
    return (chat && chat.siteLabel) || 'Assistant';
  }

  function headingFor(chat, turn) {
    return turn.role === NS.chat.USER ? USER_LABEL : assistantLabel(chat);
  }

  function localStamp(iso) {
    const date = iso ? new Date(iso) : new Date();
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return (
      date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes())
    );
  }

  /**
   * The metadata block. Every line here is either read from the page or generated locally;
   * nothing is invented, and the partial and selection states are stated plainly
   * (FR-014, FR-023).
   */
  function metaLines(chat) {
    const lines = [];
    lines.push('Source: ' + (chat.url || chat.siteLabel));
    lines.push('Exported: ' + localStamp(chat.exportedAt));
    lines.push('Messages: ' + NS.chat.chatTurnCount(chat));

    if (chat.selection) {
      lines.push(
        'Selection: turns ' + chat.selection.from + ' to ' + chat.selection.to +
          ' of ' + chat.selection.total
      );
    }
    if (chat.partial) {
      lines.push('Note: only the turns the page had rendered were captured. Scroll to the top and export again for the full conversation.');
    }
    if (chat.incompleteTurns > 0) {
      lines.push('Note: ' + chat.incompleteTurns + ' message(s) were still being written when the export ran.');
    }
    if (chat.unreadableTurns > 0) {
      lines.push('Note: ' + chat.unreadableTurns + ' message(s) could not be read on this page.');
    }

    return lines;
  }

  /**
   * Turns the chat into an ordered list of sections. Message bodies are split into prose
   * and fenced-code runs so a renderer can style code without re-parsing the text.
   */
  function chatToSections(chat) {
    const sections = [];
    const title = (chat && chat.title) || (chat ? chat.siteLabel + ' conversation' : 'Conversation');

    sections.push({ kind: KIND.TITLE, heading: null, text: title });
    for (const line of metaLines(chat)) {
      sections.push({ kind: KIND.META, heading: null, text: line });
    }

    for (const turn of chat.turns) {
      sections.push({ kind: KIND.HEADING, heading: headingFor(chat, turn), text: '' });

      for (const chunk of splitFences(turn.text)) {
        sections.push({
          kind: chunk.code ? KIND.CODE : KIND.BODY,
          heading: null,
          text: chunk.text,
          lang: chunk.lang || ''
        });
      }

      for (const note of turn.notes || []) {
        sections.push({ kind: KIND.NOTE, heading: null, text: '[' + note + ']' });
      }

      if (turn.incomplete) {
        sections.push({ kind: KIND.NOTE, heading: null, text: '[message was still being written]' });
      }
    }

    return sections;
  }

  const FENCE_OPEN = /^```([A-Za-z0-9+#_-]*)$/;

  /**
   * Splits a message body into prose and code runs, keeping the code language so Markdown
   * can re-fence it with a syntax hint. Fences are produced by the shared DOM shaper, so an
   * unbalanced fence is treated as prose rather than swallowing the rest of the message.
   */
  function splitFences(text) {
    const body = typeof text === 'string' ? text : '';
    if (!body) return [];

    const lines = body.split('\n');
    const runs = [];
    let buffer = [];
    let code = null;
    let lang = '';

    const flushProse = () => {
      if (buffer.length) {
        runs.push({ code: false, text: buffer.join('\n'), lang: '' });
        buffer = [];
      }
    };

    for (const line of lines) {
      if (code === null) {
        const open = line.trim().match(FENCE_OPEN);
        if (open) {
          flushProse();
          code = [];
          lang = open[1] || '';
          continue;
        }
        buffer.push(line);
        continue;
      }

      if (line.trim() === '```') {
        runs.push({ code: true, text: code.join('\n'), lang: lang });
        code = null;
        lang = '';
      } else {
        code.push(line);
      }
    }

    if (code !== null) {
      buffer = buffer.concat(['```' + lang], code);
    }
    flushProse();

    return runs.filter((run) => run.text.trim().length > 0);
  }

  NS.sections = {
    KIND: KIND,
    USER_LABEL: USER_LABEL,
    assistantLabel: assistantLabel,
    headingFor: headingFor,
    localStamp: localStamp,
    metaLines: metaLines,
    splitFences: splitFences,
    chatToSections: chatToSections
  };
})(window.AIChatDownloader);
