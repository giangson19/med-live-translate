# 🏥 Medical Translation Web Application

A modern, responsive web application for real-time Vietnamese ↔ English medical speech translation.

## ✨ Features

### Language Support
- **Bidirectional Translation**: Vietnamese → English and English → Vietnamese
- **One-Click Language Swap**: Easily toggle between source and target languages
- **Default**: Vietnamese → English

### Two Input Modes

#### 1. 📱 Record Audio (Live Translation)
- Real-time speech-to-text transcription
- Live translation as you speak
- Uses WebSocket streaming for low latency
- Opus codec for efficient audio transmission

#### 2. ✍️ Text Input
- Direct text translation
- Character counter (max 5000 characters)
- Medical terminology optimized
- Real-time validation

### User Interface
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Visual States**: Clear indicators for idle, connecting, recording, processing, complete, and error states
- **Two-Panel Layout**: Side-by-side source and translation display
- **Copy to Clipboard**: One-click copy buttons for both transcription and translation
- **Connection Log**: Collapsible log panel for debugging and monitoring
- **Medical Theme**: Clean, professional design optimized for medical use

## 🚀 Quick Start

### Prerequisites

1. **Translation Server Running**: You need the live-translation server running on two ports:
   - Port 8765: Vietnamese → English
   - Port 8766: English → Vietnamese

2. **HTTPS (for microphone access)**: Modern browsers require HTTPS for microphone access. For local development, you can use:
   - `localhost` (Chrome/Edge allow mic access on localhost over HTTP)
   - HTTPS with self-signed certificate
   - HTTPS reverse proxy (nginx)

### Setup Translation Servers

#### Start Vietnamese → English Server
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

#### Start English → Vietnamese Server
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

### Run the Web Application

#### Option 1: Python HTTP Server (Simplest)
```bash
cd medical-translation-webapp
python3 -m http.server 8080
```

Then open: `http://localhost:8080`

#### Option 2: Node.js HTTP Server
```bash
cd medical-translation-webapp
npx http-server -p 8080
```

Then open: `http://localhost:8080`

#### Option 3: VS Code Live Server
1. Install "Live Server" extension in VS Code
2. Right-click `index.html`
3. Select "Open with Live Server"

## 📖 Usage Guide

### 1. Record Audio Mode

1. **Select Language Direction**: Click on the language selector to choose Vietnamese → English or English → Vietnamese
2. **Start Recording**: Click the "Start Recording" button
3. **Allow Microphone Access**: Grant permission when browser prompts
4. **Speak**: Start speaking in the source language
5. **View Results**: Transcription and translation appear in real-time
6. **Stop Recording**: Click "Stop Recording" when done
7. **Copy Results**: Use copy buttons to save transcription or translation

### 2. Text Input Mode

1. **Select Language Direction**: Choose your translation direction
2. **Enter Text**: Type or paste medical text (max 5000 characters)
3. **Translate**: Click "Translate Text" button
4. **View Results**: Translation appears in the target panel
5. **Copy Results**: Use copy buttons to save results

## 🔧 Configuration

### WebSocket Server Ports

Edit `app.js` to change server ports:

```javascript
const CONFIG = {
    WS_BASE_URL: 'ws://localhost',
    PORTS: {
        'vi-en': 8765,  // Vietnamese to English
        'en-vi': 8766   // English to Vietnamese
    },
    // ... other settings
};
```

### Audio Settings

```javascript
const CONFIG = {
    SAMPLE_RATE: 16000,      // Audio sample rate (Hz)
    CHANNELS: 1,             // Mono audio
    CHUNK_SIZE: 640,         // Samples per chunk
    OPUS_BITRATE: 30000,     // Opus encoding bitrate
    MAX_TEXT_LENGTH: 5000    // Max characters for text input
};
```

## 🎨 Customization

### Theme Colors

Edit `styles.css` to customize colors:

```css
:root {
    --primary-color: #2563eb;     /* Medical blue */
    --secondary-color: #10b981;   /* Success green */
    --accent-color: #f59e0b;      /* Warning amber */
    --error-color: #ef4444;       /* Error red */
    /* ... more colors */
}
```

### Layout

The application uses CSS Grid and Flexbox for responsive layout. Modify breakpoints in `styles.css`:

```css
@media (max-width: 768px) {
    /* Tablet styles */
}

@media (max-width: 480px) {
    /* Mobile styles */
}
```

## 🔍 Troubleshooting

### Microphone Not Working

**Issue**: Browser doesn't request microphone permission or access is denied

**Solutions**:
1. **Use HTTPS**: Modern browsers require HTTPS for microphone access (localhost is exception)
2. **Check Browser Settings**: Ensure microphone permissions are enabled for your site
3. **Try Different Browser**: Some browsers have stricter security policies

### WebSocket Connection Failed

**Issue**: Cannot connect to translation server

**Solutions**:
1. **Check Server Running**: Ensure both translation servers are running on ports 8765 and 8766
2. **Check Firewall**: Allow connections on ports 8765 and 8766
3. **Check Server Logs**: Look for errors in server output
4. **Verify Ports**: Make sure ports match configuration in `app.js`

### Text Translation Not Working

**Issue**: Text input doesn't translate

**Solutions**:
1. **Character Limit**: Ensure text is under 5000 characters
2. **Server Endpoint**: Current implementation requires server-side text-only endpoint (see Note below)

**Note**: The current text translation mode is a placeholder. For production use, implement a dedicated text-only translation endpoint on the server side.

## 📱 Browser Compatibility

### Supported Browsers

- ✅ Chrome/Edge 88+ (recommended)
- ✅ Firefox 85+
- ✅ Safari 14.1+
- ✅ Opera 74+

### Required Browser Features

- WebSocket API
- Web Audio API
- AudioWorklet
- MediaRecorder API
- ES6+ JavaScript
- CSS Grid and Flexbox

## 🚀 Deployment

### Local Development

See [Quick Start](#-quick-start) section above.

### Production Deployment (EC2)

1. **Setup Servers**: Follow the deployment plan in `.claude/plans/tidy-seeking-pearl.md`

2. **Configure NGINX**: Setup reverse proxy for WebSocket and HTTPS

3. **SSL Certificate**: Use Let's Encrypt for free SSL certificates

4. **Systemd Services**: Create services for both translation servers

5. **Update Configuration**: Change `WS_BASE_URL` in `app.js` to your domain

Example NGINX configuration:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Serve web app
    location / {
        root /var/www/medical-translation-webapp;
        index index.html;
    }

    # WebSocket for vi→en (port 8765)
    location /vi-to-en {
        proxy_pass http://localhost:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }

    # WebSocket for en→vi (port 8766)
    location /en-to-vi {
        proxy_pass http://localhost:8766;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

## 📁 Project Structure

```
medical-translation-webapp/
├── index.html              # Main HTML structure
├── app.js                  # Application logic
├── styles.css              # Responsive styling
├── worklet-processor.js    # Audio worklet processor
├── libopus.wasm           # Opus codec WASM binary
├── libopus.wasm.js        # Opus codec JavaScript wrapper
└── README.md              # This file
```

## 🤝 Contributing

This application is part of the live-translation project. For contributions:

1. Test thoroughly with both language directions
2. Ensure responsive design works on mobile
3. Verify both input modes function correctly
4. Update documentation for any configuration changes

## 📄 License

Same license as the parent live-translation project.

## 🙏 Acknowledgments

- **VinAI Research**: PhoWhisper and VinAI Translate models
- **OpenAI**: Whisper ASR model
- **libopus.wasm**: Opus audio codec for WebAssembly
- **live-translation**: Backend translation server

## 📞 Support

For issues or questions:
1. Check the [Troubleshooting](#-troubleshooting) section
2. Review server logs for errors
3. Consult the main live-translation repository documentation

---

**Last Updated**: 2025-12-14
