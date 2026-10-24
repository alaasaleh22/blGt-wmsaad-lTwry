---
name: Video readiness
description: Evidence required before claiming that an avatar video connection is working.
---

An avatar must not be labelled live solely because its control socket connected or its video track subscribed. Require an actual decoded frame.

**Why:** A receive-only avatar connection reached those states while the video element remained empty. Audio RTP could arrive without any inbound video.

**How to apply:** Keep ordinary answering available when video fails. Check decoded dimensions or frame counters, not only connection events, before declaring video verified. A static preview is not a fallback live interviewer.

Codec support is client-specific; the preview testing browser may advertise VP8 but no H264.

**Why:** This capability difference was observed during integration verification. A browser-only failure cannot establish whether the same stream works on an actual phone.

**How to apply:** Inspect receiver capabilities and negotiated/inbound video before changing providers or claiming native-device compatibility. Report browser checks separately from physical-device checks.
