// src/exporters/docx.js
// A minimal but valid Word 2007+ document. Three OOXML parts in a STORE-method zip, written
// here rather than pulled from a library, per Constitution Principle II. Code runs use a
// monospace font so an exported snippet still reads as code in Word.

(function (NS) {
  'use strict';

  const KIND = NS.sections.KIND;

  function xmlEscape(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function paragraph(text, options) {
    const opts = options || {};
    const size = opts.size || 22; // half-points, 22 = 11pt
    const mono = Boolean(opts.mono);
    const font = mono
      ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>'
      : '';
    const runProps =
      '<w:rPr>' + font + (opts.bold ? '<w:b/>' : '') + (opts.italic ? '<w:i/>' : '') +
      '<w:sz w:val="' + size + '"/><w:szCs w:val="' + size + '"/></w:rPr>';
    const paraProps =
      '<w:pPr><w:spacing w:before="' + (opts.spacing || 0) + '" w:after="120"/></w:pPr>';

    const runs = String(text)
      .split('\n')
      .map((line, index) => {
        const breakTag = index > 0 ? '<w:br/>' : '';
        return (
          '<w:r>' + runProps + breakTag +
          '<w:t xml:space="preserve">' + xmlEscape(line) + '</w:t></w:r>'
        );
      })
      .join('');

    return '<w:p>' + paraProps + runs + '</w:p>';
  }

  function chatToDocx(chat) {
    const body = [];

    for (const section of NS.sections.chatToSections(chat)) {
      if (section.kind === KIND.TITLE) {
        body.push(paragraph(section.text, { bold: true, size: 36 }));
      } else if (section.kind === KIND.META) {
        body.push(paragraph(section.text, { size: 18, italic: true }));
      } else if (section.kind === KIND.HEADING) {
        body.push(paragraph(section.heading, { bold: true, size: 26, spacing: 240 }));
      } else if (section.kind === KIND.CODE) {
        for (const line of section.text.split('\n')) {
          body.push(paragraph(line || ' ', { size: 20, mono: true }));
        }
      } else if (section.kind === KIND.NOTE) {
        body.push(paragraph('[' + section.text + ']', { size: 18, italic: true }));
      } else {
        body.push(paragraph(section.text, { size: 22 }));
      }
    }

    const documentXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' + body.join('') +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>' +
      '</w:body></w:document>';

    const contentTypes =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>';

    const rootRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>';

    return NS.zip.buildZip([
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: rootRels },
      { name: 'word/document.xml', data: documentXml }
    ]);
  }

  NS.docx = { chatToDocx: chatToDocx, xmlEscape: xmlEscape };
})(window.AIChatDownloader);
