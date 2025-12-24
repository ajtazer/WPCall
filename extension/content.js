// Content script for WhatsApp Web video call injection
(function () {
  'use strict';

  // Configuration
  const CALL_PAGE_URL = 'https://ajtazer.github.io/WPCall';
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
    messageInput: '[contenteditable="true"][data-tab="10"], [aria-label^="Type a message"], [data-testid="conversation-compose-box-input"]',
    sendButton: '[data-testid="send"], [data-icon="send"], [aria-label="Send"]'
  };

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

    // Clear any existing content first
    input.innerHTML = '';

    // Create a paragraph element with the message
    const p = document.createElement('p');
    p.className = '_aupe copyable-text x15bjb6t x1n2onr6';
    p.setAttribute('dir', 'auto');
    p.textContent = message;
    input.appendChild(p);

    // Trigger input event to notify WhatsApp
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

    // Use capturing phase at document level to intercept clicks before WhatsApp handles them
    let lastClickTime = 0;
    document.addEventListener('click', (e) => {
      // Check if click is on our hijacked button or its children
      const hijackedBtn = e.target.closest('[data-wpcall-hijacked="true"]');
      if (hijackedBtn) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Debounce - prevent double clicks within 1 second
        const now = Date.now();
        if (now - lastClickTime < 1000) {
          debug('Click debounced');
          return false;
        }
        lastClickTime = now;

        debug('WPCall button clicked via global handler!');
        handleCallClick();
        return false;
      }
    }, true); // true = capturing phase

    debug('Global click handler set up');
  }

  // Hijack WhatsApp's existing video call button
  function injectCallButton() {
    // Set up global click handler first
    setupGlobalClickHandler();

    // Check if already hijacked
    if (document.querySelector('[data-wpcall-hijacked="true"]')) {
      debug('Button already hijacked');
      return true;
    }

    // Find the existing WhatsApp video call button by aria-label
    const existingVideoBtn = document.querySelector('button[aria-label="Get the app for calling"]');

    if (!existingVideoBtn) {
      debug('WhatsApp video call button not found');
      return false;
    }

    debug('Found WhatsApp video call button, hijacking...', existingVideoBtn);

    // Mark as hijacked (this is what our global handler looks for)
    existingVideoBtn.setAttribute('data-wpcall-hijacked', 'true');
    existingVideoBtn.setAttribute('aria-label', 'Start video call with WPCall');

    // Remove the dropdown arrow (second span with the arrow icon)
    const dropdownArrow = existingVideoBtn.querySelector('[data-icon="ic-arrow-drop-down"], .xdwrcjd');
    if (dropdownArrow) {
      dropdownArrow.style.display = 'none';
      debug('Hidden dropdown arrow');
    }

    // Change the icon color to green to indicate it's active
    const videoIcon = existingVideoBtn.querySelector('[data-icon="video-call-refreshed"] path');
    if (videoIcon) {
      videoIcon.setAttribute('fill', '#00a884');
      debug('Changed icon color to green');
    }

    debug('Button hijacked successfully!');
    return true;
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
    if (document.querySelector('[data-wpcall-hijacked="true"]') ||
      document.querySelector('button[aria-label="Get the app for calling"]')) {
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
    // Check for WhatsApp's video call button which only appears when a chat is open
    return !!document.querySelector('button[aria-label="Get the app for calling"], [data-wpcall-hijacked="true"]');
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
