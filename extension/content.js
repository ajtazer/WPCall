// Content script for WhatsApp Web video call injection
(function () {
  'use strict';

  // Configuration
  const CALL_PAGE_URL = 'https://call.bihari.xyz';
  const SIGNALING_URL = 'https://wpcall-signaling.ajcoolx619.workers.dev';

  // State
  let currentChatName = null;
  let isInjected = false;
  let sidebarIndicatorInjected = false;

  // DOM Selectors (using multiple fallbacks for WhatsApp Web's changing DOM)
  const SELECTORS = {
    // Chat header area - multiple fallbacks
    conversationHeader: '[data-testid="conversation-header"], [data-testid="conversation-panel-header"], header[data-testid]',
    chatTitle: '[data-testid="conversation-info-header-chat-title"], [data-testid="conversation-title"], header span[title]',
    headerActions: '[data-testid="conversation-header"] [data-testid="menu"]',

    // Alternative selectors - broader matching
    chatTitleAlt: 'header span[dir="auto"][title], #main header span[title]',
    headerIconsContainer: 'header [role="button"], #main header div[role="button"]',

    // Header with video call button area
    headerRightSection: 'header > div:last-child, #main header > div > div:last-child',

    // Right side empty screen (when no chat is open)
    introScreen: '[data-testid="intro-md-beta-logo-dark"], [data-testid="intro-md-beta-logo-light"], [data-icon="intro-md-beta-logo-dark"], [data-icon="intro-md-beta-logo-light"]',
    defaultScreen: '[data-testid="default-user"], [data-testid="intro-title"]',
    mainPanel: '#main',
    sidePanel: '#side, [data-testid="side"]',

    // Message input - chat message box (not search)
    // (confirmed 2026-07: div[role=textbox] with data-testid + data-tab="10")
    messageInput: '[data-testid="conversation-compose-box-input"], [contenteditable="true"][data-tab="10"], div[role="textbox"][aria-label^="Type a message"]',
    sendButton: '[data-testid="send"], [data-icon="send"], [aria-label="Send"]'
  };

  // Language-independent icon identifiers (WhatsApp renders these as <svg><title>id</title>).
  // These survive locale changes and aria-label churn, unlike text labels.
  const ICON = {
    videoCall: 'ic-videocam',        // header video-call button
    dropArrow: 'ic-arrow-drop-down', // chevron inside the video button
    sendLink: 'ic-link'              // "Send call link" overflow-menu item
  };

  // Find the first element under `root` whose descendant <svg><title> matches titleId.
  function elementWithIconTitle(root, titleId, tagName) {
    if (!root) return null;
    const titles = root.querySelectorAll('svg > title, svg title');
    for (const t of titles) {
      if (t.textContent.trim() === titleId) {
        return tagName ? t.closest(tagName) : t.closest('svg');
      }
    }
    return null;
  }

  // Locate the header video-call button by its icon (works for 1:1 "Video call"
  // and group "Group video call", any language).
  function findVideoCallButton() {
    const header = document.querySelector('#main header');
    if (!header) return null;
    return elementWithIconTitle(header, ICON.videoCall, 'button');
  }

  // Debug helper
  function debug(message, data = null) {
    const prefix = '[WPCall Debug]';
    if (data) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }

  // Generate UUID for room
  function generateRoomId() {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16)
    );
  }

  // Generate short token
  function generateToken() {
    return Math.random().toString(36).substring(2, 10);
  }

  // Get chat name from DOM
  function getChatName() {
    // Try primary selector
    let titleEl = document.querySelector(SELECTORS.chatTitle);
    if (titleEl) {
      return titleEl.textContent.trim();
    }

    // Try alternative selector
    titleEl = document.querySelector(SELECTORS.chatTitleAlt);
    if (titleEl) {
      return titleEl.getAttribute('title') || titleEl.textContent.trim();
    }

    return null;
  }

  // Check if it's a group chat (heuristic)
  function isGroupChat(name) {
    // Groups typically have group icon or multiple participants indicator
    const groupIndicators = document.querySelectorAll('[data-testid="group-subject-input"], [data-icon="group"]');
    return groupIndicators.length > 0;
  }

  // Generate call message
  function generateCallMessage(chatName, callLink) {
    let message = `i am waiting here bruh!! \n${callLink}\n\nWant to make WhatsApp calls on the web? Check this out: https://github.com/ajtazer/WPCall`;
    return message;
  }

  // Create call link
  async function createCallLink() {
    const roomId = generateRoomId();
    const token = generateToken();

    // Get settings for expiry
    const settings = await getSettings();
    const expiry = settings.callExpiry || 15; // minutes

    try {
      // Register room with signaling server
      const response = await fetch(`${SIGNALING_URL}/room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, token, expiry })
      });

      if (!response.ok) {
        console.warn('Failed to register room, using local-only link');
      }
    } catch (e) {
      console.warn('Signaling server unavailable, using local-only link');
    }

    return `${CALL_PAGE_URL}?room=${roomId}&token=${token}`;
  }

  // Show native-style toast
  function showToast(message) {
    // Remove existing toast
    const existing = document.querySelector('.wpcall-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'wpcall-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('wpcall-toast-visible');
    });

    // Remove after delay
    setTimeout(() => {
      toast.classList.remove('wpcall-toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // Copy to clipboard
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  }

  // Paste message to chatbox (without sending)
  async function pasteToChat(message) {
    const input = document.querySelector(SELECTORS.messageInput);
    if (!input) return false;

    // Focus the input
    input.focus();

    // Wait a bit for focus
    await new Promise(r => setTimeout(r, 100));

    // WhatsApp's compose box is a rich-text (Lexical) editor. Directly setting
    // innerHTML doesn't register with the editor's model, so we drive it through
    // execCommand, which fires the beforeinput/input events the editor listens for.
    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      const ok = document.execCommand('insertText', false, message);
      if (ok) return true;
    } catch (e) {
      debug('execCommand paste failed, falling back', e);
    }

    // Fallback: manual DOM insertion + synthetic input event.
    input.innerHTML = '';
    const p = document.createElement('p');
    p.setAttribute('dir', 'auto');
    p.textContent = message;
    input.appendChild(p);
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: message
    }));

    return true;
  }

  // Auto-send message (if enabled)
  async function autoSendMessage(message) {
    const pasted = await pasteToChat(message);
    if (!pasted) return false;

    // Small delay then send
    await new Promise(r => setTimeout(r, 100));

    const sendBtn = document.querySelector(SELECTORS.sendButton);
    if (sendBtn) {
      sendBtn.click();
      return true;
    }

    return false;
  }

  // Get extension settings
  async function getSettings() {
    return new Promise(resolve => {
      if (chrome?.storage?.sync) {
        chrome.storage.sync.get({
          autoCopy: true,
          autoSend: false,
          audioOnly: false,
          screenShare: true,
          callExpiry: 15,
          openCallRoom: false  // New setting - off by default
        }, resolve);
      } else {
        resolve({
          autoCopy: true,
          autoSend: false,
          audioOnly: false,
          screenShare: true,
          callExpiry: 15,
          openCallRoom: false
        });
      }
    });
  }

  // Handle call button click
  async function handleCallClick() {
    const chatName = getChatName();
    const callLink = await createCallLink();
    const message = generateCallMessage(chatName, callLink);

    const settings = await getSettings();

    if (settings.autoSend) {
      const sent = await autoSendMessage(message);
      if (sent) {
        showToast('Call message sent');
        if (settings.openCallRoom) {
          window.open(callLink, '_blank');
        }
        return;
      }
    }

    // Default: copy to clipboard AND paste to chatbox (but don't send)
    if (settings.autoCopy) {
      await copyToClipboard(message);
      await pasteToChat(message);
      showToast('Message ready - press send!');
    }

    // Only open call page if setting is enabled
    if (settings.openCallRoom) {
      window.open(callLink, '_blank');
    }
  }

  // Global click handler (set up once)
  let globalClickHandlerSet = false;

  function setupGlobalClickHandler() {
    if (globalClickHandlerSet) return;
    globalClickHandlerSet = true;

    let lastFireTime = 0;

    // WhatsApp triggers its call action on pointerdown/mousedown (React), not on
    // click — so intercepting only 'click' lets its handler run first (showing the
    // Mac-app prompt / posting its own link). We must swallow the whole interaction
    // in the capture phase, on every event it could use, and drive our flow once.
    function intercept(e) {
      const hijacked = e.target.closest && e.target.closest('[data-wpcall-hijacked="true"]');
      if (!hijacked) return;

      // Block WhatsApp's own handling of this interaction entirely.
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // pointerdown + mousedown + mouseup + click all fire for one tap; act once.
      const now = Date.now();
      if (now - lastFireTime < 800) return false;

      // Only actually launch on the "down" of the press (earliest signal).
      if (e.type !== 'pointerdown' && e.type !== 'mousedown') return false;
      lastFireTime = now;

      debug('WPCall interaction intercepted on ' + e.type, hijacked);
      if (hijacked.getAttribute('data-wpcall-menuitem') === 'true') {
        closeOpenMenu();
      }
      handleCallClick();
      return false;
    }

    ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'click'].forEach(type => {
      document.addEventListener(type, intercept, true); // capture phase
    });

    debug('Global interaction handlers set up (pointerdown/mousedown/click)');
  }

  // Hijack WhatsApp's existing video call button (header)
  function injectCallButton() {
    // Set up global click handler first
    setupGlobalClickHandler();

    // Find the header video-call button by its icon (language-independent).
    const videoBtn = findVideoCallButton();

    if (!videoBtn) {
      debug('WhatsApp video call button not found');
      return false;
    }

    // Already hijacked this exact button?
    if (videoBtn.getAttribute('data-wpcall-hijacked') === 'true') {
      return true;
    }

    debug('Found WhatsApp video call button, hijacking...', videoBtn);

    // Mark as hijacked (this is what our global handler looks for)
    videoBtn.setAttribute('data-wpcall-hijacked', 'true');
    videoBtn.setAttribute('aria-label', 'Start video call with WPCall');

    // Hide the dropdown chevron (svg with the arrow-drop-down title)
    const arrowSvg = elementWithIconTitle(videoBtn, ICON.dropArrow, 'svg');
    if (arrowSvg) {
      arrowSvg.style.display = 'none';
      debug('Hidden dropdown arrow');
    }

    // Tint the video icon green to signal it's active
    const videoSvg = elementWithIconTitle(videoBtn, ICON.videoCall, 'svg');
    if (videoSvg) {
      videoSvg.querySelectorAll('path').forEach(p => p.setAttribute('fill', '#00a884'));
      debug('Changed icon color to green');
    }

    debug('Button hijacked successfully!');
    return true;
  }

  // Override WhatsApp's "Send call link" item in the overflow (three-dot) menu.
  // The menu is created fresh each time it opens, so we re-scan on DOM changes.
  function hijackSendCallLink() {
    const items = document.querySelectorAll('[role="menuitem"]');
    let found = false;
    items.forEach(item => {
      if (item.getAttribute('data-wpcall-hijacked') === 'true') { found = true; return; }
      if (elementWithIconTitle(item, ICON.sendLink, 'svg')) {
        item.setAttribute('data-wpcall-hijacked', 'true');
        item.setAttribute('data-wpcall-menuitem', 'true');
        debug('Hijacked "Send call link" menu item');
        found = true;
      }
    });
    return found;
  }

  // Close any open WhatsApp overflow menu (used after overriding a menu item).
  function closeOpenMenu() {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true
    }));
  }

  // Fallback: if WhatsApp's "Make calls with the Mac app / Download WhatsApp for
  // Mac to start making calls" popover appears (i.e. a click slipped past our
  // interception), dismiss it and run WPCall instead. Matches by copy; bounded so
  // it can't fire on unrelated UI, and rate-limited so it can't loop.
  let macPromptHandledAt = 0;
  const MAC_PROMPT_RE = /to start making calls|make calls with the .{0,12}app/i;
  function overrideMacAppPrompt() {
    const now = Date.now();
    if (now - macPromptHandledAt < 1500) return false;

    const candidates = document.querySelectorAll(
      '[role="dialog"], [data-animate-modal-popup], span[dir="auto"]'
    );
    for (const el of candidates) {
      const txt = el.textContent || '';
      if (txt.length <= 200 && MAC_PROMPT_RE.test(txt)) {
        macPromptHandledAt = now;
        debug('Mac-app call prompt detected — overriding with WPCall');
        closeOpenMenu();     // dismiss WhatsApp's popover
        handleCallClick();   // run WPCall instead
        return true;
      }
    }
    return false;
  }

  // Create right-side indicator (replaces WhatsApp's download prompt)
  function createEmptyScreenIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'wpcall-empty-indicator';
    indicator.setAttribute('data-wpcall-indicator', 'true');
    indicator.innerHTML = `
      <div class="wpcall-info-card">
        <button class="wpcall-close-btn" aria-label="Close">&times;</button>
        <div class="wpcall-info-header">
          <span class="wpcall-info-icon">📹</span>
          <span class="wpcall-info-title">WPCall Active</span>
        </div>
        <div class="wpcall-info-body">
          <p class="wpcall-tagline">Video calls for WhatsApp Web</p>
          <ul class="wpcall-features">
            <li>P2P Video Calls</li>
            <li>Screen Sharing</li>
            <li>No WhatsApp servers</li>
          </ul>
          <div class="wpcall-howto">
            <strong>To start a call:</strong><br>
            Open any chat → Click the green video button
          </div>
        </div>
      </div>
    `;

    // Add close button handler
    const closeBtn = indicator.querySelector('.wpcall-close-btn');
    closeBtn.addEventListener('click', () => {
      indicator.remove();
      // Restore WhatsApp's original content if hidden
      const hiddenContent = document.querySelector('[data-wpcall-hidden]');
      if (hiddenContent) {
        hiddenContent.style.display = '';
        hiddenContent.removeAttribute('data-wpcall-hidden');
      }
    });

    return indicator;
  }

  // Inject indicator on right-side empty screen
  function injectEmptyScreenIndicator() {
    // Check if already injected
    if (document.querySelector('[data-wpcall-indicator="true"]')) {
      return true;
    }

    // Don't inject if a chat is open
    if (document.querySelector('[data-wpcall-hijacked="true"]') || isChatOpen()) {
      return false;
    }

    // Find the "Download WhatsApp" content area
    const downloadContainer = document.querySelector('.xktia5q, [class*="xktia5q"]');
    if (downloadContainer) {
      // Hide WhatsApp's original content
      const originalContent = downloadContainer.querySelector('.xg01cxk');
      if (originalContent && !originalContent.hasAttribute('data-wpcall-hidden')) {
        originalContent.setAttribute('data-wpcall-hidden', 'true');
        originalContent.style.display = 'none';
      }

      const indicator = createEmptyScreenIndicator();
      downloadContainer.style.position = 'relative';
      downloadContainer.appendChild(indicator);
      debug('Injected indicator, hid WhatsApp content');
      return true;
    }

    // Fallback: Find the main right panel
    const rightPanel = document.querySelector('#main');
    if (rightPanel && !document.querySelector('header button[aria-label]')) {
      const indicator = createEmptyScreenIndicator();
      rightPanel.appendChild(indicator);
      debug('Injected indicator in right panel');
      return true;
    }

    return false;
  }

  // Remove empty screen indicator
  function removeEmptyScreenIndicator() {
    const indicator = document.querySelector('[data-wpcall-indicator="true"]');
    if (indicator) {
      indicator.remove();
    }
  }

  // Check if a chat is currently open
  function isChatOpen() {
    // The compose box only exists when a conversation is open; the video-call
    // button is a secondary signal. (The old "Get the app for calling" label no
    // longer exists in builds that support in-browser calling.)
    return !!(
      document.querySelector(SELECTORS.messageInput) ||
      findVideoCallButton() ||
      document.querySelector('[data-wpcall-hijacked="true"]')
    );
  }

  // Main injection logic
  function updateInjection() {
    const chatOpen = isChatOpen();

    if (chatOpen) {
      // Remove empty screen indicator
      removeEmptyScreenIndicator();
      sidebarIndicatorInjected = false;

      // Inject call button
      isInjected = injectCallButton();

      // Override the "Send call link" overflow-menu item if the menu is open
      hijackSendCallLink();

      // Safety net: convert WhatsApp's "download the Mac app" call prompt into WPCall
      overrideMacAppPrompt();
    } else {
      // Remove call button (if orphaned)
      const orphanedBtn = document.querySelector('[data-wpcall="true"]');
      if (orphanedBtn) orphanedBtn.remove();
      isInjected = false;

      // Show indicator on right-side empty screen
      if (!sidebarIndicatorInjected) {
        sidebarIndicatorInjected = injectEmptyScreenIndicator();
      }
    }
  }

  // Setup MutationObserver
  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      // Debounce updates
      clearTimeout(window._wpcallUpdateTimeout);
      window._wpcallUpdateTimeout = setTimeout(updateInjection, 100);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return observer;
  }

  // Initialize
  function init() {
    // Initial injection attempt
    updateInjection();

    // Setup observer for dynamic updates
    setupObserver();

    // Listen for keyboard shortcut from background
    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'startCall' && isChatOpen()) {
          handleCallClick();
          sendResponse({ success: true });
        }
      });
    }

    console.log('[WPCall] Extension initialized');
  }

  // Wait for WhatsApp Web to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Delay slightly to ensure WhatsApp's JS has run
    setTimeout(init, 1000);
  }
})();
