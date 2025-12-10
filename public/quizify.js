async function generateQuiz(numQuestionsInput, resultContainer, loadingOverlay) {
    // Validate number of questions
    const numQuestions = parseInt(numQuestionsInput.value);
    if (numQuestions < 5 || numQuestions > 20) {
        document.getElementById('num-questions-error').classList.add('visible');
        return;
    }
    
    const button = document.getElementById('generateButton');
    const spinner = button.querySelector('.spinner');
    const buttonText = button.querySelector('.button-text');
    
    // Show loading state
    button.disabled = true;
    spinner.classList.add('visible');
    buttonText.textContent = 'Generating...';
    loadingOverlay.classList.add('visible');
    
    try {
        console.log('Sending request to generate quiz...');
        const formData = new FormData();
        const fileInput = document.querySelector('input[type="file"]');
        
        if (!fileInput.files[0]) {
            throw new Error('Please select a PDF file');
        }
        
        formData.append('lesson_pdf', fileInput.files[0]);
        formData.append('num_questions', numQuestions);
        
        const response = await fetch('/quizify/generate_quiz', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || 'Failed to generate quiz');
            }
            throw new Error('Failed to generate quiz');
        }
        
        console.log('Quiz generated successfully, downloading...');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'generated_quiz.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Error:', error);
        alert(error.message);
    } finally {
        // Reset loading state
        button.disabled = false;
        spinner.classList.remove('visible');
        buttonText.textContent = 'Generate Quiz';
        loadingOverlay.classList.remove('visible');
    }
}

// Function to check authentication and pro status
async function checkAuthAndProStatus() {
    const token = localStorage.getItem('teacherToken');
    if (!token) {
        window.location.href = '/index.html';
        return false;
    }

    try {
        const response = await fetch('/api/pro/status', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/index.html';
                return false;
            }
            throw new Error('Failed to check pro status');
        }

        const data = await response.json();
        if (!data.isPro) {
            alert('This feature is only available for Pro/Plus Users. Please upgrade your account to access this feature.');
            window.location.href = '/subscription';
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error checking pro status:', error);
        alert('Error checking subscription status. Please try again later.');
        window.location.href = '/dashboard';
        return false;
    }
}

// Add event listener once DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // First check if user is authenticated and has pro access
    const hasPro = await checkAuthAndProStatus();
    if (!hasPro) return;

    // Only proceed with initialization if user has pro access
    const generateButton = document.getElementById('generateButton');
    const numQuestionsInput = document.getElementById('num_questions');
    const resultContainer = document.getElementById('result');
    const loadingOverlay = document.querySelector('.loading-overlay');

    if (generateButton) {
        generateButton.addEventListener('click', () => {
            generateQuiz(numQuestionsInput, resultContainer, loadingOverlay);
        });
    }
});
