# 📹 WPCall - Video Calls for WhatsApp Web

> Make video calls directly from WhatsApp Web. No desktop app required.

---

## 🖼️ Screenshots

### Extension in Action
<img width="923" height="331" alt="image" src="https://github.com/user-attachments/assets/c698fd77-cc1e-4124-8611-bf6b090df6e9" />
<!-- INSERT: Screenshot of WhatsApp Web with the green video call button visible in chat header -->

### Empty Screen Info
<!-- INSERT: Screenshot showing the WPCall info card when no chat is open -->
<img width="1440" height="858" alt="image" src="https://github.com/user-attachments/assets/d91f05aa-532b-4bfb-9f62-656f24e5c5da" />

### Video Call Page
<!-- INSERT: Screenshot of the video call page with both participants -->
<img width="1052" height="700" alt="image" src="https://github.com/user-attachments/assets/485cc154-ffc7-4fb3-a25c-c948bdbef17e" />

### Settings
<!-- INSERT: Screenshot of the extension popup/settings page -->
<img width="486" height="646" alt="image" src="https://github.com/user-attachments/assets/46f09372-5b81-4ad3-8dd4-5d3d62a72edb" />


---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📹 **One-Click Calls** | Hijacks WhatsApp's own video-call button — click and go |
| 🔗 **Native "Send call link"** | Overrides WhatsApp's call-link popup so the shared link is a WPCall link |
| 🔒 **P2P Encrypted** | Direct peer-to-peer calls - no servers touch your media |
| 🖥️ **Screen Sharing** | Share your screen during calls |
| ⚡ **Zero Friction** | Click → Share link → Start talking |
| 🌗 **Native Look** | Sits behind WhatsApp's unchanged icon — no visual clutter |
| 🦊 **Chrome + Firefox** | Ships for Chromium browsers and Firefox |
| ⚙️ **Configurable** | Audio-only mode, link expiry, auto-send options |

---

## 🚀 Quick Start

### Chrome / Brave / Edge

**From a release (recommended):** download `WPCall-<version>.zip` from the [latest release](https://github.com/ajtazer/WPCall/releases/latest), extract it, then:

1. Open `chrome://extensions/` (or `brave://extensions/`)
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the extracted folder

**From source:** clone this repo and Load unpacked the `extension/` folder.

### Firefox

- **Signed** (if available): download `WPCall-firefox-<version>-signed.xpi` from the release and open it in Firefox.
- **Unsigned** (temporary): download `WPCall-firefox-<version>.xpi`, open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select the `.xpi`. (Removed on restart until the add-on is signed via AMO.)

<!-- INSERT: GIF or screenshot showing extension loading process -->

### How to Use

1. **Open** [web.whatsapp.com](https://web.whatsapp.com)
2. **Open** any chat
3. **Click** the 📹 video-call button in the header (or use the keyboard shortcut — `Ctrl+Shift+V`, `⌘+Shift+U` on macOS)
4. Or use the three-dot menu → **Send call link** to drop a WPCall link into the chat
5. **Send** the message and **wait** for the other person to join

<!-- INSERT: GIF showing the full flow from clicking button to starting call -->

---

## ⚙️ Settings

Click the extension icon in your toolbar to access settings:

| Setting | Default | What it does |
|---------|---------|--------------|
| Auto-copy message | ✅ ON | Copies call link to clipboard |
| Auto-send message | ❌ OFF | Sends message automatically |
| Audio-only calls | ❌ OFF | Start with camera off |
| Screen sharing | ✅ ON | Allow screen sharing |
| Link expiry | 15 min | How long links stay valid |

<!-- INSERT: Annotated screenshot of settings panel -->

---

## 🔐 Privacy First

- ✅ **Peer-to-peer** - Your video/audio goes directly to the other person
- ✅ **No data collection** - We don't store messages, contacts, or calls
- ✅ **No accounts needed** - Works instantly
- ✅ **Open source** - Inspect the code yourself

---

## 🛠️ Technical Details

```
WPCall/
├── extension/              # Chrome/Brave + Firefox extension
│   ├── manifest.json       # Chrome (MV3) config
│   ├── manifest.firefox.json # Firefox (MV3) config — swapped in at build time
│   ├── content.js          # WhatsApp Web integration
│   ├── background.js       # Service worker
│   ├── popup.html/js/css   # Settings page
│   └── icons/              # Extension icons
│
├── call-page/              # Video call page (GitHub Pages)
│   ├── index.html          # Call UI
│   ├── call.js             # WebRTC logic
│   └── call.css            # Styling
│
└── signaling-server/       # Cloudflare Workers
    ├── worker.js           # WebSocket signaling
    └── wrangler.toml       # Cloudflare config
```

### How It Works

1. **Extension** hijacks WhatsApp Web's native video-call button and "Send call link" popup
2. **Click** generates a secure room ID + token locally (room registered in the background)
3. **Link/message** pointing at the call page is injected into the chat or popup
4. **Call page** handles the WebRTC connection via the signaling server
5. **P2P connection** established for video/audio

### Tech Stack

| Component | Technology |
|-----------|------------|
| Extension | Manifest V3 (Chrome + Firefox) |
| Call Page | Vanilla JS + WebRTC |
| Signaling | Cloudflare Workers + Durable Objects |
| STUN/TURN | Google STUN + OpenRelay TURN |

---

## 🌐 Deployed Services

| Service | URL |
|---------|-----|
| Call Page | https://call.bihari.xyz |
| Signaling | wpcall-signaling.ajcoolx619.workers.dev |

---

## 📋 Self-Hosting

### Deploy Signaling Server

```bash
cd signaling-server
npm install
npx wrangler login
npx wrangler deploy
```

### Deploy Call Page

Push to GitHub and enable Pages (served at `call.bihari.xyz` via `call-page/CNAME`), or host anywhere static.

### Releases (Chrome + Firefox)

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which builds the Chrome `.zip` and the Firefox `.xpi` and attaches them to the GitHub release.

To also produce a **signed** Firefox `.xpi`, add these repo secrets (from your [AMO API credentials](https://addons.mozilla.org/developers/addon/api/key/)):

| Secret | Value |
|--------|-------|
| `AMO_JWT_ISSUER` | AMO API key (issuer) |
| `AMO_JWT_SECRET` | AMO API secret |

Without them, the signing step is skipped and only the unsigned (temporary-load) `.xpi` is attached.

---

## ⚠️ Disclaimer

This is an **unofficial** third-party extension.  
Not affiliated with WhatsApp or Meta.

Use at your own discretion.

---

## 📄 License

MIT

---

<p align="center">
  Made with ❤️ for WhatsApp Web users who don't want the desktop app
</p>
