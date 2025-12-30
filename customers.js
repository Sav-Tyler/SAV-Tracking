// customers.js
import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  cacheCustomers,
  readCachedCustomers,
} from './common.js';

// Global array for filtering
let allCustomers = [];

// Load customers from API, with cache fallback
async function loadCustomers() {
  try {
    // Try to get fresh customers from API
    const data = await apiGet('/customers');
    const customers = Array.isArray(data.addresses) ? data.addresses : [];

    allCustomers = customers;
    // Update cache with fresh data
    cacheCustomers(allCustomers);

    displayCustomers(allCustomers);
  } catch (error) {
    console.warn('Failed to load customers from API, using cache:', error);
    // On error, fall back to cached data
    allCustomers = readCachedCustomers();
    displayCustomers(allCustomers);
  }
}

function displayCustomers(customers) {
  const tbody = document.getElementById('customersTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  customers.forEach((customer, index) => {
    const row = `<tr>
      <td>${customer.name}</td>
      <td>${customer.street}, Elliot Lake, ON</td>
      <td>${customer.postal}</td>
      <td>${customer.phone || 'N/A'}</td>
      <td>
        <button onclick="editCustomer(${index})" class="btn-edit">Edit</button>
        <button onclick="deleteCustomer(${index})" class="btn-delete">Delete</button>
      </td>
    </tr>`;
    tbody.innerHTML += row;
  });
}

function searchCustomers() {
  const input = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const rows = document.querySelectorAll('#customersTableBody tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(input) ? '' : 'none';
  });
}

function showAddCustomerModal() {
  document.getElementById('modalTitle').textContent = 'Add Customer';
  document.getElementById('customerForm').reset();
  document.getElementById('customerId').value = '';
  document.getElementById('customerModal').style.display = 'block';
}

function editCustomer(index) {
  const customer = allCustomers[index];
  if (!customer) return;

  document.getElementById('modalTitle').textContent = 'Edit Customer';
  document.getElementById('customerId').value = index;
  document.getElementById('customerName').value = customer.name;
  document.getElementById('customerStreet').value = customer.street;
  document.getElementById('customerPostal').value = customer.postal;
  document.getElementById('customerPhone').value = customer.phone || '';
  document.getElementById('customerModal').style.display = 'block';
}

async function saveCustomer(event) {
  event.preventDefault();

  const id = document.getElementById('customerId').value;
  const customer = {
    name: document.getElementById('customerName').value,
    street: document.getElementById('customerStreet').value,
    postal: document.getElementById('customerPostal').value,
    phone: document.getElementById('customerPhone').value,
    locked: document.getElementById('customerLocked').checked,
  };

  try {
    if (id === '') {
      // Create new customer
      await apiPost('/customers', customer);
    } else {
      // Update existing customer
      await apiPut(`/customers/${id}`, customer);
    }

    // Refresh full list from API and update cache
    const data = await apiGet('/customers');
    const customers = Array.isArray(data.addresses) ? data.addresses : [];
    allCustomers = customers;
    cacheCustomers(allCustomers);
    displayCustomers(allCustomers);

    closeModal();
  } catch (error) {
    console.error('Failed to save customer:', error);
    alert(`Error: ${error.message}`);
  }
}

async function deleteCustomer(index) {
  const customer = allCustomers[index];
  if (!customer) return;

  if (!confirm(`Delete customer "${customer.name}"?`)) return;

  try {
    await apiDelete(`/customers/${index}`);

    // Refresh full list from API and update cache
    const data = await apiGet('/customers');
    const customers = Array.isArray(data.addresses) ? data.addresses : [];
    allCustomers = customers;
    cacheCustomers(allCustomers);
    displayCustomers(allCustomers);
  } catch (error) {
    console.error('Failed to delete customer:', error);
    alert(`Error: ${error.message}`);
  }
}

function closeModal() {
  document.getElementById('customerModal').style.display = 'none';
}

function logout() {
  sessionStorage.clear();
  window.location.href = 'index.html';
}

// Export functions used by customers.html
export {
  loadCustomers,
  searchCustomers,
  showAddCustomerModal,
  editCustomer,
  saveCustomer,
  deleteCustomer,
  closeModal,
  logout,
};
