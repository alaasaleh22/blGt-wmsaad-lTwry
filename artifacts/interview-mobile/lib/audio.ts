import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Uint8Array(256);
for (let i = 0; i < B64.length; i++) LOOKUP[B64.charCodeAt(i)] = i;

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)], b = LOOKUP[clean.charCodeAt(i + 1)];
    const c = LOOKUP[clean.charCodeAt(i + 2)], d = LOOKUP[clean.charCodeAt(i + 3)];
    if (p < len) out[p++] = (a << 2) | (b >> 4);
    if (p < len) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < len) out[p++] = ((c & 3) << 6) | d;
  }
  return out;
}

export async function readRecordingBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const blob = await (await globalThis.fetch(uri)).blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('read failed'));
      r.onload = () => { const s = String(r.result ?? ''); resolve(s.slice(s.indexOf(',') + 1)); };
      r.readAsDataURL(blob);
    });
  }
  return await new File(uri).base64();
}

/** Accumulates streamed PCM16 mono 24 kHz chunks. */
export class PcmCollector {
  private chunks: Uint8Array[] = [];
  size = 0;
  push(b64: string) { const b = base64ToBytes(b64); this.chunks.push(b); this.size += b.length; }
  toWav(): Uint8Array {
    const sampleRate = 24000, data = this.size;
    const buf = new Uint8Array(44 + data);
    const v = new DataView(buf.buffer);
    const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
    w(0, 'RIFF'); v.setUint32(4, 36 + data, true); w(8, 'WAVE'); w(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, data, true);
    let o = 44; for (const c of this.chunks) { buf.set(c, o); o += c.length; }
    return buf;
  }
}

let current: AudioPlayer | null = null;
let currentWebUrl: string | null = null;
let counter = 0;

export function stopPlayback() {
  if (current) { try { current.pause(); current.remove(); } catch { /* already released */ } current = null; }
  if (currentWebUrl && Platform.OS === 'web') { URL.revokeObjectURL(currentWebUrl); currentWebUrl = null; }
}

export async function playWav(wav: Uint8Array, onEnd?: () => void): Promise<void> {
  stopPlayback();
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
  let uri: string;
  if (Platform.OS === 'web') {
    const copy = new Uint8Array(wav.length); copy.set(wav);
    uri = URL.createObjectURL(new Blob([copy.buffer], { type: 'audio/wav' }));
    currentWebUrl = uri;
  } else {
    counter += 1;
    const f = new File(Paths.cache, 'miraa-q-' + Date.now() + '-' + counter + '.wav');
    if (f.exists) f.delete();
    f.create();
    f.write(wav);
    uri = f.uri;
  }
  const player = createAudioPlayer(uri);
  current = player;
  player.addListener('playbackStatusUpdate', (s) => {
    if (s.didJustFinish) { onEnd?.(); if (current === player) stopPlayback(); }
  });
  player.play();
}
