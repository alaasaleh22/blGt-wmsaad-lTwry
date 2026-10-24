---
name: Audio streaming safeguards
description: Defensive handling of streamed audio payloads and browser playback initialization.
---

Audio streams can emit events without a choices array or answer delta. Skip these events safely rather than treating them as malformed answer chunks.

**Why:** A live speech-to-speech request produced transcript fragments followed by such an event; unguarded access interrupted the stream before audio playback and answer persistence completed.

**How to apply:** Guard both the choices array and delta when consuming audio completions, and verify the terminal done event plus persisted turn state.

Playback initialization must have a deadline and a non-worklet playback fallback; it must not hold a recorded answer indefinitely before uploading.

**Why:** Browser testing reproduced an AudioWorklet module load that never settled despite its URL returning HTTP 200. Server-only voice tests passed because they did not exercise browser playback initialization.

**How to apply:** Verify start → stop → nonempty upload → SSE completion in the browser, including a deliberately stalled worklet load, rather than treating a successful server voice request as proof of the full recording journey.
