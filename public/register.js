// Handle Google Sign-In response
async function handleGoogleSignIn(response) {
    const messageDiv = document.getElementById('registerMessage');
    messageDiv.textContent = 'Authenticating...';
    messageDiv.className = '';
    
    try {
        const resp = await fetch('/api/auth/google', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                credential: response.credential,
                isRegistration: true
            })
        });

        const data = await resp.json();

        if (resp.ok) {
            messageDiv.textContent = 'Registration successful! Redirecting...';
            messageDiv.className = 'success';

            // Store authentication data
            localStorage.setItem('token', data.token);
            localStorage.setItem('teacherToken', data.token);
            localStorage.setItem('teacherInfo', JSON.stringify(data.user));
            localStorage.setItem('email', data.user.email);

            // Redirect to dashboard with delay
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1500);
        } else {
            messageDiv.textContent = data.error || 'Authentication failed';
            messageDiv.className = 'error';

            if (data.error?.includes('already registered')) {
                // Show message suggesting to use login instead
                messageDiv.textContent = 'Email already registered. Please log in instead.';
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
            }
        }
    } catch (error) {
        console.error('Google Sign-In error:', error);
        messageDiv.textContent = 'An error occurred during authentication';
        messageDiv.className = 'error';
    }
}

// Handle regular registration form
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageDiv = document.getElementById('registerMessage');
    messageDiv.textContent = '';
    messageDiv.className = '';

    try {
        // Get form values
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const school = document.getElementById('registerSchool').value;

        // Validate passwords match
        if (password !== confirmPassword) {
            messageDiv.textContent = 'Passwords do not match';
            messageDiv.className = 'error';
            return;
        }

        // Validate password length
        if (password.length < 8) {
            messageDiv.textContent = 'Password must be at least 8 characters long';
            messageDiv.className = 'error';
            return;
        }

        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                email,
                password,
                school
            })
        });

        const data = await response.json();

        if (response.ok) {
            messageDiv.textContent = 'Registration successful! Redirecting...';
            messageDiv.className = 'success';

            // Store authentication data
            localStorage.setItem('token', data.token);
            localStorage.setItem('teacherToken', data.token);
            localStorage.setItem('teacherInfo', JSON.stringify(data.user));
            localStorage.setItem('email', data.user.email);

            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1500);
        } else {
            if (data.error?.includes('already registered')) {
                messageDiv.textContent = 'Email already registered. Try using Google Sign-In instead.';
                document.getElementById('googleSignInWrapper').classList.add('pulse');
            } else {
                messageDiv.textContent = data.error || 'Registration failed';
            }
            messageDiv.className = 'error';
        }
    } catch (error) {
        console.error('Registration error:', error);
        messageDiv.textContent = 'An error occurred. Please try again.';
        messageDiv.className = 'error';
    }
});

// Add loading indicator and success/error message styles
const style = document.createElement('style');
style.textContent = `
    .info { color: #60A5FA; background: #EFF6FF; }
    .error { color: #DC2626; background: #FEE2E2; }
    .success { color: #059669; background: #D1FAE5; }
    #registerMessage {
        margin-top: 1rem;
        padding: 0.75rem;
        border-radius: 0.5rem;
        text-align: center;
        font-weight: 500;
    }
    .pulse {
        animation: pulse 2s;
    }
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style);
