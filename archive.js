// archive.js

import { apiGet, cachePackages, readCachedPackages } from './common.js';

// Global array for filtering
let allArchivedPackages = [];

// Load archived packages from API, with cache fallback
export async function loadArchived() {
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
      const filtered = allArchivedPackages.filter((pkg) => {
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
    allArchivedPackages = allArchivedPackages.filter((pkg) =>
      ['archived', 'signed', 'completed'].includes(
        (pkg.status || '').toLowerCase()
      )
    );

    if (searchTerm) {
      const filtered = allArchivedPackages.filter((pkg) => {
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
export async function viewAllArchived() {
  try {
    const packages = await apiGet('/packages/archived');
    allArchivedPackages = Array.isArray(packages) ? packages : [];
    cachePackages(allArchivedPackages);
    displayArchivedPackages(allArchivedPackages);
  } catch (error) {
    console.warn('Failed to load all archived packages from API, using cache:', error);
    allArchivedPackages = readCachedPackages();
    allArchivedPackages = allArchivedPackages.filter((pkg) =>
      ['archived', 'signed', 'completed'].includes(
        (pkg.status || '').toLowerCase()
      )
    );
    displayArchivedPackages(allArchivedPackages);
  }
}

// Apply detailed filters (customer / tracking / status)
export function applyFilters() {
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
    filtered = filtered.filter((pkg) =>
      (pkg.name || '').toLowerCase().includes(customerFilter)
    );
  }
  if (trackingFilter) {
    filtered = filtered.filter((pkg) =>
      (pkg.tracking || '').toLowerCase().includes(trackingFilter)
    );
  }
  if (statusFilter) {
    filtered = filtered.filter(
      (pkg) => (pkg.status || '').toLowerCase() === statusFilter.toLowerCase()
    );
  }

  displayArchivedPackages(filtered);
}

// Render cards
function displayArchivedPackages(packages) {
  const container = document.getElementById('archiveList');
  if (!container) return;

  if (!packages || packages.length === 0) {
    container.innerHTML =
      '<div class="empty-state">No archived packages found for this search.</div>';
    return;
  }

  const rows = packages.map((pkg) => {
    const tracking = pkg.tracking || '(no tracking)';
    const name = pkg.name || '(no name)';
    const phone = pkg.phone || '';
    const postal = pkg.postal || '';
    const status = (pkg.status || '').toLowerCase();
    const created = pkg.signed_at || pkg.created_at || '';
    const createdLabel = created ? new Date(created).toLocaleString() : '';

    let statusLabel = status || 'unknown';
    let statusClass = 'status-unknown';
    if (status === 'signed' || status === 'completed') {
      statusLabel = 'picked up';
      statusClass = 'status-picked-up';
    } else if (status === 'sent back') {
      statusLabel = 'sent back';
      statusClass = 'status-sent-back';
    }

    return `
      <div class="archive-card">
        <div class="archive-main">
          <div class="archive-tracking">${tracking}</div>
          <div class="archive-meta">
            <span class="archive-name">${name}</span>
            ${phone ? `<span class="archive-phone">· ${phone}</span>` : ''}
            ${postal ? `<span class="archive-postal">· ${postal}</span>` : ''}
          </div>
        </div>
        <div class="archive-side">
          <div class="archive-status ${statusClass}">${statusLabel}</div>
          <div class="archive-date">${createdLabel}</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = rows.join('');
}
