// src/storage.js
// User preferences only. No transcript is ever stored, and nothing here is synced to a
// Google account, so a preference cannot carry conversation content anywhere (FR-024,
// Constitution Principle I).

(function (NS) {
  'use strict';

  const DEFAULTS = {
    format: 'md',
    disabledSites: []
  };

  const VALID_FORMATS = ['md', 'txt', 'docx', 'pdf'];

  function readRaw() {
    return new Promise((resolve) => {
      chrome.storage.local.get(DEFAULTS, (stored) => resolve(stored || {}));
    });
  }

  function writeRaw(values) {
    return new Promise((resolve) => {
      chrome.storage.local.set(values, () => resolve());
    });
  }

  function validateFormat(value) {
    return VALID_FORMATS.indexOf(value) === -1 ? DEFAULTS.format : value;
  }

  function validateSites(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((id) => typeof id === 'string' && id.length > 0);
  }

  async function getSettings() {
    const stored = await readRaw();
    return {
      format: validateFormat(stored.format),
      disabledSites: validateSites(stored.disabledSites)
    };
  }

  async function setFormat(format) {
    const safe = validateFormat(format);
    await writeRaw({ format: safe });
    return safe;
  }

  async function setSiteDisabled(siteId, disabled) {
    const stored = await readRaw();
    const sites = new Set(validateSites(stored.disabledSites));
    if (disabled) sites.add(siteId);
    else sites.delete(siteId);
    await writeRaw({ disabledSites: Array.from(sites) });
    return Array.from(sites);
  }

  async function isSiteDisabled(siteId) {
    const settings = await getSettings();
    return settings.disabledSites.indexOf(siteId) !== -1;
  }

  NS.storage = {
    DEFAULTS: DEFAULTS,
    VALID_FORMATS: VALID_FORMATS,
    getSettings: getSettings,
    setFormat: setFormat,
    setSiteDisabled: setSiteDisabled,
    isSiteDisabled: isSiteDisabled
  };
})(window.AIChatDownloader);
