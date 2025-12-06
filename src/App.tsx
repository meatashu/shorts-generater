import { useState, useRef, useEffect } from 'react';
import { generateText, getModels } from './services/ollama';
import type { GenerationOptions } from './services/ollama';
import { saveInteraction, getCachedInteraction } from './services/db';
import { Play, Square, Sparkles, Loader2, Settings as SettingsIcon, RotateCw, Download, Video, Bug, Code, DollarSign, Heart, Lightbulb, Smile, Frown, Monitor, Database as DatabaseIcon, Zap, Music, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import SettingsModal from './components/SettingsModal';
import './index.css';

function App() {
  const [prompt, setPrompt] = useState('Write a funny short story about a coding bug that became sentient.');
  const [script, setScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentCharIndex, setCurrentCharIndex] = useState(-1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [options, setOptions] = useState<GenerationOptions>({
    temperature: 0.7,
    top_p: 0.9,
  });

  const [videoTitle, setVideoTitle] = useState('');
  const [hashtags, setHashtags] = useState('#shorts #coding #tech #pandeykefundey');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const frameRequestRef = useRef<number>(0);

  const activeWordRef = useRef<HTMLSpanElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Auto-connect and select model on start
  useEffect(() => {
    const init = async () => {
      try {
        const models = await getModels();
        if (models.length > 0) {
          setSelectedModel(models[0].name);
        }
      } catch (e) {
        console.error("Initial connection failed", e);
      }
    };
    init();
  }, []);

  // Update title default when prompt changes (if not edited manually)
  useEffect(() => {
    if (!prompt) return;
    // Simple debounce or just set it if matches old logic
    const defaultTitle = `Shorts: ${prompt.slice(0, 20)}...`;
    if (!videoTitle || videoTitle.startsWith('Shorts:')) {
      setVideoTitle(defaultTitle);
    }
  }, [prompt]);

  const handleGenerate = async () => {
    if (!selectedModel) {
      setIsSettingsOpen(true);
      return;
    }
    setIsGenerating(true);
    setScript('');
    let fullResponse = "";
    try {
      await generateText(
        prompt + " Write a VERY short story/script. Maximum 50 words. No formatting or special characters.",
        selectedModel,
        options,
        (token: string) => {
          fullResponse += token;
          setScript(prev => prev + token);
        }
      );
      // Save on completion
      await saveInteraction(prompt, fullResponse, selectedModel);
    } catch (error) {
      alert("Failed to connect to Ollama. Use settings to check connection.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFetchCache = async () => {
    if (!prompt) return;
    try {
      const cached = await getCachedInteraction(prompt);
      if (cached) {
        setScript(cached.response);
      } else {
        alert("No cached result found for this prompt.");
      }
    } catch (e) {
      console.error("Cache fetch failed", e);
    }
  };

  // Basic Profanity Filter
  const filterText = (text: string) => {
    const blockList = ['badword', 'offensive', 'spam']; // Example list, easy to expand
    let clean = text;
    blockList.forEach(bad => {
      const regex = new RegExp(`\\b${bad}\\b`, 'gi');
      clean = clean.replace(regex, '*'.repeat(bad.length));
    });
    return clean;
  };

  const handlePlay = () => {
    if (isPlaying) {
      synthRef.current.cancel();
      setIsPlaying(false);
      return;
    }

    if (!script) return;

    setIsPlaying(true);
    const cleanScript = filterText(script);
    const utterance = new SpeechSynthesisUtterance(cleanScript);

    // Apply options
    utterance.pitch = options.pitch || 1.0;
    utterance.rate = options.rate || 1.0;
    if (options.voiceURI) {
      const voices = window.speechSynthesis.getVoices();
      const selected = voices.find(v => v.voiceURI === options.voiceURI);
      if (selected) utterance.voice = selected;
    }

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setCurrentCharIndex(event.charIndex);
      }
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setCurrentCharIndex(-1);
    };

    utterRef.current = utterance;
    synthRef.current.speak(utterance);
  };

  const handleGenerateVideo = async () => {
    if (!script || !scrollContainerRef.current) return;

    try {
      setIsRecording(true);

      // 1. Setup Canvas for Recording
      // We will capture the DOM element repeatedly
      const targetEl = scrollContainerRef.current;
      const { width, height } = targetEl.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error("Could not get canvas context");

      // 2. Setup Stream from Canvas
      const stream = canvas.captureStream(30); // 30 FPS

      // Select MIME type (Safari supports mp4, Chrome needs webm usually)
      const mimeTypes = [
        'video/mp4',
        'video/webm;codecs=h264',
        'video/webm'
      ];
      const mimeType = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
      console.log("Internal Recording MIME:", mimeType);

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const ext = (mimeType && mimeType.includes('mp4')) ? 'mp4' : 'webm';
        const blob = new Blob(recordedChunksRef.current, { type: mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${videoTitle.replace(/[^a-z0-9]/gi, '_') || 'video'}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setIsRecording(false);
        cancelAnimationFrame(frameRequestRef.current);
      };

      recorder.start();
      handlePlay(); // Start audio/animation

      // 3. Render Loop (The "Internal" conversion)
      const renderFrame = async () => {
        if (!setIsRecording) return; // check state? (closure stale, use ref if needed or rely on stop)

        // Use html2canvas to snap the DOM
        try {
          // We use a lighter config for speed if possible
          const frame = await html2canvas(targetEl, {
            backgroundColor: '#000000',
            scale: 1, // Retain 1:1 scale for performance
            logging: false,
            useCORS: true
          });

          ctx.drawImage(frame, 0, 0, width, height);

          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            frameRequestRef.current = requestAnimationFrame(renderFrame);
          }
        } catch (e) {
          console.error("Frame capture error", e);
        }
      };

      renderFrame();

    } catch (e) {
      console.error("Video Generation failed", e);
      setIsRecording(false);
      alert("Conversion failed. " + String(e));
    }
  };

  // Stop recorder when playback ends
  useEffect(() => {
    if (!isPlaying && isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      cancelAnimationFrame(frameRequestRef.current);
    }
  }, [isPlaying, isRecording]);

  // Icon Mapping
  const getKeywordsIcons = (text: string) => {
    const t = text.toLowerCase();
    const icons = [];
    if (t.includes('bug') || t.includes('error')) icons.push(<Bug key="bug" size={40} />);
    if (t.includes('code') || t.includes('program')) icons.push(<Code key="code" size={40} />);
    if (t.includes('money') || t.includes('rich') || t.includes('dollar')) icons.push(<DollarSign key="money" size={40} />);
    if (t.includes('love') || t.includes('heart')) icons.push(<Heart key="heart" size={40} />);
    if (t.includes('idea') || t.includes('think')) icons.push(<Lightbulb key="idea" size={40} />);
    if (t.includes('happy') || t.includes('smile')) icons.push(<Smile key="smile" size={40} />);
    if (t.includes('sad') || t.includes('cry')) icons.push(<Frown key="sad" size={40} />);
    if (t.includes('computer') || t.includes('screen')) icons.push(<Monitor key="monitor" size={40} />);
    if (t.includes('data') || t.includes('db')) icons.push(<DatabaseIcon key="db" size={40} />);
    if (t.includes('fast') || t.includes('speed')) icons.push(<Zap key="zap" size={40} />);

    // Default randoms if none
    if (icons.length === 0) {
      icons.push(<Sparkles key="s1" size={40} />);
      icons.push(<Music key="m1" size={40} />);
      icons.push(<ImageIcon key="i1" size={40} />);
    }

    return icons;
  };

  // Auto-scroll to active word
  useEffect(() => {
    if (activeWordRef.current && scrollContainerRef.current) {
      activeWordRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      });
    }
  }, [currentCharIndex]);

  // Render script with highlighted words
  const renderScript = () => {
    if (!script) return <div className="placeholder-text">Generated content will appear here.</div>;

    // Split by newlines to handle blocks/lists
    const lines = script.split('\n');
    let runningIndex = 0;

    return (
      <div className="teleprompter-text">
        {lines.map((line, lineIndex) => {
          // If line is empty (double newline), render a break roughly
          const isLastLine = lineIndex === lines.length - 1;
          const lineContent = line.split(/(\s+)/).filter(s => s.length > 0);

          // We need to account for the newline char that was stripped by split('\n')
          // except for the very last line
          const lineEndIndex = runningIndex + line.length + (isLastLine ? 0 : 1);

          const lineElement = (
            <div key={lineIndex} className="script-line">
              {lineContent.map((token, i) => {
                // Check if strictly whitespace
                if (!token.trim()) {
                  runningIndex += token.length;
                  return <span key={i} className="whitespace">{token}</span>;
                }

                const start = runningIndex;
                const end = runningIndex + token.length;
                runningIndex = end;

                const isActive = isPlaying && currentCharIndex >= start && currentCharIndex < end;
                const isSpoken = isPlaying && currentCharIndex >= end;

                return (
                  <span
                    key={i}
                    ref={isActive ? activeWordRef : null}
                    className={`
                                script-word
                                ${isActive ? 'active' : ''}
                                ${isSpoken ? 'spoken' : ''}
                            `}
                  >
                    {token}
                  </span>
                );
              })}
            </div>
          );

          // Add the newline character to running index for next iteration
          if (!isLastLine) {
            runningIndex += 1;
          }

          return lineElement;
        })}
      </div>
    );
  };

  const handleDownload = () => {
    if (!script) return;

    const description = `${script}\n\nDon't forget to Like & Subscribe to PandeyKeFundey!\n\n${hashtags}`;

    const fileContent = `TITLE:\n${videoTitle}\n\nDESCRIPTION:\n${description}\n\nSCRIPT:\n${script}`;

    const blob = new Blob([fileContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shorts_package_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">
          <Sparkles className="icon-logo" />
          <h1>ShortsGen</h1>
        </div>
        <button
          className="icon-btn settings-trigger"
          onClick={() => setIsSettingsOpen(true)}
        >
          <SettingsIcon />
        </button>
      </header>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedModel={selectedModel}
        onModelSelect={setSelectedModel}
        options={options}
        onOptionsChange={setOptions}
      />

      <main className="main-content">
        <div className="input-section">
          <textarea
            className="prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your short idea..."
          />
          <button
            className="generate-btn"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 className="spin" /> : <Sparkles />}
            {isGenerating ? 'Generating...' : 'Generate Script'}
          </button>
          <button
            className="cache-btn"
            onClick={handleFetchCache}
            title="Retrieve results for this prompt from database"
          >
            <RotateCw size={18} /> Cached
          </button>
        </div>

        <div className="preview-section">
          <div className="video-placeholder" ref={scrollContainerRef}>
            <div className="background-icons">
              {getKeywordsIcons(script).map((icon, i) => (
                <motion.div
                  key={i}
                  className="bg-icon-float"
                  initial={{ opacity: 0, y: 50 }}
                  animate={{
                    opacity: [0.1, 0.3, 0.1],
                    y: [-20, 20, -20],
                    x: Math.sin(i) * 50
                  }}
                  transition={{
                    duration: 5 + i,
                    repeat: Infinity,
                    repeatType: "mirror"
                  }}
                  style={{
                    left: `${(i * 30) % 80 + 10}%`,
                    top: `${(i * 20) % 80 + 10}%`,
                  }}
                >
                  {icon}
                </motion.div>
              ))}
            </div>
            {renderScript()}
          </div>

          <div className="controls">
            <button
              className="play-btn"
              onClick={handlePlay}
              disabled={!script || isGenerating || isRecording}
              title={isRecording ? "Recording..." : "Play Preview"}
            >
              {isPlaying ? <Square fill="currentColor" /> : <Play fill="currentColor" />}
            </button>
            <button
              className={`record-btn ${isRecording ? 'recording' : ''}`}
              onClick={handleGenerateVideo}
              disabled={!script || isGenerating || isPlaying}
              title="Generate Video with Audio"
            >
              <Video /> {isRecording ? 'Generating...' : 'Generate Video'}
            </button>
          </div>

          <div className="metadata-section">
            <input
              className="meta-input"
              value={videoTitle}
              onChange={e => setVideoTitle(e.target.value)}
              placeholder="Video Title"
            />
            <input
              className="meta-input"
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              placeholder="Hashtags"
            />
          </div>

          <div className="script-editor-container">
            <div className="download-section">
              <h3>Script & Metadata:</h3>
              <button className="download-btn" onClick={handleDownload} disabled={!script}>
                <Download size={16} /> Download Package
              </button>
            </div>
            <textarea
              className="script-editor"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Script will appear here. You can edit it before playing."
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
