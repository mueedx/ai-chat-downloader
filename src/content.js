// src/content.js
// Runs on the six supported origins. Answers the popup with a preview and, on request, the
// normalised chat, optionally after walking the transcript so the site renders the parts it has
// discarded. Reads the DOM only: no fetch, no storage, no network (FR-018, FR-021).

(function (NS) {
  'use strict';

  const WALK_STOP_REASONS = {
    cancelled: 'you stopped the capture',
    'time-limit': 'the walk ran out of time',
    'step-limit': 'the walk reached its step limit',
    'no-container': 'the site does not expose a scrollable transcript',
    'background-tab': 'the page was in a background tab',
    'not-scrollable': 'the conversation was not scrollable'
  };

  function currentAdapter() {
    return NS.adapterRegistry.adapterForHost(location.host);
  }

  function siteInfo() {
    const adapter = currentAdapter();
    if (!adapter) {
      return { supported: false, message: NS.sites.unsupportedMessage(), sites: NS.sites.siteLabels() };
    }
    return {
      supported: true,
      site: adapter.id,
      siteLabel: adapter.label,
      verified: Boolean(adapter.verified),
      knownIssues: adapter.knownIssues || ''
    };
  }

  /** Remembers what the user was typing so the walk cannot take it away. FR-015, FR-016. */
  function captureFocus() {
    const active = document.activeElement;
    if (!active || typeof active.getAttribute !== 'function') return null;
    if (!/^(TEXTAREA|INPUT)$/.test(active.tagName || '')) return null;
    return {
      element: active,
      start: typeof active.selectionStart === 'number' ? active.selectionStart : null,
      end: typeof active.selectionEnd === 'number' ? active.selectionEnd : null
    };
  }

  function restoreFocus(saved) {
    if (!saved || !saved.element || typeof saved.element.focus !== 'function') return;
    saved.element.focus();
    if (saved.start !== null && typeof saved.element.setSelectionRange === 'function') {
      try {
        saved.element.setSelectionRange(saved.start, saved.end);
      } catch (error) {
        // A field that changed type under us is not worth failing an export over.
      }
    }
  }

  function readPage(adapter) {
    return NS.dom.extractChat(adapter, document, { url: location.href });
  }

  /**
   * Why the capture is not complete, in the user's terms. There are three distinct cases and
   * they read differently: a preview read that never asked for a walk, a walk the user has
   * switched off, and a walk that ran and stopped early.
   */
  function walkReason(walk, requested) {
    if (requested === undefined) return 'this was a preview read, not a full capture';
    if (!requested) return 'the walk was switched off';
    if (!walk) return 'the walk did not run';
    if (walk.completed) return null;
    if (walk.skippedReason) return walk.skippedReason;
    return WALK_STOP_REASONS[walk.stopReason] || ('the walk stopped early: ' + walk.stopReason);
  }

  /**
   * Reads the conversation, walking the transcript first when asked. The walk's own reads go
   * through the same extraction path, so nothing here knows about selectors.
   */
  async function extract(options) {
    const opts = options || {};
    const adapter = currentAdapter();

    if (!adapter) {
      return { ok: false, reason: NS.sites.unsupportedMessage(), tried: [] };
    }

    let last = readPage(adapter);
    let walk = null;
    let turns = null;

    if (opts.walk) {
      const focus = captureFocus();
      const capture = await NS.walker.captureTranscript({
        adapter: adapter,
        doc: document,
        // The window scroll is a separate restoration from the transcript's own container, and
        // it lives on window, not on document.
        viewport: typeof window !== 'undefined' ? window : null,
        collect: () => {
          last = readPage(adapter);
          return last.ok ? last.chat.turns : [];
        }
      });
      walk = capture.walk;
      turns = capture.turns;
      restoreFocus(focus);
    }

    const claim = NS.chat.completeness({
      state: walk && walk.ran && walk.completed ? 'complete' : 'incomplete',
      walked: Boolean(walk && walk.ran),
      captured: turns ? turns.length : (last.ok ? last.chat.turns.length : 0),
      steps: walk ? walk.steps : 0,
      durationMs: walk ? walk.durationMs : 0,
      reason: walkReason(walk, opts.walk)
    });

    const result = NS.dom.extractChat(adapter, document, {
      url: location.href,
      completeness: claim
    });
    if (turns && turns.length) result.chat.turns = turns;

    if (!result.ok) {
      return {
        ok: false,
        reason: result.reason,
        tried: result.tried,
        siteLabel: adapter.label,
        // The page is read here, so the failure is worded here. The popup has no document of its
        // own to diagnose, and it should not have to load the DOM engine to print a sentence.
        detail: NS.dom.describeDiagnostic(result.diagnostic) || (result.tried || []).join(' | ')
      };
    }

    return {
      ok: true,
      chat: result.chat,
      turnCount: NS.chat.chatTurnCount(result.chat),
      unreadableTurns: result.chat.unreadableTurns,
      incompleteTurns: result.chat.incompleteTurns,
      partial: result.chat.partial,
      inFrame: Boolean(result.chat.inFrame),
      completeness: result.chat.completeness,
      walk: walk
        ? {
          ran: walk.ran,
          completed: walk.completed,
          steps: walk.steps,
          durationMs: walk.durationMs,
          stopReason: walk.stopReason,
          skippedReason: walk.skippedReason,
          restored: walk.restored
        }
        : null,
      tried: result.tried
    };
  }

  function previewText(chat) {
    const first = chat.turns.slice(0, 2).map((turn) => {
      const who = turn.role === NS.chat.USER ? 'You' : chat.siteLabel;
      return who + ': ' + turn.text.slice(0, 240);
    });
    return first.join('\n\n');
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') return false;

    if (message.type === 'site-info') {
      sendResponse(siteInfo());
      return false;
    }

    if (message.type === 'extract') {
      extract(message.payload).then(
        (payload) => {
          if (payload.ok) payload.preview = previewText(payload.chat);
          sendResponse(payload);
        },
        (error) => {
          sendResponse({
            ok: false,
            reason: 'The page could not be read: ' + ((error && error.message) || 'unknown error'),
            tried: []
          });
        }
      );
      return true;
    }

    return false;
  });

  NS.content = {
    siteInfo: siteInfo,
    extract: extract,
    previewText: previewText,
    captureFocus: captureFocus,
    restoreFocus: restoreFocus,
    walkReason: walkReason,
    WALK_STOP_REASONS: WALK_STOP_REASONS
  };
})(window.AIChatDownloader);
