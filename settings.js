// settings.js

import { API_BASE_URL } from './config.js';

let API_BASE = API_BASE_URL;

// ---------- API base URL (LAN vs hosted) ----------

function initApiBaseSection() {
  const input = document.getElementById('apiBaseUrlInput');
  if (!input) return;

  const stored = localStorage.getItem('api_base_url');
  input.value = stored || API_BASE;

  const saveBtn = document.getElementById('saveApiBaseUrlBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const value = input.value.trim();
      if (!value) {
        localStorage.removeItem('api_base_url');
        API_BASE = `${window.location.protocol}//${window.location.hostname}:5000/api`;
        alert('API URL cleared; system will use the current host on port 5000.');
      } else {
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          alert('URL must start with http:// or https://');
          return;
        }
        if (!value.endsWith('/api')) {
          alert('URL should end with /api (e.g. https://host.example.com/api).');
          return;
        }
        localStorage.setItem('api_base_url', value);
        API_BASE = value;
        alert('API URL saved.');
      }
    });
  }
}

// ---------- Branding (public tracking page) ----------

async function loadBrandingSection() {
  const taglineInput = document.getElementById('publicTaglineInput');
  const logoUrlInput = document.getElementById('logoUrlInput');

  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) return;
    const settings = await res.json();
    if (taglineInput) taglineInput.value = settings.tagline || '';
    if (logoUrlInput) logoUrlInput.value = settings.logo_url || '';
  } catch (e) {
    console.error('Failed to load branding', e);
  }
}

async function saveBrandingSection() {
  const taglineEl = document.getElementById('publicTaglineInput');
  const logoUrlEl = document.getElementById('logoUrlInput');

  const tagline = taglineEl ? taglineEl.value.trim() : '';
  const logoUrl = logoUrlEl ? logoUrlEl.value.trim() : '';

  const payload = { tagline };
  if (logoUrl) {
    payload.logo_url = logoUrl;
  }

  try {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      alert('Branding updated.');
    } else {
      alert('Failed to save branding.');
    }
  } catch (e) {
    console.error('Failed to save branding', e);
    alert('Error saving branding.');
  }
}

function initBrandingSection() {
  const btn = document.getElementById('saveBrandingBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      saveBrandingSection();
    });
  }
  loadBrandingSection();
}

// ---------- Telephony (Grandstream) ----------

async function loadTelephonySection() {
  const hostEl = document.getElementById('pbxHostInput');
  const portEl = document.getElementById('pbxPortInput');
  const userEl = document.getElementById('pbxUserInput');
  const passEl = document.getElementById('pbxPasswordInput');

  try {
    const res = await fetch(`${API_BASE}/grandstream`);
    if (!res.ok) return;
    const data = await res.json();

    if (hostEl) hostEl.value = data.ip || '';
    if (portEl) portEl.value = data.port || data.extension || '';
    if (userEl) userEl.value = data.username || '';
    if (passEl) passEl.value = data.password || '';
  } catch (e) {
    console.error('Failed to load Grandstream settings', e);
  }
}

async function saveTelephonySection() {
  const host = document.getElementById('pbxHostInput')?.value.trim() || '';
  const port = document.getElementById('pbxPortInput')?.value.trim() || '';
  const user = document.getElementById('pbxUserInput')?.value.trim() || '';
  const pass = document.getElementById('pbxPasswordInput')?.value || '';

  const payload = {
    ip: host,
    port,
    username: user,
    password: pass,
  };

  try {
    const res = await fetch(`${API_BASE}/grandstream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      alert('Telephony settings saved.');
    } else {
      alert('Failed to save telephony settings.');
    }
  } catch (e) {
    console.error('Error saving telephony settings', e);
    alert('Error saving telephony settings.');
  }
}

function initTelephonySection() {
  const btn = document.getElementById('saveTelephonyBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      saveTelephonySection();
    });
  }
  loadTelephonySection();
}

// ---------- Page init ----------

export function initSettingsPage() {
  // Refresh API_BASE from localStorage override if present
  const stored = localStorage.getItem('api_base_url');
  API_BASE = stored || API_BASE_URL;

  initApiBaseSection();
  initBrandingSection();
  initTelephonySection();
}
