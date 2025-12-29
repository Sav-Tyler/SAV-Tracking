function createUser() {
    const u = document.getElementById('newUsername').value.trim();
    const p = document.getElementById('newPassword').value;
    const r = document.getElementById('newRole').value;
    if (!u || !p) return alert('Required');
    
    let users = getUsers();
    users.push({id: Date.now(), username: u, password: p, role: r});
    saveUsers(users);
    alert('Created');
    renderUserList();
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
}

function resetPassword() {
    const u = document.getElementById('resetUsername').value.trim();
    const p = document.getElementById('resetPassword').value;
    if (!u || !p) return alert('Required');
    
    let users = getUsers();
    let user = users.find(x => x.username === u);
    if (!user) return alert('Not found');
    
    user.password = p;
    saveUsers(users);
    alert('Reset');
    document.getElementById('resetUsername').value = '';
    document.getElementById('resetPassword').value = '';
}

function renderUserList() {
    const users = getUsers();
    document.getElementById('userList').innerHTML = users.map(u => `
        <div class="package-card" style="margin-bottom: 12px; padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong>${u.username}</strong>
                <span style="padding: 4px 10px; border-radius: 999px; background: ${u.role === 'admin' ? '#f66' : '#5c6'}; color: #fff; font-size: 0.85rem;">
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
}


renderUserList();

async function loadBranding() {
  try {
    const res = await fetch('/api/settings');
    const settings = await res.json();

    const taglineInput = document.getElementById('taglineInput');
    if (taglineInput) taglineInput.value = settings.tagline || '';

    const logoPreview = document.getElementById('logoPreview');
    if (logoPreview && settings.logo_url) {
      logoPreview.src = settings.logo_url;
      logoPreview.style.display = 'inline-block';
    }

    const textColor = document.getElementById('textColorInput');
    const headerBg = document.getElementById('headerBgColorInput');
    const pageBg = document.getElementById('pageBgColorInput');
    const trackingBg = document.getElementById('trackingBgColorInput');
    const staffBarBg = document.getElementById('staffBarBgColorInput');

    if (textColor && settings.text_color) textColor.value = settings.text_color;
    if (headerBg && settings.header_bg_color) headerBg.value = settings.header_bg_color;
    if (pageBg && settings.page_bg_color) pageBg.value = settings.page_bg_color;
    if (trackingBg && settings.tracking_bg_color) trackingBg.value = settings.tracking_bg_color;
    if (staffBarBg && settings.staff_bar_bg_color) staffBarBg.value = settings.staff_bar_bg_color;
  } catch (e) {
    console.error('Failed to load branding', e);
  }
}


async function saveBranding() {
  const taglineEl = document.getElementById('taglineInput');
  const fileInput = document.getElementById('logoFileInput');

  const textColorEl = document.getElementById('textColorInput');
  const headerBgEl = document.getElementById('headerBgColorInput');
  const pageBgEl = document.getElementById('pageBgColorInput');
  const trackingBgEl = document.getElementById('trackingBgColorInput');
  const staffBarBgEl = document.getElementById('staffBarBgColorInput');

  const tagline = taglineEl ? taglineEl.value.trim() : '';

  const basePayload = {
    tagline,
    text_color: textColorEl ? textColorEl.value : null,
    header_bg_color: headerBgEl ? headerBgEl.value : null,
    page_bg_color: pageBgEl ? pageBgEl.value : null,
    tracking_bg_color: trackingBgEl ? trackingBgEl.value : null,
    staff_bar_bg_color: staffBarBgEl ? staffBarBgEl.value : null
  };

  const sendUpdate = async (logoUrl) => {
    const payload = { ...basePayload };
    if (logoUrl !== null) payload.logo_url = logoUrl;
    try {
      await fetch('/api/settings', {
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
    await sendUpdate(null);
  }
}


  // If a new file is chosen, read it as data URL
  if (fileInput && fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result; // base64 image
      const preview = document.getElementById('logoPreview');
      if (preview) {
        preview.src = dataUrl;
        preview.style.display = 'inline-block';
      }
      await sendUpdate(dataUrl);
    };
    reader.readAsDataURL(file);
  } else {
    // No new file; keep existing logo URL (backend will leave it unchanged if null)
    await sendUpdate(null);
  }
}


function toggleUserPassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
}

document.addEventListener('DOMContentLoaded', () => {
    // Ensure user list still loads
    renderUserList();
    // Load branding fields
    loadBranding();
});

