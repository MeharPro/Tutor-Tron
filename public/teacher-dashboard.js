// --- (Rest of the JavaScript code remains the same,
//      except for changes in `openSubmissionsPopup`, `viewSubmission`,
//      `backToSubmissionsList`, and `closeSubmissionsPopup`) ---
// --- Authentication and Authorization ---
// CHECK updates
async function checkAuth() {
    const token = localStorage.getItem('teacherToken');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    try {
        const response = await fetch('https://tutortron.dizon-dzn12.workers.dev/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            localStorage.removeItem('teacherToken');
            window.location.href = '/index.html';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('teacherToken');
        window.location.href = '/index.html';
    }
}

// --- Pro Status ---

async function checkProStatus() {
    const token = localStorage.getItem('teacherToken');
    try {
        const response = await fetch('https://tutortron.dizon-dzn12.workers.dev/api/pro/status', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            return data.isPro;
        }
        return false;
    } catch (error) {
        console.error('Failed to check Pro status:', error);
        return false;
    }
}

// --- DOMContentLoaded Event ---

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    const token = localStorage.getItem('teacherToken');

    // Check Pro status and show Pro banner if user is Pro
    const isPro = await checkProStatus();
    window.isPro = isPro; // Set window.isPro for TutorMode to use
    const proBanner = document.getElementById('proBanner');
    if (isPro) {
        proBanner.style.display = 'block';
        // Show all Pro buttons
        document.querySelectorAll('.pro-button').forEach(btn => {
            btn.style.display = 'inline-block';
        });
    } else {
        // Hide all Pro buttons
        document.querySelectorAll('.pro-button').forEach(btn => {
            btn.style.display = 'none';
        });
    }

    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);

    // Get mode containers
    const modeTabsContainer = document.querySelector('.mode-tabs');
    const promptFormContainer = document.querySelector('.prompt-form');

    if (!modeTabsContainer || !promptFormContainer) {
        console.error('Required containers not found');
        return;
    }

    // Clear existing content
    modeTabsContainer.innerHTML = '';
    promptFormContainer.innerHTML = '';

    // Add tabs and panels for each mode
    // Check if tutor-mode.js is up to date
   fetch('/protected/tutor-mode.js')
       .then(response => response.text())
       .then(content => {
           if (!content.includes('Unique identifier: VERSION_12345')) {
               console.error('tutor-mode.js is not up to date!');
               showMessage('tutor-mode.js is not up to date! Please redeploy.', true);
           } else {
               console.log('tutor-mode.js is up to date.');
           }
       })
       .catch(error => console.error('Error fetching tutor-mode.js:', error));

   TutorMode.getAllModes().forEach((mode, index) => {
       const tab = mode.createTab();
       const panel = mode.createPanel();

        modeTabsContainer.appendChild(tab);
        promptFormContainer.appendChild(panel);

        // Set initial active state
        if (index === 0) {
            tab.classList.add('active');
            panel.classList.add('active');
        }
    });
     await loadLinks();

    // Initialize Lucide icons after adding tabs
    lucide.createIcons();

    // Load initial links

});

// --- Message Display ---

function showMessage(message, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.className = isError ? 'error-message' : 'success-message';
    messageDiv.style.marginTop = '10px';
    document.querySelector('.prompt-form').appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 3000);
}

// --- Link Management ---

async function deleteLink(linkId) {
    if (!confirm('Are you sure you want to delete this link?')) {
        return;
    }

    try {
        const token = localStorage.getItem('teacherToken');
        const response = await fetch(`https://tutortron.dizon-dzn12.workers.dev/api/links/${linkId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete link');
        }

        // Refresh the links list
        await loadLinks();
        showMessage('Link deleted successfully');
    } catch (error) {
        console.error('Error deleting link:', error);
        showMessage('Failed to delete link', true);
    }
}

async function createModeLink(mode, subject, prompt, isPro = false, enableEvaluation = false) {
    const gradeLevel = document.querySelector(`#${mode}GradeLevel`).value;
    if (!gradeLevel) {
        showMessage('Please select a grade level', true);
        return;
    }

    // Format the grade prefix based on the selected grade
    let gradePrefix;
    if (gradeLevel === 'KG') {
        gradePrefix = 'Kindergarten';
    } else if (gradeLevel === 'University') {
        gradePrefix = 'University/College';
    } else {
        gradePrefix = `Grade ${gradeLevel}`;
    }

    const gradePrefixedPrompt = `${gradePrefix}: ${prompt}`;

    try {
        const token = localStorage.getItem('teacherToken');
        if (!token) {
            console.error('No authentication token found');
            throw new Error('Authentication required');
        }

        let language = null;
        if (mode === 'codebreaker') {
            language = document.getElementById('codebreakerLanguage').value;
            console.log('Selected language for codebreaker:', language);
        }

        const requestBody = {
            mode,
            subject,
            prompt: gradePrefixedPrompt,
            isPro,
            enableEvaluation
        };

        if (language) {
            requestBody.language = language;
        }

        console.log('Sending request with body:', requestBody);

        const response = await fetch('https://tutortron.dizon-dzn12.workers.dev/api/links', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestBody)
        });

        let linkData;
        try {
            linkData = await response.json();
        } catch (e) {
            console.error('Failed to parse response:', e);
            throw new Error('Invalid server response');
        }

        if (!response.ok) {
            console.error('Server error details:', {
                status: response.status,
                statusText: response.statusText,
                errorData: linkData,
                headers: Object.fromEntries(response.headers.entries())
            });
            throw new Error(linkData.message || 'Failed to create link');
        }

        let newLinkUrl;
        if (isPro) {
            if (enableEvaluation) {
                newLinkUrl = `${window.location.origin}/${mode.toLowerCase()}/pro/evaluate/${linkData.id}`;
            } else {
                newLinkUrl = `${window.location.origin}/${mode.toLowerCase()}/pro/${linkData.id}`;
            }
        } else {
            newLinkUrl = `${window.location.origin}/${mode.toLowerCase()}/${linkData.id}`;
        }

        // Copy the URL and show a single notification
        await copyToClipboard(newLinkUrl);
        const modeType = isPro ? 'Pro ' : '';
        const evalType = enableEvaluation ? 'Evaluation ' : '';
        showMessage(`${modeType}${evalType}${mode.charAt(0).toUpperCase() + mode.slice(1)} link created and copied!`);
        return true;
    } catch (error) {
        console.error('Error creating link:', error);
        showMessage(error.message || 'Failed to create link', true);
        return false;
    }
}

// --- Clipboard Copy ---

async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                document.execCommand('copy');
                textArea.remove();
                return true;
            } catch (error) {
                console.error('Copy fallback failed:', error);
                textArea.remove();
                return false;
            }
        }
    } catch (error) {
        console.error('Failed to copy:', error);
        return false;
    }
}

// --- Pagination ---

let currentPage = 1;
const linksPerPage = 9;
const baseUrl = 'https://tutor-tron.com'; // Use the correct base URL

async function loadLinks() {
    const token = localStorage.getItem('teacherToken');
    if (!token) return;

    try {
        const response = await fetch('https://tutortron.dizon-dzn12.workers.dev/api/links', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load links');

        const links = await response.json();
        // Convert numeric flags to booleans
        links.forEach(link => {
            link.isPro = !!link.isPro;
            link.enableEvaluation = !!link.enableEvaluation;
        });

        const linksContainer = document.getElementById('linksList');
        linksContainer.innerHTML = ''; // Clear existing links

        if (links.length === 0) {
            linksContainer.innerHTML = '<p class="no-links">No links created yet</p>';
            return;
        }

        // Sort links by creation date, newest first
        links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Calculate pagination
        const totalPages = Math.ceil(links.length / linksPerPage);
        const startIndex = (currentPage - 1) * linksPerPage;
        const endIndex = startIndex + linksPerPage;
        const currentLinks = links.slice(startIndex, endIndex);

        // Display current page links
        currentLinks.forEach(link => {
            // Format the date
            const date = new Date(link.createdAt);
            const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Create link URL

            const linkUrl = link.isPro ?
                link.enableEvaluation ?
                    `${baseUrl}/${link.mode.toLowerCase()}/pro/evaluate/${link.id}` :
                    `${baseUrl}/${link.mode.toLowerCase()}/pro/${link.id}` :
                `${baseUrl}/${link.mode.toLowerCase()}/${link.id}`;

            const linkElement = document.createElement('div');
            linkElement.className = `link-item ${link.mode.toLowerCase()}-mode`;
            linkElement.innerHTML = `
                <div class="link-content">
                    <div class="link-header">
                        <span class="mode-tag ${link.mode.toLowerCase()}">
                            ${link.mode} Mode
                            ${link.isPro ? '<span class="pro-badge">Pro</span>' : ''}
                            ${link.enableEvaluation ? '<span class="evaluation-badge">Evaluation</span>' : ''}
                        </span>
                        <div class="link-actions">
                            <button onclick="copyLink('${link.id}')" class="copy-btn" title="Copy Link">
                                <i data-lucide="copy"></i>
                            </button>
                            <button onclick="deleteLink('${link.id}')" class="delete-btn" title="Delete Link">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </div>
                    <h3>${link.subject}</h3>
                    <div class="link-details">
                        ${link.prompt ? `<p class="link-description">${link.prompt}</p>` : ''}
                        <div class="link-url" data-url="${linkUrl}"></div>
                        <p class="link-date">Created: ${formattedDate}</p>
                        <button onclick="window.open('${linkUrl}', '_blank')" class="open-tab-btn">
                            <i data-lucide="external-link"></i>
                            Open in new tab
                        </button>
                        ${link.enableEvaluation ? `
                            <button onclick="openSubmissionsPopup('${link.id}')" class="submissions-btn">
                                Submissions
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            linksContainer.appendChild(linkElement);
        });

        // Add popup container (initially hidden)
        const popupContainer = document.createElement('div');
        popupContainer.id = 'submissionsPopup';
        popupContainer.className = 'submissions-popup';
        popupContainer.style.display = 'none'; // Initially hidden
        document.body.appendChild(popupContainer); // Append to body

        // Add pagination controls if there are multiple pages
        if (totalPages > 1) {
            const paginationContainer = document.createElement('div');
            paginationContainer.className = 'pagination';

            // Previous button
            if (currentPage > 1) {
                const prevButton = document.createElement('button');
                prevButton.innerHTML = '<i data-lucide="chevron-left"></i>';
                prevButton.onclick = () => {
                    currentPage--;
                    loadLinks();
                };
                paginationContainer.appendChild(prevButton);
            }

            // Page numbers
            for (let i = 1; i <= totalPages; i++) {
                const pageButton = document.createElement('button');
                pageButton.textContent = i;
                pageButton.className = i === currentPage ? 'active' : '';
                pageButton.onclick = () => {
                    currentPage = i;
                    loadLinks();
                };
                paginationContainer.appendChild(pageButton);
            }

            // Next button
            if (currentPage < totalPages) {
                const nextButton = document.createElement('button');
                nextButton.innerHTML = '<i data-lucide="chevron-right"></i>';
                nextButton.onclick = () => {
                    currentPage++;
                    loadLinks();
                };
                paginationContainer.appendChild(nextButton);
            }

            linksContainer.appendChild(paginationContainer);
        }

        lucide.createIcons();
    } catch (error) {
        console.error('Error loading links:', error);
        showMessage('Failed to load links', true);
    }
}

// --- Submission Popup ---

async function openSubmissionsPopup(linkId) {
    const popup = document.getElementById('submissionsPopup');
    popup.innerHTML = '<div class="popup-loader">Loading submissions...</div>';
    popup.style.display = 'flex'; // Use flex for vertical centering of loader

    const token = localStorage.getItem('teacherToken');
    if (!token) {
        popup.innerHTML = '<p>Error: Not authenticated.</p>';
        return;
    }

    try {
        const response = await fetch(`/api/links/${linkId}/submissions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch submissions: ${response.status}`);
        }

        const submissions = await response.json();
        
        const popupHeaderHTML = `
            <div class="submissions-header">
                <h2>Submissions</h2>
                <button class="close-button" onclick="closeSubmissionsPopup()">Close</button>
            </div>`;

        if (submissions.length === 0) {
            popup.innerHTML = `
                <div class="submissions-popup-content">
                    ${popupHeaderHTML}
                    <p class="no-submissions-message">No submissions found for this link.</p>
                </div>`;
            return;
        }

        let submissionsListHTML = '';
        submissions.forEach(s => {
            submissionsListHTML += `
                <div class="submission-item" data-session-code="${s.session_code}" onclick="viewSubmission('${linkId}', '${s.session_code}')">
                    ${s.session_code}
                </div>`;
        });

        popup.innerHTML = `
            <div class="submissions-popup-content">
                ${popupHeaderHTML}
                <div class="submissions-body">
                    <div class="submissions-list-panel">
                        <div class="submissions-count">
                            ${submissions.length} submission(s)
                        </div>
                        <div class="submissions-list">
                            ${submissionsListHTML}
                        </div>
                    </div>
                    <div class="submission-view-panel">
                        <div class="popup-loader">Select a submission to view.</div>
                    </div>
                </div>
            </div>`;

        // Automatically view the first submission
        const firstSubmission = submissions[0];
        if (firstSubmission) {
            await viewSubmission(linkId, firstSubmission.session_code);
        }

    } catch (error) {
        console.error('Error opening submissions popup:', error);
        popup.innerHTML = `<div class="submissions-popup-content"><div class="submissions-header"><h2>Error</h2><button class="close-button" onclick="closeSubmissionsPopup()">Close</button></div><p>${error.message}</p></div>`;
    }
}

async function viewSubmission(linkId, sessionCode) {
    const viewPanel = document.querySelector('.submission-view-panel');
    if (!viewPanel) {
        console.error('Submission view panel not found');
        return;
    }
    viewPanel.innerHTML = '<div class="popup-loader">Loading submission...</div>';

    // Highlight the active item in the list
    document.querySelectorAll('.submission-item').forEach(item => {
        item.classList.toggle('active', item.dataset.sessionCode === sessionCode);
    });

    const token = localStorage.getItem('teacherToken');
    if (!token) {
        viewPanel.innerHTML = '<p>Error: Not authenticated.</p>';
        return;
    }

    try {
        const response = await fetch(`/api/links/${linkId}/submissions/${sessionCode}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch submission: ${response.status}`);
        }

        const submission = await response.json();

        viewPanel.innerHTML = `
            <div class="submission-view-header">
                <h3>Submission: ${sessionCode}</h3>
                <div class="submission-view-actions">
                    <button class="summarize-button" onclick="scrollToBottom()">Summarize</button>
                </div>
            </div>
            <div class="submission-content-wrapper">
                 <pre id="submission-content">${submission.content || 'This submission is empty.'}</pre>
            </div>`;
    } catch (error) {
        console.error('Error fetching submission content:', error);
        viewPanel.innerHTML = `<p>Error loading submission: ${error.message}</p>`;
    }
}

function scrollToBottom() {
    // The scrollable container is the wrapper, not the <pre> element itself.
    const scrollableContainer = document.querySelector('.submission-content-wrapper');
    if (scrollableContainer) {
        // Use a small timeout to ensure the DOM has fully updated before scrolling
        setTimeout(() => {
            scrollableContainer.scrollTop = scrollableContainer.scrollHeight;
        }, 50);
    } else {
        console.error("The '.submission-content-wrapper' element was not found!");
    }
}

function closeSubmissionsPopup() {
    const popup = document.getElementById('submissionsPopup');
    if (popup) {
        popup.style.display = 'none';
        popup.innerHTML = ''; // Clear content to free up memory
    }
}

// Function to copy a specific link
async function copyLink(linkId) {
    try {
        const linkItem = document.querySelector(`button[onclick="copyLink('${linkId}')"]`)?.closest('.link-item');

        if (!linkItem) {
            throw new Error('Link item not found - the link may still be generating');
        }

        const linkElement = linkItem.querySelector('.link-url');
        if (!linkElement) {
            throw new Error('Link URL element not found');
        }

        const linkUrl = linkElement.dataset.url;
        if (!linkUrl) {
            throw new Error('Link URL is empty');
        }

        await navigator.clipboard.writeText(linkUrl);
        showMessage('Link copied to clipboard!');
    } catch (error) {
        console.error('Error copying link:', error);
        showMessage(error.message || 'Failed to copy link', true);
    }
}

// --- Theme Toggle ---

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme);
}

function updateThemeButton(theme) {
    const icon = document.getElementById('theme-icon');
    if (theme === 'dark') {
        icon.setAttribute('data-lucide', 'sun');
    } else {
        icon.setAttribute('data-lucide', 'moon');
    }
    lucide.createIcons();
}

// --- Logout ---

function logout() {
    localStorage.clear();
    window.location.href = '/index.html';
}

// Add styles for the popup
document.head.insertAdjacentHTML('beforeend', `
 <style>
   .submissions-popup {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 1200px;
        height: 85vh;
        max-height: 800px;
        background-color: var(--background-color);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        display: none; /* Controlled by JS */
        flex-direction: column;
        overflow: hidden;
    }

    .popup-loader {
        padding: 40px;
        text-align: center;
        font-size: 1.2em;
        color: var(--text-color-secondary);
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
    }

    .submissions-popup-content {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .submissions-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 25px;
        border-bottom: 1px solid var(--border-color);
        flex-shrink: 0;
    }
    
    .submissions-header h2 {
        margin: 0;
        font-size: 1.6em;
    }
    
    .close-button, .summarize-button {
        background-color: var(--accent-color);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.2s ease;
    }
    
    .close-button:hover, .summarize-button:hover {
        background-color: var(--accent-color-dark);
    }

    .submissions-body {
        display: flex;
        flex-grow: 1;
        overflow: hidden; /* Prevent body from overflowing */
    }

    .submissions-list-panel {
        flex: 0 0 300px;
        border-right: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
        background-color: var(--background-color-offset);
    }

    .submissions-count {
        padding: 15px 20px;
        font-weight: bold;
        color: var(--text-color-secondary);
        border-bottom: 1px solid var(--border-color);
        flex-shrink: 0;
    }

    .submissions-list {
        overflow-y: auto;
        flex-grow: 1;
        padding: 10px;
    }
    
    .no-submissions-message {
        padding: 20px;
        text-align: center;
        color: var(--text-color-secondary);
    }

    .submission-item {
        padding: 12px 15px;
        margin-bottom: 5px;
        border-radius: 6px;
        cursor: pointer;
        border: 1px solid transparent;
        transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        word-break: break-all;
    }
    
    .submission-item:hover {
        background-color: var(--hover-bg);
    }
    
    .submission-item.active {
        background-color: var(--hover-bg);
        color: var(--accent-color); /* This makes the text blue */
        font-weight: bold;
        border-color: var(--accent-color); /* This adds a blue border */
    }

    .submission-view-panel {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .submission-view-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 25px;
        border-bottom: 1px solid var(--border-color);
        background-color: var(--background-color-offset);
        flex-shrink: 0;
    }
    
    .submission-view-header h3 {
        margin: 0;
        font-size: 1.2em;
        word-break: break-all;
    }
    
    .submission-content-wrapper {
        flex-grow: 1;
        overflow-y: auto;
        padding: 25px;
    }
    
    #submission-content {
        white-space: pre-wrap;
        word-wrap: break-word;
        font-family: var(--font-mono);
        font-size: 1rem;
        line-height: 1.6;
        margin: 0;
        color: var(--text-color);
    }

    /* --- Other Styles --- */

    .copy-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #4CAF50;
        color: white;
        padding: 16px;
        border-radius: 4px;
        z-index: 1000;
        animation: fadeInOut 2s ease-in-out;
    }

    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(20px); }
        10% { opacity: 1; transform: translateY(0); }
        90% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-20px); }
    }

    .evaluation-checkbox {
        margin: 10px 0;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .evaluation-checkbox input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
    }

    .evaluation-checkbox label {
        cursor: pointer;
        font-size: 14px;
        color: var(--text-color);
    }

    .evaluation-badge {
        background: rgba(255, 255, 255, 0.2);
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 0.75rem;
        margin-left: 4px;
    }

    .grade-select {
        width: 100%;
        padding: 8px;
        margin-bottom: 10px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        background-color: var(--input-bg);
        color: var(--text-color);
    }
    /* Mobile Styles */
    @media (max-width: 768px) {
        .submissions-popup {
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            transform: none;
            border-radius: 0;
            max-height: none;
            border: none;
        }

        .submissions-body {
            flex-direction: column;
        }

        .submissions-list-panel {
            flex: 0 0 40%; /* List takes 40% of the height */
            border-right: none;
            border-bottom: 1px solid var(--border-color);
        }
        
        .submissions-header h2 { font-size: 1.2em; }
        .submission-view-header h3 { font-size: 1.0em; }
        .close-button, .summarize-button { padding: 6px 12px; font-size: 0.9em; }
        .submissions-header, .submission-view-header { padding: 10px 15px; }
        .submission-content-wrapper { padding: 15px; }
        #submission-content { font-size: 0.9rem; }
    }
</style>
`);