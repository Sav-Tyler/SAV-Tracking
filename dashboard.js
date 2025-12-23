let pendingPackages = [], currentBatchPackages = [];
const TEST_MODE = false;
const API_URL = 'http://localhost:5000/api';  // Update this to your server URL when deployed

async function processImages() {
    try {
        const files = document.getElementById('labelImages').files;
        if (!files.length) return alert('❌ Select images');
        
        const courier = document.getElementById('courier').value;
        document.getElementById('processing').innerHTML = '⏳ Processing...';
        pendingPackages = [];
        
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            
            // Convert image to base64 for storage
            const reader = new FileReader();
            const imageData = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(f);
            });
            
            if (TEST_MODE) {
                const pkg = {
                    id: Date.now() + Math.random(),
                    courier,
                    name: 'Test Customer',
                    tracking: 'TEST' + Math.floor(Math.random() * 1000000000),
                    phone: '705-123-4567',
                    postal: 'P5A 1M1',
                    labelImage: imageData,
                    missingFields: []
                };
                pendingPackages.push(pkg);
                continue;
            }
            
            // REAL MODE - Use Tesseract OCR
            try {
                if (typeof Tesseract === 'undefined') throw new Error('Tesseract not loaded');
                
                document.getElementById('processing').innerHTML = '⏳ ' + (i + 1) + '/' + files.length + ': ' + f.name + '...';
                
                const worker = await Tesseract.createWorker('eng');
                const { data } = await worker.recognize(f);
                const text = data.text;
                await worker.terminate();
                
                const pkg = {
                    id: Date.now() + Math.random(),
                    courier,
                    name: text.match(/([A-Z][a-z]+ [A-Z][a-z]+)/)?.[1] || '',
                    tracking: text.match(/\b[A-Z0-9]{10,}\b/)?.[0] || '',
                    phone: text.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/)?.[0] || '',
                    postal: text.match(/P5A\s*[12][A-Z0-9][0-9]/i)?.[0] || '',
                    labelImage: imageData,
                    missingFields: []
                };
                
                if (!pkg.name) pkg.missingFields.push('Name');
                if (!pkg.tracking) pkg.missingFields.push('Tracking');
                if (!pkg.postal) pkg.missingFields.push('Postal');
                
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
        // Save to backend
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
}
