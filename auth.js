// auth.js
import { API_BASE_URL } from './config.js';
import {
  setAuthToken,
  clearAuthToken,
  setCurrentUser,
  clearCurrentUser,
} from './common.js';

// Login via /api/auth/login
async function login(username, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Login failed');
    }

    const data = await response.json();
    const token = data.token;
    const user = data.user;

    if (!token) {
      throw new Error('No token received');
    }

    // Store token in sessionStorage (authoritative auth state)
    setAuthToken(token);
    // Optionally mirror user info to localStorage for convenience
    setCurrentUser(user);

    return { success: true, user };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: error.message };
  }
}

// Logout: clear token and cached user
function logout() {
  clearAuthToken();
  clearCurrentUser();
  // Optionally clear any other session state
  sessionStorage.removeItem('currentUser');
  sessionStorage.removeItem('userRole');
  sessionStorage.removeItem('userId');
  // Redirect to login page
  window.location.href = 'index.html';
}

// Check if user is authenticated
function isAuthenticated() {
  return !!getAuthToken();
}

// Get current user from localStorage (for UI only, not as source of truth)
function getCurrentUser() {
  const userStr = localStorage.getItem('currentUser');
  return userStr ? JSON.parse(userStr) : null;
}

// Staff login from modal on index.html
async function staffLogin() {
  const usernameEl = document.getElementById('staffUsername');
  const passwordEl = document.getElementById('staffPassword');

  const username = usernameEl ? usernameEl.value.trim() : '';
  const password = passwordEl ? passwordEl.value : '';

  if (!username || !password) {
    alert('Username and password are required');
    return;
  }

  const result = await login(username, password);
  if (result.success) {
    window.location.href = 'dashboard.html';
  } else {
    alert(`❌ ${result.message}`);
  }
}

// Optional: public tracking helper for index.html (if still used there)
// This is separate from customer_tracking.html.
async function publicTrack() {
  const trackingInput = document.getElementById('publicTracking');
  const resultEl = document.getElementById('publicResult');

  if (!trackingInput || !resultEl) return;

  const tracking = trackingInput.value.trim();
  if (!tracking) {
    resultEl.innerHTML = '<div class="package-card">Enter a tracking number.</div>';
    return;
  }

  try {
    // Use the tracking endpoint
    const pkg = await fetch(`${API_BASE_URL}/packages/${tracking}`).then(r => r.json());

    if (pkg && pkg.status === 'pending') {
      resultEl.innerHTML = `
        <div class="package-card">
          <strong>${pkg.tracking || pkg.trackingNumber}</strong><br>
          ${pkg.name || ''}<br>
          <small>${pkg.courier || ''}</small><br>
          <span class="status-badge status-pending">📦 Awaiting Pickup</span>
        </div>
      `;
    } else if (pkg) {
      resultEl.innerHTML = `
        <div class="package-card">
          <strong>${pkg.tracking || pkg.trackingNumber}</strong><br>
          ${pkg.name || ''}<br>
          <small>${pkg.courier || ''}</small><br>
          <span class="status-badge status-signed">✅ ${pkg.status || 'Completed'}</span>
        </div>
      `;
    } else {
      resultEl.innerHTML = '<div class="package-card">No package found for that tracking number.</div>';
    }
  } catch (error) {
    console.error('Failed to fetch package:', error);
    resultEl.innerHTML = '<div class="package-card">Error checking tracking number.</div>';
  }
}

// Export functions used by index.html and other pages
export {
  login,
  logout,
  isAuthenticated,
  getCurrentUser,
  staffLogin,
  publicTrack,
};
