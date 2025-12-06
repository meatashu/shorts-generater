# Future Feature Plan: Customization & Safety

## 1. Advanced Voice Control
**Goal:** Allow users to create distinct personas for their shorts.
- [ ] **Voice Selection**: Expose `window.speechSynthesis.getVoices()` to allow selecting different browser-provided voices (Google US English, Microsoft David, etc.).
- [ ] **Voice Texture**: Implement pitch and rate modulation to simulate different "textures" (e.g., Deep/Slow for horror, High/Fast for excitement).
- [ ] **ElevenLabs Integration**: (Long term) Add API integration for premium AI voices if local browser voices are insufficient.

## 2. Content Moderation (Safety)
**Goal:** Ensure generated content is safe for public upload.
- [x] **Basic Filtering**: Implement a "blocklist" of common offensive terms that get asterisks (***) or are removed.
- [ ] **AI Moderation**: Use a small separate Ollama prompt to "verify" the safety of the script before rendering.
- [ ] **User Overrides**: Allow users to toggle "Safe Mode" on/off in settings.

## 3. Visual Enhancements
**Goal:** Make the video more dynamic.
- [ ] **Image Generation**: Use a local Stable Diffusion (or Ollama/Llava if capable) to generate a static background image instead of just icons.
- [ ] **Ken Burns Effect**: Slowly pan/zoom the background image/icons.
- [ ] **Transition Effects**: Animate text in/out with different styles (Fade, Slide, Typewriter).

## 4. Audio Atmosphere
**Goal:** Increase engagement.
- [ ] **Background Music**: Add a library of royalty-free mp3s that can loop in the background.
- [ ] **Sound Effects**: Trigger SFX (ding, buzz) based on keywords in the script (similar to the icon logic).
