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

function editUserPassword(userId, newPassword) {
    let users = getUsers();
    let user = users.find(x => x.id === userId);
    if (!user) return alert('User not found');
    
    user.password = newPassword;
    saveUsers(users);
    alert('Password updated');
    renderUserList();
}

function renderUserList() {
    const users = getUsers();
    document.getElementById('userList').innerHTML = users.map(u => `
        <div class="package-card" style="margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong>${u.username}</strong>
                <span style="padding: 4px 8px; border-radius: 8px; background: ${u.role === 'admin' ? '#f66' : '#5c6'}; color: #fff;">${u.role}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <label style="flex: 0 0 auto;">Password:</label>
                <input type="text" id="pwd-${u.id}" value="${u.password}" style="flex: 1; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px;" />
                <button onclick="editUserPassword(${u.id}, document.getElementById('pwd-${u.id}').value)" style="padding: 4px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">💾 Save</button>
            </div>
        </div>
    `).join('');
}

renderUserList();
