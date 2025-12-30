// admin.js
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  getAuthToken,
  getCurrentUser,
} from './common.js';

// === API helpers (for /api/users) ===

async function getUsers() {
  try {
    const users = await apiGet('/users');
    return Array.isArray(users) ? users : [];
  } catch (error) {
    console.error('Failed to load users from API:', error);
    return [];
  }
}

async function createUserOnServer(userData) {
  try {
    const user = await apiPost('/users', userData);
    return { success: true, user };
  } catch (error) {
    console.error('Failed to create user:', error);
    return { success: false, message: error.message };
  }
}

async function updateUserPassword(userId, newPassword) {
  try {
    const response = await apiPut(`/users/${userId}`, { password: newPassword });
    return { success: true, user: response };
  } catch (error) {
    console.error('Failed to update user password:', error);
    return { success: false, message: error.message };
  }
}

// === UI functions ===

function createUser() {
  const u = document.getElementById('newUsername').value.trim();
  const p = document.getElementById('newPassword').value;
  const r = document.getElementById('newRole').value;
  if (!u || !p) return alert('Username and password are required.');

  const userData = {
    username: u,
    password: p,
    role: r,
  };

  createUserOnServer(userData)
    .then(result => {
      if (result.success) {
        alert('User created');
        renderUserList();
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
      } else {
        alert(`Error: ${result.message}`);
      }
    })
    .catch(() => {
      alert('Error creating user. Check network and try again.');
    });
}

function editUserPassword(id, newPassword) {
  if (!newPassword) return alert('Password required');
  updateUserPassword(id, newPassword)
    .then(result => {
      if (result.success) {
        alert('Password updated');
        renderUserList();
      } else {
        alert(`Error: ${result.message}`);
      }
    })
    .catch(() => {
      alert('Error updating password. Check network and try again.');
    });
}

function renderUserList() {
  getUsers()
    .then(users => {
      const container = document.getElementById('userList');
      if (!container) return;

      container.innerHTML = users.map(u => `
        <div class="package-card" style="margin-bottom: 12px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong>${u.username}</strong>
            <span style="
              padding: 4px 10px;
              border-radius: 999px;
              background: ${u.role === 'admin' ? '#f66' : '#5c6'};
              color: #fff;
              font-size: 0.85rem;
            ">
              ${u.role}
            </span>
          </div>

          <div class="form-group" style="margin-bottom: 8px;">
            <label style="display:block; margin-bottom:4px;">Password:</label>
            <div class="password-row" style="display:flex; align-items:center; gap:8px;">
              <input 
                type="password" 
                id="pwd-${u.id}" 
                value="${u.password}" 
                style="flex:1; padding:6px 10px; border:1px solid #ddd; border-radius:4px;"
              />
              <button 
                type="button" 
                class="show-password-btn" 
                onclick="toggleUserPassword('pwd-${u.id}', this)" 
                title="Show/Hide Password"
                style="padding:6px 10px; border:none; border-radius:4px; background:#e5e7eb; cursor:pointer;"
              >
                👁️
              </button>
            </div>
          </div>

          <div style="text-align:center; margin-top:8px;">
            <button 
              onclick="editUserPassword(${u.id}, document.getElementById('pwd-${u.id}').value)" 
              style="padding:6px 18px; background:#4CAF50; color:white; border:none; border-radius:6px; cursor:pointer; font-size:0.9rem;"
            >
              💾 Save
            </button>
          </div>
        </div>
      `).join('');
    })
    .catch(() => {
      const container = document.getElementById('userList');
      if (container) {
        container.innerHTML = '<p>Failed to load users. Check connection.</p>';
      }
    });
}

function toggleUserPassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

// === API URL setting (for admin.html) ===

function saveApiBaseUrl() {
  const input = document.getElementById('apiBaseUrlInput');
  const newUrl = input.value.trim();

  if (!newUrl) {
    return alert('Please enter a valid API URL (e.g. http://192.168.1.10:5000/api or https://sub.example.com/api)');
  }

  // Validate that it looks like a URL ending with /api
  if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
    return alert('URL must start with http:// or https://');
  }
  if (!newUrl.endsWith('/api')) {
    return alert('URL must end with /api (e.g. https://sub.example.com/api)');
  }

  // Save to localStorage and tell the user to reload
  window.saveApiBaseUrlToStorage(newUrl);
  alert('API URL saved. Please reload the page for changes to take effect.');
}

// === Welcome message and init ===

function updateWelcomeMessage() {
  const user = getCurrentUser();
  const welcomeEl = document.getElementById('welcomeUser');
  if (welcomeEl && user) {
    welcomeEl.textContent = `Welcome, ${user.username} (${user.role})`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateWelcomeMessage();
  renderUserList();
});
