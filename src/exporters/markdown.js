// src/exporters/markdown.js
// Markdown is the format that round-trips best: code stays fenced, notes stay visible,
// and the file stays readable in a diff.

(function (NS) {
  'use strict';

  const KIND = NS.sections.KIND;

  function renderCode(text, lang) {
    const body = text.replace(/\n+$/, '');
    return '```' + (lang || '') + '\n' + body + '\n```';
  }

  function chatToMarkdown(chat) {
    const out = [];

    for (const section of NS.sections.chatToSections(chat)) {
      if (section.kind === KIND.TITLE) {
        out.push('# ' + section.text);
        continue;
      }
      if (section.kind === KIND.META) {
        out.push('> ' + section.text);
        continue;
      }
      if (section.kind === KIND.HEADING) {
        out.push('## ' + section.heading);
        continue;
      }
      if (section.kind === KIND.CODE) {
        out.push(renderCode(section.text, section.lang));
        continue;
      }
      if (section.kind === KIND.NOTE) {
        out.push('_' + section.text + '_');
        continue;
      }
      out.push(section.text);
    }

    return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }

  NS.markdown = { chatToMarkdown: chatToMarkdown };
})(window.AIChatDownloader);
