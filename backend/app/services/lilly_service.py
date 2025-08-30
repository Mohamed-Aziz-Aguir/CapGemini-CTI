# app/services/lilly_service.py
import httpx
import json
import re
import unicodedata
from typing import AsyncGenerator
from app.core.config import LLAMA_SERVER_URL, LLILLY_MODEL_PATH


class LillyService:
    """
    LillyService with improved sanitization:
    - removes control and invisible characters (zero-width, control codes)
    - preserves streaming behavior (yields only incremental deltas)
    - retains token-level heuristics and final text normalization
    """

    chat_memory = [
        {"role": "system", "content": "You are Lilly, a helpful cybersecurity assistant."}
    ]

    @staticmethod
    def _remove_control_chars(text: str) -> str:
        """
        Remove Unicode control characters (category 'C*') and common invisible characters
        (zero-width space, zero-width non-joiner, zero-width joiner, BOM, narrow no-break space, etc.)
        and normalize NBSP to regular space.
        """
        if not text:
            return text

        # Replace common non-breaking spaces with regular space
        text = text.replace("\u00A0", " ")  # NBSP
        text = text.replace("\u202F", " ")  # narrow no-break space
        text = text.replace("\u00AD", "")   # soft hyphen remove
        # Remove zero-width and BOM characters
        zero_width_chars = ["\u200B", "\u200C", "\u200D", "\uFEFF", "\u2060"]
        for ch in zero_width_chars:
            text = text.replace(ch, "")

        # Remove all Unicode control characters (categories starting with 'C')
        # Keep printable characters only.
        filtered = []
        for ch in text:
            # get category like 'Cc', 'Cf', 'Lu', etc.
            cat = unicodedata.category(ch)
            if cat and cat[0] == "C":
                # skip control / format characters
                continue
            filtered.append(ch)
        return "".join(filtered)

    @staticmethod
    def _clean_final_text(text: str) -> str:
        """Final cleanup for the assembled text before storing/returning."""
        if not text:
            return text

        # 0) sanitize control/zero-width characters first
        text = LillyService._remove_control_chars(text)

        # 1) Normalize whitespace (collapse multiple whitespace to single space)
        text = re.sub(r"\s+", " ", text)

        # 2) Fix common spaced contractions: e.g. I ' m -> I'm
        text = re.sub(r"\bI\s+'\s*m\b", "I'm", text, flags=re.IGNORECASE)
        text = re.sub(r"\b([A-Za-z])\s+'\s*([A-Za-z]+)\b", r"\1'\2", text)

        # 3) Remove spaces that occur directly before punctuation: "word ," -> "word,"
        text = re.sub(r"\s+([,\.!\?:;])", r"\1", text)

        # 4) Ensure a space after sentence-ending punctuation if missing:
        #    "Hello!How are you?" -> "Hello! How are you?"
        text = re.sub(r"([\.!\?])([A-Za-z0-9\"'(\[])",
                      r"\1 \2", text)

        # 5) Ensure a space after commas/colons/semicolons if missing: "Hi,there" -> "Hi, there"
        text = re.sub(r"([,;:])([A-Za-z0-9\"'(\[])",
                      r"\1 \2", text)

        # 6) Collapse single-letter runs separated by spaces into continuous tokens.
        #    Examples: "L il ly" -> "Lilly", "C V E" -> "CVE"
        def _collapse_letter_run(match: re.Match) -> str:
            s = match.group(0)
            return s.replace(" ", "")

        text = re.sub(r'(?:\b[A-Za-z](?:\s+[A-Za-z]){1,}\b)', _collapse_letter_run, text)

        # 7) Heuristic collapse for mid-word splits introduced by streaming.
        common_small_words = {"the", "and", "of", "to", "in", "on", "is", "it", "by", "for", "as", "at", "an", "be"}

        def _collapse_mid_word(match: re.Match) -> str:
            left = match.group(1)
            right = match.group(2)
            # don't merge if right is a common small word
            if right.lower() in common_small_words:
                return match.group(0)
            if len(left) <= 5 and len(right) <= 6:
                return left + right
            return match.group(0)

        for _ in range(2):
            text = re.sub(r'\b([A-Za-z]{1,5})\s+([A-Za-z]{1,6})\b', _collapse_mid_word, text)

        # 8) Final normalization & strip
        text = re.sub(r"\s+", " ", text).strip()

        return text

    @staticmethod
    def _clean_token_for_stream(token: str, prev_text: str) -> str:
        """
        Clean a token delta before appending to accumulated text.
        Removes control chars and uses heuristics considering the last whole word
        to decide if a space is needed.
        """
        if not token:
            return ""

        # Remove control/zero-width characters from the token first
        token = LillyService._remove_control_chars(token)

        # Normalize newlines and collapse internal whitespace inside token
        token = token.replace("\r", " ").replace("\n", " ")
        token = re.sub(r"\s+", " ", token)

        # Determine leading space presence (model may emit a leading space)
        has_leading_space = token.startswith(" ")
        token_stripped = token.lstrip(" ")

        # If token becomes empty after stripping -> return a single space (if had leading)
        if token_stripped == "":
            return " " if has_leading_space else ""

        # Examine prev_text for last char and last alpha fragment
        prev_last = prev_text[-1] if prev_text else ""
        prev_word_match = re.search(r'([A-Za-z]+)$', prev_text)
        prev_word = prev_word_match.group(1) if prev_word_match else ""
        first_char = token_stripped[0]

        # punctuation that should not have a space before it
        no_space_before = {",", ".", "!", "?", ":", ";", "%", ")", "]", "}", "’", "'"}

        # If token begins with punctuation, attach directly
        if first_char in no_space_before:
            return token_stripped

        # If previous char is sentence-ending and token begins with letter, add space
        if prev_last in {".", "!", "?"} and first_char.isalpha():
            return " " + token_stripped

        # If prev char is comma/semicolon/colon and token is letter -> add space
        if prev_last in {",", ";", ":"} and first_char.isalpha():
            return " " + token_stripped

        # If previous char is whitespace -> don't add another space
        if prev_last and prev_last.isspace():
            return token_stripped

        # If prev_word and the new token are both alphabetic: use heuristics
        if prev_word and prev_word.isalpha() and token_stripped.isalpha():
            common_small_words = {"the", "and", "of", "to", "in", "on", "is", "it", "by", "for", "as", "at", "an", "be"}

            # If prev_word lowercase and token lowercase, likely a mid-word split -> join
            if prev_word.islower() and token_stripped.islower():
                if token_stripped.lower() not in common_small_words and len(prev_word) <= 8 and len(token_stripped) <= 8:
                    return token_stripped  # join directly
                return " " + token_stripped

            # If prev_word is lowercase and token begins uppercase -> new word
            if prev_word.islower() and token_stripped[0].isupper():
                return " " + token_stripped

            # If prev_word is uppercase (acronym) and token is lowercase -> likely continuation -> join
            if prev_word.isupper() and token_stripped.islower():
                return token_stripped

            # Default: insert a space
            return " " + token_stripped

        # If prev_last is alnum and token starts with letter -> add space
        if prev_last and prev_last.isalnum() and first_char.isalpha():
            return " " + token_stripped

        # Default: append stripped token
        return token_stripped

    @staticmethod
    async def _ask_lilly(prompt: str, stream: bool = True):
        """
        Core function:
        - If stream=True returns an async generator yielding bytes (only new characters).
        - If stream=False returns the full cleaned string.
        """
        # Append user message to memory
        LillyService.chat_memory.append({"role": "user", "content": prompt})

        payload = {
            "model": LLILLY_MODEL_PATH,
            "messages": LillyService.chat_memory,
            "stream": True
        }

        if stream:
            async def generator() -> AsyncGenerator[bytes, None]:
                accumulated = ""   # full assembled assistant text
                last_sent = ""     # portion already yielded to clients
                try:
                    async with httpx.AsyncClient(timeout=None) as client:
                        async with client.stream("POST", LLAMA_SERVER_URL, json=payload) as resp:
                            if resp.status_code >= 400:
                                err = f"[Lilly API error: {resp.status_code}]\n"
                                yield err.encode("utf-8")
                                return

                            async for line in resp.aiter_lines():
                                if not line:
                                    continue

                                # handle 'data:' SSE-like prefixes if present
                                if line.startswith("data:"):
                                    payload_line = line[len("data:"):].strip()
                                else:
                                    payload_line = line.strip()

                                if payload_line in ("[DONE]", ""):
                                    continue

                                # try to parse JSON chunk; if fails, treat as raw text token
                                try:
                                    chunk = json.loads(payload_line)
                                except Exception:
                                    token = payload_line
                                    token_clean = LillyService._clean_token_for_stream(token, accumulated)
                                    accumulated += token_clean
                                    delta = accumulated[len(last_sent):]
                                    if delta:
                                        last_sent = accumulated
                                        yield delta.encode("utf-8")
                                    continue

                                # extract token delta (support both 'content' and 'text' keys)
                                try:
                                    delta_obj = chunk["choices"][0].get("delta", {})
                                except Exception:
                                    continue

                                token = delta_obj.get("content") or delta_obj.get("text") or ""
                                if token:
                                    token_clean = LillyService._clean_token_for_stream(token, accumulated)
                                    accumulated += token_clean
                                    delta = accumulated[len(last_sent):]
                                    if delta:
                                        last_sent = accumulated
                                        yield delta.encode("utf-8")
                except httpx.RequestError as e:
                    err = f"[Error contacting Lilly API: {e}]\n"
                    yield err.encode("utf-8")
                    return
                except Exception as e:
                    err = f"[Unexpected streaming error: {e}]\n"
                    yield err.encode("utf-8")
                    return
                finally:
                    # final cleanup and append assistant message to memory
                    final_text = LillyService._clean_final_text(accumulated)
                    LillyService.chat_memory.append({"role": "assistant", "content": final_text})
            return generator()
        else:
            assembled = ""
            try:
                async with httpx.AsyncClient(timeout=None) as client:
                    async with client.stream("POST", LLAMA_SERVER_URL, json=payload) as resp:
                        if resp.status_code >= 400:
                            return f"[Lilly API error: {resp.status_code}]"
                        async for line in resp.aiter_lines():
                            if not line:
                                continue
                            if line.startswith("data:"):
                                payload_line = line[len("data:"):].strip()
                            else:
                                payload_line = line.strip()

                            if payload_line in ("[DONE]", ""):
                                continue

                            try:
                                chunk = json.loads(payload_line)
                            except Exception:
                                token = payload_line
                                token_clean = LillyService._clean_token_for_stream(token, assembled)
                                assembled += token_clean
                                continue

                            try:
                                delta_obj = chunk["choices"][0].get("delta", {})
                            except Exception:
                                continue

                            token = delta_obj.get("content") or delta_obj.get("text") or ""
                            if token:
                                token_clean = LillyService._clean_token_for_stream(token, assembled)
                                assembled += token_clean
            except httpx.RequestError as e:
                return f"[Error contacting Lilly API: {e}]"

            final_text = LillyService._clean_final_text(assembled)
            LillyService.chat_memory.append({"role": "assistant", "content": final_text})
            return final_text or "No answer returned."

    @staticmethod
    async def chat(message: str, stream: bool = True):
        return await LillyService._ask_lilly(message, stream=stream)

    @staticmethod
    async def enrich_cve(cve_id: str, cve_description: str, stream: bool = False):
        prompt = (
            f"Enrich CVE {cve_id}:\nDescription: {cve_description}\n"
            "Provide detailed technical explanation, causes, examples, and mitigation steps."
        )
        return await LillyService._ask_lilly(prompt, stream=stream)

    @staticmethod
    async def explain_cve_for_nonexpert(cve_id: str, cve_description: str, stream: bool = False):
        prompt = (
            f"Explain CVE {cve_id} in simple non-technical terms for someone with no cybersecurity background.\n"
            f"Description: {cve_description}\n"
            "Use analogies and concrete examples."
        )
        return await LillyService._ask_lilly(prompt, stream=stream)

    @staticmethod
    def clear_chat():
        LillyService.chat_memory = [
            {"role": "system", "content": "You are Lilly, a helpful cybersecurity assistant."}
        ]
