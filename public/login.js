// Handle Google Sign-In response
async function handleGoogleSignIn(response) {
    const messageDiv = document.getElementById('loginMessage');
    
    try {
        const resp = await fetch('/api/auth/google', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ credential: response.credential })
        });

        const data = await resp.json();

        if (resp.ok) {
            messageDiv.textContent = 'Login successful! Redirecting...';
            messageDiv.className = 'success-message';

            // Store the authentication data
            localStorage.setItem('token', data.token);
            localStorage.setItem('teacherToken', data.token);
            localStorage.setItem('teacherInfo', JSON.stringify(data.user));
            localStorage.setItem('email', data.user.email);

            // Get redirect URL from query parameters or use default
            const urlParams = new URLSearchParams(window.location.search);
            const redirectUrl = urlParams.get('redirect') || '/dashboard';
            
            // Redirect after a short delay
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 1000);
        } else {
            messageDiv.textContent = data.error || 'Authentication failed';
            messageDiv.className = 'error-message';
        }
    } catch (error) {
        console.error('Google Sign-In error:', error);
        messageDiv.textContent = 'An error occurred during authentication';
        messageDiv.className = 'error-message';
    }
}

// Handle regular form login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageDiv = document.getElementById('loginMessage');
    
    try {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            messageDiv.textContent = 'Login successful! Redirecting...';
            messageDiv.className = 'success-message';

            // Store authentication data
            localStorage.setItem('token', data.token);
            localStorage.setItem('teacherToken', data.token);
            localStorage.setItem('teacherInfo', JSON.stringify(data.user));
            localStorage.setItem('email', data.user.email);

            // Get redirect URL from query parameters or use default
            const urlParams = new URLSearchParams(window.location.search);
            const redirectUrl = urlParams.get('redirect') || '/dashboard';

            // Redirect after a short delay
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 1000);
        } else {
            messageDiv.textContent = data.error || 'Login failed';
            messageDiv.className = 'error-message';

            // If user needs to use Google Sign-In, highlight the button
            if (data.error === 'Please use Google Sign-In') {
                document.getElementById('googleSignInWrapper').classList.add('pulse');
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        messageDiv.textContent = 'An error occurred. Please try again.';
        messageDiv.className = 'error-message';
    }
});

// Add loading indicator
function showLoading() {
    const messageDiv = document.getElementById('loginMessage');
    messageDiv.textContent = 'Loading...';
    messageDiv.className = 'info-message';
}

// Check if we're on a protected page
if (window.location.pathname.includes('dashboard')) {
    checkAuth();
}

// Authentication check function
async function checkAuth() {
    const token = localStorage.getItem('teacherToken') || localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
        return;
    }

    try {
        const response = await fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            localStorage.removeItem('teacherToken');
            localStorage.removeItem('token');
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('teacherToken');
        localStorage.removeItem('token');
        window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
    }
}
