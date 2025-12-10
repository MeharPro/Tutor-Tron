        // Add MathJax configuration
        window.MathJax = {
            tex: {
                inlineMath: [['$', '$'], ['\\(', '\\)']],
                displayMath: [['$$', '$$'], ['\\[', '\\]']],
                processEscapes: true,
                processEnvironments: true,
                packages: ['base', 'ams', 'noerrors', 'noundefined']
            },
            options: {
                skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
                ignoreHtmlClass: 'tex2jax_ignore',
                processHtmlClass: 'tex2jax_process'
            },
            startup: {
                ready: () => {
                    console.log('MathJax is ready');
                    MathJax.startup.defaultReady();
                    mathJaxReady = true;
                    // Typeset any existing math content
                    MathJax.typesetPromise().catch((err) => console.error('MathJax typeset error:', err));
                }
            }
        };

// Load MathJax
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
script.async = true;

document.head.appendChild(script);

// Load highlight.js
const highlightScript = document.createElement('script');
highlightScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
highlightScript.onload = () => {
    console.log('Highlight.js loaded');
    // Load common languages
    ['cpp', 'python', 'javascript', 'java', 'csharp'].forEach(lang => {
        const script = document.createElement('script');
        script.src = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/${lang}.min.js`;
        document.head.appendChild(script);
    });
};
document.head.appendChild(highlightScript);

// Load highlight.js CSS
const highlightCSS = document.createElement('link');
highlightCSS.rel = 'stylesheet';
highlightCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css';
document.head.appendChild(highlightCSS);

// Define all global variables at the top
window.messageHistory = []; // Full history with evaluation data
window.displayHistory = []; // Clean history without evaluation data

// Helper function to check if we're in evaluation mode
function isEvaluationMode() {
    return window.location.pathname.includes('evaluate');
}

// Helper function to clean evaluation data from message
function cleanEvaluationData(content) {
    const assessmentDoneMarker = "ASSESSMENT DONE! Ask your teacher for any feedback and comments.";
    if (content.includes(assessmentDoneMarker)) {
        return assessmentDoneMarker;
    }
    return content;
}

// Helper function to add messages to histories
function addToHistories(message) {
    // Add to full history
    window.messageHistory.push({ ...message });

    // Add to display history (skip system messages and clean evaluation data)
    if (message.role !== 'system') {
        let displayMessage = { ...message };
        // Always clean evaluation data for display
        if (message.role === 'assistant') {
            displayMessage.content = cleanEvaluationData(displayMessage.content);
        }
        window.displayHistory.push(displayMessage);
    }
}

// Helper function to reset histories
function resetHistories(systemPrompt) {
    window.messageHistory = [{
        role: 'system',
        content: systemPrompt
    }];
    window.displayHistory = [];
}

let currentModelIndex = 0;
let isProcessing = false;
let chatContainer;
let currentSubject = '';
let currentPrompt = '';
let currentMode = '';
let apiService;
let mathJaxReady = false;
let imageData = null;
let isPro = false; // Add isPro flag

// Constants for image upload
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_HISTORY_MESSAGES = 4;

// Define available models in order of preference
const FREE_MODELS = [
    "google/gemini-2.0-flash-lite-preview-02-05:free",
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-exp-1206:free",
    "google/gemini-2.0-flash-thinking-exp:free",
    "google/gemini-exp-1121:free",
    "google/gemini-exp-1114:free",
    "meta-llama/llama-3.1-405b-instruct:free",
    "openchat/openchat-7b:free",
    "qwen/qwen-2-7b-instruct:free",
    "google/learnlm-1.5-pro-experimental:free",
    "liquid/lfm-40b:free",
    "google/gemini-exp-1114",
    "google/gemma-2-9b-it:free"
];

const PRO_MODEL = "gpt-5-mini-2025-08-07";
const VISION_MODEL = "meta-llama/llama-3.2-90b-vision-instruct:free"; // Updated to OpenAI's vision model

// Add a flag to track if we've switched to vision model
let switchedToVisionModel = false;

// Add loading state functions
function showLoading() {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) loadingDiv.style.display = 'block';
}

function hideLoading() {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) loadingDiv.style.display = 'none';
}

// Add error display function
function showError(message) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        const errorMessage = errorDiv.querySelector('.error-message');
        if (errorMessage) errorMessage.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    } else {
        console.error(message);
    }
}

// Move formatMathContent to global scope
function formatMathContent(content) {
    if (!content || typeof content !== 'string') {
        console.warn('Invalid content passed to formatMathContent:', content);
        return String(content || '');
    }

    // Language aliases mapping
    const languageAliases = {
        'cpp': 'cpp',
        'c++': 'cpp',
        'Cpp': 'cpp',
        'CPP': 'cpp',
        'py': 'python',
        'python': 'python',
        'Python': 'python',
        'js': 'javascript',
        'javascript': 'javascript',
        'JavaScript': 'javascript',
        'java': 'java',
        'Java': 'java',
        'cs': 'csharp',
        'csharp': 'csharp',
        'c#': 'csharp',
        'C#': 'csharp'
    };

    try {
        // First protect code blocks from other formatting
        const codeBlocks = [];
        content = content.replace(/```([\w+]+)?\s*([\s\S]*?)```/g, (match, lang, code) => {
            const normalizedLang = lang ? languageAliases[lang.trim()] || lang.toLowerCase() : '';
            codeBlocks.push({ language: normalizedLang, code: code.trim() });
            return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
        });

        // Handle LaTeX delimiters
        content = content
            .replace(/\\\((.*?)\\\)/g, '$ $1 $')
            .replace(/\\\[(.*?)\\\]/g, '$$ $1 $$')
            .replace(/\$\$([\s\S]*?)\$\$/g, (match, tex) => {
                return `<div class="math-display">$$ ${tex.trim()} $$</div>`;
            })
            .replace(/\$(.*?)\$/g, (match, tex) => {
                return `<span class="math-inline">$ ${tex.trim()} $</span>`;
            });

        // Format bullet points
        content = content.replace(/^\* /gm, '• ');

        // Format headers
        content = content
            .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
            .replace(/^## (.*?)$/gm, '<h2>$2</h2>')
            .replace(/^### (.*?)$/gm, '<h3>$3</h3>');

        // Handle general formatting
        content = content
            .replace(/\n\n/g, '<br><br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Restore code blocks with syntax highlighting
        content = content.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
            const block = codeBlocks[parseInt(index)];
            const formattedCode = block.code
                .replace(/</g, '<')
                .replace(/>/g, '>');
            return `<pre><code class="language-${block.language}">${formattedCode}</code></pre>`;
        });

        return content;
    } catch (error) {
        console.error('Error in formatMathContent:', error);
        return String(content);
    }
}

// Move appendMessage to global scope
function appendMessage(role, content, hasImage = false) {
    console.log('Appending message:', { role, hasImage, hasImageData: !!imageData });

    if (!chatContainer) {
        chatContainer = document.getElementById('chatContainer');
    }
    if (!chatContainer) {
        console.error('Chat container not found');
        return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    // Add a small role badge instead of emoji
    const badge = document.createElement('span');
    badge.className = 'role-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = role === 'assistant' ? 'Tutor-Tron' : 'You';
    messageDiv.appendChild(badge);

    // Create message content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (role === 'user' && hasImage && imageData) {
        console.log('Adding image to message');
        const imgElement = document.createElement('img');
        imgElement.src = `data:image/jpeg;base64,${imageData}`;
        imgElement.className = 'message-image';
        imgElement.alt = 'Uploaded image';
        contentDiv.appendChild(imgElement);

        if (content && content !== 'Image uploaded') {
            const textDiv = document.createElement('div');
            textDiv.innerHTML = formatMathContent(content);
            contentDiv.appendChild(textDiv);
        }
    } else {
        // Always use clean content for display
        if (role === 'assistant') {
            content = cleanEvaluationData(content);
        }
        contentDiv.innerHTML = formatMathContent(content);
    }

    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    if (hasImage) {
        // Clear image data after sending
        imageData = null;
        const imagePreviewContainer = document.getElementById('image-preview-container');
        const imagePreviewThumbnail = document.getElementById('image-preview-thumbnail');
        if (imagePreviewContainer && imagePreviewThumbnail) {
            imagePreviewContainer.style.display = 'none';
            imagePreviewThumbnail.src = '';
        }
    }

    // Handle code highlighting and math rendering
    messageDiv.querySelectorAll('pre code').forEach((block) => {
        if (window.hljs) {
            window.hljs.highlightElement(block);
        }
    });

    if (window.MathJax) {
        window.MathJax.typesetPromise([messageDiv]).catch(err =>
            console.error('MathJax error:', err)
        );
    }
}

// Add this function to get the system prompt based on mode
function getSystemPrompt(mode) {
    return TutorMode.getSystemPrompt(mode) || '';
}

// Add this function to initialize the conversation with system prompt
function initializeConversation() {
    const mode = window.TUTOR_CONFIG.mode;
    const systemPrompt = getSystemPrompt(mode);
    console.log('Initializing conversation with mode:', mode);

    resetHistories(systemPrompt + window.TUTOR_CONFIG.subject + ", " + window.TUTOR_CONFIG.prompt);

    // Function to append message to histories
    function appendMessageToHistories(message) {
        addToHistories(message);
    }

    // Update message handling functions to use appendMessageToHistories
    async function handleUserMessage(userInput) {
        if (!userInput.trim()) return;

        // Add user message
        const userMessage = {
            role: 'user',
            content: userInput
        };
        appendMessageToHistories(userMessage);
        appendMessage(userMessage);
    }

    // Initialize message history with system and teacher prompts
    let content = systemPrompt + window.TUTOR_CONFIG.subject + ", " + window.TUTOR_CONFIG.prompt;

    // Only add language for pro users
    if (isPro && window.TUTOR_CONFIG.language && window.TUTOR_CONFIG.language !== 'English') {
        content += ` Please respond in ${window.TUTOR_CONFIG.language}.`;
    }

    // Add teacher prompt if present
    if (window.TUTOR_CONFIG.prompt) {
        content += '\n\n' + window.TUTOR_CONFIG.prompt;
    }

    window.messageHistory = [{
        role: 'system',
        content: content
    }];
}

// --- Token Tracking Variables ---
window.inputTokenCount = 0;
window.outputTokenCount = 0;
window.sessionLinkID = null; // To store the link ID for updates

// --- Function to estimate tokens (simple word count) ---
function estimateTokens(text) {
    if (!text) return 0;
    return text.split(/\s+/).filter(word => word !== "").length; // Simple word count
}

// Update the handleSendMessage function
async function handleSendMessage() {
    if (isProcessing) return;

    const userInput = document.getElementById('userInput').value.trim();
    if (!userInput) return;

    // Clear input and show loading state
    document.getElementById('userInput').value = '';
    isProcessing = true;
    showLoading();

    // Add user message to UI
    appendMessage('user', userInput);

    // Increment input token count
    const inputTokens = estimateTokens(userInput);
    window.inputTokenCount += inputTokens;
    console.log(`User Input Tokens: ${inputTokens}, Total Input Tokens: ${window.inputTokenCount}`);

    try {
        let messageContent;
        if (imageData) {
            messageContent = [
                { type: "text", text: userInput || "What's in this image?" },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageData}` } }
            ];
        } else {
            messageContent = userInput;
        }

        // Add user message to history
        addToHistories({
            role: 'user',
            content: messageContent
        });

        const endpoint = isPro ? '/api/pro/chat' : '/api/chat';
        const model = imageData ? VISION_MODEL : (isPro ? PRO_MODEL : FREE_MODELS[currentModelIndex]);

        console.log('Using model:', model);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: messageContent,
                subject: window.TUTOR_CONFIG.subject || currentSubject,
                prompt: window.TUTOR_CONFIG.prompt || currentPrompt,
                mode: window.TUTOR_CONFIG.mode || currentMode,
                model,
                messageHistory: window.messageHistory
            })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();

        // Add assistant response to history and UI
        if (data.response) {
            // Increment output token count
            const outputTokens = estimateTokens(data.response);
            window.outputTokenCount += outputTokens;
            console.log(`AI Output Tokens: ${outputTokens}, Total Output Tokens: ${window.outputTokenCount}`);

            addToHistories({
                role: 'assistant',
                content: data.response
            });

            // Trim message history to maintain 10 message limit
            const MAX_MESSAGES = 40;
            const systemMessage = window.messageHistory.find(msg => msg.role === 'system');
            const nonSystemMessages = window.messageHistory.filter(msg => msg.role !== 'system');

            // Keep only the most recent messages (excluding system message)
            const recentMessages = nonSystemMessages.slice(-MAX_MESSAGES + 1); // +1 for system message

            // Reconstruct message history with system message first
            window.messageHistory = systemMessage ? [systemMessage, ...recentMessages] : recentMessages;

            appendMessage('assistant', data.response);
        }

        // Clear image data after successful processing
        if (imageData) {
            imageData = null;
            document.getElementById('imagePreview').style.display = 'none';
        }
    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'Failed to process message');
        // Remove the failed message from history
        window.messageHistory.pop();
    } finally {
        isProcessing = false;
        hideLoading();
    }
}

// Update formatMessages to use the current message history
function formatMessages(userInput, model) {
    const MAX_MESSAGES = 25;  // Set same limit as server

    // Get system message if present
    const systemMessage = window.messageHistory.find(msg => msg.role === 'system');

    // Get recent messages excluding system message
    const recentMessages = window.messageHistory
        .filter(msg => msg.role !== 'system')
        .slice(-(MAX_MESSAGES - 1)); // -1 to make room for system message

    // Construct final messages array
    const messages = systemMessage ? [systemMessage, ...recentMessages] : recentMessages;

    // Add current user message
    messages.push({
        role: 'user',
        content: userInput
    });

    return messages;
}

// Update makeInitialApiCall function
async function makeInitialApiCall(apiKeys, systemMessage, retryCount = 0) {
    try {
        if (!apiService) {
            await initializeApiService();
        }

        const model = FREE_MODELS[currentModelIndex];
        console.log('Making initial API call with model:', model);

        try {
            let messages;
            if (model === "google/gemini-2.0-flash-exp:free") {
                messages = [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: systemMessage
                            }
                        ]
                    }
                ];
            } else {
                messages = [
                    {
                        role: "system",
                        content: systemMessage
                    }
                ];
            }

            const response = await Promise.race([
                apiService.makeApiCall(messages, model),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timed out')), 30000)
                )
            ]);

            // Check for error in response
            if (response.error) {
                throw new Error(response.error.message || 'API error occurred');
            }

            // Handle different response formats
            if (response.choices && response.choices.length > 0) {
                const choice = response.choices[0];
                let message;

                // Handle Google Flash 2 format
                if (model === "google/gemini-2.0-flash-exp:free" && choice.content) {
                    if (Array.isArray(choice.content)) {
                        message = choice.content.map(c => c.text).join('\n');
                    } else if (typeof choice.content === 'object' && choice.content.text) {
                        message = choice.content.text;
                    } else {
                        message = choice.content;
                    }
                }
                // Handle OpenAI/OpenRouter format
                else if (choice.message && choice.message.content) {
                    message = choice.message.content;
                }
                // Handle other Google formats
                else if (choice.content) {
                    message = choice.content;
                }
                // Handle text-only format
                else if (choice.text) {
                    message = choice.text;
                }
                // Handle raw text format
                else if (typeof choice === 'string') {
                    message = choice;
                }
                else {
                    throw new Error('Unexpected response format');
                }

                return message;
            }

            throw new Error('No valid response content');
        } catch (error) {
            console.error('API call error:', error);

            // Try next model if available
            currentModelIndex = (currentModelIndex + 1) % FREE_MODELS.length;
            if (currentModelIndex !== 0) {
                console.log('Trying next model:', FREE_MODELS[currentModelIndex]);
                return makeInitialApiCall(apiKeys, systemMessage, 0);
            }
            throw error;
        }
    } catch (error) {
        console.error('Initial API call failed:', error);
        // Try next model if available
        currentModelIndex = (currentModelIndex + 1) % FREE_MODELS.length;
        if (currentModelIndex !== 0) {
            console.log('Trying next model:', FREE_MODELS[currentModelIndex]);
            return makeInitialApiCall(apiKeys, systemMessage, 0);
        }
        throw error;
    }
}

// Update tryApiCall function
async function tryApiCall(message, model, retryCount = 0) {
    try {
        const response = await Promise.race([
            apiService.makeApiCall(message, model),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timed out')), 30000)
            )
        ]);

        if (!response.ok) {
            const error = await response.json();
            console.error('OpenRouter error:', error);

            // If payment required or rate limit, try next key
            if (response.status === 402 || response.status === 429) {
                this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
                if (this.currentKeyIndex === 0) {
                    throw new Error('All API keys exhausted');
                }
                console.log('Trying next API key...');
                return this.makeOpenRouterCall(message, model);
            }

            throw new Error(error.error || 'API request failed');
        }

        return await response.json();
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            const backoffDelay = RATE_LIMIT_RETRY_DELAY * Math.pow(2, retryCount);
            console.log(`Error occurred, retrying in ${backoffDelay}ms (${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            return tryApiCall(message, model, retryCount + 1);
        }
        throw error;
    }
}

// Helper function to format messages based on model
function formatMessages(userMessage, model) {
    const MAX_MESSAGES = 10;  // Set same limit as server

    // Get system message if present
    const systemMessage = window.messageHistory.find(msg => msg.role === 'system');

    // Get recent messages excluding system message
    const recentMessages = window.messageHistory
        .filter(msg => msg.role !== 'system')
        .slice(-(MAX_MESSAGES - 1)); // -1 to make room for system message

    // Construct final messages array
    const messages = systemMessage ? [systemMessage, ...recentMessages] : recentMessages;

    // Add current user message
    messages.push({
        role: 'user',
        content: userMessage
    });

    return messages;
}

// Update makeApiCall function
async function makeApiCall(messages, model = null) {
    try {
        if (!apiService) {
            await initializeApiService();
        }

        // For pro links, use OpenAI API directly
        if (isPro) {
            try {
                const response = await fetch('/api/pro/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: messages[messages.length - 1].content,
                        subject: window.TUTOR_CONFIG.subject || currentSubject,
                        prompt: window.TUTOR_CONFIG.prompt || currentPrompt,
                        mode: window.TUTOR_CONFIG.mode || currentMode,
                        model: PRO_MODEL,
                        messageHistory: messages
                    })
                });

                if (!response.ok) {
                    throw new Error('Pro API request failed');
                }

                return response.json();
            } catch (error) {
                console.error('Pro API error:', error);
                throw error; // Don't fall back to OpenRouter for pro links
            }
        }

        // For free links, use OpenRouter
        return this.makeOpenRouterCall(messages, model || FREE_MODELS[currentModelIndex]);
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

// Update image upload handler
imageInput.addEventListener('change', async (e) => {
    console.log('Image input change event triggered');
    const file = e.target.files[0];
    if (file) {
        console.log('File selected:', file.name, file.type, file.size);

        // Validate file type
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            showError('Please upload a valid image file (JPEG, PNG, or GIF)');
            imageInput.value = '';
            return;
        }

        // Validate file size
        if (file.size > MAX_IMAGE_SIZE) {
            showError('Image size must be less than 5MB');
            imageInput.value = '';
            return;
        }

        try {
            console.log('Processing image file...');
            const reader = new FileReader();

            reader.onload = async (event) => {
                try {
                    console.log('Image file read successfully');
                    imageData = event.target.result.split(',')[1];
                    imagePreviewThumbnail.src = event.target.result;
                    imagePreviewContainer.style.display = 'inline-block';

                    // Set the flag to switch to vision model permanently for free users
                    if (!isPro) {
                        switchedToVisionModel = true;
                        console.log('Switched to vision model permanently');
                    }

                    showMessage('Image ready to send!', 'info', 2000);
                    if (userInput) userInput.focus();
                } catch (error) {
                    console.error('Error processing image:', error);
                    showError('Failed to process image. Please try again.');
                    imageData = null;
                }
            };

            reader.onerror = (error) => {
                console.error('FileReader error:', error);
                showError('Failed to read image file. Please try again.');
                imageData = null;
            };

            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error in image processing:', error);
            showError('Failed to process image. Please try again.');
            imageData = null;
        }
    }
});

// Add this function to initialize the API service
async function initializeApiService() {
    try {
        // For free users, use OpenRouter
        const response = await fetch('/api/keys');
        const data = await response.json();
        if (!data.OPENROUTER_API_KEYS) {
            throw new Error('No API keys found');
        }

        const openRouterKeys = data.OPENROUTER_API_KEYS.split(',').map(key => key.trim());

        apiService = {
            apiKeys: openRouterKeys,
            currentKeyIndex: 0,
            lastCallTime: 0,

            async makeOpenRouterCall(messages, model) {
                const key = this.apiKeys[this.currentKeyIndex];
                try {
                    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${key}`,
                            'Content-Type': 'application/json',
                            'HTTP-Referer': window.location.href,
                            'X-Title': 'Tutor-Tron'
                        },
                        body: JSON.stringify({
                            model,
                            messages,
                            temperature: 0.7,
                            max_tokens: 512
                        })
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        console.error('OpenRouter error:', error);

                        // If payment required or rate limit, try next key
                        if (response.status === 402 || response.status === 429) {
                            this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
                            if (this.currentKeyIndex === 0) {
                                throw new Error('All API keys exhausted');
                            }
                            console.log('Trying next API key...');
                            return this.makeOpenRouterCall(messages, model);
                        }

                        throw new Error(error.error || 'API request failed');
                    }

                    return await response.json();
                } catch (error) {
                    console.error('OpenRouter call error:', error);
                    // Only retry with next key if it's a payment/rate limit issue
                    if (error.message.includes('402') || error.message.includes('429')) {
                        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
                        if (this.currentKeyIndex === 0) {
                            throw new Error('All API keys exhausted');
                        }
                        console.log('Trying next API key...');
                        return this.makeOpenRouterCall(messages, model);
                    }
                    throw error;
                }
            },

            async makeApiCall(messages, model) {
                try {
                    if (!apiService) {
                        await initializeApiService();
                    }

                    // For pro links, use OpenAI API directly
                    if (isPro) {
                        try {
                            const response = await fetch('/api/pro/chat', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    message: messages[messages.length - 1].content,
                                    subject: window.TUTOR_CONFIG.subject || currentSubject,
                                    prompt: window.TUTOR_CONFIG.prompt || currentPrompt,
                                    mode: window.TUTOR_CONFIG.mode || currentMode,
                                    model: PRO_MODEL,
                                    messageHistory: messages
                                })
                            });

                            if (!response.ok) {
                                throw new Error('Pro API request failed');
                            }

                            return response.json();
                        } catch (error) {
                            console.error('Pro API error:', error);
                            throw error; // Don't fall back to OpenRouter for pro links
                        }
                    }

                    // For free links, use OpenRouter
                    return this.makeOpenRouterCall(messages, model || FREE_MODELS[currentModelIndex]);
                } catch (error) {
                    console.error('API call error:', error);
                    throw error;
                }
            }
        };

        return true;
    } catch (error) {
        console.error('Failed to initialize API service:', error);
        return false;
    }
}

// --- Function to update token count on server ---
async function updateTokenCountOnServer() {
    if (!window.sessionLinkID) {
        console.warn("No session link ID available to update token count.");
        return;
    }

    const totalTokens = window.inputTokenCount + window.outputTokenCount;
    console.log(`Attempting to update token count for link ID: ${window.sessionLinkID}, Total Tokens: ${totalTokens}`);

    try {
        const response = await fetch(`/api/links/${window.sessionLinkID}/update-tokens`, { // New API endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token_count: totalTokens
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to update token count on server:', response.status, response.statusText, errorData);
        } else {
            console.log('Token count updated successfully on server.');
        }
    } catch (error) {
        console.error('Error updating token count:', error);
    }
}

// --- Event Listeners to Trigger Token Update ---

// Before unload (tab close or reload)
window.addEventListener('beforeunload', function(event) {
    updateTokenCountOnServer();
});

// Visibility change (user goes off-screen/switches tabs)
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
        updateTokenCountOnServer();
    }
});

// --- Token Tracking Variables ---
window.inputTokenCount = 0;
window.outputTokenCount = 0;
window.sessionLinkID = null; // To store the link ID for updates

// --- Function to estimate tokens (simple word count) ---
function estimateTokens(text) {
    if (!text) return 0;
    return text.split(/\s+/).filter(word => word !== "").length; // Simple word count
}

// Update initialization code
document.addEventListener("DOMContentLoaded", async () => {
    try {

        // Get Pro status from URL
        isPro = window.location.pathname.includes('/pro/');
        console.log('Is Pro link:', isPro);

        // Initialize UI elements
        const imageInput = document.getElementById('imageInput');
        const imagePreviewContainer = document.getElementById('image-preview-container');
        const imagePreviewThumbnail = document.getElementById('image-preview-thumbnail');
        const removeImageButton = document.getElementById('remove-image');
        const userInput = document.getElementById('userInput');
        const sendButton = document.getElementById('sendButton');
        const copyButton = document.getElementById('copyButton');
        chatContainer = document.getElementById('chatContainer');

        if (!chatContainer) {
            throw new Error('Chat container not found');
        }

        // Initialize Lucide icons
        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Show Pro banner if it's a Pro link
        if (isPro) {
            const proBanner = document.getElementById('proBanner');
           // const imageButton = document.getElementById('imageUploadButton');
            if (proBanner) {
                proBanner.style.display = 'flex';
               // imageButton.style.display = 'flex';
            }
        }

        // Initialize API service
        const apiInitialized = await initializeApiService();
        if (!apiInitialized) {
            showError('Failed to initialize API service');
            return;
        }

        // Get configuration
        currentSubject = window.TUTOR_CONFIG?.subject || 'general topics';
        currentMode = window.TUTOR_CONFIG?.mode?.toLowerCase() || 'investigator';
        currentPrompt = window.TUTOR_CONFIG?.prompt;

        const systemPrompt = getSystemPrompt(currentMode) + currentSubject;

        // Initialize message histories
        resetHistories(systemPrompt + window.TUTOR_CONFIG.subject + ", " + window.TUTOR_CONFIG.prompt);

        // Function to append message to histories
        function appendMessageToHistories(message) {
            addToHistories(message);
        }

        // Update message handling functions to use appendMessageToHistories
        async function handleUserMessage(userInput) {
            if (!userInput.trim()) return;

            // Add user message
            const userMessage = {
                role: 'user',
                content: userInput
            };
            appendMessageToHistories(userMessage);
            appendMessage(userMessage);
        }

        showLoading();  // Show loading indicator

        // Make initial API call
        let initialResponse;
        try {
            console.log('Making initial API call');
            const model = isPro ? PRO_MODEL : FREE_MODELS[currentModelIndex];
            console.log('Using model:', model);

            const messages = [{
                role: "system",
                content: systemPrompt
            }];

            const response = await apiService.makeApiCall(messages, model);
            initialResponse = isPro ? response.response : response.choices[0].message.content;

        } catch (error) {
            console.error('Initial API call failed:', error);
            // Try with free model as fallback
            initialResponse = await makeInitialApiCall(
                { OPENROUTER_API_KEYS: apiService.apiKeys.join(',') },
                systemPrompt
            );
        }

        hideLoading();  // Hide loading indicator

        if (initialResponse) {
            addToHistories({
                role: "assistant",
                content: initialResponse
            });
            appendMessage('assistant', initialResponse);
        }

        // Set up image upload handlers
        if (imageInput && imagePreviewContainer && imagePreviewThumbnail && removeImageButton) {
            console.log('Setting up image upload handlers');

            imageInput.addEventListener('change', async (e) => {
                console.log('Image input change event triggered');
                const file = e.target.files[0];
                if (file) {
                    console.log('File selected:', file.name, file.type, file.size);

                    // Validate file type
                    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
                        showError('Please upload a valid image file (JPEG, PNG, or GIF)');
                        imageInput.value = '';
                        return;
                    }

                    // Validate file size
                    if (file.size > MAX_IMAGE_SIZE) {
                        showError('Image size must be less than 5MB');
                        imageInput.value = '';
                        return;
                    }

                    try {
                        console.log('Processing image file...');
                        const reader = new FileReader();

                        reader.onload = async (event) => {
                            try {
                                console.log('Image file read successfully');
                                imageData = event.target.result.split(',')[1];
                                if (imagePreviewThumbnail) {
                                    imagePreviewThumbnail.src = event.target.result;
                                    imagePreviewContainer.style.display = 'inline-block';
                                }

                                // Set the flag to switch to vision model permanently for free users
                                if (!isPro) {
                                    switchedToVisionModel = true;
                                    console.log('Switched to vision model permanently');
                                }

                                showMessage('Image ready to send!', 'info', 2000);
                                if (userInput) userInput.focus();
                            } catch (error) {
                                console.error('Error processing image:', error);
                                showError('Failed to process image. Please try again.');
                                imageData = null;
                            }
                        };

                        reader.onerror = (error) => {
                            console.error('FileReader error:', error);
                            showError('Failed to read image file. Please try again.');
                            imageData = null;
                        };

                        reader.readAsDataURL(file);
                    } catch (error) {
                        console.error('Error in image processing:', error);
                        showError('Failed to process image. Please try again.');
                        imageData = null;
                    }
                }
            });

            removeImageButton.addEventListener('click', () => {
                console.log('Removing image');
                imageData = null;
                imagePreviewContainer.style.display = 'none';
                if (imagePreviewThumbnail) {
                    imagePreviewThumbnail.src = '';
                }
                imageInput.value = '';
            });
        } else {
            console.error('Image upload elements not found:', {
                imageInput: !!imageInput,
                container: !!imagePreviewContainer,
                thumbnail: !!imagePreviewThumbnail,
                removeButton: !!removeImageButton
            });
        }

        // Extract link ID from URL path and set sessionLinkID
        const pathSegments = window.location.pathname.split('/');
        window.sessionLinkID = pathSegments.pop(); // Assuming the link ID is the last segment

        if (!window.sessionLinkID || window.sessionLinkID === 'tutor.html' || window.sessionLinkID === 'pro' || window.sessionLinkID === 'evaluate' || window.sessionLinkID === 'tutor-tron') {
            window.sessionLinkID = pathSegments[pathSegments.length - 1]; // Get the segment before 'pro' or 'evaluate' if present
        }


        if (window.sessionLinkID) {
            console.log(`Session Link ID set to: ${window.sessionLinkID}`);
        } else {
            console.warn("Could not determine session link ID from URL.");
        }

        // Set up event listeners
        if (sendButton) {
            sendButton.addEventListener('click', handleSendMessage);
        }
        if (userInput) {
            userInput.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    await handleSendMessage();
                }
            });

            // Use native textarea scrolling; no JS auto-resize
        }
        if (copyButton) {
            copyButton.addEventListener('click', copyChat);
        }

    } catch (error) {
        console.error('Initialization error:', error);
        hideLoading();
        showError('Failed to initialize chat. Please refresh the page.');
    }
});

// Function to show messages
function showMessage(message, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast ${isError ? 'error' : 'success'}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);

    // Remove after animation
    setTimeout(() => {
        messageDiv.classList.add('fade-out');
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 300);
    }, 2000);
}

// Add copy chat functionality
async function copyChat() {
    if (!chatContainer) {
        console.error('Chat container not found');
        return;
    }

    const copyButton = document.getElementById('copyButton');
    if (!copyButton) {
        console.error('Copy button not found');
        return;
    }

    try {
        const messages = Array.from(chatContainer.children).map(messageDiv => {
            const role = messageDiv.classList.contains('user-message') ? 'User' : 'Tutor-Tron';
            const content = messageDiv.textContent.trim();
            return `${role}: ${content}`;
        }).join('\n\n');

        await navigator.clipboard.writeText(messages);
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<span>✓</span> Copied!';
        showMessage('Chat copied to clipboard!');
        setTimeout(() => {
            copyButton.innerHTML = originalText;
        }, 2000);
    } catch (error) {
        console.error('Error copying chat:', error);
        showMessage('Failed to copy chat', true);
    }
}