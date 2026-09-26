// src/options.js
// Preferences and an honest status board for the six adapters.

(function (NS) {
  'use strict';

  const el = (id) => document.getElementById(id);
  const FORMATS = [
    { id: 'md', label: 'Markdown' },
    { id: 'txt', label: 'Plain text' },
    { id: 'docx', label: 'Word' },
    { id: 'pdf', label: 'PDF' }
  ];

  function renderFormats(current) {
    const host = el('formats');
    host.innerHTML = '';
    for (const format of FORMATS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = format.label;
      button.setAttribute('aria-pressed', String(format.id === current));
      button.addEventListener('click', async () => {
        await NS.storage.setFormat(format.id);
        renderFormats(format.id);
      });
      host.appendChild(button);
    }
  }

  function renderSites(disabled) {
    const host = el('sites');
    host.innerHTML = '';
    for (const site of NS.sites.siteList()) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = disabled.indexOf(site.id) === -1;
      input.addEventListener('change', async () => {
        await NS.storage.setSiteDisabled(site.id, !input.checked);
      });

      const text = document.createElement('span');
      text.textContent = site.label;
      const origin = document.createElement('span');
      origin.className = 'origin';
      origin.textContent = site.origins.join(', ');

      label.appendChild(input);
      label.appendChild(text);
      label.appendChild(origin);
      host.appendChild(label);
    }
  }

  /** The global walk switch, and the per-site opt-outs beneath it. FR-010. */
  function renderWalk(settings) {
    const global = el('walk-global');
    global.setAttribute('aria-pressed', String(settings.walkEnabled));
    global.textContent = settings.walkEnabled
      ? 'Scroll long conversations: on'
      : 'Scroll long conversations: off';
    global.onclick = async () => {
      const next = await NS.storage.setWalkEnabled(!settings.walkEnabled);
      renderWalk(Object.assign({}, settings, { walkEnabled: next }));
    };

    const host = el('walk-sites');
    host.innerHTML = '';
    for (const site of NS.sites.siteList()) {
      const enabled = settings.walkEnabled && settings.walkDisabledSites.indexOf(site.id) === -1;

      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = enabled;
      input.disabled = !settings.walkEnabled;
      input.addEventListener('change', async () => {
        const updated = await NS.storage.setWalkDisabled(site.id, !input.checked);
        renderWalk(Object.assign({}, settings, { walkDisabledSites: updated }));
      });

      const text = document.createElement('span');
      text.textContent = site.label;

      label.appendChild(input);
      label.appendChild(text);
      host.appendChild(label);
    }
  }

  function renderStatus() {
    const host = el('status');
    host.innerHTML = '';
    for (const site of NS.sites.siteList()) {
      const row = document.createElement('div');
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = site.verified ? 'verified' : 'unverified';
      const name = document.createElement('strong');
      name.appendChild(badge);
      name.appendChild(document.createTextNode(site.label));
      const detail = document.createElement('p');
      detail.textContent = site.lastVerified
        ? 'Last checked against a live conversation on ' + site.lastVerified + '. ' + site.knownIssues
        : 'Never checked against a live conversation. ' + site.knownIssues;
      row.appendChild(name);
      row.appendChild(detail);
      host.appendChild(row);
    }
  }

  async function init() {
    const settings = await NS.storage.getSettings();
    renderFormats(settings.format);
    renderWalk(settings);
    renderSites(settings.disabledSites);
    renderStatus();
  }

  init();
})(window.AIChatDownloader);
