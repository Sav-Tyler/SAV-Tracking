// auth.js

import { API_BASE_URL } from './config.js';

// Simple login via /api/login (no JWT)
async function login(username, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Login failed');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Login failed');
    }

    // Store session user in sessionStorage for the app
    sessionStorage.setItem(
      'savUser',
      JSON.stringify({ username: data.username, role: data.role })
    );

    return { success: true, user: { username: data.username, role: data.role } };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: error.message };
  }
}

// Staff login from modal on index.html
export async function staffLogin() {
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
    resultEl.innerHTML = 'Please enter a tracking number.';
    return;
  }

  try {
    resultEl.innerHTML = 'Checking...';

    const res = await fetch(
      `${API_BASE_URL}/public-search?tracking=${encodeURIComponent(tracking)}`
    );
    if (!res.ok) {
      resultEl.innerHTML = 'Lookup failed. Please try again.';
      return;
    }

    const data = await res.json();
    if (!data.packages || data.packages.length === 0) {
      resultEl.innerHTML = 'No packages found for that tracking number.';
    } else {
      resultEl.innerHTML = `${data.packages.length} package(s) found for that tracking number.`;
    }
  } catch (e) {
    console.error('Public track error', e);
    resultEl.innerHTML = 'Error performing lookup.';
  }
}
