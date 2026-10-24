---
name: Audio stream events
description: Defensive handling of OpenAI-compatible streamed audio events.
---

Audio streams can emit events without a choices array or answer delta. Skip these events safely rather than treating them as malformed answer chunks.

**Why:** A live speech-to-speech request produced transcript fragments followed by such an event; unguarded access interrupted the stream before audio playback and answer persistence completed.

**How to apply:** Guard both the choices array and delta when consuming audio completions, and verify the terminal done event plus persisted turn state.
