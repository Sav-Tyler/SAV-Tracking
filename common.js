function getUsers(){return JSON.parse(localStorage.getItem('users')||'[]')}
function saveUsers(u){localStorage.setItem('users',JSON.stringify(u))}
function getCustomers(){return JSON.parse(localStorage.getItem('customers')||'[]')}
function saveCustomers(c){localStorage.setItem('customers',JSON.stringify(c))}
function getPackages(){return JSON.parse(localStorage.getItem('packages')||'[]')}
function savePackages(p){localStorage.setItem('packages',JSON.stringify(p))}
function checkAuth(){const s=localStorage.getItem('currentUser');if(!s){window.location.href='index.html';return null}const u=JSON.parse(s);document.getElementById('welcomeUser').textContent='Welcome, '+u.username;const adminBtn=document.getElementById('adminBtn');if(adminBtn&&u.role==='admin')adminBtn.classList.remove('hidden');return u}
function logout(){localStorage.removeItem('currentUser');window.location.href='index.html'}
checkAuth();
