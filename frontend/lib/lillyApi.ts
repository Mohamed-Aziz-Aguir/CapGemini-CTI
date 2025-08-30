// lib/lillyApi.ts
// Place at: /lib/lillyApi.ts
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

/**
 * Stream a chat request to Lilly and call onChunk(token) for each received token.
 * Works with SSE-like "data: ..." lines and plain text chunks.
 */
export async function streamChatLilly(
  message: string,
  onChunk: (token: string) => void
): Promise<void> {
  const url = `${BASE}/api/lilly/chat?stream=true`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Lilly stream error ${resp.status}: ${text}`);
  }

  if (!resp.body) return;

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let done = false;

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      const chunk = decoder.decode(value, { stream: true });

      // split into lines because backend may send SSE-like "data: { ... }" lines
      const lines = chunk.split(/\r?\n/);
      for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        if (line.startsWith("data:")) line = line.slice(5).trim();
        if (line === "[DONE]") continue;

        try {
          const parsed = JSON.parse(line);
          const token =
            parsed?.choices?.[0]?.delta?.content ??
            parsed?.choices?.[0]?.delta?.text ??
            parsed?.text ??
            parsed?.content ??
            null;
          if (token) {
            onChunk(token);
          } else {
            onChunk(typeof parsed === "string" ? parsed : JSON.stringify(parsed));
          }
        } catch (e) {
          onChunk(line);
        }
      }
    }
  }

  const tail = decoder.decode();
  if (tail) onChunk(tail);
}

/**
 * Non-streaming chat call (returns JSON).
 * Use stream=true to ask backend for streaming, but this function will fetch JSON response.
 */
export async function chatLilly(message: string, stream = false) {
  const url = `${BASE}/api/lilly/chat${stream ? "?stream=true" : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Lilly API error ${res.status}: ${text}`);
  }
  return await res.json();
}

export async function clearLilly() {
  const res = await fetch(`${BASE}/api/lilly/clear`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to clear Lilly chat");
  return await res.json();
}

export async function enrichCve(cveId: string, desc: string) {
  const res = await fetch(`${BASE}/api/lilly/enrich_cve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cve_id: cveId, cve_description: desc }),
  });
  if (!res.ok) throw new Error("Failed to enrich CVE");
  return await res.json();
}

export async function simplifyCve(cveId: string, desc: string) {
  const res = await fetch(`${BASE}/api/lilly/simplify_cve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cve_id: cveId, cve_description: desc }),
  });
  if (!res.ok) throw new Error("Failed to simplify CVE");
  return await res.json();
}

export default {
  streamChatLilly,
  chatLilly,
  clearLilly,
  enrichCve,
  simplifyCve,
};

