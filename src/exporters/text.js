// src/exporters/text.js
// Plain text for pasting anywhere. Fixed-width labels, no markup, code kept verbatim
// between fence lines so indentation still reads as code.

(function (NS) {
  'use strict';

  const KIND = NS.sections.KIND;
  const RULE = '='.repeat(60);
  const THIN = '-'.repeat(60);

  function chatToText(chat) {
    const out = [];

    for (const section of NS.sections.chatToSections(chat)) {
      if (section.kind === KIND.TITLE) {
        out.push(RULE, section.text, THIN);
        continue;
      }
      if (section.kind === KIND.META) {
        out.push(section.text);
        continue;
      }
      if (section.kind === KIND.HEADING) {
        out.push('', '--- ' + section.heading.toUpperCase() + ' ---', '');
        continue;
      }
      if (section.kind === KIND.CODE) {
        out.push('```' + (section.lang || ''), section.text, '```');
        continue;
      }
      if (section.kind === KIND.NOTE) {
        out.push('[' + section.text + ']');
        continue;
      }
      out.push(section.text);
    }

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }

  NS.text = { chatToText: chatToText, RULE: RULE };
})(window.AIChatDownloader);
