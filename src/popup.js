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
    walk: el('walk'),
    walkNote: el('walk-note'),
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
  let shouldWalkHere = true;

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

  /** FR-012: the page movement is disclosed before the export, not after. */
  function describeWalk() {
    if (!ui.walk.checked) {
      ui.walkNote.textContent =
        'Off: only the messages the page has already rendered will be exported, and the file will say so.';
      return false;
    }
    if (!shouldWalkHere) {
      ui.walkNote.textContent = 'Off for this site in the options page, so the page will not scroll.';
      return false;
    }
    ui.walkNote.textContent =
      'The page will scroll to load the rest of the conversation, then return to where you are now.';
    return true;
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

    // The preview never walks the page. A walk on open would move the user's page before they
    // had asked for anything, so only the export walks.
    shouldWalkHere = await NS.storage.shouldWalk(info.site);
    describeWalk(info.site);

    const result = await askTab(tab.id, 'extract', {});
    if (!result || !result.ok) {
      ui.title.textContent = '-';
      ui.count.textContent = '0';
      ui.preview.textContent = '';
      ui.exportButton.disabled = true;
      const reason = (result && result.reason) || 'Nothing could be read from this page.';
      // The content script reads the page, so it words the diagnosis. This page has no
      // conversation document of its own and does not load the DOM engine.
      const detail = (result && result.detail) || ((result && result.tried) || []).join(' | ');
      setStatus(detail ? reason + ' Tried: ' + detail : reason, 'error');
      return;
    }

    ui.title.textContent = result.chat.title || '(no title on this page)';
    ui.count.textContent = String(result.turnCount);
    ui.preview.textContent = result.preview || '';
    ui.rangeFrom.value = '1';
    ui.rangeTo.value = String(result.turnCount);
    ui.exportButton.disabled = false;

    const warnings = [];
    if (result.completeness && result.completeness.state === 'incomplete' && result.completeness.walked) {
      warnings.push('Capture is incomplete: ' + (result.completeness.reason || 'the walk stopped early') + '.');
    }
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

    const wanted = ui.walk.checked && shouldWalkHere;
    const result = await askTab(tab.id, 'extract', { walk: wanted });
    if (!result || !result.ok) {
      setStatus((result && result.reason) || 'Nothing could be read from this page.', 'error');
      ui.exportButton.disabled = false;
      return;
    }

    let chat = result.chat;
    if (chat.completeness && chat.completeness.state !== 'complete') {
      showWarnings([
        'Capture is incomplete: ' + (chat.completeness.reason || 'the page had not rendered the rest') + '.'
      ]);
    }
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

    ui.walk.checked = settings.walkEnabled;
    describeWalk();

    ui.selectionMode.addEventListener('change', () => {
      ui.selectionFields.classList.toggle('hidden', !ui.selectionMode.checked);
    });

    ui.walk.addEventListener('change', () => describeWalk());

    ui.exportButton.addEventListener('click', exportChat);
    ui.refresh.addEventListener('click', refresh);

    await refresh();
  }

  init();
})(window.AIChatDownloader);
