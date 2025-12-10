// Function to highlight code blocks in messages
function highlightCode(messageDiv) {
    // Find all code blocks in the message
    messageDiv.querySelectorAll('pre code').forEach((block) => {
        // Add the language class if not present
        if (!block.className && block.parentElement.textContent.trim().startsWith('```')) {
            const langMatch = block.parentElement.textContent.match(/```(\w+)/);
            if (langMatch) {
                const language = langMatch[1].toLowerCase();
                // Map cpp or c++ to the correct prism language class
                const languageMap = {
                    'cpp': 'cpp',
                    'c++': 'cpp',
                    'python': 'python',
                    'javascript': 'javascript',
                    'js': 'javascript'
                };
                block.className = `language-${languageMap[language] || language}`;
            }
        }
        
        // Preserve indentation by replacing spaces with &nbsp;
        const codeText = block.textContent;
        const lines = codeText.split('\n');
        const indentedLines = lines.map(line => {
            const leadingSpaces = line.match(/^\s*/)[0].length;
            return '&nbsp;'.repeat(leadingSpaces) + line.trimLeft();
        });
        block.innerHTML = indentedLines.join('\n');
        
        // Apply Prism highlighting
        Prism.highlightElement(block);
    });

    // Override any black colors in the highlighted code
    messageDiv.querySelectorAll('pre code .token').forEach(token => {
        if (token.style.color === '#000000' || token.style.color === 'rgb(255, 255, 255)' || token.style.color === 'white') {
            token.style.color = '#374151'; // Using a dark gray instead
        }
    });
}

// Function to process code blocks in text
function processCodeBlocks(text) {
    return text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        // Map cpp or c++ to the correct language identifier
        let language = (lang || 'cpp').toLowerCase();
        if (language === 'c++') language = 'cpp';
        
        // Preserve indentation while cleaning up the code
        const lines = code.split('\n');
        const cleanLines = lines.map(line => {
            // Replace tabs with spaces and preserve leading spaces
            return line.replace(/\t/g, '    ');
        });
        const cleanCode = cleanLines.join('\n').trim();
            
        return `<pre><code class="language-${language}">${cleanCode}</code></pre>`;
    });
}

// Make sure Prism.js loads the C++ language support
if (typeof Prism !== 'undefined') {
    if (!Prism.languages.cpp) {
        // Load cpp language support if not already loaded
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.24.1/components/prism-cpp.min.js';
        document.head.appendChild(script);
    }
}

// Export functions if using modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        highlightCode,
        processCodeBlocks
    };
} 