// common.js
import { API_BASE_URL } from './config.js';

// === Auth helpers ===

function getAuthToken() {
  return sessionStorage.getItem('authToken');
}

function setAuthToken(token) {
  sessionStorage.setItem('authToken', token);
}

function clearAuthToken() {
  sessionStorage.removeItem('authToken');
}

function getCurrentUser() {
  const userStr = localStorage.getItem('currentUser');
  return userStr ? JSON.parse(userStr) : null;
}

function setCurrentUser(user) {
  localStorage.setItem('currentUser', JSON.stringify(user));
}

function clearCurrentUser() {
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

    // Return null for 204 No Content
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

// === Legacy auth check (for protected pages) ===

function checkAuth() {
  const username = sessionStorage.getItem('currentUser');
  const role = sessionStorage.getItem('userRole');

  // If not logged in, send back to login page
  if (!username) {
    window.location.href = 'index.html';
    return null;
  }

  // Some pages show a "Welcome, user" span
  const welcomeEl = document.getElementById('welcomeUser');
  if (welcomeEl) {
    welcomeEl.textContent = 'Welcome, ' + username;
  }

  // Some pages have an Admin button that should only show for admins
  const adminBtn = document.getElementById('adminBtn');
  if (adminBtn && role === 'admin') {
    adminBtn.classList.remove('hidden');
  }

  return { username, role };
}

function logout() {
  sessionStorage.removeItem('currentUser');
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

  // Legacy
  checkAuth,
  logout,
};
