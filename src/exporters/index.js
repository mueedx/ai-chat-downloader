// src/exporters/index.js
// The four formats, one registry. Everything downstream asks this list what exists, so
// adding a format is a single change here plus one renderer (FR-003).

(function (NS) {
  'use strict';

  const encoder = new TextEncoder();

  function bytesOf(text) {
    return encoder.encode(text);
  }

  const FORMATS = [
    {
      id: 'md',
      label: 'Markdown',
      extension: 'md',
      mime: 'text/markdown;charset=utf-8',
      description: 'Fenced code preserved. Best for notes, diffs, and Obsidian.',
      render: (chat) => bytesOf(NS.markdown.chatToMarkdown(chat)),
      warnings: () => []
    },
    {
      id: 'txt',
      label: 'Plain text',
      extension: 'txt',
      mime: 'text/plain;charset=utf-8',
      description: 'No markup. Pastes cleanly into anything.',
      render: (chat) => bytesOf(NS.text.chatToText(chat)),
      warnings: () => []
    },
    {
      id: 'docx',
      label: 'Word document',
      extension: 'docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      description: 'Opens in Word, LibreOffice, and Google Docs.',
      render: (chat) => NS.docx.chatToDocx(chat),
      warnings: () => []
    },
    {
      id: 'pdf',
      label: 'PDF',
      extension: 'pdf',
      mime: 'application/pdf',
      description: 'Fixed layout, base-14 fonts, no external files.',
      render: (chat) => NS.pdf.chatToPdf(chat),
      warnings: (chat) => {
        const lost = NS.pdf.countUnsupportedInChat(chat);
        if (!lost) return [];
        return [
          lost + ' character(s) outside Latin-1 cannot be drawn in the PDF font and will ' +
            'appear as question marks. Markdown, text, and Word keep them.'
        ];
      }
    }
  ];

  function getFormat(id) {
    return FORMATS.find((format) => format.id === id) || null;
  }

  function listFormats() {
    return FORMATS.map((format) => ({
      id: format.id,
      label: format.label,
      extension: format.extension,
      description: format.description
    }));
  }

  /** Renders one export. Returns bytes, filename, and any format-specific warnings. */
  function renderExport(chat, formatId, date) {
    const format = getFormat(formatId);
    if (!format) throw new Error('Unsupported format: ' + formatId);

    const filename = NS.filename.buildFilename({
      title: chat.title,
      site: chat.site,
      siteLabel: chat.siteLabel,
      extension: format.extension,
      selection: chat.selection,
      date: date instanceof Date ? date : new Date()
    });

    return {
      format: format.id,
      extension: format.extension,
      mime: format.mime,
      filename: filename,
      bytes: format.render(chat),
      warnings: format.warnings(chat)
    };
  }

  NS.exporters = {
    FORMATS: FORMATS,
    getFormat: getFormat,
    listFormats: listFormats,
    renderExport: renderExport,
    bytesOf: bytesOf
  };
})(window.AIChatDownloader);
