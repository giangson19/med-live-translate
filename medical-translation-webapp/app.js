/**
 * Medical Translation Web Application
 * Vietnamese ↔ English Speech Translation
 */

// Configuration
const CONFIG = {
    WS_BASE_URL: 'ws://localhost',
    PORTS: {
        'vi-en': 8765,  // Vietnamese to English
        'en-vi': 8766   // English to Vietnamese
    },
    SAMPLE_RATE: 16000,
    CHANNELS: 1,
    CHUNK_SIZE: 640,
    CHUNK_SIZE_MS: 40,
    OPUS_BITRATE: 30000,
    APPLICATION_VOIP: true,
    MAX_TEXT_LENGTH: 5000
};

// Application State
const state = {
    currentLanguage: 'vi-en', // 'vi-en' or 'en-vi'
    currentMode: 'record',    // 'record', 'upload', or 'text'
    isRecording: false,
    isProcessing: false,
    ws: null,
    audioContext: null,
    audioWorkletNode: null,
    mediaStream: null,
    audioBuffer: [],
    encoder: null,
    currentFile: null,
    history: []  // Store dialogue history
};

// Language configuration
const LANGUAGES = {
    'vi-en': {
        source: { code: 'VI', name: 'Vietnamese' },
        target: { code: 'EN', name: 'English' },
        port: 8765
    },
    'en-vi': {
        source: { code: 'EN', name: 'English' },
        target: { code: 'VI', name: 'Vietnamese' },
        port: 8766
    }
};

// Initialize Opus encoder when library loads
libopus.onload = () => {
    state.encoder = new libopus.Encoder(
        CONFIG.CHANNELS,
        CONFIG.SAMPLE_RATE,
        CONFIG.OPUS_BITRATE,
        CONFIG.CHUNK_SIZE_MS,
        CONFIG.APPLICATION_VOIP
    );
    log('✅ Opus encoder initialized');
};

// DOM Elements
const elements = {
    // Language dropdowns
    sourceLanguage: document.getElementById('source-language'),
    targetLanguage: document.getElementById('target-language'),
    switchBtn: document.getElementById('switch-languages'),

    // Action buttons
    actionButtons: document.getElementById('action-buttons'),
    recordActionBtn: document.getElementById('record-action-btn'),
    uploadActionBtn: document.getElementById('upload-action-btn'),
    textActionBtn: document.getElementById('text-action-btn'),

    // Interfaces
    recordInterface: document.getElementById('record-interface'),
    uploadInterface: document.getElementById('upload-interface'),
    textInterface: document.getElementById('text-interface'),

    // Back buttons
    recordBackBtn: document.getElementById('record-back-btn'),
    uploadBackBtn: document.getElementById('upload-back-btn'),
    textBackBtn: document.getElementById('text-back-btn'),

    // Record controls
    toggleRecordBtn: document.getElementById('toggle-record-btn'),
    uploadArea: document.getElementById('upload-area'),
    audioFile: document.getElementById('audio-file'),
    processAudioBtn: document.getElementById('process-audio-btn'),

    // Text controls
    textInput: document.getElementById('text-input'),
    charCount: document.getElementById('char-count'),
    translateBtn: document.getElementById('translate-btn'),

    // Output panels
    sourceTitle: document.getElementById('source-title'),
    targetTitle: document.getElementById('target-title'),
    sourceContent: document.getElementById('source-content'),
    sourceOutput: document.getElementById('source-output'),
    sourceText: document.getElementById('source-text'),
    targetContent: document.getElementById('target-content'),
    copySource: document.getElementById('copy-source'),
    copyTarget: document.getElementById('copy-target'),

    // Log
    logToggle: document.getElementById('log-toggle'),
    logContent: document.getElementById('log-content'),

    // History
    historyContent: document.getElementById('history-content'),
    clearHistoryBtn: document.getElementById('clear-history-btn')
};

// ====================
// Language Functions
// ====================

function updateLanguageUI() {
    const lang = LANGUAGES[state.currentLanguage];

    // Update dropdowns
    elements.sourceLanguage.value = lang.source.code.toLowerCase();
    elements.targetLanguage.value = lang.target.code.toLowerCase();

    // Update text input placeholder
    elements.textInput.placeholder = `Enter ${lang.source.name.toLowerCase()} medical text to translate...`;

    log(`🌐 Language direction: ${lang.source.name} → ${lang.target.name}`);
}

function switchLanguages() {
    state.currentLanguage = state.currentLanguage === 'vi-en' ? 'en-vi' : 'vi-en';
    updateLanguageUI();

    // Clear outputs when language changes
    clearOutputs();

    // If recording, stop it
    if (state.isRecording) {
        stopRecording();
    }
}

function updateLanguageFromDropdowns() {
    const sourceLang = elements.sourceLanguage.value;
    const targetLang = elements.targetLanguage.value;

    // Determine the language direction
    if (sourceLang === 'vi' && targetLang === 'en') {
        state.currentLanguage = 'vi-en';
    } else if (sourceLang === 'en' && targetLang === 'vi') {
        state.currentLanguage = 'en-vi';
    } else {
        // If both are the same or invalid combination, default to vi-en
        state.currentLanguage = 'vi-en';
        updateLanguageUI();
        return;
    }

    log(`🌐 Language direction: ${LANGUAGES[state.currentLanguage].source.name} → ${LANGUAGES[state.currentLanguage].target.name}`);

    // Clear outputs when language changes
    clearOutputs();

    // If recording, stop it
    if (state.isRecording) {
        stopRecording();
    }
}

// ====================
// Mode Functions
// ====================

function showInterface(type) {
    if (state.isRecording) {
        stopRecording();
    }

    state.currentMode = type;

    // Hide action buttons
    elements.actionButtons.style.display = 'none';

    // Hide all interfaces
    elements.recordInterface.style.display = 'none';
    elements.uploadInterface.style.display = 'none';
    elements.textInterface.style.display = 'none';

    // Show selected interface
    if (type === 'record') {
        elements.recordInterface.style.display = 'flex';
    } else if (type === 'upload') {
        elements.uploadInterface.style.display = 'flex';
    } else if (type === 'text') {
        elements.textInterface.style.display = 'flex';
    }

    // Clear outputs
    clearOutputs();

    log(`🔄 Switched to ${type} mode`);
}

function showActionButtons() {
    if (state.isRecording) {
        stopRecording();
    }

    // Show action buttons
    elements.actionButtons.style.display = 'flex';

    // Hide all interfaces
    elements.recordInterface.style.display = 'none';
    elements.uploadInterface.style.display = 'none';
    elements.textInterface.style.display = 'none';

    // Clear outputs
    clearOutputs();
}

// ====================
// Logging
// ====================

function log(message) {
    const timestamp = new Date().toLocaleTimeString();
    elements.logContent.innerHTML += `<div class="log-entry">[${timestamp}] ${message}</div>`;
    elements.logContent.scrollTop = elements.logContent.scrollHeight;
}

// ====================
// Output Functions
// ====================

function clearOutputs() {
    if (elements.sourceOutput) {
        elements.sourceOutput.style.display = 'none';
    }
    elements.targetContent.innerHTML = '<p class="empty-state">No translation yet</p>';
    elements.copySource.disabled = true;
    elements.copyTarget.disabled = true;
}

function updateOutput(transcription, translation) {
    if (transcription) {
        if (elements.sourceText) {
            elements.sourceText.textContent = transcription;
            elements.sourceOutput.style.display = 'block';
        }
        elements.copySource.disabled = false;
    }

    if (translation) {
        elements.targetContent.innerHTML = `<p class="output-text">${escapeHtml(translation)}</p>`;
        elements.copyTarget.disabled = false;
    }

    // Add to history if both are available
    if (transcription && translation) {
        addToHistory(transcription, translation);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ====================
// Recording Functions
// ====================

async function startRecording() {
    if (state.isRecording) return;

    elements.toggleRecordBtn.disabled = true;
    log('🔄 Connecting to server...');

    try {
        // Connect to WebSocket
        const wsUrl = `${CONFIG.WS_BASE_URL}:${LANGUAGES[state.currentLanguage].port}`;
        state.ws = new WebSocket(wsUrl);

        await new Promise((resolve, reject) => {
            state.ws.onopen = resolve;
            state.ws.onerror = () => reject(new Error('WebSocket connection failed'));
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });

        log('✅ Connected to server');
        log('🎤 Starting microphone...');

        // Get microphone access
        state.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: CONFIG.SAMPLE_RATE,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        // Create AudioContext
        state.audioContext = new AudioContext({ sampleRate: CONFIG.SAMPLE_RATE });
        log(`🎤 AudioContext sample rate: ${state.audioContext.sampleRate} Hz`);

        // Add audio worklet
        await state.audioContext.audioWorklet.addModule('worklet-processor.js');
        state.audioWorkletNode = new AudioWorkletNode(state.audioContext, 'pcm-processor');

        // Connect audio pipeline
        const source = state.audioContext.createMediaStreamSource(state.mediaStream);
        source.connect(state.audioWorkletNode);
        state.audioWorkletNode.connect(state.audioContext.destination);

        // Handle audio data
        state.audioWorkletNode.port.onmessage = handleAudioData;

        // Handle WebSocket messages
        state.ws.onmessage = handleWebSocketMessage;

        state.ws.onerror = () => {
            log('❌ WebSocket error');
            stopRecording();
        };

        state.ws.onclose = () => {
            log('🔌 WebSocket closed');
            if (state.isRecording) {
                stopRecording();
            }
        };

        state.isRecording = true;
        elements.toggleRecordBtn.disabled = false;
        elements.toggleRecordBtn.classList.add('recording');
        elements.toggleRecordBtn.querySelector('.toggle-text').textContent = 'Stop Recording';
        log('🎙️ Recording started');

    } catch (error) {
        log(`❌ Error: ${error.message}`);
        elements.toggleRecordBtn.disabled = false;
        elements.toggleRecordBtn.classList.remove('recording');
        elements.toggleRecordBtn.querySelector('.toggle-text').textContent = 'Start Recording';

        // Clean up
        if (state.ws) state.ws.close();
        if (state.audioWorkletNode) state.audioWorkletNode.disconnect();
        if (state.audioContext) state.audioContext.close();
        if (state.mediaStream) state.mediaStream.getTracks().forEach(t => t.stop());
    }
}

function stopRecording() {
    if (!state.isRecording) return;

    state.isRecording = false;

    // Close WebSocket
    if (state.ws) {
        state.ws.close();
        state.ws = null;
    }

    // Stop audio
    if (state.audioWorkletNode) {
        state.audioWorkletNode.disconnect();
        state.audioWorkletNode = null;
    }

    if (state.audioContext) {
        state.audioContext.close();
        state.audioContext = null;
    }

    if (state.mediaStream) {
        state.mediaStream.getTracks().forEach(track => track.stop());
        state.mediaStream = null;
    }

    // Reset buffer
    state.audioBuffer = [];

    // Update UI
    elements.toggleRecordBtn.disabled = false;
    elements.toggleRecordBtn.classList.remove('recording');
    elements.toggleRecordBtn.querySelector('.toggle-text').textContent = 'Start Recording';
    log('🛑 Recording stopped');
}

function handleAudioData(event) {
    const floatSamples = event.data;

    // Downsample if necessary
    const downsampled = downsampleBuffer(
        floatSamples,
        state.audioContext.sampleRate,
        CONFIG.SAMPLE_RATE
    );

    // Convert to Int16
    const int16 = new Int16Array(downsampled.length);
    for (let i = 0; i < downsampled.length; i++) {
        int16[i] = Math.max(-1, Math.min(1, downsampled[i])) * 0x7fff;
    }

    // Add to buffer
    state.audioBuffer.push(...int16);

    // Encode and send chunks
    while (state.audioBuffer.length >= CONFIG.CHUNK_SIZE) {
        const chunk = new Int16Array(state.audioBuffer.slice(0, CONFIG.CHUNK_SIZE));

        // Encode with Opus
        state.encoder.input(chunk);
        const encoded = state.encoder.output();

        if (encoded && state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(encoded);
        }

        // Remove processed chunk
        state.audioBuffer = state.audioBuffer.slice(CONFIG.CHUNK_SIZE);
    }
}

function handleWebSocketMessage(event) {
    try {
        const msg = JSON.parse(event.data);

        if (msg.transcription || msg.translation) {
            updateOutput(msg.transcription, msg.translation);

            if (msg.transcription) {
                log(`📝 Transcription: ${msg.transcription.substring(0, 50)}...`);
            }
            if (msg.translation) {
                log(`🌍 Translation: ${msg.translation.substring(0, 50)}...`);
            }
        }
    } catch (error) {
        log(`❌ Failed to parse message: ${error.message}`);
    }
}

function downsampleBuffer(buffer, inputRate, targetRate) {
    if (inputRate === targetRate) return buffer;

    const ratio = inputRate / targetRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);

    let offset = 0;
    for (let i = 0; i < newLength; i++) {
        const nextOffset = Math.round((i + 1) * ratio);
        let sum = 0, count = 0;

        for (let j = offset; j < nextOffset && j < buffer.length; j++) {
            sum += buffer[j];
            count++;
        }

        result[i] = sum / count;
        offset = nextOffset;
    }

    return result;
}

// ====================
// Upload Audio Functions
// ====================

function handleFileSelect(file) {
    if (!file) return;

    state.currentFile = file;
    elements.uploadArea.querySelector('.upload-text').textContent = `📁 ${file.name}`;
    elements.processAudioBtn.disabled = false;
    log(`📂 File selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
}

async function processAudioFile() {
    if (!state.currentFile) return;

    elements.processAudioBtn.disabled = true;
    log('⚙️ Processing audio file...');

    try {
        // Read file as ArrayBuffer
        const arrayBuffer = await state.currentFile.arrayBuffer();

        // Decode audio
        const audioContext = new AudioContext({ sampleRate: CONFIG.SAMPLE_RATE });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        log(`🎵 Audio loaded: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate} Hz`);

        // Get audio data
        let audioData = audioBuffer.getChannelData(0); // Get first channel

        // Resample to 16kHz if needed
        if (audioBuffer.sampleRate !== CONFIG.SAMPLE_RATE) {
            audioData = downsampleBuffer(audioData, audioBuffer.sampleRate, CONFIG.SAMPLE_RATE);
            log(`⚙️ Resampled to ${CONFIG.SAMPLE_RATE} Hz`);
        }

        // Connect to WebSocket
        const wsUrl = `${CONFIG.WS_BASE_URL}:${LANGUAGES[state.currentLanguage].port}`;
        const ws = new WebSocket(wsUrl);

        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = () => reject(new Error('WebSocket connection failed'));
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });

        log('✅ Connected to server');

        // Handle responses
        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.transcription || msg.translation) {
                    updateOutput(msg.transcription, msg.translation);
                }
            } catch (error) {
                log(`❌ Failed to parse message: ${error.message}`);
            }
        };

        // Initialize encoder
        const encoder = new libopus.Encoder(
            CONFIG.CHANNELS,
            CONFIG.SAMPLE_RATE,
            CONFIG.OPUS_BITRATE,
            CONFIG.CHUNK_SIZE_MS,
            CONFIG.APPLICATION_VOIP
        );

        // Convert to Int16 and send in chunks
        const int16Data = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
            int16Data[i] = Math.max(-1, Math.min(1, audioData[i])) * 0x7fff;
        }

        // Send chunks
        let offset = 0;
        const sendChunk = () => {
            if (offset >= int16Data.length) {
                log('✅ Audio file processed');
                ws.close();
                audioContext.close();
                elements.processAudioBtn.disabled = false;
                return;
            }

            const chunk = int16Data.slice(offset, offset + CONFIG.CHUNK_SIZE);
            encoder.input(chunk);
            const encoded = encoder.output();

            if (encoded && ws.readyState === WebSocket.OPEN) {
                ws.send(encoded);
            }

            offset += CONFIG.CHUNK_SIZE;

            // Continue sending with slight delay
            setTimeout(sendChunk, CONFIG.CHUNK_SIZE_MS);
        };

        sendChunk();

    } catch (error) {
        log(`❌ Error processing file: ${error.message}`);
        elements.processAudioBtn.disabled = false;
    }
}

// ====================
// Text Input Functions
// ====================

function handleTextInput() {
    const text = elements.textInput.value;
    const length = text.length;

    elements.charCount.textContent = `${length} / ${CONFIG.MAX_TEXT_LENGTH}`;
    elements.translateBtn.disabled = length === 0 || length > CONFIG.MAX_TEXT_LENGTH;

    if (length > CONFIG.MAX_TEXT_LENGTH) {
        elements.charCount.classList.add('error');
    } else {
        elements.charCount.classList.remove('error');
    }
}

async function translateText() {
    const text = elements.textInput.value.trim();
    if (!text) return;

    elements.translateBtn.disabled = true;
    log('⚙️ Translating text...');

    try {
        // Connect to WebSocket
        const wsUrl = `${CONFIG.WS_BASE_URL}:${LANGUAGES[state.currentLanguage].port}`;
        const ws = new WebSocket(wsUrl);

        await new Promise((resolve, reject) => {
            ws.onopen = resolve;
            ws.onerror = () => reject(new Error('WebSocket connection failed'));
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });

        log('✅ Connected to server');

        // Handle responses
        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.transcription || msg.translation) {
                    updateOutput(msg.transcription || text, msg.translation);
                    log('✅ Text translated');
                    ws.close();
                }
            } catch (error) {
                log(`❌ Failed to parse message: ${error.message}`);
            }
        };

        // Convert text to audio and send (or implement direct text translation API)
        // For now, this shows transcription as source and waits for translation
        // You may need to implement a separate text-only endpoint on the server

        // Placeholder: Update source with input text
        updateOutput(text, '');

        log('⚠️ Note: Text translation requires server-side text-only endpoint');
        elements.translateBtn.disabled = false;

    } catch (error) {
        log(`❌ Error: ${error.message}`);
        elements.translateBtn.disabled = false;
    }
}

// ====================
// Copy Functions
// ====================

async function copyToClipboard(text, type) {
    try {
        await navigator.clipboard.writeText(text);
        log(`📋 ${type} copied to clipboard`);

        // Visual feedback
        const btn = type === 'Source' ? elements.copySource : elements.copyTarget;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>`;

        setTimeout(() => {
            btn.innerHTML = originalHTML;
        }, 2000);

    } catch (error) {
        log(`❌ Failed to copy ${type.toLowerCase()}`);
    }
}

// ====================
// History Functions
// ====================

function addToHistory(source, target) {
    const timestamp = new Date().toLocaleString();
    const lang = LANGUAGES[state.currentLanguage];
    
    const historyItem = {
        timestamp,
        source,
        target,
        sourceLanguage: lang.source.name,
        targetLanguage: lang.target.name
    };

    // Add to beginning of array (newest first)
    state.history.unshift(historyItem);

    // Keep only last 10 items
    if (state.history.length > 10) {
        state.history = state.history.slice(0, 10);
    }

    renderHistory();
}

function renderHistory() {
    if (state.history.length === 0) {
        elements.historyContent.innerHTML = '<p class="empty-history">No dialogue history yet</p>';
        return;
    }

    const historyHTML = state.history.map(item => `
        <div class="history-item">
            <div class="history-timestamp">${item.timestamp}</div>
            <div class="history-text">
                <div class="history-label">${item.sourceLanguage}:</div>
                <div class="history-value">${escapeHtml(item.source)}</div>
            </div>
            <div class="history-text">
                <div class="history-label">${item.targetLanguage}:</div>
                <div class="history-value">${escapeHtml(item.target)}</div>
            </div>
        </div>
    `).join('');

    elements.historyContent.innerHTML = historyHTML;
}

function clearHistory() {
    state.history = [];
    renderHistory();
    log('🗑️ History cleared');
}

// ====================
// Event Listeners
// ====================

// Language dropdowns
elements.sourceLanguage.addEventListener('change', () => {
    // Update target to be the opposite
    const sourceLang = elements.sourceLanguage.value;
    elements.targetLanguage.value = sourceLang === 'vi' ? 'en' : 'vi';
    updateLanguageFromDropdowns();
});

elements.targetLanguage.addEventListener('change', () => {
    // Update source to be the opposite
    const targetLang = elements.targetLanguage.value;
    elements.sourceLanguage.value = targetLang === 'vi' ? 'en' : 'vi';
    updateLanguageFromDropdowns();
});

elements.switchBtn.addEventListener('click', switchLanguages);

// Action buttons
elements.recordActionBtn.addEventListener('click', () => {
    showInterface('record');
    // Start recording immediately
    startRecording();
});
elements.uploadActionBtn.addEventListener('click', () => showInterface('upload'));
elements.textActionBtn.addEventListener('click', () => showInterface('text'));

// Back buttons
elements.recordBackBtn.addEventListener('click', showActionButtons);
elements.uploadBackBtn.addEventListener('click', showActionButtons);
elements.textBackBtn.addEventListener('click', showActionButtons);

// Record controls
elements.toggleRecordBtn.addEventListener('click', () => {
    if (state.isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
});

// Upload controls
elements.uploadArea.addEventListener('click', () => {
    elements.audioFile.click();
});

elements.uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.add('dragover');
});

elements.uploadArea.addEventListener('dragleave', () => {
    elements.uploadArea.classList.remove('dragover');
});

elements.uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
        elements.audioFile.files = e.dataTransfer.files;
        handleFileSelect(file);
    } else {
        log('❌ Please drop an audio file');
    }
});

elements.audioFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFileSelect(file);
    }
});

elements.processAudioBtn.addEventListener('click', processAudioFile);

// Drag and drop on entire source panel
elements.sourceContent.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    elements.sourceContent.classList.add('dragover');
});

elements.sourceContent.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only remove if we're leaving the source content entirely
    if (e.target === elements.sourceContent) {
        elements.sourceContent.classList.remove('dragover');
    }
});

elements.sourceContent.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    elements.sourceContent.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
        // Show upload interface and handle the file
        showInterface('upload');
        elements.audioFile.files = e.dataTransfer.files;
        handleFileSelect(file);
        log('📁 Audio file dropped');
    } else {
        log('❌ Please drop an audio file');
    }
});

// Text input controls
elements.textInput.addEventListener('input', handleTextInput);
elements.translateBtn.addEventListener('click', translateText);

// Copy buttons
elements.copySource.addEventListener('click', () => {
    const text = elements.sourceText ? elements.sourceText.textContent : '';
    if (text) {
        copyToClipboard(text, 'Source');
    }
});

elements.copyTarget.addEventListener('click', () => {
    const text = elements.targetContent.textContent;
    if (text && text !== 'No translation yet') {
        copyToClipboard(text, 'Translation');
    }
});

// Log toggle
elements.logToggle.addEventListener('click', () => {
    elements.logContent.classList.toggle('collapsed');
    const isCollapsed = elements.logContent.classList.contains('collapsed');
    elements.logToggle.querySelector('svg').style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)'
});

// History clear button
elements.clearHistoryBtn.addEventListener('click', clearHistory);

// ====================
// Initialize
// ====================

function initialize() {
    updateLanguageUI();
    log('🚀 Medical Translation App initialized');
    log(`📡 Server ports: VI→EN (${CONFIG.PORTS['vi-en']}), EN→VI (${CONFIG.PORTS['en-vi']})`);
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
