/**
 * React hook for streaming audio playback using AudioWorklet.
 * Supports real-time PCM16 audio streaming from SSE responses.
 * Includes sequence buffer for reordering out-of-order chunks.
 */
import { useRef, useCallback, useState, useEffect } from "react";
import { decodePCM16ToFloat32 } from "./audio-utils";

export type PlaybackState = "idle" | "playing" | "ended";

/**
 * Reorders audio chunks that may arrive out of sequence.
 * Buffers chunks until they can be played in correct order.
 *
 * Example: If chunks arrive as seq 2, seq 0, seq 1:
 * - seq 2 arrives → buffered (waiting for seq 0)
 * - seq 0 arrives → played immediately, then check buffer
 * - seq 1 arrives → played immediately (seq 0 done), seq 2 now plays
 */
class SequenceBuffer {
  private pending = new Map<number, string[]>();
  private nextSeq = 0;

  /** Add chunk with sequence number, returns chunks ready to play in order */
  push(seq: number, data: string): string[] {
    // Store the chunk under its sequence number
    if (!this.pending.has(seq)) {
      this.pending.set(seq, []);
    }
    this.pending.get(seq)!.push(data);

    // Drain consecutive ready sequences
    const ready: string[] = [];
    while (this.pending.has(this.nextSeq)) {
      ready.push(...this.pending.get(this.nextSeq)!);
      this.pending.delete(this.nextSeq);
      this.nextSeq++;
    }
    return ready;
  }

  reset() {
    this.pending.clear();
    this.nextSeq = 0;
  }
}

export function useAudioPlayback(workletPath: string) {
  const [state, setState] = useState<PlaybackState>("idle");
  const ctxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const readyRef = useRef(false);
  const seqBufferRef = useRef(new SequenceBuffer());
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const nextPlaybackTimeRef = useRef(0);

  useEffect(() => () => {
    for (const source of sourcesRef.current) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    sourcesRef.current.clear();
    workletRef.current?.disconnect();
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    readyRef.current = false;
  }, []);

  const init = useCallback(async () => {
    if (readyRef.current) {
      void ctxRef.current?.resume().catch(() => {});
      return;
    }
    if (!workletPath) {
      throw new Error("workletPath is required for audio playback");
    }

    const ctx = new AudioContext({ sampleRate: 24000 });
    ctxRef.current = ctx;
    void ctx.resume().catch(() => {});
    // Some browsers never settle addModule(). Do not let a playback setup
    // problem block uploading the candidate's recorded answer.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        ctx.audioWorklet.addModule(workletPath),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Audio worklet setup timed out")), 2000);
        }),
      ]);
      const worklet = new AudioWorkletNode(ctx, "audio-playback-processor");
      worklet.connect(ctx.destination);
      worklet.port.onmessage = (e) => {
        if (e.data.type === "ended") setState("idle");
      };
      workletRef.current = worklet;
    } catch {
      // Native Web Audio scheduling also plays PCM16 without a worklet.
      workletRef.current = null;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
    readyRef.current = true;
  }, [workletPath]);

  /** Push audio directly (no sequencing) - for simple streaming */
  const pushAudio = useCallback((base64Audio: string) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const samples = decodePCM16ToFloat32(base64Audio);
    if (workletRef.current) {
      workletRef.current.port.postMessage({ type: "audio", samples });
    } else {
      const buffer = ctx.createBuffer(1, samples.length, 24000);
      buffer.getChannelData(0).set(samples);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      sourcesRef.current.add(source);
      source.onended = () => {
        sourcesRef.current.delete(source);
        source.disconnect();
        if (sourcesRef.current.size === 0) setState("idle");
      };
      const start = Math.max(ctx.currentTime + 0.02, nextPlaybackTimeRef.current);
      nextPlaybackTimeRef.current = start + buffer.duration;
      source.start(start);
    }
    setState("playing");
  }, []);

  /** Push audio with sequence number - reorders before playback */
  const pushSequencedAudio = useCallback((seq: number, base64Audio: string) => {
    const readyChunks = seqBufferRef.current.push(seq, base64Audio);
    for (const chunk of readyChunks) {
      pushAudio(chunk);
    }
    if (readyChunks.length > 0) {
      setState("playing");
    }
  }, [pushAudio]);

  const signalComplete = useCallback(() => {
    workletRef.current?.port.postMessage({ type: "streamComplete" });
  }, []);

  const clear = useCallback(() => {
    workletRef.current?.port.postMessage({ type: "clear" });
    for (const source of sourcesRef.current) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    sourcesRef.current.clear();
    nextPlaybackTimeRef.current = ctxRef.current?.currentTime ?? 0;
    seqBufferRef.current.reset();
    setState("idle");
  }, []);

  return { state, init, pushAudio, pushSequencedAudio, signalComplete, clear };
}
