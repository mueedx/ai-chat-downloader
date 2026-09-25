// src/exporters/zip.js
// A minimal ZIP writer, enough to produce a valid DOCX. STORE method only, so entries are
// uncompressed and the file is larger than a deflated equivalent. This keeps the extension
// dependency-free, which is a constitution requirement.

(function (NS) {
  'use strict';

  const encoder = new TextEncoder();

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function u16(value) {
    return [value & 0xff, (value >> 8) & 0xff];
  }

  function u32(value) {
    return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff];
  }

  function concat(chunks, totalLength) {
    const out = new Uint8Array(totalLength);
    let position = 0;
    for (const chunk of chunks) {
      out.set(chunk, position);
      position += chunk.length;
    }
    return out;
  }

  /**
   * Builds a ZIP archive from {name, data} entries. String data is encoded as UTF-8,
   * which is what OOXML parts declare.
   */
  function buildZip(entries) {
    const localChunks = [];
    const centralChunks = [];
    let offset = 0;

    for (const entry of entries) {
      const nameBytes = encoder.encode(entry.name);
      const dataBytes =
        typeof entry.data === 'string' ? encoder.encode(entry.data) : entry.data;
      const crc = crc32(dataBytes);

      const local = new Uint8Array([
        ...u32(0x04034b50),
        ...u16(20), // version needed
        ...u16(0), // flags
        ...u16(0), // method: store
        ...u16(0), // time
        ...u16(0), // date
        ...u32(crc),
        ...u32(dataBytes.length),
        ...u32(dataBytes.length),
        ...u16(nameBytes.length),
        ...u16(0), // extra length
        ...nameBytes,
        ...dataBytes
      ]);
      localChunks.push(local);

      centralChunks.push(
        new Uint8Array([
          ...u32(0x02014b50),
          ...u16(20), // version made by
          ...u16(20), // version needed
          ...u16(0), // flags
          ...u16(0), // method: store
          ...u16(0), // time
          ...u16(0), // date
          ...u32(crc),
          ...u32(dataBytes.length),
          ...u32(dataBytes.length),
          ...u16(nameBytes.length),
          ...u16(0), // extra
          ...u16(0), // comment
          ...u16(0), // disk number
          ...u16(0), // internal attributes
          ...u32(0), // external attributes
          ...u32(offset),
          ...nameBytes
        ])
      );

      offset += local.length;
    }

    const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const end = new Uint8Array([
      ...u32(0x06054b50),
      ...u16(0),
      ...u16(0),
      ...u16(entries.length),
      ...u16(entries.length),
      ...u32(centralSize),
      ...u32(offset),
      ...u16(0)
    ]);

    return concat(localChunks.concat(centralChunks, [end]), offset + centralSize + end.length);
  }

  NS.zip = { crc32: crc32, buildZip: buildZip, encoder: encoder };
})(window.AIChatDownloader);
