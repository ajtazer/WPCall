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

  // DOM Selectors (using data-testid for stability)
  const SELECTORS = {
    // Chat header area
    conversationHeader: '[data-testid="conversation-header"]',
    chatTitle: '[data-testid="conversation-info-header-chat-title"]',
    headerActions: '[data-testid="conversation-header"] [data-testid="menu"]',

    // Alternative selectors
    chatTitleAlt: 'header span[dir="auto"][title]',
    headerIconsContainer: 'header [role="button"]',

    // Right side empty screen (when no chat is open)
    introScreen: '[data-testid="intro-md-beta-logo-dark"], [data-testid="intro-md-beta-logo-light"]',
    emptyScreen: '[data-icon="intro-md-beta-logo-dark"], [data-icon="intro-md-beta-logo-light"]',
    mainPanel: '#main',

    // Message input
    messageInput: '[data-testid="conversation-compose-box-input"]',
    sendButton: '[data-testid="send"]'
  };

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
    let message = '📹 Video call started';

    if (chatName) {
      const prefix = isGroupChat(chatName) ? 'for' : 'with';
      message += ` ${prefix} "${chatName}"`;
    }

    message += `\nJoin here → ${callLink}`;
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

    // Try using execCommand for better compatibility with WhatsApp's contenteditable
    await new Promise(r => setTimeout(r, 50));

    // Insert text using input simulation
    document.execCommand('insertText', false, message);

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
          shortcut: 'Ctrl+Shift+V'
        }, resolve);
      } else {
        resolve({
          autoCopy: true,
          autoSend: false,
          audioOnly: false,
          screenShare: true,
          callExpiry: 15
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
        window.open(callLink, '_blank');
        return;
      }
    }

    // Default: copy to clipboard AND paste to chatbox (but don't send)
    if (settings.autoCopy) {
      await copyToClipboard(message);
      await pasteToChat(message);
      showToast('Message copied');
    }

    // Open call page
    window.open(callLink, '_blank');
  }

  // Create video call button
  function createCallButton() {
    const button = document.createElement('div');
    button.className = 'wpcall-btn';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', 'Start video call');
    button.setAttribute('data-wpcall', 'true');

    button.innerHTML = `
      <span data-icon="video-call">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
        </svg>
      </span>
    `;

    button.addEventListener('click', handleCallClick);
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCallClick();
      }
    });

    return button;
  }

  // Inject call button into chat header
  function injectCallButton() {
    // Check if already injected
    if (document.querySelector('[data-wpcall="true"]')) {
      return true;
    }

    // Find conversation header
    const header = document.querySelector(SELECTORS.conversationHeader);
    if (!header) return false;

    // Find icons area (near menu button)
    const menuBtn = header.querySelector('[data-testid="menu"]');
    const searchBtn = header.querySelector('[data-testid="search"]');

    // Find the container for header actions
    let iconsContainer = null;

    if (menuBtn) {
      iconsContainer = menuBtn.parentElement;
    } else if (searchBtn) {
      iconsContainer = searchBtn.parentElement;
    } else {
      // Fallback: find any button-like elements in header
      const buttons = header.querySelectorAll('[role="button"]');
      if (buttons.length > 0) {
        iconsContainer = buttons[buttons.length - 1].parentElement;
      }
    }

    if (!iconsContainer) return false;

    // Create and inject button
    const callBtn = createCallButton();

    // Insert before menu button for natural placement
    if (menuBtn) {
      iconsContainer.insertBefore(callBtn, menuBtn);
    } else {
      iconsContainer.appendChild(callBtn);
    }

    return true;
  }

  // Create right-side indicator (shown on empty screen)
  function createEmptyScreenIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'wpcall-empty-indicator';
    indicator.setAttribute('data-wpcall-indicator', 'true');
    indicator.textContent = '📹 Calls for WhatsApp enabled';
    return indicator;
  }

  // Inject indicator on right-side empty screen
  function injectEmptyScreenIndicator() {
    // Check if already injected
    if (document.querySelector('[data-wpcall-indicator="true"]')) {
      return true;
    }

    // Find the intro/empty screen on the right side
    const introLogo = document.querySelector(SELECTORS.introScreen) ||
      document.querySelector(SELECTORS.emptyScreen);

    if (introLogo) {
      // Find parent container and append indicator
      let container = introLogo.closest('[data-testid]') || introLogo.parentElement?.parentElement;
      if (container) {
        const indicator = createEmptyScreenIndicator();
        container.appendChild(indicator);
        return true;
      }
    }

    // Fallback: try to find the main empty area
    const mainPanel = document.querySelector('#main, [data-testid="default-user"]');
    if (mainPanel && !document.querySelector(SELECTORS.conversationHeader)) {
      const indicator = createEmptyScreenIndicator();
      mainPanel.appendChild(indicator);
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
    return !!document.querySelector(SELECTORS.conversationHeader);
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
