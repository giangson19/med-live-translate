<div align="center">

# 🏥 MedComms

**Real-time Vietnamese ⇄ English speech translation for clinical settings.**

*A medical-focused fork of [live-translation](https://github.com/AbdullahHendy/live-translation), extending it with
Vietnamese-optimized ASR and MT backends and a browser client built for the bedside.*

[![License](https://img.shields.io/github/license/AbdullahHendy/live-translation.svg)](./LICENSE)
[![Python >= 3.11](https://img.shields.io/badge/Python-%3E=3.11-%231f425f?logo=python)](https://www.python.org/downloads/)
</br>
[![Architecture](https://img.shields.io/badge/Architecture-Client--Server-informational)](https://en.wikipedia.org/wiki/Client%E2%80%93server_model)
[![WebSocket](https://img.shields.io/badge/Protocol-WebSocket-brightgreen?logo=websocket)](https://en.wikipedia.org/wiki/WebSocket)
[![Audio](https://img.shields.io/badge/Audio-16bit_PCM@16kHz-brightgreen?logo=sound)](https://en.wikipedia.org/wiki/Pulse-code_modulation)
[![Codec](https://img.shields.io/badge/Audio_Codec-Opus-blueviolet?logo=opus)](https://en.wikipedia.org/wiki/Opus_(audio_format))
</br>
[![Powered by PhoWhisper](https://img.shields.io/badge/ASR-PhoWhisper-green)](https://huggingface.co/vinai/PhoWhisper-small)
[![Powered by VinAI Translate](https://img.shields.io/badge/MT-VinAI_Translate-blue)](https://huggingface.co/vinai/vinai-translate-vi2en-v2)
[![Deploy](https://img.shields.io/badge/Deploy-AWS_Amplify_%2B_EC2-ff9900?logo=amazonaws&logoColor=white)](./AWS_DEPLOYMENT_GUIDE.md)

</div>

---

## What this is

A Vietnamese-speaking patient and an English-speaking clinician need to understand each other **now**,
not after a translated document comes back. **MedComms** is a speech translation pipeline for exactly that
moment: a phone or laptop microphone streams audio to a translation server, and transcription and
translation appear side by side while the person is still speaking.

The system has two halves:

| Half | What it is | Where |
|---|---|---|
| **Translation server** | Python pipeline: VAD → ASR → NMT, streaming over WebSocket | [`live_translation/`](./live_translation) |
| **MedComms web client** | Zero-install browser front end — record, translate, keep the dialogue history | [`medical-translation-webapp/`](./medical-translation-webapp) |

The server half is inherited from [live-translation](https://github.com/AbdullahHendy/live-translation) by
Abdullah Hendy, an excellent general-purpose real-time translation engine. This fork adds what a
Vietnamese clinical deployment needs: **PhoWhisper** for Vietnamese ASR, **VinAI Translate** for
Vietnamese⇄English MT, and the MedComms client and its AWS deployment path.

Developed by the College of Engineering and Computer Science & the College of Health Sciences,
**VinUniversity**.

---

## 👷🏼‍♂️ Architecture

Microphone → Opus-encoded 16 kHz mono frames over WebSocket → Silero VAD → ASR → NMT → JSON results
streamed back to the client.

<img src="./doc/live-translation-pipeline.png" alt="Architecture Diagram" />

***The diagram omits finer details.***

A MedComms deployment runs **two server instances**, one per direction:

| Direction | Port | ASR | MT |
|---|---|---|---|
| Vietnamese → English | `8765` | `vinai/PhoWhisper-small` | `vinai/vinai-translate-vi2en-v2` |
| English → Vietnamese | `8766` | `vinai/PhoWhisper-small` | `vinai/vinai-translate-en2vi-v2` |

The web client picks the port matching the selected direction.

---

## ⭐ Features

**Clinical translation**
- Bidirectional Vietnamese ⇄ English, swappable with one click in the browser
- **PhoWhisper** — Vietnamese-optimized ASR, considerably better than base Whisper on Vietnamese speech
- **VinAI Translate** — state-of-the-art Vietnamese⇄English MT
- Dialogue history so a whole consultation stays on screen

**Engine**
- Voice Activity Detection (**Silero**) so silence never reaches the models
- Full-duplex **WebSocket** streaming; **Opus** compression for low bandwidth on hospital Wi-Fi
- Multithreaded/multiprocess pipeline for parallel capture, transcription, and translation
- Also supports the general-purpose path: OpenAI **Whisper** (99 languages) + Helsinki-NLP **OpusMT**
- Optional logging to **stdout** or structured **.jsonl** transcripts
- Usable as a **CLI** (`live-translate-server`, `live-translate-client`) or a **Python API**
  (`LiveTranslationServer`, `LiveTranslationClient`)

**Client**
- No framework, no build step — static HTML/CSS/ES modules plus `libopus.wasm`
- Deployable to AWS Amplify as static files; servers on EC2 behind NGINX + TLS

---

## 📜 Prerequisites

System dependencies:

**Debian/Ubuntu**
```bash
sudo apt-get install portaudio19-dev libopus0 libopus-dev
```

**macOS**
```bash
brew install portaudio opus
# Add to ~/.zshrc so the Opus shared library is found at runtime:
export DYLD_LIBRARY_PATH="/opt/homebrew/opt/opus/lib:$DYLD_LIBRARY_PATH"
```

[PortAudio](https://www.portaudio.com/) handles audio input; [Opus](https://opus-codec.org/) is the codec.

---

## 📥 Installation

> **NOTE**: The `live-translation` package on PyPI is the **upstream** project and does **not** include the
> PhoWhisper/VinAI backends or the MedComms client. Install from this repository.

```bash
git clone git@github.com:giangson19/med-live-translate.git
cd med-live-translate

python -m venv .venv
source .venv/bin/activate

pip install --upgrade pip
pip install -e .
```

Verify:
```bash
python -c "import live_translation; print(live_translation.__version__)"
```

---

## 🚀 Quick start (MedComms)

### 1. Start both translation servers

Vietnamese → English:
```bash
live-translate-server \
  --asr_backend phowhisper \
  --whisper_model vinai/PhoWhisper-small \
  --nmt_backend vinai \
  --trans_model vinai/vinai-translate-vi2en-v2 \
  --src_lang vi --tgt_lang en \
  --ws_port 8765 --log print
```

English → Vietnamese:
```bash
live-translate-server \
  --asr_backend phowhisper \
  --whisper_model vinai/PhoWhisper-small \
  --nmt_backend vinai \
  --trans_model vinai/vinai-translate-en2vi-v2 \
  --src_lang en --tgt_lang vi \
  --ws_port 8766 --log print
```

> **NOTE**: The first run downloads models into the cache folder (e.g. `~/.cache`). That output can scatter
> the initial server logs — rerun once downloads finish for a clean view.

### 2. Serve the web client

```bash
cd medical-translation-webapp
python3 -m http.server 8080
```

Open <http://localhost:8080>. Microphone access needs a secure context — `localhost` counts, anything
else needs HTTPS.

Full client documentation: [`medical-translation-webapp/README.md`](./medical-translation-webapp/README.md).

---

## 🔧 Server usage

### CLI

```bash
live-translate-server [OPTIONS]
```

| Option | Values | Default | Notes |
|---|---|---|---|
| `--asr_backend` | `whisper`, `phowhisper` | `whisper` | `phowhisper` for Vietnamese |
| `--whisper_model` | Whisper sizes, or `vinai/PhoWhisper-{small,large}` | `base` | must match the backend |
| `--nmt_backend` | `marian`, `vinai` | `marian` | `vinai` is vi⇄en only |
| `--trans_model` | `Helsinki-NLP/opus-mt[-tc-big]`, `vinai/vinai-translate-{vi2en,en2vi}-v2` | `Helsinki-NLP/opus-mt` | for Marian, omit language codes |
| `--src_lang` / `--tgt_lang` | e.g. `vi`, `en`, `es` | `en` / `es` | |
| `--device` | `cpu`, `cuda` | `cpu` | GPU strongly recommended for PhoWhisper/VinAI |
| `--codec` | `pcm`, `opus` | `opus` | must match the client |
| `--ws_port` | port | `8765` | |
| `--silence_threshold` | seconds (min 1.5) | `2` | silence flushes the buffer |
| `--vad_aggressiveness` | `0`–`9` | `8` | higher = more confident before calling it speech |
| `--max_buffer_duration` | `5`–`10` s | `7` | buffer trim point |
| `--log` | `print`, `file` | none | `file` writes `./transcripts/transcript_{TIMESTAMP}.jsonl` |
| `--transcribe_only` | flag | off | skip translation |
| `--version` | flag | | print version and exit |

Run `live-translate-server --help` for the authoritative list.

There is also a reference CLI client and an all-in-one demo:
```bash
live-translate-client --server ws://localhost:8765 --codec opus
live-translate-demo   # server + client with default config, quick smoke test only
```

> **NOTE**: On Linux, ALSA/JACK warnings when the client opens the mic (`unable to open slave`,
> `jack server is not running`, …) are harmless.

### Python API

**Server** — Vietnamese → English:
```python
from live_translation import LiveTranslationServer, ServerConfig

def main():
    config = ServerConfig(
        device="cpu",  # or "cuda"
        asr_backend="phowhisper",
        whisper_model="vinai/PhoWhisper-small",
        nmt_backend="vinai",
        trans_model="vinai/vinai-translate-vi2en-v2",
        src_lang="vi",
        tgt_lang="en",
        ws_port=8765,
        log="print",
        codec="opus",
    )
    LiveTranslationServer(config).run(blocking=True)

# The main guard is CRITICAL on platforms that spawn processes (macOS, Windows)
if __name__ == "__main__":
    main()
```

**Client**:
```python
from live_translation import LiveTranslationClient, ClientConfig

def parser_callback(entry, *args, **kwargs):
    print(f"📝 {entry['transcription']}")
    print(f"🌍 {entry['translation']}")
    return False  # return True to shut the client down

def main():
    config = ClientConfig(server_uri="ws://localhost:8765", codec="opus")
    LiveTranslationClient(config).run(callback=parser_callback, blocking=True)

if __name__ == "__main__":
    main()
```

Non-blocking and asynchronous workflows are shown in [`./examples/`](./examples).

---

## 🔌 WebSocket protocol

To write your own client, talk to the server directly.

**Send** Opus-encoded audio (or raw PCM with `--codec pcm`):
- 16-bit signed integer (`int16`), 16,000 Hz, mono
- 640 samples = 1280 bytes per message (40 ms), sent as soon as each chunk is encoded

**Receive** JSON:
```json
{
  "timestamp": "2025-05-25T12:58:35.259085+00:00",
  "transcription": "Chào buổi sáng, anh thấy trong người thế nào?",
  "translation": "Good morning, how are you feeling?"
}
```

Working reference clients in [`./examples/clients`](./examples/clients): **Node.js**, **Browser JS**, **Go**,
**C#**, **Kotlin/Android**. The [Python client](./live_translation/client/client.py) is the guide for
anything more involved. The MedComms webapp is the production browser implementation.

---

## ☁️ Deployment

- **[`AMPLIFY_SETUP.md`](./AMPLIFY_SETUP.md)** — hosting the MedComms client on AWS Amplify.
  `amplify.yml` runs `build-config.sh`, which injects `BACKEND_URL` into
  `medical-translation-webapp/config.env.js`, and serves that directory as the site root.
- **[`AWS_DEPLOYMENT_GUIDE.md`](./AWS_DEPLOYMENT_GUIDE.md)** — running the translation servers on EC2:
  systemd units for both directions, NGINX reverse proxy for the WebSockets, Let's Encrypt TLS.

Serve the client over HTTPS and the WebSockets over `wss://` — an HTTPS page cannot open an insecure
`ws://` connection, and the microphone requires a secure context.

---

## 🧪 Performance notes

For Vietnamese work:
1. **PhoWhisper for ASR** — clearly better Vietnamese recognition than stock Whisper.
2. **VinAI Translate for NMT** — best-in-class for vi⇄en.
3. **GPU recommended** (`--device cuda`); both model families benefit substantially.
4. Model size: `vinai/PhoWhisper-small` for development, `vinai/PhoWhisper-large` for production
   (needs more GPU memory).

Reference environment used during development of the upstream engine: Ubuntu 24.10, Python 3.12.7,
Intel i9-13900HX, RTX 4070 Mobile, CUDA 12.1 / cuDNN 9.7.1, 32 GB RAM. CUDA is effectively required
for the heavier models — see [NVIDIA drivers](https://www.nvidia.com/drivers/),
[CUDA Toolkit](https://developer.nvidia.com/cuda-downloads), [cuDNN](https://developer.nvidia.com/cudnn-downloads).

---

## 🤝 Development

```bash
python -m venv .venv && source .venv/bin/activate
pip install --upgrade pip
pip install -e .[dev,examples]   # == make install

make test     # pytest
make build    # lint + format check (ruff) + wheel
make help     # everything else
```

Editable install means CLI changes take effect immediately — no reinstall between runs.

For changes: work in a feature branch, keep tests passing, and open a PR describing what changed.
For the webapp, also test both language directions end to end and check a phone-sized viewport.

---

## 📈 Roadmap

- **Medical terminology tuning** — domain adaptation / glossary enforcement for clinical vocabulary
- **Text input mode** — the client UI exists but is hidden pending a server-side text-only endpoint
- **ARM64 support**
- **Concurrency review** — revisit `WebSocketIO` as a thread while `AudioProcessor`, `Transcriber`, and
  `Translator` are processes; audit for races and deadlocks
- **Structured logging** — a real logging framework with activity, error, and performance metrics
- **Resource profiling** — document CPU/GPU/memory per component to ground hardware sizing
- **Handshake protocol** — server advertises capabilities and negotiates with the client instead of
  duplicating options (e.g. `--codec`) on both sides
- **Better Marian model selection** — automatically pick top-performing OpusMT models for a given
  `src_lang`/`tgt_lang` pair

---

## 📄 License & credits

MIT — see [`LICENSE`](./LICENSE).

Built on [live-translation](https://github.com/AbdullahHendy/live-translation) by Abdullah Hendy.

© 2025 College of Engineering and Computer Science & College of Health Sciences, VinUniversity.

---

## 📚 Citations

```bibtex
@article{Whisper,
  title = {Robust Speech Recognition via Large-Scale Weak Supervision},
  url = {https://arxiv.org/abs/2212.04356},
  author = {Radford, Alec and Kim, Jong Wook and Xu, Tao and Brockman, Greg and McLeavey, Christine and Sutskever, Ilya},
  publisher = {arXiv},
  year = {2022}
}

@misc{PhoWhisper,
  title = {PhoWhisper: Automatic Speech Recognition for Vietnamese},
  author = {VinAI Research},
  year = {2023},
  publisher = {Hugging Face},
  howpublished = {\url{https://huggingface.co/vinai/PhoWhisper-small}}
}

@misc{VinAITranslate,
  title = {High-Quality Vietnamese-English Neural Machine Translation},
  author = {VinAI Research},
  year = {2023},
  publisher = {Hugging Face},
  howpublished = {\url{https://huggingface.co/vinai/vinai-translate-vi2en-v2}}
}

@misc{SileroVAD,
  author = {Silero Team},
  title = {Silero VAD: pre-trained enterprise-grade Voice Activity Detector (VAD), Number Detector and Language Classifier},
  year = {2021},
  publisher = {GitHub},
  journal = {GitHub repository},
  howpublished = {\url{https://github.com/snakers4/silero-vad}},
  email = {hello@silero.ai}
}

@article{tiedemann2023democratizing,
  title = {Democratizing neural machine translation with {OPUS-MT}},
  author = {Tiedemann, J{\"o}rg and Aulamo, Mikko and Bakshandaeva, Daria and Boggia, Michele and Gr{\"o}nroos, Stig-Arne and Nieminen, Tommi and Raganato, Alessandro and Scherrer, Yves and Vazquez, Raul and Virpioja, Sami},
  journal = {Language Resources and Evaluation},
  number = {58},
  pages = {713--755},
  year = {2023},
  publisher = {Springer Nature},
  issn = {1574-0218},
  doi = {10.1007/s10579-023-09704-w}
}

@InProceedings{TiedemannThottingal:EAMT2020,
  author = {J{\"o}rg Tiedemann and Santhosh Thottingal},
  title = {{OPUS-MT} — {B}uilding open translation services for the {W}orld},
  booktitle = {Proceedings of the 22nd Annual Conference of the European Association for Machine Translation (EAMT)},
  year = {2020},
  address = {Lisbon, Portugal}
}
```
