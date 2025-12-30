// admin.js

import { apiGet, apiPost, apiPut } from './common.js';

// --- API helpers (for /api/users) ---

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

// --- UI functions ---

async function handleCreateUser() {
  const usernameEl = document.getElementById('newUsername');
  const passwordEl = document.getElementById('newPassword');
  const roleEl = document.getElementById('newRole');

  const u = usernameEl ? usernameEl.value.trim() : '';
  const p = passwordEl ? passwordEl.value : '';
  const r = roleEl ? roleEl.value : 'staff';

  if (!u || !p) {
    alert('Username and password are required.');
    return;
  }

  const userData = { username: u, password: p, role: r };

  const result = await createUserOnServer(userData);
  if (result.success) {
    alert('User created');
    if (usernameEl) usernameEl.value = '';
    if (passwordEl) passwordEl.value = '';
    await renderUserList();
  } else {
    alert(`Error: ${result.message}`);
  }
}

async function handleUpdatePassword(userId) {
  const inputId = `password-${userId}`;
  const input = document.getElementById(inputId);
  const newPassword = input ? input.value : '';
  if (!newPassword) {
    alert('Password required');
    return;
  }

  const result = await updateUserPassword(userId, newPassword);
  if (result.success) {
    alert('Password updated');
    if (input) input.value = '';
  } else {
    alert(`Error: ${result.message}`);
  }
}

function toggleUserPassword(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function renderUserList() {
  const container = document.getElementById('usersTableBody');
  if (!container) return;

  const users = await getUsers();
  if (!users || users.length === 0) {
    container.innerHTML =
      '<tr><td colspan="4">No users found. Add a user above.</td></tr>';
    return;
  }

  const rows = users.map((u) => {
    const created = u.created_at ? new Date(u.created_at).toLocaleString() : '';
    const roleClass =
      (u.role || '').toLowerCase() === 'admin' ? 'role-admin' : 'role-staff';
    const roleLabel = u.role || 'staff';
    const inputId = `password-${u.id}`;

    return `
      <tr>
        <td>${u.username}</td>
        <td><span class="${roleClass}">${roleLabel}</span></td>
        <td>${created}</td>
        <td>
          <input
            type="password"
            id="${inputId}"
            placeholder="New password"
            style="width: 120px; font-size: 11px; padding: 4px 6px; margin-right: 4px;"
          />
          <button
            type="button"
            class="btn btn-secondary"
            style="padding: 4px 8px; font-size: 11px;"
            data-action="toggle"
            data-input-id="${inputId}"
          >
            Show
          </button>
          <button
            type="button"
            class="btn btn-primary"
            style="padding: 4px 8px; font-size: 11px;"
            data-action="update"
            data-user-id="${u.id}"
          >
            Update
          </button>
        </td>
      </tr>
    `;
  });

  container.innerHTML = rows.join('');

  // Attach button handlers
  container.querySelectorAll('button[data-action="toggle"]').forEach((btn) => {
    const inputId = btn.getAttribute('data-input-id');
    btn.addEventListener('click', () => {
      toggleUserPassword(inputId);
      const input = document.getElementById(inputId);
      if (input && input.type === 'password') {
        btn.textContent = 'Show';
      } else {
        btn.textContent = 'Hide';
      }
    });
  });

  container.querySelectorAll('button[data-action="update"]').forEach((btn) => {
    const userId = btn.getAttribute('data-user-id');
    btn.addEventListener('click', () => {
      if (userId) handleUpdatePassword(parseInt(userId, 10));
    });
  });
}

// --- Init exported for admin.html ---

export function initAdminPage() {
  const addUserBtn = document.getElementById('addUserBtn');
  if (addUserBtn) {
    addUserBtn.addEventListener('click', handleCreateUser);
  }

  renderUserList();
}
