import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, X, Server, Database, CheckCircle, AlertCircle, RefreshCw, Type, Image as ImageIcon, Music, Video } from 'lucide-react';
import { getModels, getModelCapabilities } from '../services/ollama';
import type { OllamaModel, GenerationOptions } from '../services/ollama';
import '../index.css';

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
    selectedModel: string;
    onModelSelect: (model: string) => void;
    options: GenerationOptions;
    onOptionsChange: (options: GenerationOptions) => void;
}

const SettingsModal: React.FC<SettingsProps> = ({
    isOpen,
    onClose,
    selectedModel,
    onModelSelect,
    options,
    onOptionsChange
}) => {
    const [models, setModels] = useState<OllamaModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'error'>('checking');
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        const fetchVoices = () => {
            const vs = window.speechSynthesis.getVoices();
            setVoices(vs);
        };
        fetchVoices();
        window.speechSynthesis.onvoiceschanged = fetchVoices;
    }, []);

    const checkConnectionAndFetchModels = async () => {
        setLoading(true);
        setServerStatus('checking');
        setError(null);
        try {
            const availableModels = await getModels();
            setModels(availableModels);
            setServerStatus('connected');

            // Auto-select first model if needed
            if (availableModels.length > 0) {
                if (!selectedModel || !availableModels.find(m => m.name === selectedModel)) {
                    onModelSelect(availableModels[0].name);
                }
            }
        } catch (err) {
            console.error(err);
            setError('Could not connect to Ollama server. Is it running on port 11434?');
            setServerStatus('error');
            setModels([]);
        } finally {
            setLoading(false);
        }
    };

    const getCapabilities = (modelName: string) => {
        return getModelCapabilities(modelName);
    };

    useEffect(() => {
        if (isOpen) {
            checkConnectionAndFetchModels();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content"
                onClick={e => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h2><SettingsIcon size={24} /> Settings</h2>
                    <button className="icon-btn" onClick={onClose}><X size={24} /></button>
                </div>

                <div className="setting-group">
                    <div className="status-header">
                        <h3><Server size={18} /> Server Status</h3>
                        <button className="refresh-btn" onClick={checkConnectionAndFetchModels} disabled={loading}>
                            <RefreshCw size={16} className={loading ? 'spin' : ''} />
                        </button>
                    </div>

                    <div className={`status-indicator ${serverStatus}`}>
                        {serverStatus === 'checking' && <span>Checking connection...</span>}
                        {serverStatus === 'connected' && <span className="success"><CheckCircle size={16} /> Connected to 127.0.0.1:11434</span>}
                        {serverStatus === 'error' && <span className="error"><AlertCircle size={16} /> {error || "Connection Failed"}</span>}
                    </div>
                </div>

                <div className="setting-group">
                    <h3><Database size={18} /> Model Selection</h3>
                    {serverStatus === 'connected' ? (
                        <div className="model-selection-container">
                            <div className="model-list">
                                {models.length > 0 ? (
                                    <div className="custom-select-wrapper">
                                        <select
                                            value={selectedModel}
                                            onChange={(e) => onModelSelect(e.target.value)}
                                            className="model-select"
                                        >
                                            {models.map(model => (
                                                <option key={model.name} value={model.name}>
                                                    {model.name} ({(model.size / 1024 / 1024 / 1024).toFixed(1)} GB)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <p className="no-models">No models found. Run `ollama pull llama3` in terminal.</p>
                                )}
                            </div>

                            {selectedModel && (
                                <div className="capabilities">
                                    <span className="cap-label">Capabilities:</span>
                                    <div className={`cap-icon ${getCapabilities(selectedModel).text ? 'active' : ''}`} title="Text Generation">
                                        <Type size={16} />
                                    </div>
                                    <div className={`cap-icon ${getCapabilities(selectedModel).image ? 'active' : ''}`} title="Image Understanding">
                                        <ImageIcon size={16} />
                                    </div>
                                    <div className={`cap-icon ${getCapabilities(selectedModel).audio ? 'active' : ''}`} title="Audio">
                                        <Music size={16} />
                                    </div>
                                    <div className={`cap-icon ${getCapabilities(selectedModel).video ? 'active' : ''}`} title="Video">
                                        <Video size={16} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="dim-text">Connect to server to list models.</p>
                    )}
                </div>

                <div className="setting-group">
                    <h3>Parameters</h3>
                    <div className="param-control">
                        <label>
                            Temperature ({options.temperature ?? 0.7})
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={options.temperature ?? 0.7}
                                onChange={(e) => onOptionsChange({ ...options, temperature: parseFloat(e.target.value) })}
                            />
                        </label>
                    </div>
                    <div className="param-control">
                        <label>
                            Top P ({options.top_p ?? 0.9})
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={options.top_p ?? 0.9}
                                onChange={(e) => onOptionsChange({ ...options, top_p: parseFloat(e.target.value) })}
                            />
                        </label>
                    </div>
                </div>

                <div className="setting-group">
                    <h3>Audio Voice</h3>
                    <div className="param-control">
                        <label>
                            Voice Personality
                            <select
                                className="model-select"
                                value={options.voiceURI || ''}
                                onChange={(e) => onOptionsChange({ ...options, voiceURI: e.target.value })}
                            >
                                <option value="">Default Browser Voice</option>
                                {voices.map(v => (
                                    <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div className="param-control">
                        <label>
                            Pitch ({options.pitch ?? 1.0})
                            <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.1"
                                value={options.pitch ?? 1.0}
                                onChange={(e) => onOptionsChange({ ...options, pitch: parseFloat(e.target.value) })}
                            />
                        </label>
                    </div>
                    <div className="param-control">
                        <label>
                            Speed ({options.rate ?? 1.0})
                            <input
                                type="range"
                                min="0.5"
                                max="2"
                                step="0.1"
                                value={options.rate ?? 1.0}
                                onChange={(e) => onOptionsChange({ ...options, rate: parseFloat(e.target.value) })}
                            />
                        </label>
                    </div>
                </div>

                <div className="modal-footer">
                    <p className="info-text">
                        Ensure Ollama is running: <code>ollama serve</code>
                    </p>
                </div>

            </div>
        </div>
    );
};

export default SettingsModal;
