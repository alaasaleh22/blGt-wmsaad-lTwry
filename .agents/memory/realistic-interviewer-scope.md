---
name: Realistic interviewer scope
description: What the user means by a realistic virtual job interview.
---

The user clarified: “كنت اقصد ان يكون شخص مقابلي وكأنني في مقابلة وظيفية حقيقية”.

**Why:** A local webcam preview and a voice-only AI indicator do not satisfy the requested human-presenting video interviewer.

**How to apply:** Treat interactive human-presenting video as the intended experience. Do not claim that a static portrait, prerecorded clip, waveform or the candidate's own camera fulfills it. Explain any external account and usage requirements before committing to a provider.

The user also explicitly requested “تطبيق للهاتف”; a responsive web page alone is not the requested phone app.

**Why:** The user repeated the phone-app request while the video integration was being implemented.

**How to apply:** Preserve a native phone interface and native camera/microphone capabilities, rather than packaging the whole web app as a WebView.

Use the video provider as a receive-only renderer for generated interviewer audio; keep interview questions, turns and evaluation in the existing interview service.

**Why:** A provider-managed conversation would create a second independent interview and could bypass the selected question count and saved feedback. Native WebRTC dependencies also require compatibility checks before using them in Expo Go; an isolated media WebView is a deliberate fallback, not a whole-app wrapper.

**How to apply:** Do not publish the candidate's camera or microphone to the avatar room. Check provider sandbox limits and spending consent before enabling long sessions; a free one-minute video trial is not a full 15–20-question video interview.
