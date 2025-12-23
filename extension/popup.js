// Popup settings logic

document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        autoCopy: document.getElementById('autoCopy'),
        autoSend: document.getElementById('autoSend'),
        audioOnly: document.getElementById('audioOnly'),
        screenShare: document.getElementById('screenShare'),
        callExpiry: document.getElementById('callExpiry'),
        status: document.getElementById('status')
    };

    // Load current settings
    chrome.storage.sync.get({
        autoCopy: true,
        autoSend: false,
        audioOnly: false,
        screenShare: true,
        callExpiry: 15
    }, (settings) => {
        elements.autoCopy.checked = settings.autoCopy;
        elements.autoSend.checked = settings.autoSend;
        elements.audioOnly.checked = settings.audioOnly;
        elements.screenShare.checked = settings.screenShare;
        elements.callExpiry.value = settings.callExpiry;
    });

    // Save settings on change
    function saveSettings() {
        const settings = {
            autoCopy: elements.autoCopy.checked,
            autoSend: elements.autoSend.checked,
            audioOnly: elements.audioOnly.checked,
            screenShare: elements.screenShare.checked,
            callExpiry: parseInt(elements.callExpiry.value, 10)
        };

        chrome.storage.sync.set(settings, () => {
            showStatus('Settings saved');
        });
    }

    function showStatus(message) {
        elements.status.textContent = message;
        setTimeout(() => {
            elements.status.textContent = '';
        }, 2000);
    }

    // Add event listeners
    elements.autoCopy.addEventListener('change', saveSettings);
    elements.autoSend.addEventListener('change', saveSettings);
    elements.audioOnly.addEventListener('change', saveSettings);
    elements.screenShare.addEventListener('change', saveSettings);
    elements.callExpiry.addEventListener('change', saveSettings);

    // Special handling: if auto-send is enabled, auto-copy should also be on
    elements.autoSend.addEventListener('change', () => {
        if (elements.autoSend.checked) {
            elements.autoCopy.checked = true;
        }
    });
});
