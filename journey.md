# Building a Shorts Generator with Antigravity: A Development Journey

**Date Started:** December 6, 2025  
**Tech Stack:** React + TypeScript, Vite, Ollama, Local LLMs, Framer Motion, html2canvas  
**AI Pair Programmer:** Antigravity (Google Deepmind)

---

## The Vision

What started as a simple idea—"Let's generate short video scripts with a local LLM"—evolved into an ambitious full-stack application that generates complete video packages for social media. The goal: create a tool that transforms a simple text prompt into a production-ready video with synchronized audio, animated visuals, and metadata—all running locally.

---

## Phase 1: Foundation & Core Generation

### **Building the Basics**
The first step was to establish communication with Ollama, a local LLM runtime. Unlike cloud APIs, Ollama runs entirely on your machine, providing privacy and unlimited usage. Antigravity helped scaffold a clean React + TypeScript application with:

- **Streaming Text Generation:** Real-time script generation using Ollama's `/api/generate` endpoint
- **Modern UI:** Dark-themed interface with smooth animations via Framer Motion
- **Settings Modal:** Dynamic model selection, temperature/top_p controls, and real-time capability detection

**Key Insight:** Ollama's streaming API returns newline-delimited JSON. Antigravity implemented proper chunk parsing to handle incomplete JSON objects gracefully.

```typescript
// Streaming generation with proper error handling
async function* generateText(prompt, model, options) {
  const response = await fetch('/api/ollama/generate', {
    method: 'POST',
    body: JSON.stringify({ model, prompt, temperature, top_p })
  });
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        const json = JSON.parse(line);
        if (json.response) yield json.response;
      }
    }
  }
}
```

### **Challenge: Vite Proxy Configuration**
Ollama runs on `http://127.0.0.1:11434` by default, but React's dev server runs on a different port. Cross-origin requests would fail. Antigravity configured a Vite proxy:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, '')
      }
    }
  }
})
```

**Lesson Learned:** Always use `127.0.0.1` instead of `localhost` to avoid IPv6 resolution issues on macOS.

---

## Phase 2: The Teleprompter Experience

### **Real-Time Speech Synthesis**
The next evolution: bring the script to life with audio. We integrated the Web Speech API (`SpeechSynthesis`) to read the generated script aloud. But we didn't stop at basic playback—we wanted Netflix-style word-by-word highlighting.

**The Challenge:** Synchronize visual highlighting with audio playback.

**The Solution:** The `SpeechSynthesisUtterance.onboundary` event fires for each word, providing the exact character index. Antigravity implemented a character-tracking system:

```typescript
utterance.onboundary = (event) => {
  if (event.name === 'word') {
    setCurrentCharIndex(event.charIndex); // Highlight current word
  }
};

// Rendering with active word detection
const isActive = isPlaying && currentCharIndex >= start && currentCharIndex < end;
```

### **Auto-Scrolling Teleprompter**
As words were highlighted, we needed the viewport to follow along. Using React refs and the Intersection Observer pattern:

```typescript
useEffect(() => {
  if (activeWordRef.current && scrollContainerRef.current) {
    activeWordRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    });
  }
}, [currentCharIndex]);
```

**Design Decision:** We styled active words with a bright accent color and enlarged scale, while spoken words faded to a muted tone—creating a clear "past, present, future" visual timeline.

---

## Phase 3: Persistent Context with sql.js

### **The Problem: Lost Generations**
Users were losing their generated scripts on page refresh. We needed local persistence, but didn't want to set up a full database server.

### **The Solution: In-Browser SQLite**
Antigravity suggested `sql.js`, a WebAssembly port of SQLite that runs entirely in the browser. Combined with `idb-keyval` for persistence, we built a local database:

```typescript
// Initialize SQLite in memory
const SQL = await initSqlJs({ locateFile: file => `/${file}` });
let db = new SQL.Database();

// Create schema
db.run(`
  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    model TEXT,
    timestamp INTEGER
  )
`);

// Persist to IndexedDB
const data = db.export();
await set('ollama-db', data);
```

**Why This Matters:** Users can now cache results, retrieve past generations, and build a personal library of scripts—all without any backend infrastructure.

---

## Phase 4: The Video Generation Odyssey

This is where the project transformed from a script generator into a video production tool. The journey had many twists:

### **Attempt 1: Screen Recording API**
**Approach:** Use `navigator.mediaDevices.getDisplayMedia()` to record the screen.

**Problems Encountered:**
1. **Safari User Gesture Requirements:** Safari requires a direct user click to trigger `getDisplayMedia()`. Even a single `alert()` or `confirm()` dialog before the call breaks the gesture chain, resulting in a `NotAllowedError`.
2. **User Friction:** Users had to manually select the correct browser tab from a popup—error-prone and unintuitive.
3. **Inconsistent Cropping:** Recording captured the entire tab, including browser chrome, requiring manual cropping.

**Verdict:** ❌ Abandoned due to poor UX and browser inconsistencies.

---

### **Attempt 2: Internal Canvas Capture with html2canvas**
**Approach:** Render the DOM element to a canvas frame-by-frame, then stream to `MediaRecorder`.

**Implementation:**
```typescript
const canvas = document.createElement('canvas');
canvas.width = width;
canvas.height = height;
const ctx = canvas.getContext('2d');

const renderFrame = async () => {
  if (!isCapturing) {
    isCapturing = true;
    const frame = await html2canvas(targetEl, {
      backgroundColor: '#000000',
      scale: 1,
      logging: false,
      useCORS: true
    });
    ctx.drawImage(frame, 0, 0, width, height);
    isCapturing = false;
  }
  
  if (recorder.state === 'recording') {
    requestAnimationFrame(renderFrame);
  }
};

const stream = canvas.captureStream(30); // 30 FPS
const recorder = new MediaRecorder(stream, { 
  mimeType: 'video/webm', 
  videoBitsPerSecond: 5000000 
});
```

**✅ Success:** Clean, cropped video output without user prompts!

**New Problem:** The video was silent. `SpeechSynthesis` audio can't be captured programmatically—it's an accessibility API that bypasses the audio graph.

---

### **Attempt 3: Audio Capture via External TTS**
To embed audio, we needed a capturable source. Antigravity suggested **StreamElements TTS API** via a Vite proxy:

```typescript
// vite.config.ts
'/api/tts': {
  target: 'https://api.streamelements.com',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/api\/tts/, '/kappa/v2/speech')
}
```

**Audio Capture Architecture:**
```typescript
// Create audio element
const audioEl = new Audio();
audioEl.crossOrigin = "anonymous"; // Essential for CORS

// Create Web Audio context
const audioCtx = new AudioContext();
const source = audioCtx.createMediaElementSource(audioEl);
const dest = audioCtx.createMediaStreamDestination();

source.connect(audioCtx.destination); // To speakers
source.connect(dest); // To recorder

// Combine video + audio streams
const videoTrack = canvas.captureStream(30).getVideoTracks()[0];
const audioTrack = dest.stream.getAudioTracks()[0];
const combinedStream = new MediaStream([videoTrack, audioTrack]);

const recorder = new MediaRecorder(combinedStream);
```

**Critical Bug Encountered:** Videos were **empty** (0 bytes or very short).

**Root Causes Identified:**
1. **Closure Staleness:** The `renderFrame` loop checked a stale `isRecording` state variable, causing immediate exit.
2. **Premature Stop:** `await handlePlay()` resolved before audio finished, stopping the recorder after 500ms.
3. **No Data Chunks:** `recorder.start()` without a timeslice argument sometimes failed to emit `ondataavailable` events.

**The Fix:**
```typescript
// 1. Use live ref instead of stale state
if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

// 2. Don't await playback—let useEffect handle stopping
handlePlay(false); // Fire and forget

// 3. Use timeslice to guarantee chunks
recorder.start(1000); // Emit data every 1 second

// 4. Auto-stop when playback ends via useEffect
useEffect(() => {
  if (!isPlaying && isRecording && mediaRecorderRef.current?.state === 'recording') {
    mediaRecorderRef.current.stop();
  }
}, [isPlaying, isRecording]);
```

---

### **Attempt 4: Simplified Separation of Concerns**
After multiple attempts at unified video+audio generation, we pivoted to a **modular approach**:

1. **"Gen Video" Button:** Produces a silent MP4/WebM video using stable canvas capture
2. **"Audio" Button:** Downloads the TTS audio as a standalone MP3
3. **"Metadata" Button:** Exports title, script, and hashtags as text

**Rationale:** 
- Users can assemble the final video in any editor (iMovie, DaVinci Resolve, etc.)
- Each component is independently debugged and tested
- More flexible for different workflows (some users might want to add custom music, others might prefer different TTS voices)

---

## Phase 5: Polish & User Experience

### **Voice Customization**
Added a settings panel to control:
- **Voice Selection:** Choose from available `SpeechSynthesisVoice` options
- **Pitch Control:** 0.5 to 2.0x (slider)
- **Speed Control:** 0.5 to 2.0x (slider)
- **Remote TTS Toggle:** Switch between local browser TTS (for preview) and high-quality StreamElements voice (for export)

### **Profanity Filter**
Implemented a basic word-blocking system:
```typescript
const filterText = (text: string) => {
  const blockList = ['badword', 'offensive'];
  blockList.forEach(bad => {
    const regex = new RegExp(`\\b${bad}\\b`, 'gi');
    text = text.replace(regex, '*'.repeat(bad.length));
  });
  return text;
};
```

### **Dynamic Background Animations**
To make the video visually engaging, we added context-aware floating icons:
```typescript
const getKeywordsIcons = (text: string) => {
  if (text.includes('bug')) return <Bug />;
  if (text.includes('code')) return <Code />;
  // ... etc
};

// Render with randomized animation
<motion.div
  animate={{ 
    opacity: [0, 0.6, 0], 
    y: [-100, 100],
    rotate: [0, 360],
    scale: [0.5, 1.5, 0.5]
  }}
  transition={{ 
    duration: 3 + Math.random() * 4,
    repeat: Infinity 
  }}
/>
```

---

## Technical Challenges & Solutions

### **Challenge: Browser Compatibility**
- **Safari** prefers `video/mp4` encoding
- **Chrome/Firefox** prefer `video/webm`

**Solution:** MIME type detection with fallback
```typescript
const mimeTypes = ['video/mp4', 'video/webm;codecs=h264', 'video/webm'];
const supportedMime = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
```

### **Challenge: Performance**
`html2canvas` is CPU-intensive at 30 FPS.

**Solution:** Mutex-based frame capture
```typescript
let isCapturing = false;
const renderFrame = async () => {
  if (!isCapturing) {
    isCapturing = true;
    // ... capture frame
    isCapturing = false;
  }
  requestAnimationFrame(renderFrame);
};
```

### **Challenge: Word-Level Synchronization**
External TTS APIs don't provide word-level timing metadata.

**Attempted Solution:** Linear interpolation based on audio progress
```typescript
audioEl.ontimeupdate = () => {
  const progress = audioEl.currentTime / audioEl.duration;
  const charIdx = Math.floor(script.length * progress);
  setCurrentCharIndex(charIdx);
};
```

**Status:** Approximate—works for preview, but not frame-accurate. Future improvement: use Whisper alignment or forced alignment tools.

---

## Lessons Learned

### **1. Start Simple, Iterate**
We began with basic text generation and added features incrementally. Each phase built on a stable foundation.

### **2. Browser APIs Have Hidden Complexity**
What seems simple (like recording video) involves:
- User gesture requirements
- CORS policies
- Audio context handling
- Stream synchronization
- MIME type negotiation

### **3. Local-First Development**
Using Ollama + sql.js means zero external dependencies. The app works offline and respects user privacy.

### **4. Debugging Is Multi-Layered**
When the video was empty, the issue wasn't obvious. We added extensive logging:
```typescript
console.log("Recorder started");
console.log("Data available:", e.data.size, "bytes");
console.log("Recorder stopped. Total chunks:", chunks.length);
console.log("Final blob size:", blob.size);
```

These logs revealed the closure staleness issue that traditional debugging missed.

### **5. AI Pair Programming Accelerates Development**
Antigravity helped:
- Scaffold boilerplate code rapidly
- Debug obscure browser API issues
- Suggest alternative architectures when hitting walls
- Refactor code to fix lint errors and improve readability

---

## Current Architecture

```
┌─────────────────────────────────────────────────┐
│                   React App                     │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐            │
│  │   Ollama    │  │ SpeechSynth  │            │
│  │   Service   │  │ / Remote TTS │            │
│  └──────┬──────┘  └──────┬───────┘            │
│         │                 │                     │
│         ▼                 ▼                     │
│  ┌─────────────────────────────┐               │
│  │      Script Generator       │               │
│  └─────────────┬───────────────┘               │
│                │                                │
│                ▼                                │
│  ┌─────────────────────────────┐               │
│  │   Teleprompter (Framer)     │               │
│  │   + Word Highlighting       │               │
│  └─────────────┬───────────────┘               │
│                │                                │
│                ▼                                │
│  ┌─────────────────────────────┐               │
│  │   html2canvas Renderer      │               │
│  │   → MediaRecorder → MP4     │               │
│  └─────────────────────────────┘               │
│                                                 │
│  ┌─────────────────────────────┐               │
│  │   sql.js Local Database     │               │
│  │   (IndexedDB Persistence)   │               │
│  └─────────────────────────────┘               │
└─────────────────────────────────────────────────┘
```

---

## Future Enhancements

### **Planned Features**
- [ ] **SRT Subtitle Generation:** Export word-level timing data
- [ ] **Background Music:** Royalty-free tracks with volume ducking
- [ ] **Image Generation:** DALL-E/Stable Diffusion integration for visual B-roll
- [ ] **Advanced TTS:** Elevenlabs or Coqui for voice cloning
- [ ] **Batch Generation:** Process multiple prompts in sequence
- [ ] **YouTube Auto-Upload:** Direct upload via YouTube Data API

### **Technical Debt**
- [ ] Remove unused `srtToTimestamp` and `lineEndIndex` variables
- [ ] Add CSS vendor prefix for `background-clip`
- [ ] Improve error handling for network failures
- [ ] Add unit tests for core generation logic

---

## Metrics

**Lines of Code:** ~650 (excluding node_modules)  
**Dependencies:** 10 (Vite, React, Framer Motion, html2canvas, sql.js, idb-keyval, lucide-react)  
**Development Time:** ~3 hours (with Antigravity)  
**Coffee Consumed:** ☕☕☕

---

## How to Run

```bash
# Install dependencies
npm install

# Start Ollama (in separate terminal)
ollama serve

# Pull a model
ollama pull llama3.2

# Start dev server
npm run dev
```

---

## Reflections

This project showcases the power of modern web APIs and local-first AI. By combining:
- **Local LLMs** (Ollama)
- **In-Browser Databases** (sql.js)
- **Canvas Manipulation** (html2canvas)
- **Audio Synthesis** (Web Speech + External TTS)

...we built a complete video production pipeline that runs entirely in the browser. No cloud services. No API keys. No monthly subscriptions.

The journey had its challenges—figuring out MediaRecorder timing, debugging closure staleness, navigating Safari's strict security model—but each obstacle was a learning opportunity.

**Most importantly:** This entire application was built through pair programming with an AI. Antigravity suggested architectures, wrote boilerplate, debugged obscure issues, and refactored code—demonstrating that AI coding assistants are not just autocomplete tools, but genuine collaborative partners.

The future of development is **human creativity + AI execution**. This project is living proof.

---

**Built with ❤️ using Antigravity**  
**December 2025**
