# Call for WhatsApp Web

> Video calls for WhatsApp Web.

A Chrome extension that adds native-looking video call functionality to WhatsApp Web using WebRTC P2P calling.

## Features

- 📹 Video call button injected directly into WhatsApp Web chat header
- 🔒 Secure P2P calls using WebRTC (STUN + TURN)
- 📋 Auto-copy and paste call message to chat
- ⚙️ Configurable settings (audio-only, screen sharing, link expiry)
- 🌗 Automatic light/dark mode support
- ⌨️ Keyboard shortcut support (Ctrl/Cmd + Shift + V)

## Project Structure

```
WPCall/
├── extension/           # Chrome extension
│   ├── manifest.json    # Extension manifest
│   ├── content.js       # DOM injection script
│   ├── background.js    # Service worker
│   ├── styles.css       # Injected styles
│   ├── popup.html/js/css # Settings page
│   └── icons/           # Extension icons
├── call-page/           # Video call page (GitHub Pages)
│   ├── index.html
│   ├── call.js          # WebRTC implementation
│   └── call.css
└── signaling-server/    # Cloudflare Workers
    ├── worker.js        # Signaling server
    ├── wrangler.toml    # Cloudflare config
    └── package.json
```

## Installation

### 1. Deploy Signaling Server

```bash
cd signaling-server
npm install
npx wrangler deploy
```

### 2. Deploy Call Page

Push the `call-page` folder to GitHub and enable GitHub Pages, or:

```bash
# The call page will be available at:
# https://ajtazer.github.io/WPCall/call-page/
```

### 3. Load Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` folder

## Usage

1. Open [WhatsApp Web](https://web.whatsapp.com/)
2. Open a chat
3. Click the video call button in the chat header
4. The call message is copied and pasted to the chat
5. The call page opens in a new tab
6. Share the link with the other person!

## Configuration

Click the extension icon to access settings:

- **Auto-copy message**: Copy call message to clipboard (ON by default)
- **Auto-send message**: Automatically send the message (OFF by default)
- **Audio-only calls**: Start with video disabled
- **Screen sharing**: Allow sharing your screen
- **Link expiry**: How long call links are valid (5-60 min)

## Technical Details

- **WebRTC**: P2P video/audio with STUN + TURN servers
- **Signaling**: Cloudflare Workers with Durable Objects
- **Extension**: Manifest V3 with content scripts
- **Styling**: Uses WhatsApp's CSS variables for native look

## License

MIT
