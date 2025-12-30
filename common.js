// common.js

import { API_BASE_URL } from './config.js';

// === Auth helpers ===

// Token-based helpers (optional; currently not used by login)
function getAuthToken() {
  return sessionStorage.getItem('authToken');
}

function setAuthToken(token) {
  sessionStorage.setItem('authToken', token);
}

function clearAuthToken() {
  sessionStorage.removeItem('authToken');
}

// Current user stored as JSON (used by auth.js via savUser)
function getCurrentUser() {
  const userStr = sessionStorage.getItem('savUser') || localStorage.getItem('currentUser');
  return userStr ? JSON.parse(userStr) : null;
}

function setCurrentUser(user) {
  // Prefer sessionStorage for active session; keep localStorage for legacy compatibility
  sessionStorage.setItem('savUser', JSON.stringify(user));
  localStorage.setItem('currentUser', JSON.stringify(user));
}

function clearCurrentUser() {
  sessionStorage.removeItem('savUser');
  localStorage.removeItem('currentUser');
}

// === API helpers ===

async function apiRequest(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

function apiGet(path, options) {
  return apiRequest(path, { ...options, method: 'GET' });
}

function apiPost(path, body, options) {
  return apiRequest(path, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function apiPut(path, body, options) {
  return apiRequest(path, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

function apiDelete(path, options) {
  return apiRequest(path, { ...options, method: 'DELETE' });
}

// === Local cache helpers ===

function cachePackages(packages) {
  localStorage.setItem('cachedPackages', JSON.stringify(packages));
}

function readCachedPackages() {
  const cached = localStorage.getItem('cachedPackages');
  return cached ? JSON.parse(cached) : [];
}

function cacheCustomers(customers) {
  localStorage.setItem('cachedCustomers', JSON.stringify(customers));
}

function readCachedCustomers() {
  const cached = localStorage.getItem('cachedCustomers');
  return cached ? JSON.parse(cached) : [];
}

function cacheSettings(settings) {
  localStorage.setItem('cachedSettings', JSON.stringify(settings));
}

function readCachedSettings() {
  const cached = localStorage.getItem('cachedSettings');
  return cached ? JSON.parse(cached) : {};
}

// === Auth check for protected pages ===

function checkAuth() {
  const user = getCurrentUser();

  if (!user || !user.username) {
    window.location.href = 'index.html';
    return null;
  }

  const welcomeEl = document.getElementById('welcomeUser');
  if (welcomeEl) {
    welcomeEl.textContent = `Welcome, ${user.username}`;
  }

  const adminBtn = document.getElementById('adminBtn');
  if (adminBtn && user.role === 'admin') {
    adminBtn.classList.remove('hidden');
  }

  return { username: user.username, role: user.role };
}

function logout() {
  clearAuthToken();
  clearCurrentUser();
  sessionStorage.removeItem('userRole');
  sessionStorage.removeItem('userId');
  window.location.href = 'index.html';
}

// Export all helpers

export {
  // Auth
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  getCurrentUser,
  setCurrentUser,
  clearCurrentUser,
  // API
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  // Cache
  cachePackages,
  readCachedPackages,
  cacheCustomers,
  readCachedCustomers,
  cacheSettings,
  readCachedSettings,
  // Auth check / logout
  checkAuth,
  logout,
};
