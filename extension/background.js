// Background service worker for WPCall extension

// Default settings
const DEFAULT_SETTINGS = {
    autoCopy: true,
    autoSend: false,
    audioOnly: false,
    screenShare: true,
    callExpiry: 15
};

// Initialize settings on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        chrome.storage.sync.set(items);
    });
    console.log('[WPCall] Extension installed');
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
    if (command === 'start-call') {
        // Send message to content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && tab.url?.includes('web.whatsapp.com')) {
                chrome.tabs.sendMessage(tab.id, { action: 'startCall' });
            }
        });
    }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getSettings') {
        chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
            sendResponse(settings);
        });
        return true; // Async response
    }

    if (message.action === 'saveSettings') {
        chrome.storage.sync.set(message.settings, () => {
            sendResponse({ success: true });
        });
        return true;
    }
});
