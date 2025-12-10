// API Service for handling OpenRouter API calls
const API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const REFERER = 'https://tutortron-preview.dizon-dzn12.workers.dev/';

class ApiService {
    constructor() {
        this.currentKeyIndex = 0;
        this.apiKeys = [];
    }

    async initialize() {
        try {
            const response = await fetch('/api/keys');
            const data = await response.json();
            if (data.OPENROUTER_API_KEY) {
                this.apiKeys = data.OPENROUTER_API_KEY.split(',').map(key => key.trim());
            }
            return true;
        } catch (error) {
            console.error('Failed to initialize API keys:', error);
            return false;
        }
    }

    async makeApiCall(messages, model, retryCount = 0) {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 2000;
        let lastError = null;

        // Try each API key
        const startIndex = this.currentKeyIndex;
        do {
            const apiKey = this.apiKeys[this.currentKeyIndex];
            try {
                const response = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                        'HTTP-Referer': REFERER,
                        'X-Title': 'Tutor-Tron'
                    },
                    body: JSON.stringify({
                        model,
                        messages,
                        temperature: 0.7,
                        max_tokens: 1024,
                        provider: {
                            order: ["DeepInfra", "SambaNova", "Google AI Studio"],
                            allow_fallbacks: true
                        }
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    if (response.status === 429) {
                        lastError = error;
                        this.rotateKey();
                        continue;
                    }
                    throw new Error(`OpenRouter API error: ${JSON.stringify(error)}`);
                }

                const data = await response.json();
                return data;
            } catch (error) {
                console.error('API call error:', error);
                lastError = error;
                this.rotateKey();
            }
        } while (this.currentKeyIndex !== startIndex);

        // If all keys failed and we haven't exceeded max retries
        if (retryCount < MAX_RETRIES) {
            console.log(`All keys failed, retrying in ${RETRY_DELAY}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return this.makeApiCall(messages, model, retryCount + 1);
        }

        throw new Error('All API keys failed: ' + (lastError?.message || 'Rate limits exceeded'));
    }

    rotateKey() {
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    }
}

export const apiService = new ApiService(); 