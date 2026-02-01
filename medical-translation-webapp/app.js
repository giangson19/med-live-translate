/**
 * Medical Translation Web Application
 * Vietnamese ↔ English Speech Translation
 */

// Configuration
const CONFIG = {
    // Use environment variable if available, otherwise fall back to localhost
    WS_BASE_URL: window.ENV_CONFIG?.BACKEND_URL || 'ws://localhost',
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

// Log configuration for debugging
console.log('🔧 Configuration:', {
    environment: window.ENV_CONFIG?.NODE_ENV || 'development',
    backendUrl: CONFIG.WS_BASE_URL,
    ports: CONFIG.PORTS
});

// Application State
const state = {
    currentLanguage: 'vi-en', // 'vi-en' or 'en-vi'
    currentMode: 'record',    // 'record' or 'text'
    isRecording: false,
    isProcessing: false,
    ws: null,
    audioContext: null,
    audioWorkletNode: null,
    mediaStream: null,
    audioBuffer: [],
    encoder: null,
    history: [],  // Store dialogue history
    // Track current pending transcription/translation (for sentence detection)
    pendingTranscription: '',
    pendingTranslation: ''
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
    textActionBtn: document.getElementById('text-action-btn'),

    // Interfaces
    recordInterface: document.getElementById('record-interface'),
    textInterface: document.getElementById('text-interface'),

    // Back buttons
    recordBackBtn: document.getElementById('record-back-btn'),
    textBackBtn: document.getElementById('text-back-btn'),

    // Record controls
    toggleRecordBtn: document.getElementById('toggle-record-btn'),

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
    elements.textInterface.style.display = 'none';

    // Show selected interface
    if (type === 'record') {
        elements.recordInterface.style.display = 'flex';
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
    // Detect if this is a new sentence (not a continuation of the previous one)
    if (transcription && state.pendingTranscription) {
        const isNewSentence = !isContinuation(state.pendingTranscription, transcription);

        if (isNewSentence && state.pendingTranscription && state.pendingTranslation) {
            // Save the previous completed sentence to history
            addToHistory(state.pendingTranscription, state.pendingTranslation);
            log('📌 Sentence completed, added to history');
        }
    }

    // Update the display
    if (transcription) {
        if (elements.sourceText) {
            elements.sourceText.textContent = transcription;
            elements.sourceOutput.style.display = 'block';
        }
        elements.copySource.disabled = false;
        state.pendingTranscription = transcription;
    }

    if (translation) {
        elements.targetContent.innerHTML = `<p class="output-text">${escapeHtml(translation)}</p>`;
        elements.copyTarget.disabled = false;
        state.pendingTranslation = translation;
    }
}

/**
 * Check if newText is a continuation/update of oldText
 * Returns true if newText extends or refines oldText (same sentence)
 * Returns false if newText is a completely new sentence
 */
function isContinuation(oldText, newText) {
    if (!oldText || !newText) return false;

    // Normalize texts for comparison
    const oldNorm = oldText.trim().toLowerCase();
    const newNorm = newText.trim().toLowerCase();

    // If new text starts with old text, it's a continuation
    if (newNorm.startsWith(oldNorm.substring(0, Math.min(oldNorm.length, 20)))) {
        return true;
    }

    // If old text starts with new text (refinement/correction), it's still the same sentence
    if (oldNorm.startsWith(newNorm.substring(0, Math.min(newNorm.length, 20)))) {
        return true;
    }

    // Check for significant word overlap (handles minor corrections)
    const oldWords = oldNorm.split(/\s+/).slice(0, 5); // First 5 words
    const newWords = newNorm.split(/\s+/).slice(0, 5);

    if (oldWords.length > 0 && newWords.length > 0) {
        // If the first few words match, it's likely the same sentence
        const matchingWords = oldWords.filter((word, i) => newWords[i] === word);
        if (matchingWords.length >= Math.min(2, oldWords.length)) {
            return true;
        }
    }

    // Otherwise, it's a new sentence
    return false;
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

    // Clear pending state from any previous session
    state.pendingTranscription = '';
    state.pendingTranslation = '';

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

    // Save any pending sentence to history before stopping
    if (state.pendingTranscription && state.pendingTranslation) {
        addToHistory(state.pendingTranscription, state.pendingTranslation);
        log('📌 Final sentence added to history');
    }

    // Clear pending state
    state.pendingTranscription = '';
    state.pendingTranslation = '';

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
        id: Date.now(), // Unique ID for each item
        timestamp,
        source,
        target,
        sourceLanguage: lang.source.name,
        targetLanguage: lang.target.name,
        // Feedback fields
        transcriptionRating: 0, // 0 = not rated, 1-5 = rating
        translationRating: 0,
        correctedTranslation: '' // User's corrected translation
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
        <div class="history-item" data-id="${item.id}">
            <div class="history-timestamp">${item.timestamp}</div>

            <!-- Transcription (Source) -->
            <div class="history-text">
                <div class="history-label-row">
                    <span class="history-label">${item.sourceLanguage} (Transcription):</span>
                    <div class="star-rating" data-type="transcription" data-id="${item.id}">
                        ${renderStars(item.transcriptionRating, 'transcription', item.id)}
                    </div>
                </div>
                <div class="history-value">${escapeHtml(item.source)}</div>
            </div>

            <!-- Translation (Target) -->
            <div class="history-text">
                <div class="history-label-row">
                    <span class="history-label">${item.targetLanguage} (Translation):</span>
                    <div class="star-rating" data-type="translation" data-id="${item.id}">
                        ${renderStars(item.translationRating, 'translation', item.id)}
                    </div>
                </div>
                <div class="history-value">${escapeHtml(item.target)}</div>
            </div>

            <!-- Correction Input -->
            <div class="correction-section">
                <div class="correction-label">Suggest correction:</div>
                <div class="correction-input-wrapper">
                    <textarea
                        class="correction-input"
                        data-id="${item.id}"
                        placeholder="Enter your corrected translation..."
                        rows="2"
                    >${escapeHtml(item.correctedTranslation)}</textarea>
                    <button class="save-correction-btn" data-id="${item.id}" title="Save correction">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </button>
                </div>
                ${item.correctedTranslation ? '<div class="correction-saved">Correction saved</div>' : ''}
            </div>
        </div>
    `).join('');

    elements.historyContent.innerHTML = historyHTML;

    // Attach event listeners for star ratings
    attachRatingListeners();

    // Attach event listeners for correction inputs
    attachCorrectionListeners();
}

function renderStars(rating, type, itemId) {
    let starsHTML = '';
    for (let i = 1; i <= 5; i++) {
        const filled = i <= rating;
        starsHTML += `
            <span class="star ${filled ? 'filled' : ''}" data-rating="${i}" data-type="${type}" data-id="${itemId}">
                ${filled ? '★' : '☆'}
            </span>
        `;
    }
    return starsHTML;
}

function attachRatingListeners() {
    const stars = document.querySelectorAll('.star-rating .star');
    stars.forEach(star => {
        star.addEventListener('click', handleStarClick);
        star.addEventListener('mouseenter', handleStarHover);
        star.addEventListener('mouseleave', handleStarLeave);
    });
}

function handleStarClick(event) {
    const star = event.target;
    const rating = parseInt(star.dataset.rating);
    const type = star.dataset.type;
    const itemId = parseInt(star.dataset.id);

    // Find the history item and update rating
    const item = state.history.find(h => h.id === itemId);
    if (item) {
        if (type === 'transcription') {
            item.transcriptionRating = rating;
        } else if (type === 'translation') {
            item.translationRating = rating;
        }

        log(`⭐ Rated ${type}: ${rating}/5 stars`);

        // Re-render the specific star rating group
        const ratingContainer = star.parentElement;
        ratingContainer.innerHTML = renderStars(rating, type, itemId);
        attachRatingListeners();
    }
}

function handleStarHover(event) {
    const star = event.target;
    const rating = parseInt(star.dataset.rating);
    const container = star.parentElement;

    // Highlight stars up to hovered position
    const allStars = container.querySelectorAll('.star');
    allStars.forEach((s, index) => {
        if (index < rating) {
            s.textContent = '★';
            s.classList.add('hover');
        } else {
            s.textContent = '☆';
            s.classList.remove('hover');
        }
    });
}

function handleStarLeave(event) {
    const star = event.target;
    const container = star.parentElement;
    const type = star.dataset.type;
    const itemId = parseInt(star.dataset.id);

    // Find the actual rating and restore
    const item = state.history.find(h => h.id === itemId);
    if (item) {
        const currentRating = type === 'transcription' ? item.transcriptionRating : item.translationRating;
        const allStars = container.querySelectorAll('.star');
        allStars.forEach((s, index) => {
            if (index < currentRating) {
                s.textContent = '★';
                s.classList.add('filled');
            } else {
                s.textContent = '☆';
                s.classList.remove('filled');
            }
            s.classList.remove('hover');
        });
    }
}

function attachCorrectionListeners() {
    const saveButtons = document.querySelectorAll('.save-correction-btn');
    saveButtons.forEach(btn => {
        btn.addEventListener('click', handleSaveCorrection);
    });

    // Also save on Enter key (Ctrl+Enter for textarea)
    const correctionInputs = document.querySelectorAll('.correction-input');
    correctionInputs.forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                handleSaveCorrection({ target: input.parentElement.querySelector('.save-correction-btn') });
            }
        });
    });
}

function handleSaveCorrection(event) {
    const btn = event.target.closest('.save-correction-btn');
    const itemId = parseInt(btn.dataset.id);
    const input = document.querySelector(`.correction-input[data-id="${itemId}"]`);
    const correction = input.value.trim();

    // Find the history item and update correction
    const item = state.history.find(h => h.id === itemId);
    if (item) {
        item.correctedTranslation = correction;
        log(`📝 Correction saved for item ${itemId}`);

        // Show saved indicator
        renderHistory();
    }
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
elements.textActionBtn.addEventListener('click', () => showInterface('text'));

// Back buttons
elements.recordBackBtn.addEventListener('click', showActionButtons);
elements.textBackBtn.addEventListener('click', showActionButtons);

// Record controls
elements.toggleRecordBtn.addEventListener('click', () => {
    if (state.isRecording) {
        stopRecording();
    } else {
        startRecording();
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
