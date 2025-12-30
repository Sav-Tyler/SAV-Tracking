// dashboard.js
// OCR intake + API-backed package management + 5‑day warnings + pickup/signatures

import {
  apiGet,
  apiPost,
  cachePackages,
  readCachedPackages,
} from './common.js';
// adjust imports if you name things differently
import { processLabelFiles } from './ocr.js';
import { saveSignature as apiSaveSignature } from './signatures.js';

let pendingPackages = [];
let selectedPackages = [];
let signatureCanvas, signatureCtx;

// -------- OCR intake (client-side via ocr.js, then POST /api/packages) --------

async function processImages() {
  try {
    const fileInput = document.getElementById('labelImages');
    const files = Array.from(fileInput.files || []);
    if (!files.length) {
      alert('❌ Select images');
      return;
    }

    const courier = document.getElementById('courier').value;
    const processingEl = document.getElementById('processing');
    processingEl.textContent = '⏳ Processing...';

    pendingPackages = [];

    // OCR in-browser via ocr.js
    const ocrPackages = await processLabelFiles(files, courier);

    const nowIso = new Date().toISOString();
    pendingPackages = ocrPackages.map(p => ({
      courier: p.courier || courier,
      tracking: p.tracking || '',
      name: p.name || '',
      phone: p.phone || '',
      postal: p.postal || '',
      label_image: p.label_image || p.labelImage || '',
      status: 'pending',
      created_at: p.created_at || nowIso,
      signed_at: p.signed_at || null,
      weight: p.weight || '',
      service: p.service || '',
      raw_ocr: p.raw_ocr || '',
    }));

    showPendingPackages();
    processingEl.textContent = '✅ Done: ' + pendingPackages.length;
    document.getElementById('continueOrFinish').classList.remove('hidden');
  } catch (err) {
    console.error('Fatal:', err);
    alert('❌ Error: ' + err.message);
    document.getElementById('processing').textContent = '❌ Error';
  }
}

function showPendingPackages() {
  const c = document.getElementById('pendingPackages');
  if (!c) return;

  if (!pendingPackages.length) {
    c.innerHTML = '';
    return;
  }

  c.innerHTML = `
    <h3>Pending Packages</h3>
    <ul>
      ${pendingPackages
        .map(
          p =>
            `<li>${p.courier} – ${p.tracking || '(no tracking)'} – ${
              p.name || 'Unknown'
            }</li>`
        )
        .join('')}
    </ul>
    <button class="process-btn" onclick="savePendingToApi()">💾 Save to Server</button>
  `;
}

function continueBatch() {
  const input = document.getElementById('labelImages');
  const processing = document.getElementById('processing');
  if (input) input.value = '';
  if (processing) processing.textContent = '';
}

function finishBatch() {
  const input = document.getElementById('labelImages');
  const processing = document.getElementById('processing');
  if (input) input.value = '';
  if (processing) processing.textContent = 'Batch finished.';
}

// Save OCR‑created packages to /api/packages
async function savePendingToApi() {
  if (!pendingPackages.length) {
    alert('No pending packages to save.');
    return;
  }

  try {
    for (const pkg of pendingPackages) {
      await apiPost('/packages', pkg);
    }

    // Refresh from API and update cache
    const packages = await apiGet('/packages');
    cachePackages(packages);

    alert(`✅ Saved ${pendingPackages.length} package(s) to server.`);
    pendingPackages = [];
    showPendingPackages();
    loadShippingSummary();
  } catch (error) {
    console.error('Failed to save packages:', error);
    alert(`Error saving packages: ${error.message}`);
  }
}

// -------- Customer pickup (search via API, sign via /packages/{id}/sign) --------

function openCustomerPickup() {
  document.getElementById('pickupModal').classList.add('active');
  selectedPackages = [];
  document.getElementById('packagesDisplay').innerHTML =
    '<div class="no-packages">Enter search criteria to find packages</div>';
  document.getElementById('signatureSection').style.display = 'none';
}

function closeCustomerPickup() {
  document.getElementById('pickupModal').classList.remove('active');
  document.getElementById('signatureSection').style.display = 'none';
  document.getElementById('packagesDisplay').innerHTML =
    '<div class="no-packages">Enter search criteria to find packages</div>';
}

async function searchPackages() {
  const searchTerm = document
    .getElementById('customerSearch')
    .value.trim()
    .toLowerCase();

  if (!searchTerm) {
    alert('Please enter a search term');
    return;
  }

  try {
    // Prefer API: get only recent/pending packages if you like, or all
    const packages = await apiGet('/packages?status=pending');
    cachePackages(packages);
    filterAndDisplayPackages(packages, searchTerm);
  } catch (error) {
    console.warn('Failed to load packages from API, using cache:', error);
    const packages = readCachedPackages();
    filterAndDisplayPackages(packages, searchTerm);
  }
}

function filterAndDisplayPackages(allPackages, searchTerm) {
  const pending = allPackages.filter(pkg => {
    const status = (pkg.status || 'pending').toLowerCase();
    return status === 'pending' || status === 'available for pickup';
  });

  const filtered = pending.filter(pkg => {
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

  displayPackages(filtered);
}

function displayPackages(packages) {
  const container = document.getElementById('packagesDisplay');

  if (!packages || packages.length === 0) {
    container.innerHTML =
      '<div class="no-packages">No packages found for this customer</div>';
    return;
  }

  const html = `
    <h3 style="margin-bottom: 20px;">📦 Found ${packages.length} Package(s)</h3>
    <div class="packages-grid">
      ${packages
        .map(pkg => {
          const id = pkg.id;
          const createdAt = pkg.created_at;
          const receivedText = createdAt
            ? new Date(createdAt).toLocaleDateString()
            : 'N/A';
          return `
            <div class="package-card">
              ${
                pkg.label_image
                  ? `<img src="${pkg.label_image}" alt="Label">`
                  : ''
              }
              <div class="package-info">
                <input type="checkbox" class="select-checkbox"
                  onchange="togglePackageSelection('${id}', this.checked)"
                  id="pkg_${id}">
                <strong>Tracking:</strong> ${pkg.tracking || 'N/A'}
              </div>
              <div class="package-info"><strong>Courier:</strong> ${
                pkg.courier || ''
              }</div>
              <div class="package-info"><strong>Name:</strong> ${
                pkg.name || ''
              }</div>
              <div class="package-info"><strong>Phone:</strong> ${
                pkg.phone || 'N/A'
              }</div>
              <div class="package-info"><strong>Postal:</strong> ${
                pkg.postal || ''
              }</div>
              <div class="package-info"><strong>Received:</strong> ${receivedText}</div>
            </div>
          `;
        })
        .join('')}
    </div>
    <button class="search-btn" style="margin-top: 20px;" onclick="showSignatureSection()">
      Continue to Signature →
    </button>
  `;

  container.innerHTML = html;
}

function togglePackageSelection(packageId, selected) {
  const idStr = String(packageId);
  if (selected) {
    if (!selectedPackages.includes(idStr)) {
      selectedPackages.push(idStr);
    }
  } else {
    selectedPackages = selectedPackages.filter(id => id !== idStr);
  }
}

function showSignatureSection() {
  if (selectedPackages.length === 0) {
    alert('Please select at least one package');
    return;
  }

  const section = document.getElementById('signatureSection');
  section.style.display = 'block';

  signatureCanvas = document.getElementById('signatureCanvas');
  signatureCtx = signatureCanvas.getContext('2d');

  // Reset canvas listeners by cloning
  const newCanvas = signatureCanvas.cloneNode(true);
  signatureCanvas.parentNode.replaceChild(newCanvas, signatureCanvas);
  signatureCanvas = newCanvas;
  signatureCtx = signatureCanvas.getContext('2d');

  let drawing = false;

  function getPos(e) {
    const rect = signatureCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function startDrawing(e) {
    e.preventDefault();
    drawing = true;
    const { x, y } = getPos(e);
    signatureCtx.beginPath();
    signatureCtx.moveTo(x, y);
  }

  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    signatureCtx.lineTo(x, y);
    signatureCtx.strokeStyle = '#000';
    signatureCtx.lineWidth = 2;
    signatureCtx.lineCap = 'round';
    signatureCtx.stroke();
  }

  function stopDrawing(e) {
    if (!drawing) return;
    e.preventDefault();
    drawing = false;
  }

  signatureCanvas.addEventListener('mousedown', startDrawing);
  signatureCanvas.addEventListener('mousemove', draw);
  signatureCanvas.addEventListener('mouseup', stopDrawing);
  signatureCanvas.addEventListener('mouseout', stopDrawing);

  signatureCanvas.addEventListener('touchstart', startDrawing, {
    passive: false,
  });
  signatureCanvas.addEventListener('touchmove', draw, { passive: false });
  signatureCanvas.addEventListener('touchend', stopDrawing, { passive: false });

  section.scrollIntoView({ behavior: 'smooth' });
}

function clearSignature() {
  if (!signatureCanvas || !signatureCtx) return;
  signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
}

async function saveSignature() {
  if (selectedPackages.length === 0) {
    alert('No packages selected');
    return;
  }
  if (!signatureCanvas || !signatureCtx) {
    alert('Signature area not ready');
    return;
  }

  const signatureData = signatureCanvas.toDataURL('image/png');
  const blank = document.createElement('canvas');
  blank.width = signatureCanvas.width;
  blank.height = signatureCanvas.height;
  if (signatureData === blank.toDataURL('image/png')) {
    alert('Please provide a signature');
    return;
  }

  const customerName = document
    .getElementById('customerNameInput')
    .value.trim();
  const nowIso = new Date().toISOString();

  try {
    for (const packageId of selectedPackages) {
      await apiSaveSignature(packageId, {
        signature_image: signatureData,
        signed_by: customerName || null,
        signed_at: nowIso,
      });
    }

    // Refresh packages and cache
    const packages = await apiGet('/packages');
    cachePackages(packages);

    alert(
      `✅ Successfully completed pickup for ${selectedPackages.length} package(s)!`
    );
    closeCustomerPickup();
    loadShippingSummary();
  } catch (error) {
    console.error('Failed to save signatures:', error);
    alert(`Error saving signatures: ${error.message}`);
  }
}

function useScriptelPad() {
  alert(
    'Scripttel Signature Pad Integration\n\nTo integrate with Scripttel signature pad:\n\n1. Install Scripttel SDK\n2. Connect pad via USB\n3. Use Scripttel API to capture signature\n\nContact your IT administrator for setup assistance.'
  );
}

// -------- Shipping summary (API‑first, cache fallback) --------

async function loadShippingSummary() {
  const container = document.getElementById('shippingSummary');
  const content = document.getElementById('shippingSummaryContent');
  if (!container || !content) return;

  let packages;
  try {
    const sinceDays = 5;
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    const isoSince = since.toISOString();

    packages = await apiGet(`/packages?since=${isoSince}`);
    cachePackages(packages);
  } catch (error) {
    console.warn('Failed to load summary from API, using cache:', error);
    packages = readCachedPackages();
  }

  const summary = {};

  packages.forEach(pkg => {
    const courier = pkg.courier || 'Unknown';
    if (!summary[courier]) {
      summary[courier] = { small: 0, large: 0, total: 0 };
    }
    const weight = Number(pkg.weight || pkg.weightLbs || 0);
    const isLarge = !isNaN(weight) && weight >= 10;
    if (isLarge) summary[courier].large += 1;
    else summary[courier].small += 1;
    summary[courier].total += 1;
  });

  let html =
    '<table style="width:100%; border-collapse: collapse;">' +
    '<tr>' +
    '<th style="border-bottom:1px solid #ccc; text-align:left; padding:8px;">Shipping Company</th>' +
    '<th style="border-bottom:1px solid #ccc; text-align:left; padding:8px;">Small (&lt;10 lbs)</th>' +
    '<th style="border-bottom:1px solid #ccc; text-align:left; padding:8px;">Large (&ge;10 lbs)</th>' +
    '<th style="border-bottom:1px solid #ccc; text-align:left; padding:8px;">Total</th>' +
    '</tr>';

  Object.keys(summary).forEach(company => {
    const s = summary[company];
    html += `
      <tr>
        <td style="padding:8px; border-bottom:1px solid #eee;">${company}</td>
        <td style="padding:8px; border-bottom:1px solid #eee;">${s.small}</td>
        <td style="padding:8px; border-bottom:1px solid #eee;">${s.large}</td>
        <td style="padding:8px; border-bottom:1px solid #eee;">${s.total}</td>
      </tr>
    `;
  });

  html += '</table>';
  content.innerHTML = html;
}

// Expose functions used by dashboard.html inline handlers
window.processImages = processImages;
window.continueBatch = continueBatch;
window.finishBatch = finishBatch;
window.savePendingToApi = savePendingToApi;
window.openCustomerPickup = openCustomerPickup;
window.closeCustomerPickup = closeCustomerPickup;
window.searchPackages = searchPackages;
window.togglePackageSelection = togglePackageSelection;
window.showSignatureSection = showSignatureSection;
window.clearSignature = clearSignature;
window.saveSignature = saveSignature;
window.useScriptelPad = useScriptelPad;
window.loadShippingSummary = loadShippingSummary;
