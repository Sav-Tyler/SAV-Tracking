// settings.js

const API_BASE = 'http://localhost:5000/api';

// -------- Branding --------

async function loadBranding() {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) return;

    const settings = await res.json();

    const taglineInput = document.getElementById('taglineInput');
    const logoPreview = document.getElementById('logoPreview');

    if (taglineInput) {
      taglineInput.value = settings.tagline || '';
    }

    if (logoPreview && settings.logo_url) {
      logoPreview.src = settings.logo_url;
      logoPreview.style.display = 'inline-block';
    }
  } catch (e) {
    console.error('Failed to load branding', e);
  }
}

async function saveBranding() {
  const taglineEl = document.getElementById('taglineInput');
  const fileInput = document.getElementById('logoFileInput');
  const tagline = taglineEl ? taglineEl.value.trim() : '';

  // base payload for non-file data
  const basePayload = { tagline };

  const sendUpdate = async (logoUrl) => {
    const payload = { ...basePayload };
    if (logoUrl !== null) payload.logo_url = logoUrl;

    try {
      await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      alert('Branding updated');
    } catch (e) {
      console.error('Failed to save branding', e);
      alert('Error saving branding');
    }
  };

  // If a new file is chosen, read it as data URL (same pattern as old admin.js)
  if (fileInput && fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      const preview = document.getElementById('logoPreview');
      if (preview) {
        preview.src = dataUrl;
        preview.style.display = 'inline-block';
      }
      await sendUpdate(dataUrl);
    };
    reader.readAsDataURL(file);
  } else {
    // No new file; backend should keep existing logo if logo_url is omitted / null
    await sendUpdate(null);
  }
}

// -------- Grandstream Integration --------

async function loadGrandstreamSettings() {
  try {
    const res = await fetch(`${API_BASE}/grandstream`);
    if (!res.ok) return;

    const data = await res.json();

    const ipEl = document.getElementById('grandstreamIP');
    const extEl = document.getElementById('grandstreamExt');
    const userEl = document.getElementById('grandstreamUser');
    const passEl = document.getElementById('grandstreamPass');
    const msgEl = document.getElementById('grandstreamMsgID');

    if (ipEl) ipEl.value = data.ip || '';
    if (extEl) extEl.value = data.extension || '';
    if (userEl) userEl.value = data.username || '';
    if (passEl) passEl.value = data.password || '';
    if (msgEl) msgEl.value = data.message_id || '';
  } catch (e) {
    console.error('Failed to load Grandstream settings', e);
  }
}

async function saveGrandstreamSettings() {
  const payload = {
    ip: document.getElementById('grandstreamIP').value.trim(),
    extension: document.getElementById('grandstreamExt').value.trim(),
    username: document.getElementById('grandstreamUser').value.trim(),
    password: document.getElementById('grandstreamPass').value,
    message_id: document.getElementById('grandstreamMsgID').value.trim()
  };

  try {
    const res = await fetch(`${API_BASE}/grandstream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert('Grandstream settings saved');
    } else {
      alert('Failed to save Grandstream settings');
    }
  } catch (e) {
    console.error('Error saving Grandstream settings', e);
    alert('Error saving Grandstream settings');
  }
}

async function testGrandstreamConnection() {
  try {
    const res = await fetch(`${API_BASE}/grandstream/test`, {
      method: 'POST'
    });
    if (res.ok) {
      const data = await res.json();
      alert(data.message || 'Grandstream connection OK');
    } else {
      alert('Grandstream test failed');
    }
  } catch (e) {
    console.error('Error testing Grandstream connection', e);
    alert('Error testing Grandstream connection');
  }
}

// -------- Init --------

document.addEventListener('DOMContentLoaded', () => {
  loadBranding();
  loadGrandstreamSettings();
});
