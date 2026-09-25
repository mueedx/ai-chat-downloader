// src/adapters/index.js
// Host to adapter lookup. The only place that knows which adapter belongs to which site, so
// adding a site means adding a file and one entry here (SC-008).

(function (NS) {
  'use strict';

  const ORDER = ['chatgpt', 'claude', 'gemini', 'deepseek', 'qwen', 'kimi'];

  function allAdapters() {
    return ORDER.map((id) => NS.adapters[id]).filter(Boolean);
  }

  function hostMatches(adapter, host) {
    if (!adapter || !host) return false;
    return adapter.origins.some((origin) => {
      try {
        return new URL(origin).host === host;
      } catch (error) {
        return origin === host;
      }
    });
  }

  function adapterForHost(host) {
    return allAdapters().find((adapter) => hostMatches(adapter, host)) || null;
  }

  function adapterForUrl(url) {
    try {
      return adapterForHost(new URL(url).host);
    } catch (error) {
      return null;
    }
  }

  NS.adapterRegistry = {
    ORDER: ORDER,
    allAdapters: allAdapters,
    hostMatches: hostMatches,
    adapterForHost: adapterForHost,
    adapterForUrl: adapterForUrl
  };
})(window.AIChatDownloader);
