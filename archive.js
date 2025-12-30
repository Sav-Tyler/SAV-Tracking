// archive.js
import {
  apiGet,
  cachePackages,
  readCachedPackages,
} from './common.js';

// Global array for filtering
let allArchivedPackages = [];

// Load archived packages from API, with cache fallback
async function loadArchived() {
  const searchTerm = (document.getElementById('archiveFilter')?.value || '')
    .trim()
    .toLowerCase();

  try {
    // Try to get fresh archived packages from API
    const packages = await apiGet('/packages/archived');
    allArchivedPackages = Array.isArray(packages) ? packages : [];

    // Update cache with fresh data
    cachePackages(allArchivedPackages);

    // Apply search filter
    if (searchTerm) {
      const filtered = allArchivedPackages.filter(pkg => {
        const name = (pkg.name || '').toLowerCase();
        const tracking = (pkg.tracking || '').toLowerCase();
        const phone = (pkg.phone || '').toLowerCase();
        const postal = (pkg.postal || '').toLowerCase();
        return (
          name.includes(searchTerm) ||
          tracking.includes(searchTerm) ||
          phone.includes(searchTerm) ||
          postal.includes(searchTerm)
        );
      });
      displayArchivedPackages(filtered);
    } else {
      displayArchivedPackages(allArchivedPackages);
    }
  } catch (error) {
    console.warn('Failed to load archived packages from API, using cache:', error);
    // On error, fall back to cached data
    allArchivedPackages = readCachedPackages();
    // Filter by archived/completed status
    allArchivedPackages = allArchivedPackages.filter(pkg =>
      ['archived', 'signed', 'completed'].includes((pkg.status || '').toLowerCase())
    );

    if (searchTerm) {
      const filtered = allArchivedPackages.filter(pkg => {
        const name = (pkg.name || '').toLowerCase();
        const tracking = (pkg.tracking || '').toLowerCase();
        const phone = (pkg.phone || '').toLowerCase();
        const postal = (pkg.postal || '').toLowerCase();
        return (
          name.includes(searchTerm) ||
          tracking.includes(searchTerm) ||
          phone.includes(searchTerm) ||
          postal.includes(searchTerm)
        );
      });
      displayArchivedPackages(filtered);
    } else {
      displayArchivedPackages(allArchivedPackages);
    }
  }
}

// View all archived (no search term)
async function viewAllArchived() {
  try {
    const packages = await apiGet('/packages/archived');
    allArchivedPackages = Array.isArray(packages) ? packages : [];
    cachePackages(allArchivedPackages);
    displayArchivedPackages(allArchivedPackages);
  } catch (error) {
    console.warn('Failed to load all archived packages from API, using cache:', error);
    allArchivedPackages = readCachedPackages();
    allArchivedPackages = allArchivedPackages.filter(pkg =>
      ['archived', 'signed', 'completed'].includes((pkg.status || '').toLowerCase())
    );
    displayArchivedPackages(allArchivedPackages);
  }
}

// Apply detailed filters (customer / tracking / status)
function applyFilters() {
  const customerFilter = (document.getElementById('filterCustomer')?.value || '')
    .trim()
    .toLowerCase();
  const trackingFilter = (document.getElementById('filterTracking')?.value || '')
    .trim()
    .toLowerCase();
  const statusFilter = (document.getElementById('filterStatus')?.value || '')
    .trim()
    .toLowerCase();

  let filtered = allArchivedPackages;

  if (customerFilter) {
    filtered = filtered.filter(pkg =>
      (pkg.name || '').toLowerCase().includes(customerFilter)
    );
  }

  if (trackingFilter) {
    filtered = filtered.filter(pkg =>
      (pkg.tracking || '').toLowerCase().includes(trackingFilter)
    );
  }

  if (statusFilter) {
    filtered = filtered.filter(pkg =>
      (pkg.status || '').toLowerCase() === statusFilter.toLowerCase()
    );
  }

  displayArchivedPackages(filtered);
}

// Render cards
function displayArchivedPackages(packages) {
  const container = document.getElementById('archiveList');

  if (!container) return;

  if (!packages || packages.length === 0) {
    container.innerHTML = '<div class="no-packages">No archived packages found</div>';
    return;
  }

  const html = packages
    .map(pkg => {
      const tracking = pkg.tracking || 'N/A';
      const createdAt = pkg.created_at;
      const signedAt = pkg.signed_at;
      const receivedText = createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A';
      const pickedUpText = signedAt ? new Date(signedAt).toLocaleString() : 'N/A';
      const statusText = (pkg.status || 'completed').toLowerCase();

      return `
        <div class="package-card">
          ${
            pkg.label_image
              ? `<img src="${pkg.label_image}" alt="Label" style="max-width: 200px; border-radius: 8px; margin-bottom: 10px;">`
              : ''
          }
          <div class="package-info"><strong>Courier:</strong> ${pkg.courier || ''}</div>
          <div class="package-info"><strong>Service:</strong> ${pkg.service || ''}</div>
          <div class="package-info"><strong>Tracking:</strong> ${tracking}</div>
          <div class="package-info"><strong>Name:</strong> ${pkg.name || ''}</div>
          <div class="package-info"><strong>Phone:</strong> ${pkg.phone || 'N/A'}</div>
          <div class="package-info"><strong>Postal:</strong> ${pkg.postal || ''}</div>
          <div class="package-info"><strong>Weight:</strong> ${pkg.weight || ''}</div>
          <div class="package-info"><strong>Received:</strong> ${receivedText}</div>
          <div class="package-info"><strong>Picked Up:</strong> ${pickedUpText}</div>
          ${
            pkg.signature || pkg.signature_image
              ? `
            <div class="package-info">
              <strong>Signature:</strong><br>
              <img src="${pkg.signature || pkg.signature_image}" alt="Signature"
                   style="max-width: 300px; border: 2px solid #ddd; border-radius: 8px; margin-top: 10px;">
            </div>
          `
              : ''
          }
          <span class="status-badge status-signed">✅ ${
            statusText.charAt(0).toUpperCase() + statusText.slice(1)
          }</span>
        </div>
      `;
    })
    .join('');

  container.innerHTML = html;
}

// Optional: cache last filter state for instant re‑filtering
function saveArchiveFilters() {
  const searchTerm = document.getElementById('archiveFilter')?.value || '';
  const customerFilter = document.getElementById('filterCustomer')?.value || '';
  const trackingFilter = document.getElementById('filterTracking')?.value || '';
  const statusFilter = document.getElementById('filterStatus')?.value || '';

  const filters = {
    searchTerm,
    customerFilter,
    trackingFilter,
    statusFilter,
  };
  localStorage.setItem('archiveFilters', JSON.stringify(filters));
}

function restoreArchiveFilters() {
  const saved = localStorage.getItem('archiveFilters');
  if (!saved) return;

  try {
    const filters = JSON.parse(saved);
    if (document.getElementById('archiveFilter')) {
      document.getElementById('archiveFilter').value = filters.searchTerm || '';
    }
    if (document.getElementById('filterCustomer')) {
      document.getElementById('filterCustomer').value = filters.customerFilter || '';
    }
    if (document.getElementById('filterTracking')) {
      document.getElementById('filterTracking').value = filters.trackingFilter || '';
    }
    if (document.getElementById('filterStatus')) {
      document.getElementById('filterStatus').value = filters.statusFilter || '';
    }
  } catch (e) {
    console.warn('Failed to restore archive filters:', e);
  }
}

// Export functions used by archived.html
export {
  loadArchived,
  viewAllArchived,
  applyFilters,
  saveArchiveFilters,
  restoreArchiveFilters,
};
