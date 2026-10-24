import { fetch } from 'expo/fetch';

export interface SseEvent { type?: string; data?: string; error?: string; done?: boolean }
export class HttpError extends Error { constructor(message: string, public status: number) { super(message); } }
export const API_ORIGIN = 'https://' + (process.env.EXPO_PUBLIC_DOMAIN ?? '');

/** POSTs and parses a server-sent-event stream. Resolves on done:true, throws on error event or premature end. */
export async function streamSse(path: string, body: unknown | undefined, onEvent: (e: SseEvent) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch(API_ORIGIN + path, {
    method: 'POST',
    headers: body === undefined ? { Accept: 'text/event-stream' } : { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const j = (await res.json()) as { error?: string }; if (j.error) msg = j.error; } catch { /* non-json */ }
    throw new HttpError(msg, res.status);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;
  const handle = (line: string) => {
    if (!line.startsWith('data:')) return;
    const raw = line.slice(5).trim();
    if (!raw || raw === '[DONE]') return;
    let ev: SseEvent;
    try { ev = JSON.parse(raw) as SseEvent; } catch { return; }
    if (ev.type === 'error') throw new Error(ev.error || 'Stream error');
    if (ev.done) { finished = true; return; }
    onEvent(ev);
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const l of lines) handle(l.trim());
      if (finished) break;
    }
    if (!finished && buffer.trim()) handle(buffer.trim());
  } finally {
    try { await reader.cancel(); } catch { /* already closed */ }
    try { reader.releaseLock(); } catch { /* released */ }
  }
  if (!finished) throw new Error('Stream ended unexpectedly');
}
