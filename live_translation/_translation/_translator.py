# translation/_translator.py

from datetime import datetime, timezone
import torch
import queue
import multiprocessing as mp
import threading
from transformers import MarianMTModel, MarianTokenizer, AutoTokenizer, AutoModelForSeq2SeqLM
from ..server import config


class Translator(mp.Process):
    """
    Translator retrieves transcriptions from a queue, translates them using
    the M2M-100 model, and prints the translation.
    """

    def __init__(
        self,
        transcription_queue: mp.Queue,
        stop_event: threading.Event,
        cfg: config.Config,
        output_queue: mp.Queue,
    ):
        """Initialize the Translator."""
        super().__init__()
        self._transcription_queue = transcription_queue
        self._stop_event = stop_event
        self._cfg = cfg
        self._output_queue = output_queue

        # Configure model based on backend
        if self._cfg.NMT_BACKEND == "marian":
            self._model_name = (
                f"{self._cfg.TRANS_MODEL}-{self._cfg.SRC_LANG}-{self._cfg.TGT_LANG}"
            )
            print(f"🔄 Translator: Loading MarianMT model {self._model_name}...")
            self._tokenizer = MarianTokenizer.from_pretrained(self._model_name)
            self.use_vinai = False
        elif self._cfg.NMT_BACKEND == "vinai":
            self._model_name = self._cfg.TRANS_MODEL
            print(f"🔄 Translator: Loading VinAI model {self._model_name}...")
            # VinAI models require src_lang parameter
            if "vi2en" in self._model_name:
                self._tokenizer = AutoTokenizer.from_pretrained(
                    self._model_name, src_lang="vi_VN"
                )
                self._tgt_lang_code = "en_XX"
            elif "en2vi" in self._model_name:
                self._tokenizer = AutoTokenizer.from_pretrained(
                    self._model_name, src_lang="en_XX"
                )
                self._tgt_lang_code = "vi_VN"
            else:
                raise ValueError(
                    f"🚨 Unsupported VinAI model: {self._model_name}. "
                    "Use 'vinai/vinai-translate-vi2en-v2' or 'vinai/vinai-translate-en2vi-v2'."
                )
            self.use_vinai = True

    def run(self):
        try:
            # Load model based on backend
            if self.use_vinai:
                self.model = AutoModelForSeq2SeqLM.from_pretrained(
                    self._model_name, torch_dtype=torch.float32
                ).to(self._cfg.DEVICE)
            else:
                self.model = MarianMTModel.from_pretrained(
                    self._model_name, torch_dtype=torch.float32
                ).to(self._cfg.DEVICE)
            print("🌍 Translator: Ready to translate text...")

            while not (self._stop_event.is_set() and self._transcription_queue.empty()):
                # Get transcription from the queue
                try:
                    text = self._transcription_queue.get(timeout=0.5)
                except queue.Empty:
                    continue

                try:
                    translation = self._translate(text)
                    if not self._cfg.TRANSCRIBE_ONLY:
                        entry = {
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "transcription": text,
                            "translation": translation,
                        }
                        self._output_queue.put(entry)
                except Exception as e:
                    print(f"🚨 Translator Error: {e}")
        except Exception as e:
            print(f"🚨 Critical Translator Error: {e}")
        except KeyboardInterrupt:
            pass
        finally:
            self._cleanup()
            print("🌍 Translator: Stopped.")

    def _translate(self, text: str) -> str:
        if not text.strip():
            return ""

        inputs = self._tokenizer(text, return_tensors="pt", padding=True).to(self._cfg.DEVICE)

        with torch.inference_mode():
            if self.use_vinai:
                # VinAI models require decoder_start_token_id
                translated_tokens = self.model.generate(
                    **inputs,
                    decoder_start_token_id=self._tokenizer.lang_code_to_id[self._tgt_lang_code],
                    num_return_sequences=1,
                    num_beams=5,
                    early_stopping=True
                )
            else:
                # MarianMT default generation
                translated_tokens = self.model.generate(
                    **inputs,
                )

        translated_text = self._tokenizer.decode(
            translated_tokens[0], skip_special_tokens=True
        )
        return translated_text

    def _cleanup(self):
        """Clean up the translation model."""
        pass
