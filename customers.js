// Load customers on page load
window.addEventListener('DOMContentLoaded', loadCustomers);

function loadCustomers() {
    fetch('/api/customers')
        .then(r => r.json())
        .then(data => {
            displayCustomers(data.addresses || []);
        });
}

function displayCustomers(customers) {
    const tbody = document.getElementById('customersTableBody');
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
    const input = document.getElementById('searchInput').value.toLowerCase();
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
    fetch('/api/customers').then(r => r.json()).then(data => {
        const customer = data.addresses[index];
        document.getElementById('modalTitle').textContent = 'Edit Customer';
        document.getElementById('customerId').value = index;
        document.getElementById('customerName').value = customer.name;
        document.getElementById('customerStreet').value = customer.street;
        document.getElementById('customerPostal').value = customer.postal;
        document.getElementById('customerPhone').value = customer.phone || '';
        document.getElementById('customerModal').style.display = 'block';
    });
}

function saveCustomer(event) {
    event.preventDefault();
    const id = document.getElementById('customerId').value;
    const customer = {
        name: document.getElementById('customerName').value,
        street: document.getElementById('customerStreet').value,
        postal: document.getElementById('customerPostal').value,
        phone: document.getElementById('customerPhone').value
    };
    
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/customers/${id}` : '/api/customers';
    
    fetch(url, {
        method: method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(customer)
    }).then(r => r.json()).then(() => {
        closeModal();
        loadCustomers();
    });
}

function deleteCustomer(index) {
    if (confirm('Delete this customer?')) {
        fetch(`/api/customers/${index}`, {method: 'DELETE'})
            .then(() => loadCustomers());
    }
}

function closeModal() {
    document.getElementById('customerModal').style.display = 'none';
}

function logout() {
    sessionStorage.clear();
    window.location.href = 'index.html';
}
