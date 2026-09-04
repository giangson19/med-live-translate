# 🏥 MedComms

**Vietnamese–English Medical Speech Translation**

MedComms is a lightweight, dependency-free web client for real-time Vietnamese ↔ English
medical speech translation. A clinician speaks, and the transcription and translation appear
side by side as the words come out — no install, no build step, just a browser and a microphone.

Built by the College of Engineering and Computer Science & the College of Health Sciences,
VinUniversity, as the front end for the [live-translation](../README.md) server.

## ✨ What it does

### Live speech translation
- **Bidirectional**: Vietnamese → English and English → Vietnamese (default: Vietnamese → English)
- **Streaming**: audio is Opus-encoded in the browser and streamed over WebSocket, so partial
  transcriptions and translations arrive while the speaker is still talking
- **One-click swap**: the ⇄ button flips source and target languages

### Interface
- **Two-panel layout**: source (📝) and translation (🌍) side by side, each with its own
  language selector and copy-to-clipboard button
- **Dialogue history**: completed utterances are collected below the panels so a whole
  consultation stays on screen; clear it with one button
- **Connection log**: a collapsible panel showing WebSocket and encoder events, for debugging
- **Responsive**: works on desktop, tablet, and phone
- **Clean medical theme**: high-contrast, distraction-free, designed for use at the bedside

> **Text input mode** exists in the markup but is hidden pending a server-side text-only
> translation endpoint. The `#text-action-btn` button in `index.html` can be unhidden once
> that endpoint lands.

## 🧱 How it is built

No framework, no bundler, no `node_modules` — the app is plain ES modules plus a WASM codec:

```
medical-translation-webapp/
├── index.html              # Markup and layout
├── app.js                  # All application logic (state, WebSocket, audio, UI)
├── styles.css              # Responsive styling and theme tokens
├── worklet-processor.js    # AudioWorklet that captures raw PCM frames
├── config.env.js           # Backend URL, generated at build time (see Configuration)
├── libopus.wasm            # Opus codec WASM binary
├── libopus.wasm.js         # Opus codec JS wrapper
├── AWS_DEPLOYMENT_GUIDE.md # Production deployment on AWS
└── README.md               # This file
```

Audio path: `getUserMedia` → `AudioWorklet` (16 kHz mono, 640-sample / 40 ms frames) →
`libopus` encoder (30 kbps, VoIP profile) → WebSocket → translation server.

## 🚀 Quick start

### Prerequisites

1. **Two translation servers running**, one per direction:
   - port `8765`: Vietnamese → English
   - port `8766`: English → Vietnamese

2. **A secure context for microphone access**. Browsers only grant the mic over HTTPS,
   with `localhost` as the exception — so local development over plain HTTP is fine.

### Start the translation servers

Vietnamese → English:

```bash
live-translate-server \
  --asr_backend phowhisper \
  --whisper_model vinai/PhoWhisper-small \
  --nmt_backend vinai \
  --trans_model vinai/vinai-translate-vi2en-v2 \
  --src_lang vi \
  --tgt_lang en \
  --ws_port 8765
```

English → Vietnamese:

```bash
live-translate-server \
  --asr_backend phowhisper \
  --whisper_model vinai/PhoWhisper-small \
  --nmt_backend vinai \
  --trans_model vinai/vinai-translate-en2vi-v2 \
  --src_lang en \
  --tgt_lang vi \
  --ws_port 8766
```

### Serve the web app

Any static file server works — the app must be served over HTTP(S), not opened as a `file://` URL,
because it loads ES modules and a WASM binary.

```bash
cd medical-translation-webapp
python3 -m http.server 8080      # or: npx http-server -p 8080
```

Then open <http://localhost:8080>.

## 📖 Usage

1. **Pick a direction** with the source/target dropdowns, or hit ⇄ to swap.
2. **Click "Record Audio"**, then **"Start Recording"**.
3. **Grant microphone access** when the browser asks.
4. **Speak.** Transcription fills the left panel, translation the right, updating live.
5. **Click "Stop Recording"** when the turn is over — the completed exchange moves into
   Dialogue History.
6. **Copy** either panel with its clipboard button, or **Clear** the history when done.

If something looks wrong, expand **Connection Log** at the bottom to see what the client saw.

## 🔧 Configuration

### Backend URL

The WebSocket host comes from `window.ENV_CONFIG`, defined in `config.env.js`:

```javascript
window.ENV_CONFIG = {
    BACKEND_URL: 'ws://localhost',
    NODE_ENV: 'development'
};
```

For deployments this file is **generated**, not edited: `build-config.sh` in the repository root
writes it from the `BACKEND_URL` and `NODE_ENV` environment variables during the build. Edit it
directly only for local development.

### Ports and audio settings

Both directions are mapped to ports in `app.js`:

```javascript
const CONFIG = {
    WS_BASE_URL: window.ENV_CONFIG?.BACKEND_URL || 'ws://localhost',
    PORTS: {
        'vi-en': 8765,       // Vietnamese to English
        'en-vi': 8766        // English to Vietnamese
    },
    SAMPLE_RATE: 16000,      // Hz
    CHANNELS: 1,             // Mono
    CHUNK_SIZE: 640,         // Samples per chunk (40 ms)
    CHUNK_SIZE_MS: 40,
    OPUS_BITRATE: 30000,     // bits/s
    APPLICATION_VOIP: true,  // Opus VoIP profile
    MAX_TEXT_LENGTH: 5000    // Max characters for text input
};
```

### Theme

Colors live as custom properties at the top of `styles.css`:

```css
:root {
    --primary-color: #2563eb;     /* Medical blue */
    --secondary-color: #10b981;   /* Success green */
    --accent-color: #f59e0b;      /* Warning amber */
    --error-color: #ef4444;       /* Error red */
}
```

Layout uses CSS Grid and Flexbox, with breakpoints at `768px` (tablet) and `480px` (mobile).

## 🚀 Deployment

Two supported paths, both documented in detail elsewhere in the repo:

- **AWS Amplify** (static hosting for the client): driven by `amplify.yml` at the repository
  root, which runs `build-config.sh` and serves `medical-translation-webapp/` as the site root.
  Set `BACKEND_URL` (e.g. `wss://api.yourdomain.com`) as an Amplify environment variable.
  See [`AMPLIFY_SETUP.md`](../AMPLIFY_SETUP.md).
- **EC2 + NGINX** (client and servers on one host): see
  [`AWS_DEPLOYMENT_GUIDE.md`](./AWS_DEPLOYMENT_GUIDE.md) for the full walkthrough — systemd
  units for both translation servers, NGINX reverse proxy, and Let's Encrypt TLS.

Whichever path you take, serve the app over HTTPS and the WebSocket over `wss://` — a page
loaded over HTTPS cannot open an insecure `ws://` connection, and the microphone requires a
secure context.

Minimal NGINX sketch:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        root /var/www/medical-translation-webapp;
        index index.html;
    }

    location /vi-to-en {
        proxy_pass http://localhost:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }

    location /en-to-vi {
        proxy_pass http://localhost:8766;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

## 🔍 Troubleshooting

**Microphone never prompts, or access is denied**
Serve over HTTPS (or use `localhost`), check the site's mic permission in browser settings,
and try Chrome/Edge if another browser is being strict.

**WebSocket connection failed**
Confirm both servers are listening on `8765` and `8766`, that the firewall allows them, that
`BACKEND_URL` matches the scheme the page is served with (`wss://` on HTTPS), and check the
server logs. The Connection Log panel shows the exact URL the client tried.

**No transcription appears while recording**
The Opus encoder logs `✅ Opus encoder initialized` in the browser console once `libopus.wasm`
loads — if that line is missing, the WASM binary was not served correctly (check the path and
its MIME type).

**Text translation does nothing**
Expected — that mode is hidden and awaiting a server-side text-only endpoint.

## 📱 Browser support

Chrome/Edge 88+ (recommended), Firefox 85+, Safari 14.1+, Opera 74+.

Requires: WebSocket API, Web Audio API, AudioWorklet, WebAssembly, ES modules, CSS Grid.

## 🤝 Contributing

This app is part of the live-translation project. Before opening a PR:

1. Test both language directions end to end against live servers.
2. Check the layout on a phone-sized viewport.
3. Update this README for any change to configuration or deployment.

## 🙏 Acknowledgments

- **VinAI Research** — PhoWhisper and VinAI Translate models
- **OpenAI** — Whisper ASR
- **libopus.wasm** — Opus codec for WebAssembly
- **live-translation** — the backend translation server

## 📄 License

Same license as the parent live-translation project. See [`LICENSE`](../LICENSE).

---

© 2025 College of Engineering and Computer Science & College of Health Sciences, VinUniversity
