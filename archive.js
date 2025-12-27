const API_URL = 'http://localhost:5000/api';

async function loadArchived() {
    const searchTerm = document.getElementById('archiveFilter').value.toLowerCase();
    
    try {
        const url = searchTerm 
            ? `${API_URL}/packages/archived?search=${encodeURIComponent(searchTerm)}`
            : `${API_URL}/packages/archived`;
            
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to fetch archived packages');
        }
        
        const packages = await response.json();
        displayArchivedPackages(packages);
    } catch (error) {
        console.error('Error loading archived packages:', error);
        document.getElementById('archiveList').innerHTML = 
            '<div class="error-message">❌ Error loading archived packages. Please try again.</div>';
    }
}

function displayArchivedPackages(packages) {
    const container = document.getElementById('archiveList');
    
    if (packages.length === 0) {
        container.innerHTML = '<div class="no-packages">No archived packages found</div>';
        return;
    }
    
    const html = packages.map(pkg => `
        <div class="package-card">
            ${pkg.label_image ? `<img src="${pkg.label_image}" alt="Label" style="max-width: 200px; border-radius: 8px; margin-bottom: 10px;">` : ''}
            <div class="package-info"><strong>Courier:</strong> ${pkg.courier}</div>
            <div class="package-info"><strong>Tracking:</strong> ${pkg.tracking}</div>
            <div class="package-info"><strong>Name:</strong> ${pkg.name}</div>
            <div class="package-info"><strong>Phone:</strong> ${pkg.phone || 'N/A'}</div>
            <div class="package-info"><strong>Postal:</strong> ${pkg.postal}</div>
            <div class="package-info"><strong>Received:</strong> ${new Date(pkg.created_at).toLocaleDateString()}</div>
            <div class="package-info"><strong>Picked Up:</strong> ${new Date(pkg.signed_at).toLocaleString()}</div>
            ${pkg.signature_image ? `
                <div class="package-info">
                    <strong>Signature:</strong><br>
                    <img src="${pkg.signature_image}" alt="Signature" style="max-width: 300px; border: 2px solid #ddd; border-radius: 8px; margin-top: 10px;">
                </div>
            ` : ''}
            <span class="status-badge status-signed">✅ Completed</span>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Global variable to store all archived packages for filtering
let allArchivedPackages = [];

// View All Archived Packages
async function viewAllArchived() {
    try {
        const response = await fetch(`${API_URL}/packages/archived/all`);
        const packages = await response.json();
        
        if (!response.ok) {
            throw new Error('Failed to fetch all archived packages');
        }
        
        allArchivedPackages = packages; // Store for filtering
        displayArchivedPackages(packages);
    } catch (error) {
        console.error('Error loading all archived packages:', error);
        document.getElementById('archiveList').innerHTML = 
            '<div class="error-message">❌ Error loading archived packages. Please try again.</div>';
    }
}

// Apply Filters
function applyFilters() {
    const customerFilter = document.getElementById('filterCustomer').value.toLowerCase();
    const trackingFilter = document.getElementById('filterTracking').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    
    let filtered = allArchivedPackages.filter(pkg => {
        const matchCustomer = !customerFilter || pkg.name.toLowerCase().includes(customerFilter);
        const matchTracking = !trackingFilter || pkg.tracking.toLowerCase().includes(trackingFilter);
        const matchStatus = !statusFilter || pkg.status === statusFilter;
        
        return matchCustomer && matchTracking && matchStatus;
    });
    
    displayArchivedPackages(filtered);
}

