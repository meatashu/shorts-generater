export interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
}

export interface OllamaModel {
    name: string;
    modified_at: string;
    size: number;
    details: {
        format: string;
        family: string;
        families: string[];
        parameter_size: string;
        quantization_level: string;
    };
}

export interface GenerationOptions {
    temperature?: number;
    top_p?: number;
    pitch?: number;
    rate?: number;
    voiceURI?: string;
}

export interface OllamaModelResponse {
    models: OllamaModel[];
}

export const getModels = async (): Promise<OllamaModel[]> => {
    try {
        const response = await fetch('/api/ollama/tags');
        if (!response.ok) throw new Error('Failed to fetch models');
        const data: OllamaModelResponse = await response.json();
        return data.models;
    } catch (error) {
        console.error('Error fetching models:', error);
        throw error;
    }
};

export const getModelCapabilities = (modelName: string) => {
    const name = modelName.toLowerCase();
    return {
        text: true, // All LLMs do text
        image: name.includes('llava') || name.includes('vision') || name.includes('bakllava'),
        audio: false, // Ollama doesn't typically serve audio models yet
        video: false,
    };
};

export const generateText = async (prompt: string, model: string, options: GenerationOptions = {}, onToken: (token: string) => void): Promise<string> => {
    try {
        const response = await fetch('/api/ollama/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                stream: true,
                options: options,
            }),
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }

        if (!response.body) return "";

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            // Ollama returns multiple JSON objects in one chunk sometimes, or broken JSONs
            // We need to handle NDJSON (Newline Delimited JSON) preferably
            // But typically it's one JSON per line
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json: OllamaResponse = JSON.parse(line);
                    onToken(json.response);
                    fullText += json.response;
                    if (json.done) {
                        return fullText;
                    }
                } catch (e) {
                    console.error("Error parsing JSON chunk", e);
                }
            }
        }
        return fullText;

    } catch (error) {
        console.error("Failed to generate text:", error);
        throw error;
    }
};
