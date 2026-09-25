// src/exporters/pdf.js
// A minimal multi-page PDF using the base-14 fonts, written here rather than pulled from a
// library (Constitution Principle II).
//
// KNOWN LIMIT, stated rather than hidden: the base-14 fonts with WinAnsi encoding can only
// represent Latin-1. Characters outside that range are transliterated where an obvious
// equivalent exists and replaced with '?' otherwise, so a CJK transcript will lose glyphs
// in PDF. Markdown, text, and DOCX are unaffected. FR-025 and docs/architecture.md cover
// this. The popup warns the user before a PDF export when characters would be lost.

(function (NS) {
  'use strict';

  const KIND = NS.sections.KIND;

  const PROSE_CHARS_PER_LINE = 88;
  const CODE_CHARS_PER_LINE = 96;
  const LINE_HEIGHT = 14;
  const LINES_PER_PAGE = 55;
  const PAGE_WIDTH = 595; // A4, in points
  const PAGE_HEIGHT = 842;
  const MARGIN = 57;
  const FIRST_BASELINE = 785;

  // Typography with a faithful Latin-1 equivalent, so common punctuation survives.
  const TRANSLITERATIONS = {
    '‘': "'",
    '’': "'",
    '‚': "'",
    '“': '"',
    '”': '"',
    '–': '-',
    '—': '-',
    '…': '...',
    ' ': ' ',
    '•': '*',
    '·': '-',
    '→': '->',
    '←': '<-',
    '×': 'x'
  };
  const TRANSLITERATION_PATTERN = new RegExp(
    '[' + Object.keys(TRANSLITERATIONS).join('') + ']',
    'g'
  );

  function toLatin1(value) {
    return String(value)
      .replace(TRANSLITERATION_PATTERN, (char) => TRANSLITERATIONS[char])
      .replace(/[^\x00-\xff]/g, '?');
  }

  /** How many characters a PDF export would lose. Used for the pre-export warning. */
  function countUnsupported(text) {
    const value = String(text || '');
    if (!value) return 0;
    return (value.match(/[^\x00-\xff]/g) || []).length;
  }

  function countUnsupportedInChat(chat) {
    let total = 0;
    for (const section of NS.sections.chatToSections(chat)) {
      total += countUnsupported(section.text);
      if (section.heading) total += countUnsupported(section.heading);
    }
    return total;
  }

  function pdfEscape(value) {
    return toLatin1(value)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  function wrapLine(text, max) {
    const out = [];
    for (const raw of String(text).split('\n')) {
      if (raw.length <= max) {
        out.push(raw);
        continue;
      }
      let line = '';
      for (const word of raw.split(' ')) {
        let chunk = word;
        while (chunk.length > 0) {
          if (line.length === 0) {
            line = chunk.slice(0, max);
            chunk = chunk.slice(max);
            if (chunk.length > 0) {
              out.push(line);
              line = '';
            }
          } else if ((line + ' ' + chunk).length <= max) {
            line += ' ' + chunk;
            chunk = '';
          } else {
            out.push(line);
            line = chunk.slice(0, max);
            chunk = chunk.slice(max);
            if (chunk.length > 0) {
              out.push(line);
              line = '';
            }
          }
        }
      }
      if (line.length > 0) out.push(line);
    }
    return out;
  }

  function buildLines(chat) {
    const lines = [];
    let first = true;

    for (const section of NS.sections.chatToSections(chat)) {
      if (section.kind === KIND.TITLE) {
        lines.push({ text: section.text, bold: true, size: 18, mono: false, gapBefore: first ? 0 : 16 });
        first = false;
      } else if (section.kind === KIND.META) {
        lines.push({ text: section.text, bold: false, size: 8, mono: false, gapBefore: 8 });
      } else if (section.kind === KIND.HEADING) {
        lines.push({ text: section.heading, bold: true, size: 13, mono: false, gapBefore: 16 });
      } else if (section.kind === KIND.NOTE) {
        lines.push({ text: '[' + section.text + ']', bold: false, size: 9, mono: false, gapBefore: 4 });
      } else {
        const mono = section.kind === KIND.CODE;
        const max = mono ? CODE_CHARS_PER_LINE : PROSE_CHARS_PER_LINE;
        for (const wrapped of wrapLine(section.text, max)) {
          lines.push({ text: wrapped, bold: false, size: mono ? 9 : 10, mono: mono, gapBefore: 0 });
        }
      }
    }

    return lines;
  }

  function fontRef(line) {
    if (line.mono) return '/F3';
    return line.bold ? '/F2' : '/F1';
  }

  function assemble(lines) {
    const pageStreams = [];
    let ops = [];
    let used = 0;

    const flush = () => {
      if (!ops.length) return;
      pageStreams.push(
        'BT\n1 0 0 1 ' + MARGIN + ' ' + FIRST_BASELINE + ' Tm\n/F1 10 Tf\n' +
          LINE_HEIGHT + ' TL\n' + ops.join('\n') + '\nET'
      );
      ops = [];
      used = 0;
    };

    for (const line of lines) {
      const gapLines = Math.ceil(line.gapBefore / LINE_HEIGHT);
      const need = (line.text ? 1 : 0) + gapLines;
      if (used + need > LINES_PER_PAGE) flush();

      if (gapLines > 0) {
        ops.push('0 -' + line.gapBefore + ' Td');
        used += gapLines;
      }
      if (line.text) {
        ops.push(fontRef(line) + ' ' + line.size + ' Tf');
        ops.push('(' + pdfEscape(line.text) + ') Tj');
        ops.push('0 -' + LINE_HEIGHT + ' Td');
        used += 1;
      }
    }
    flush();

    const pageCount = Math.max(pageStreams.length, 1);
    const fontRegularId = 3 + pageCount;
    const fontBoldId = fontRegularId + 1;
    const fontMonoId = fontBoldId + 1;
    const contentStartId = fontMonoId + 1;

    const objects = [];
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[2] =
      '<< /Type /Pages /Kids [' +
      pageStreams.map((_, index) => 3 + index + ' 0 R').join(' ') +
      '] /Count ' + pageCount + ' >>';

    pageStreams.forEach((stream, index) => {
      objects[3 + index] =
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PAGE_WIDTH + ' ' + PAGE_HEIGHT + '] ' +
        '/Resources << /Font << /F1 ' + fontRegularId + ' 0 R /F2 ' + fontBoldId +
        ' 0 R /F3 ' + fontMonoId + ' 0 R >> >> /Contents ' + (contentStartId + index) + ' 0 R >>';
    });

    objects[fontRegularId] =
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[fontBoldId] =
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objects[fontMonoId] =
      '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';

    const encoder = new TextEncoder();
    pageStreams.forEach((stream, index) => {
      const bytes = encoder.encode(stream);
      objects[contentStartId + index] =
        '<< /Length ' + bytes.length + ' >>\nstream\n' + stream + '\nendstream';
    });

    let pdf = '%PDF-1.4\n';
    const offsets = [];
    for (let i = 1; i < objects.length; i += 1) {
      offsets[i] = toLatin1(pdf).length;
      pdf += i + ' 0 obj\n' + objects[i] + '\nendobj\n';
    }

    const xrefStart = toLatin1(pdf).length;
    pdf += 'xref\n0 ' + objects.length + '\n0000000000 65535 f \n';
    for (let i = 1; i < objects.length; i += 1) {
      pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    pdf +=
      'trailer\n<< /Size ' + objects.length + ' /Root 1 0 R >>\nstartxref\n' +
      xrefStart + '\n%%EOF';

    const latin = toLatin1(pdf);
    const bytes = new Uint8Array(latin.length);
    for (let i = 0; i < latin.length; i += 1) bytes[i] = latin.charCodeAt(i) & 0xff;
    return bytes;
  }

  function chatToPdf(chat) {
    return assemble(buildLines(chat));
  }

  NS.pdf = {
    chatToPdf: chatToPdf,
    countUnsupported: countUnsupported,
    countUnsupportedInChat: countUnsupportedInChat,
    toLatin1: toLatin1,
    wrapLine: wrapLine,
    buildLines: buildLines
  };
})(window.AIChatDownloader);
