// Initialize default admin user
function initDefaultAdmin() {
    const users = getUsers();
    if (!users.find(u => u.username === 'sav')) {
        users.push({
            id: Date.now(),
            username: 'sav',
            password: '$!SuperiorAudioVideo9!$',
            role: 'admin'
        });
        saveUsers(users);
    }
}

// Storage functions
function getUsers() {
    return JSON.parse(localStorage.getItem('users') || '[]');
}
function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}
function getPackages() {
    return JSON.parse(localStorage.getItem('packages') || '[]');
}

// Login function (old inline login form, if still used)
function doLogin() {
    const username = document.getElementById('username')?.value.trim() || '';
    const password = document.getElementById('password')?.value || '';
    const users = getUsers();
    const found = users.find(u => u.username === username && u.password === password);

    if (found) {
    sessionStorage.setItem('currentUser', found.username);
    sessionStorage.setItem('userRole', found.role);
    sessionStorage.setItem('userId', String(found.id));
    window.location.href = 'dashboard.html';
} else {
    alert('❌ Invalid credentials');
}

// Staff login from modal on index.html
function staffLogin() {
    const usernameEl = document.getElementById('staffUsername');
    const passwordEl = document.getElementById('staffPassword');
    const username = usernameEl ? usernameEl.value.trim() : '';
    const password = passwordEl ? passwordEl.value : '';

    const users = getUsers();
    const found = users.find(u => u.username === username && u.password === password);

if (found) {
    sessionStorage.setItem('currentUser', found.username);
    sessionStorage.setItem('userRole', found.role);
    sessionStorage.setItem('userId', String(found.id));
    window.location.href = 'dashboard.html';
} else {
    alert('❌ Invalid credentials');
}
}

// Public tracking
function publicTrack() {
    const tracking = document.getElementById('publicTracking').value.trim();
    const packages = getPackages();
    const pkg = packages.find(p => p.trackingNumber === tracking);
    const result = document.getElementById('publicResult');
    
    if (pkg && pkg.status === 'Available for Pickup') {
        result.innerHTML = `<div class="package-card">
            <h4>✅ Package Found!</h4>
            <strong>Tracking:</strong> ${pkg.trackingNumber}<br>
            <strong>Customer:</strong> ${pkg.customerName || pkg.name || 'Unknown'}<br>
            <strong>Status:</strong> <span style="color: #28a745; font-weight: 600;">${pkg.status}</span><br>
            <strong>Courier:</strong> ${pkg.courier}
        </div>`;
    } else {
        result.innerHTML = `<div class="package-card" style="background: #f8d7da; color: #721c24;">
            ❌ Package not found or already processed
        </div>`;
    }
}

// Toggle views (if you still use the old login/public view switching)
function showPublicSearch() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('publicSearch').classList.remove('hidden');
}

function showLogin() {
    document.getElementById('publicSearch').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
}

// Initialize
initDefaultAdmin();

// Show/hide password in staff login modal
function togglePassword() {
    const input = document.getElementById('staffPassword');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
}
