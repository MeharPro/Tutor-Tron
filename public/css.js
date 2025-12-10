// Initialize empty environment variables
export const env = {
    OPENROUTER_API_KEYS: "",
    DEEPGRAM_API_KEY: "",
    OPENAI_API_KEY: "",
    GEMINI_API_KEY: "",
};

// Create a promise that resolves when env vars are loaded
window.envLoaded = new Promise(async (resolve) => {
    try {
        const token = localStorage.getItem('teacherToken');
        const response = await fetch('/api/keys', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error('Failed to load API keys');
        const data = await response.json();
        env = data;
        console.log('API keys initialized');
        resolve();
    } catch (error) {
        console.error('Failed to initialize API keys:', error);
        resolve(); // Resolve anyway to prevent hanging
    }
});