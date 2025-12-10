// Navigation functions
function logout() {
    localStorage.clear();
    window.location.href = '/index.html';
}

function updateProfile() {
    window.location.href = '/profile';
}

function openSettings() {
    const modal = document.getElementById('settingsModal');
    const emailInput = document.getElementById('settingsEmail');
    const subscriptionType = document.getElementById('settingsSubscriptionType');
    
    // Get current user data from teacherInfo
    const teacherInfo = JSON.parse(localStorage.getItem('teacherInfo') || '{}');
    emailInput.value = teacherInfo.email || '';
    
    // Display subscription type
    const isPro = localStorage.getItem('isPro') === 'true';
    subscriptionType.textContent = isPro ? 'Pro Membership' : 'Basic Membership';
    
    // Show modal
    modal.style.display = 'flex';
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'none';
}

async function saveSettings() {
    const newPassword = document.getElementById('settingsPassword').value;
    const token = localStorage.getItem('teacherToken');
    
    try {
        if (!newPassword) {
            alert('Please enter a new password to update');
            return;
        }
        
        // Update password only
        const response = await fetch('https://tutortron.dizon-dzn12.workers.dev/api/user/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                password: newPassword
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || data.details || 'Failed to update password');
        }
        
        // Clear password field and close modal
        document.getElementById('settingsPassword').value = '';
        closeSettings();
        
        alert('Password updated successfully');
    } catch (error) {
        console.error('Error saving settings:', error);
        alert(error.message || 'Failed to update password. Please try again.');
    }
}

function manageSubscription() {
    window.location.href = '/subscription';
}


// Todo functionality
class TodoList {
    constructor() {
        console.log('Initializing TodoList');
        this.todos = this.loadTodos();
        this.todoList = document.getElementById('todoList');
        this.newTodoInput = document.getElementById('newTodo');
        
        console.log('Todo elements:', {
            todoList: this.todoList,
            newTodoInput: this.newTodoInput
        });
        
        if (this.newTodoInput) {
            this.newTodoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addTodo();
                }
            });
        }

        this.renderTodos();
    }

    loadTodos() {
        console.log('Loading todos from localStorage');
        const todos = localStorage.getItem('todos');
        const parsedTodos = todos ? JSON.parse(todos) : [];
        console.log('Loaded todos:', parsedTodos);
        return parsedTodos;
    }

    saveTodos() {
        localStorage.setItem('todos', JSON.stringify(this.todos));
        console.log('Saved todos:', this.todos);
    }

    addTodo() {
        console.log('Adding new todo');
        const input = document.getElementById('newTodo');
        const text = input.value.trim();
        
        if (text) {
            const newTodo = {
                id: Date.now(),
                text,
                completed: false
            };
            console.log('New todo:', newTodo);
            
            this.todos.push(newTodo);
            this.saveTodos();
            this.renderTodos();
            input.value = '';
        }
    }

    toggleTodo(id) {
        console.log('Toggling todo:', id);
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            this.saveTodos();
            this.renderTodos();
        }
    }

    deleteTodo(id) {
        console.log('Deleting todo:', id);
        this.todos = this.todos.filter(t => t.id !== id);
        this.saveTodos();
        this.renderTodos();
    }

    renderTodos() {
        console.log('Rendering todos');
        if (!this.todoList) {
            console.error('Todo list element not found!');
            return;
        }
        
        this.todoList.innerHTML = this.todos.map(todo => `
            <li class="flex items-center justify-between bg-slate-700 p-3 rounded">
                <div class="flex items-center">
                    <input type="checkbox" ${todo.completed ? 'checked' : ''} 
                        onclick="todoList.toggleTodo(${todo.id})"
                        class="mr-3 rounded">
                    <span class="text-white ${todo.completed ? 'line-through' : ''}">${todo.text}</span>
                </div>
                <button onclick="todoList.deleteTodo(${todo.id})" 
                    class="text-red-400 hover:text-red-600">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </li>
        `).join('');
        
        if (window.lucide) {
            lucide.createIcons();
        }
    }
}

// Check Pro status
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

// Check authentication
async function checkAuth() {
    const token = localStorage.getItem('teacherToken');
    if (!token) {
        window.location.href = '/index.html';
        return;
    }

    try {
        // Verify auth token with relative path
        const authResponse = await fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!authResponse.ok) {
            throw new Error('Auth verification failed');
        }

        // Load user details from teacherInfo
        const teacherInfo = JSON.parse(localStorage.getItem('teacherInfo'));
        if (!teacherInfo) {
            window.location.href = '/index.html';
            return;
        }

        // Update user details in the dashboard
        const userNameElement = document.getElementById('userName');
        const userEmailElement = document.getElementById('userEmail');
        const membershipTypeElement = document.getElementById('membershipType');
        
        if (userNameElement) userNameElement.textContent = teacherInfo.name;
        if (userEmailElement) userEmailElement.textContent = teacherInfo.email;

        // Check Pro status with relative path
        const proResponse = await fetch('https://tutortron.dizon-dzn12.workers.dev/api/pro/status', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!proResponse.ok) {
            throw new Error('Failed to check pro status');
        }

        const proData = await proResponse.json();
        localStorage.setItem('isPro', proData.isPro);
        
        // Update membership display
        if (membershipTypeElement) {
            if (proData.isPro) {
                membershipTypeElement.innerHTML = `
                    <svg class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 15.4L7.2 18L8.4 12.6L4 9L9.6 8.8L12 3.6L14.4 8.8L20 9L15.6 12.6L16.8 18L12 15.4Z" fill="currentColor"/>
                    </svg>
                    Pro Membership
                `;
                membershipTypeElement.className = 'inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-semibold text-sm shadow-lg';
            } else {
                membershipTypeElement.innerHTML = 'Basic Membership';
                membershipTypeElement.className = 'inline-flex items-center px-3 py-1 rounded-full bg-gray-700 text-gray-300 text-sm';
            }
        }

    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('teacherToken');
        window.location.href = '/index.html';
    }
}

// Profile menu functionality
document.addEventListener('DOMContentLoaded', function() {
    const profileButton = document.getElementById('profileButton');
    const profileMenu = document.getElementById('profileMenu');
    
    // Toggle menu on profile button click
    profileButton.addEventListener('click', function(e) {
        e.stopPropagation();
        profileMenu.classList.toggle('hidden');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!profileMenu.contains(e.target) && !profileButton.contains(e.target)) {
            profileMenu.classList.add('hidden');
        }
    });
    
    // Prevent menu from closing when clicking inside it
    profileMenu.addEventListener('click', function(e) {
        e.stopPropagation();
    });
});

// Initialize TodoList globally
let todoList;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
    
    // Re-initialize icons after a short delay to ensure all dynamic content is loaded
    setTimeout(() => {
        if (window.lucide) {
            lucide.createIcons();
        }
    }, 100);
    
    // Initialize todo list
    todoList = new TodoList();
    
    // Make todoList and addTodo available globally
    window.todoList = todoList;
    window.addTodo = () => todoList.addTodo();
    
    // Check auth and load user data
    await checkAuth();
    
    // Close settings modal when clicking outside
    const modal = document.getElementById('settingsModal');
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeSettings();
        }
    });
});