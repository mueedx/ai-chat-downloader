// src/popup.js
// Reads the conversation from the page, renders the chosen format locally, and hands the
// file to the browser's own download path. Nothing is uploaded and nothing is stored
// (Constitution Principle I).

(function (NS) {
  'use strict';

  const el = (id) => document.getElementById(id);

  const ui = {
    unsupported: el('unsupported'),
    unsupportedText: el('unsupported-text'),
    site: el('site'),
    title: el('title'),
    count: el('count'),
    preview: el('preview'),
    formats: el('formats'),
    formatNote: el('format-note'),
    selectionMode: el('selection-mode'),
    selectionFields: el('selection-fields'),
    rangeFrom: el('range-from'),
    rangeTo: el('range-to'),
    warnings: el('warnings'),
    warningList: el('warning-list'),
    exportButton: el('export'),
    status: el('status'),
    refresh: el('refresh')
  };

  let chosenFormat = 'md';

  function setStatus(text, kind) {
    ui.status.textContent = text || '';
    ui.status.className = 'status' + (kind ? ' ' + kind : '');
  }

  function showWarnings(list) {
    ui.warningList.innerHTML = '';
    const items = (list || []).filter(Boolean);
    ui.warnings.classList.toggle('hidden', items.length === 0);
    for (const item of items) {
      const li = document.createElement('li');
      li.textContent = item;
      ui.warningList.appendChild(li);
    }
  }

  function buildFormatButtons(formats) {
    ui.formats.innerHTML = '';
    for (const format of formats) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = format.label;
      button.setAttribute('aria-pressed', String(format.id === chosenFormat));
      button.addEventListener('click', () => {
        chosenFormat = format.id;
        for (const other of ui.formats.querySelectorAll('button')) {
          other.setAttribute('aria-pressed', String(other.textContent === format.label));
        }
        describeFormat(formats);
        NS.storage.setFormat(chosenFormat);
      });
      ui.formats.appendChild(button);
    }
  }

  function describeFormat(formats) {
    const format = formats.find((item) => item.id === chosenFormat);
    ui.formatNote.textContent = format ? format.description : '';
  }

  function activeTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs && tabs[0]));
    });
  }

  function askTab(tabId, type, payload) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: type, payload: payload }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, reason: 'No reader on this page. Reload the tab and try again.' });
          return;
        }
        resolve(response);
      });
    });
  }

  function setUnsupported(message) {
    ui.unsupportedText.textContent = message;
    ui.unsupported.classList.remove('hidden');
    ui.site.textContent = '-';
    ui.title.textContent = '-';
    ui.count.textContent = '-';
    ui.preview.textContent = '';
    ui.exportButton.disabled = true;
  }

  async function refresh() {
    setStatus('Reading the page…');
    showWarnings([]);

    const tab = await activeTab();
    if (!tab || typeof tab.id !== 'number') {
      setUnsupported('No active tab to read.');
      return;
    }

    const info = await askTab(tab.id, 'site-info');
    if (!info || !info.supported) {
      setUnsupported((info && info.reason) || (info && info.message) || 'This site is not supported.');
      setStatus('');
      return;
    }

    ui.unsupported.classList.add('hidden');
    ui.site.textContent = info.siteLabel + (info.verified ? '' : ' (selectors unverified)');

    const result = await askTab(tab.id, 'extract');
    if (!result || !result.ok) {
      ui.title.textContent = '-';
      ui.count.textContent = '0';
      ui.preview.textContent = '';
      ui.exportButton.disabled = true;
      const tried = (result && result.tried) || [];
      const reason = (result && result.reason) || 'Nothing could be read from this page.';
      setStatus(
        tried.length ? reason + ' Tried: ' + tried.join(' | ') : reason,
        'error'
      );
      return;
    }

    ui.title.textContent = lastChat.title || '(no title on this page)';
    ui.count.textContent = String(result.turnCount);
    ui.preview.textContent = result.preview || '';
    ui.rangeFrom.value = '1';
    ui.rangeTo.value = String(result.turnCount);
    ui.exportButton.disabled = false;

    const warnings = [];
    if (result.unreadableTurns > 0) {
      warnings.push(result.unreadableTurns + ' message(s) could not be read on this page.');
    }
    if (result.incompleteTurns > 0) {
      warnings.push(result.incompleteTurns + ' message(s) were still being written.');
    }
    if (result.partial) {
      warnings.push('Only the messages the page had rendered were captured. Scroll to the top of the conversation and refresh.');
    }
    showWarnings(warnings);
    setStatus('');
  }

  function watchDownload(downloadId, blobUrl, filename) {
    const listener = (delta) => {
      if (!delta || delta.id !== downloadId) return;
      if (delta.state && delta.state.current === 'complete') {
        setStatus('Saved ' + filename, 'ok');
        chrome.downloads.onChanged.removeListener(listener);
        URL.revokeObjectURL(blobUrl);
      } else if (delta.state && delta.state.current === 'interrupted') {
        setStatus('The download was interrupted. Nothing was saved.', 'error');
        chrome.downloads.onChanged.removeListener(listener);
        URL.revokeObjectURL(blobUrl);
      }
    };
    chrome.downloads.onChanged.addListener(listener);
  }

  async function exportChat() {
    const tab = await activeTab();
    if (!tab || typeof tab.id !== 'number') {
      setStatus('No active tab to read.', 'error');
      return;
    }

    ui.exportButton.disabled = true;
    setStatus('Reading the page…');

    const result = await askTab(tab.id, 'extract');
    if (!result || !result.ok) {
      setStatus((result && result.reason) || 'Nothing could be read from this page.', 'error');
      ui.exportButton.disabled = false;
      return;
    }

    let chat = result.chat;
    if (ui.selectionMode.checked) {
      chat = NS.chat.applySelection(chat, Number(ui.rangeFrom.value), Number(ui.rangeTo.value));
      if (chat.turns.length === result.turnCount) {
        setStatus('That range covers the whole conversation, so it was exported in full.', '');
      }
    }

    const rendered = NS.exporters.renderExport(chat, chosenFormat);
    showWarnings(rendered.warnings);

    const blob = new Blob([rendered.bytes], { type: rendered.mime });
    const blobUrl = URL.createObjectURL(blob);

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'download', payload: { url: blobUrl, filename: rendered.filename } },
        resolve
      );
    });

    if (!response || !response.ok) {
      URL.revokeObjectURL(blobUrl);
      setStatus((response && response.error) || 'The download could not be started.', 'error');
      ui.exportButton.disabled = false;
      return;
    }

    setStatus('Saving ' + rendered.filename + '…');
    watchDownload(response.downloadId, blobUrl, rendered.filename);
    ui.exportButton.disabled = false;
  }

  async function init() {
    const settings = await NS.storage.getSettings();
    chosenFormat = settings.format;

    const formats = NS.exporters.listFormats();
    buildFormatButtons(formats);
    describeFormat(formats);

    ui.selectionMode.addEventListener('change', () => {
      ui.selectionFields.classList.toggle('hidden', !ui.selectionMode.checked);
    });

    ui.exportButton.addEventListener('click', exportChat);
    ui.refresh.addEventListener('click', refresh);

    await refresh();
  }

  init();
})(window.AIChatDownloader);
