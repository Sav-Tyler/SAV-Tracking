// signatures.js
// Customer pickup signatures using localStorage packages/customers

let signaturePad;

function initSignature() {
  const canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;

  signaturePad = new SignaturePad(canvas, {
    backgroundColor: '#fff'
  });
}

function clearSignature() {
  if (signaturePad) {
    signaturePad.clear();
  }
}

function loadCustomerPackages() {
  const nameInput = document.getElementById('customerSigName');
  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (!name) {
    alert('Enter a customer name');
    return;
  }

  const customers = getCustomers();
  const customer = customers.find(c =>
    c.name && c.name.toLowerCase().includes(name.toLowerCase())
  );

  if (!customer) {
    alert('Customer not found');
    return;
  }

  const allPackages = getPackages();
  // Adjust status as needed; here using 'Available for Pickup' per original code
  const customerPackages = allPackages.filter(
    p => p.customerId === customer.id && p.status === 'Available for Pickup'
  );

  const listEl = document.getElementById('customerPackages');
  if (!listEl) return;

  listEl.innerHTML = customerPackages.map(p => `
    <div class="package-card">
      <input type="checkbox" data-id="${p.id}">
      ${p.trackingNumber || p.tracking} (${p.courier || ''})
    </div>
  `).join('');

  const sigSection = document.getElementById('signatureSection');
  if (sigSection) {
    sigSection.classList.remove('hidden');
  }

  if (!signaturePad) {
    initSignature();
  }
}

async function saveSignatures() {
  const listEl = document.getElementById('customerPackages');
  if (!listEl) return;

  const checkboxes = listEl.querySelectorAll('input:checked');
  if (!checkboxes.length) {
    alert('Select at least one package');
    return;
  }

  if (!signaturePad || signaturePad.isEmpty()) {
    alert('Need a signature before saving');
    return;
  }

  const signatureData = signaturePad.toDataURL();

  const photoInput = document.getElementById('photoInput');
  let photoData = null;
  if (photoInput && photoInput.files && photoInput.files[0]) {
    const reader = new FileReader();
    photoData = await new Promise(resolve => {
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(photoInput.files[0]);
    });
  }

  const allPackages = getPackages();
  checkboxes.forEach(cb => {
    const id = cb.dataset.id;
    const pkg = allPackages.find(p => String(p.id) === String(id));
    if (pkg) {
      pkg.status = 'Picked Up';
      pkg.signature = signatureData;
      if (photoData) {
        pkg.photo = photoData;
      }
    }
  });

  savePackages(allPackages);

  alert('Signatures saved');

  if (signaturePad) signaturePad.clear();
  if (photoInput) photoInput.value = '';

  const sigSection = document.getElementById('signatureSection');
  if (sigSection) {
    sigSection.classList.add('hidden');
  }

  listEl.innerHTML = '';
}
