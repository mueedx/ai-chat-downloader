// src/core/sites.js
// The list of supported sites, derived from the adapters so the manifest, the popup, the
// options page, and the documentation cannot drift apart. FR-020 and FR-021 depend on this
// being the single source.

(function (NS) {
  'use strict';

  function siteList() {
    return NS.adapterRegistry.allAdapters().map((adapter) => ({
      id: adapter.id,
      label: adapter.label,
      origins: adapter.origins.slice(),
      verified: Boolean(adapter.verified),
      lastVerified: adapter.lastVerified || null,
      knownIssues: adapter.knownIssues || ''
    }));
  }

  function siteLabels() {
    return siteList().map((site) => site.label);
  }

  /** Every origin the extension needs host permission for. The manifest must match this. */
  function allOrigins() {
    return siteList().reduce((acc, site) => acc.concat(site.origins), []);
  }

  function unsupportedMessage() {
    return 'This site is not supported. AI Chat Downloader works on: ' + siteLabels().join(', ') + '.';
  }

  NS.sites = {
    siteList: siteList,
    siteLabels: siteLabels,
    allOrigins: allOrigins,
    unsupportedMessage: unsupportedMessage
  };
})(window.AIChatDownloader);
