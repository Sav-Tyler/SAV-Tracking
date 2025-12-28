let pendingPackages = [], currentBatchPackages = [];
const API_URL = 'http://localhost:5000/api'; // Update this to your server URL when deployed

async function processImages() {
    try {
        const files = document.getElementById('labelImages').files;
        if (!files.length) return alert('❌ Select images');
        
        const courier = document.getElementById('courier').value;
        document.getElementById('processing').innerHTML = '⏳ Processing...';
        pendingPackages = [];
        
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            
            // Convert image to base64 for storage and processing
            const reader = new FileReader();
            const imageData = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(f);
            });
            
            document.getElementById('processing').innerHTML = '⏳ ' + (i + 1) + '/' + files.length + ': ' + f.name + '...';
            
            try {
                // Send to server for PaddleOCR processing
                const response = await fetch(`${API_URL}/process`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: imageData,
                        courier: courier
                    })
                });
                
                if (!response.ok) throw new Error('Server processing failed');
                
                const result = await response.json();
let pendingPackages = [], currentBatchPackages = [];
const API_URL = 'http://localhost:5000/api';

async function processImages() {
    try {
        const files = document.getElementById('labelImages').files;
        if (!files.length) return alert('❌ Select images');
        
        const courier = document.getElementById('courier').value;
        document.getElementById('processing').innerHTML = '⏳ Processing...';
        pendingPackages = [];
        
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            
            // Convert image to base64
            const reader = new FileReader();
            const imageData = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(f);
            });
            
            document.getElementById('processing').innerHTML = '⏳ ' + (i + 1) + '/' + files.length + ': ' + f.name + '...';
            
            try {
                // Send to server for PaddleOCR processing
                const response = await fetch(`${API_URL}/process`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: imageData,
                        courier: courier
                    })
                });
                
                if (!response.ok) throw new Error('Server processing failed');
                
                const result = await response.json();
                
                const pkg = {
                    id: Date.now() + Math.random(),
                    courier,
                    name: result.name || '',
                    tracking: result.tracking || '',
                    phone: result.phone || '',
                    postal: result.postal || '',
                    labelImage: imageData,
                    missingFields: result.missing_fields || []
                };
                
                pendingPackages.push(pkg);
            } catch (err) {
                console.error('OCR Error:', err);
                const pkg = {
                    id: Date.now() + Math.random(),
                    courier,
                    name: '',
                    tracking: '',
                    phone: '',
                    postal: '',
                    labelImage: imageData,
                    missingFields: ['Name', 'Tracking', 'Postal']
                };
                pendingPackages.push(pkg);
            }
        }
        
        showPendingPackages();
        document.getElementById('processing').innerHTML = '✅ Done: ' + pendingPackages.length;
        document.getElementById('continueOrFinish').classList.remove('hidden');
        
    } catch (err) {
        console.error('Fatal:', err);
        alert('❌ Error: ' + err.message);
        document.getElementById('processing').innerHTML = '❌ Error';
    }
}

function showPendingPackages() {
    const c = document.getElementById('pendingPackages');
    c.innerHTML = pendingPackages.map((p, i) => `
        <div class="package-card" style="border:2px solid ${p.missingFields.length ? '#dc3545' : '#28a745'}">
            <div style="display:grid;grid-template-columns:100px 1fr;gap:10px">
                <img src="${p.labelImage}" width="100" style="border-radius:8px">
                <div>
                    <p><strong>Courier:</strong> ${p.courier}</p>
                    <p><strong>Name:</strong> <input type="text" value="${p.name || ''}" id="name_${i}" style="width:200px;padding:4px"></p>
                    <p><strong>Tracking:</strong> <input type="text" value="${p.tracking || ''}" id="track_${i}" style="width:200px;padding:4px"></p>
                    <p><strong>Phone:</strong> <input type="text" value="${p.phone || ''}" id="phone_${i}" style="width:150px;padding:4px"></p>
                    <p><strong>Postal:</strong> <input type="text" value="${p.postal || ''}" id="postal_${i}" style="width:100px;padding:4px"></p>
                    ${p.missingFields.length ? `<p style="background:#f8d7da;padding:8px;border-radius:6px;color:#721c24">⚠️ Missing: ${p.missingFields.join(', ')}</p>` : ''}
                    <div class="btn-group">
                        <button onclick="savePackageFromForm(${i})" style="background:#28a745">✅ Save</button>
                        <button onclick="skipPackage(${i})" class="secondary">⏭️ Skip</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

async function savePackageFromForm(i) {
    const pkg = pendingPackages[i];
    pkg.name = document.getElementById('name_' + i).value.trim();
    pkg.tracking = document.getElementById('track_' + i).value.trim();
    pkg.phone = document.getElementById('phone_' + i).value.trim();
    pkg.postal = document.getElementById('postal_' + i).value.trim();
    
    if (!pkg.name || !pkg.tracking || !pkg.postal) {
        alert('❌ Name, Tracking, and Postal Code are required');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/packages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                courier: pkg.courier,
                name: pkg.name,
                tracking: pkg.tracking,
                phone: pkg.phone,
                postal: pkg.postal,
                labelImage: pkg.labelImage,
                createdBy: sessionStorage.getItem('currentUser')
            })
        });
        
        if (!response.ok) throw new Error('Failed to save package');
        
        currentBatchPackages.push(pkg);
        pendingPackages.splice(i, 1);
        showPendingPackages();
        
        if (!pendingPackages.length) {
            alert('✅ All packages saved!');
            document.getElementById('continueOrFinish').classList.remove('hidden');
        }
    } catch (err) {
        console.error('Save error:', err);
        alert('❌ Error saving package: ' + err.message);
    }
}

function skipPackage(i) {
    pendingPackages.splice(i, 1);
    showPendingPackages();
}

function continueBatch() {
    document.getElementById('labelImages').value = '';
    pendingPackages = [];
    document.getElementById('pendingPackages').innerHTML = '';
    document.getElementById('processing').innerHTML = '';
    document.getElementById('continueOrFinish').classList.add('hidden');
}

function finishBatch() {
    if (!currentBatchPackages.length) return alert('No packages');
    
    const s = {};
    currentBatchPackages.forEach(p => {
        const n = p.name;
        if (!s[n]) s[n] = { phone: p.phone, count: 0, packages: [] };
        s[n].count++;
        s[n].packages.push(p.tracking);
    });
    
    document.getElementById('customerSummaryList').innerHTML = Object.entries(s).map(([n, d]) =>
        `<div class="package-card">
            <h4>${n}</h4>
            <p><strong>Phone:</strong> ${d.phone || 'N/A'}</p>
            <p><strong>Total Packages:</strong> <span style="font-size:1.5em;color:#28a745">${d.count}</span></p>
            <p style="font-size:0.85em;opacity:0.7">${d.packages.join(', ')}</p>
        </div>`
    ).join('');
    
    document.getElementById('ocrWorkflow').classList.add('hidden');
    document.getElementById('batchSummary').classList.remove('hidden');
}

function returnToMainMenu() {
    document.getElementById('batchSummary').classList.add('hidden');
    document.getElementById('ocrWorkflow').classList.remove('hidden');
    document.getElementById('continueOrFinish').classList.add('hidden');
    currentBatchPackages = [];
}

async function filterPackages() {
    const q = document.getElementById('filterInput').value.toLowerCase();
    if (!q) {
        document.getElementById('packageList').innerHTML = '<div class="package-card">Enter search term</div>';
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/packages/archived?search=${q}`);
        const packages = await response.json();
        
        document.getElementById('packageList').innerHTML = packages.length ?
            packages.map(p => `
                <div class="package-card">
                    <strong style="font-size:1.1em">${p.tracking}</strong><br>
                    ${p.name}<br>
                    <small>${p.courier} | ${new Date(p.created_at).toLocaleDateString()}</small>
                    <br><span class="status-badge ${p.status === 'signed' ? 'status-signed' : 'status-pending'}">
                        ${p.status === 'signed' ? '✅ Signed' : '📦 Pending'}
                    </span>
                </div>
            `).join('') :
            '<div class="package-card">No results for: ' + q + '</div>';
    } catch (err) {
        console.error('Search error:', err);
        alert('❌ Error searching packages');
    }


// Load 5-Day Ready Packages
async function load5DayPackages() {
    try {
        const response = await fetch(`${API_URL}/packages/ready-5days`);
        const packages = await response.json();
        
        if (!response.ok) {
            throw new Error('Failed to fetch 5-day packages');
        }
        
        if (packages.length > 0) {
            document.getElementById('fiveDaySection').style.display = 'block';
            displayFiveDayPackages(packages);
        } else {
            document.getElementById('fiveDaySection').style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading 5-day packages:', error);
    }
}

// Display 5-Day Packages
function displayFiveDayPackages(packages) {
    const listDiv = document.getElementById('fiveDayPackageList');
    listDiv.innerHTML = packages.map(pkg => `
        <div class="package-card" style="margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
            <input type="checkbox" class="five-day-checkbox" data-id="${pkg.id}" style="margin-right: 10px;" />
            <strong>${pkg.tracking}</strong> - ${pkg.name} (Ready since: ${new Date(pkg.ready_date).toLocaleDateString()})
        </div>
    `).join('');
}

// Mark Selected as Sent Back
async function markSelectedAsSentBack() {
    const checkboxes = document.querySelectorAll('.five-day-checkbox:checked');
    const packageIds = Array.from(checkboxes).map(cb => cb.dataset.id);
    
    if (packageIds.length === 0) {
        alert('Please select at least one package to mark as sent back.');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/packages/bulk-sent-back`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ package_ids: packageIds })
        });
        
        if (!response.ok) {
            throw new Error('Failed to mark packages as sent back');
        }
        
        alert(`${packageIds.length} package(s) marked as sent back.`);
        load5DayPackages(); // Reload the list
    } catch (error) {
        console.error('Error marking packages as sent back:', error);
        alert('❌ Error marking packages as sent back.');
    }
}

// Load 5-day packages on page load
load5DayPackages();}

