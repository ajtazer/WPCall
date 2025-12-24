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
| 📹 **One-Click Calls** | Video call button injected right into WhatsApp Web |
| 🔒 **P2P Encrypted** | Direct peer-to-peer calls - no servers touch your media |
| 🖥️ **Screen Sharing** | Share your screen during calls |
| ⚡ **Zero Friction** | Click → Share link → Start talking |
| 🌗 **Native Look** | Matches WhatsApp's design automatically |
| ⚙️ **Configurable** | Audio-only mode, link expiry, auto-send options |

---

## 🚀 Quick Start

### Install the Extension

1. Download or clone this repo
2. Open `chrome://extensions/` (or `brave://extensions/`)
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `extension` folder

<!-- INSERT: GIF or screenshot showing extension loading process -->

### How to Use

1. **Open** [web.whatsapp.com](https://web.whatsapp.com)
2. **Open** any chat
3. **Click** the green 📹 button in the header
4. **Send** the auto-generated message
5. **Wait** for the other person to join

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
├── extension/              # Chrome/Brave extension
│   ├── manifest.json       # Extension config
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

1. **Extension** injects a call button into WhatsApp Web
2. **Click** generates a secure room ID + token
3. **Message** with call link is pasted to chat
4. **Call page** handles WebRTC connection via signaling server
5. **P2P connection** established for video/audio

### Tech Stack

| Component | Technology |
|-----------|------------|
| Extension | Chrome Manifest V3 |
| Call Page | Vanilla JS + WebRTC |
| Signaling | Cloudflare Workers + Durable Objects |
| STUN/TURN | Google STUN + OpenRelay TURN |

---

## 🌐 Deployed Services

| Service | URL |
|---------|-----|
| Call Page | https://ajtazer.github.io/WPCall/ |
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

Push to GitHub and enable Pages, or host anywhere static.

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
