// customers.js

import {
  apiGet,
  cacheCustomers,
  readCachedCustomers,
} from './common.js';

// Global array for filtering
let allCustomers = [];

// Load customers from API, with cache fallback
async function loadCustomers() {
  try {
    const customers = await apiGet('/customers');
    allCustomers = Array.isArray(customers) ? customers : [];

    cacheCustomers(allCustomers);
    displayCustomers(allCustomers);
  } catch (error) {
    console.warn('Failed to load customers from API, using cache:', error);
    allCustomers = readCachedCustomers();
    displayCustomers(allCustomers);
  }
}

function displayCustomers(customers) {
  const tbody = document.getElementById('customersTableBody');
  if (!tbody) return;

  if (!customers || customers.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4">No customers found for this search.</td></tr>';
    return;
  }

  const rows = customers.map((c) => {
    const name = c.name || '';
    const phone = c.phone || '';
    const postal = c.postal || '';
    const street = c.street || '';

    return `
      <tr>
        <td>${name}</td>
        <td>${phone}</td>
        <td>${postal}</td>
        <td>${street}</td>
      </tr>
    `;
  });

  tbody.innerHTML = rows.join('');
}

// Apply filters from inputs
function applyCustomerFilters() {
  const nameFilter = (document.getElementById('customerNameSearch')?.value || '')
    .trim()
    .toLowerCase();
  const phoneFilter = (document.getElementById('customerPhoneSearch')?.value || '')
    .trim()
    .toLowerCase();
  const postalFilter = (document.getElementById('customerPostalSearch')?.value || '')
    .trim()
    .toLowerCase();

  let filtered = allCustomers;

  if (nameFilter) {
    filtered = filtered.filter((c) =>
      (c.name || '').toLowerCase().includes(nameFilter)
    );
  }
  if (phoneFilter) {
    filtered = filtered.filter((c) =>
      (c.phone || '').toLowerCase().includes(phoneFilter)
    );
  }
  if (postalFilter) {
    filtered = filtered.filter((c) =>
      (c.postal || '').toLowerCase().includes(postalFilter)
    );
  }

  displayCustomers(filtered);
}

// Exported init for customers.html
export function initCustomersPage() {
  const searchBtn = document.getElementById('customerSearchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', applyCustomerFilters);
  }

  // Live filtering while typing
  document.getElementById('customerNameSearch')?.addEventListener('input', applyCustomerFilters);
  document.getElementById('customerPhoneSearch')?.addEventListener('input', applyCustomerFilters);
  document.getElementById('customerPostalSearch')?.addEventListener('input', applyCustomerFilters);

  loadCustomers();
}
