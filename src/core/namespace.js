// src/core/namespace.js
// Content scripts in Manifest V3 cannot use ES module imports, so every source file
// attaches to one global namespace. This file must load first.

(function (root) {
  'use strict';
  root.AIChatDownloader = root.AIChatDownloader || {};
})(typeof window !== 'undefined' ? window : globalThis);
