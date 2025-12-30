// dashboard.js
import {
  apiGet,
  apiPost,
  cachePackages,
  readCachedPackages,
} from './common.js';

let allPackages = [];
let pendingPackages = [];
let selectedPackages = [];
let signatureCanvas;
let signatureCtx;
let isDrawing = false;
let capturedPhotoBlob = null;

function normalizeStatus(status) {
  const s = (status || '').toLowerCase();
  if (s === 'pending') return 'pending';
  if (s === 'signed' || s === 'picked up') return 'signed';
  if (s === 'sent back') return 'sent back';
  return 'pending';
}

function statusClass(status) {
  const s = normalizeStatus(status);
  if (s === 'pending') return 'status-pending';
  if (s === 'signed') return 'status-signed';
  if (s === 'sent back') return 'status-sent-back';
  return 'status-pending';
}

async function loadPackages() {
  try {
    const data = await apiGet('/packages');
    const pkgs = Array.isArray(data) ? data : [];
    allPackages = pkgs;
    cachePackages(allPackages);
  } catch (err) {
    console.warn('Failed to load packages from API, using cache:', err);
    allPackages = readCachedPackages();
  }
  pendingPackages = allPackages.filter(
    (p) => normalizeStatus(p.status) === 'pending'
  );
  renderPendingPackages();
  updateSummary();
}

function renderPendingPackages() {
  const list = document.getElementById('pendingPackagesList');
  if (!list) return;
  if (!pendingPackages.length) {
    list.innerHTML =
      '<div style="padding:8px; font-size:12px; color:#9ca3af;">No pending packages.</div>';
    return;
  }
  list.innerHTML = pendingPackages
    .map((p) => {
      const created = p.created_at
        ? new Date(p.created_at).toLocaleDateString()
        : '';
      const s = normalizeStatus(p.status);
      const cls = statusClass(s);
      return `
        <div class="package-row">
          <div class="pkg-main">
            <div class="pkg-name">${p.tracking || '(no tracking)'} — ${p.name || ''}</div>
            <div class="pkg-meta">${p.courier || ''} · ${created}</div>
          </div>
          <div class="pkg-status ${cls}">${s}</div>
        </div>
      `;
    })
    .join('');
}

function updateSummary() {
  const pendingCount = allPackages.filter(
    (p) => normalizeStatus(p.status) === 'pending'
  ).length;
  const signedCount = allPackages.filter(
    (p) => normalizeStatus(p.status) === 'signed'
  ).length;
  const sentBackCount = allPackages.filter(
    (p) => normalizeStatus(p.status) === 'sent back'
  ).length;
  const pendingEl = document.getElementById('summaryPending');
  const signedEl = document.getElementById('summarySigned');
  const sentBackEl = document.getElementById('summarySentBack');
  if (pendingEl) pendingEl.textContent = pendingCount.toString();
  if (signedEl) signedEl.textContent = signedCount.toString();
  if (sentBackEl) sentBackEl.textContent = sentBackCount.toString();
}

async function openCameraCapture() {
  try {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      capturedPhotoBlob = file;
      displayCapturedPhoto(file);
      alert('📸 Photo captured! Click "Process" to extract label data.');
    };
    input.click();
  } catch (error) {
    console.error('Camera error:', error);
    alert('Could not access camera. Please ensure camera permissions are granted.');
  }
}

function displayCapturedPhoto(file) {
  const photoGrid = document.querySelector('.photo-grid');
  if (!photoGrid) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = photoGrid.querySelector('[data-photo-preview]');
    if (preview) {
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`;
    } else {
      const tile = document.createElement('div');
      tile.className = 'photo-tile';
      tile.setAttribute('data-photo-preview', 'true');
      tile.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`;
      photoGrid.insertBefore(tile, photoGrid.firstChild);
    }
  };
  reader.readAsDataURL(file);
}

function extractFieldsFromText(text, courier) {
  const out = { name: '', tracking: '', phone: '', postal: '', weight: '', service: '' };
  if (!text) return out;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const postalRegex = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d\b/i;
  const phoneRegex = /(\+?1[-.,\s]?)?(\(?\d{3}\)?[-.,\s]?\d{3}[-.,\s]?\d{4})/;
  const trackingRegex = /\b[0-9A-Z]{8,}\b/g;
  const postalMatch = text.match(postalRegex);
  if (postalMatch) out.postal = postalMatch[0].toUpperCase();
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) out.phone = phoneMatch[0];
  const postalIdx = lines.findIndex(l => postalRegex.test(l));
  if (postalIdx > 0) out.name = lines[postalIdx - 1];
  const trackings = text.match(trackingRegex);
  if (trackings && trackings.length) {
    out.tracking = trackings.sort((a, b) => b.length - a.length)[0];
  }
  return out;
}

async function processLabelPhoto() {
  if (!capturedPhotoBlob) {
    alert('No photo captured yet. Click "Take Photo" first.');
    return;
  }
  const courier = document.getElementById('courierSelect')?.value || '';
  if (!courier) {
    alert('Please select a courier first.');
    return;
  }
  if (typeof Tesseract === 'undefined') {
    alert('OCR library is loading. Please wait and try again.');
    return;
  }
  try {
    alert('🔄 Processing label with OCR... This may take 15-30 seconds.');
    const { data } = await Tesseract.recognize(capturedPhotoBlob, 'eng', {
      logger: m => console.log('OCR Progress:', m)
    });
    const text = (data.text || '').replace(/\s+/g, ' ').trim();
    console.log('OCR Result:', text);
    const extracted = extractFieldsFromText(text, courier);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const trackingInput = document.getElementById('trackingInput');
      const nameInput = document.getElementById('nameInput');
      const phoneInput = document.getElementById('phoneInput');
      const postalInput = document.getElementById('postalInput');
      if (trackingInput) trackingInput.value = extracted.tracking || '';
      if (nameInput) nameInput.value = extracted.name || '';
      if (phoneInput) phoneInput.value = extracted.phone || '';
      if (postalInput) postalInput.value = extracted.postal || '';
      alert(`✅ OCR Complete!\n\nExtracted:\n- Tracking: ${extracted.tracking || '(not found)'}\n- Name: ${extracted.name || '(not found)'}\n- Phone: ${extracted.phone || '(not found)'}\n- Postal: ${extracted.postal || '(not found)'}\n\nReview and adjust if needed, then click Process to save.`);
    };
    reader.readAsDataURL(capturedPhotoBlob);
  } catch (error) {
    console.error('OCR error:', error);
    alert('❌ OCR processing failed: ' + error.message);
  }
}

async function addSinglePackage() {
  const courier = document.getElementById('courierSelect')?.value || '';
  const tracking = document.getElementById('trackingInput')?.value.trim() || '';
  const name = document.getElementById('nameInput')?.value.trim() || '';
  const phone = document.getElementById('phoneInput')?.value.trim() || '';
  const postal = document.getElementById('postalInput')?.value.trim() || '';
  const address = document.getElementById('addressInput')?.value.trim() || '';
  if (!courier || !tracking || !name) {
    alert('Courier, tracking, and customer name are required.');
    return;
  }
  const payload = {
    courier,
    tracking,
    name,
    phone,
    postal,
    address,
    status: 'pending',
  };
  try {
    await apiPost('/packages', payload);
    document.getElementById('trackingInput').value = '';
    document.getElementById('nameInput').value = '';
    document.getElementById('phoneInput').value = '';
    document.getElementById('postalInput').value = '';
    document.getElementById('addressInput').value = '';
    capturedPhotoBlob = null;
    await loadPackages();
    alert('✅ Package added.');
  } catch (err) {
    console.error('Failed to add package', err);
    alert('Could not add package.');
  }
}

function initLabelPhotoButtons() {
  const take = document.getElementById('takeLabelPhotoBtn');
  const process = document.getElementById('processLabelBtn');
  const more = document.getElementById('addMoreLabelBtn');
  const finish = document.getElementById('finishBatchBtn');
  if (take) {
    take.addEventListener('click', openCameraCapture);
  }
  if (process) {
    process.addEventListener('click', async () => {
      if (capturedPhotoBlob) {
        await processLabelPhoto();
      } else {
        addSinglePackage();
      }
    });
  }
  if (more) {
    more.addEventListener('click', () => {
      alert('Multiple label images to be implemented.');
    });
  }
  if (finish) {
    finish.addEventListener('click', () => {
      alert('Batch finish to be implemented.');
    });
  }
}

function searchPackagesForPickup() {
  const q =
    document.getElementById('pickupSearchInput')?.value.trim().toLowerCase() ||
    '';
  if (!q) {
    alert('Enter name, tracking, or phone to search.');
    return;
  }
  selectedPackages = allPackages.filter((p) => {
    const tracking = (p.tracking || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    const phone = (p.phone || '').toLowerCase();
    return (
      tracking.includes(q) || name.includes(q) || phone.includes(q)
    );
  });
  if (!selectedPackages.length) {
    alert('No matching packages for this customer.');
    return;
  }
  const first = selectedPackages[0];
  const nameInput = document.getElementById('pickupCustomerName');
  if (nameInput && first.name) {
    nameInput.value = first.name;
  }
  alert(`Found ${selectedPackages.length} package(s) for pickup.`);
}

function initSignaturePad() {
  const pad = document.getElementById('signaturePad');
  if (!pad) return;
  let canvas = pad.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = pad.clientWidth - 20;
    canvas.height = 140;
    canvas.style.width = '100%';
    canvas.style.height = '140px';
    pad.innerHTML = '';
    pad.appendChild(canvas);
  }
  signatureCanvas = canvas;
  signatureCtx = canvas.getContext('2d');
  signatureCtx.strokeStyle = '#e5e7eb';
  signatureCtx.lineWidth = 2;
  signatureCtx.lineJoin = 'round';
  signatureCtx.lineCap = 'round';
  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };
  const startDraw = (e) => {
    isDrawing = true;
    const { x, y } = getPos(e);
    signatureCtx.beginPath();
    signatureCtx.moveTo(x, y);
    e.preventDefault();
  };
  const draw = (e) => {
    if (!isDrawing) return;
    const { x, y } = getPos(e);
    signatureCtx.lineTo(x, y);
    signatureCtx.stroke();
    e.preventDefault();
  };
  const endDraw = () => {
    isDrawing = false;
  };
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', endDraw);
  canvas.addEventListener('mouseleave', endDraw);
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', endDraw);
}

function clearSignature() {
  if (!signatureCanvas || !signatureCtx) return;
  signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
}

async function completePickup() {
  if (!selectedPackages.length) {
    alert('Search and select customer packages first.');
    return;
  }
  const name =
    document.getElementById('pickupCustomerName')?.value.trim() || '';
  if (!name) {
    alert('Enter customer name.');
    return;
  }
  let signatureData = null;
  if (signatureCanvas) {
    signatureData = signatureCanvas.toDataURL('image/png');
  }
  const ids = selectedPackages.map((p) => p.id).filter((id) => id != null);
  if (!ids.length) {
    alert('No valid package IDs for pickup.');
    return;
  }
  try {
    await apiPost('/signatures/complete-pickup', {
      package_ids: ids,
      customer_name: name,
      signature_data: signatureData,
    });
    clearSignature();
    selectedPackages = [];
    document.getElementById('pickupCustomerName').value = '';
    await loadPackages();
    alert('✅ Pickup recorded.');
  } catch (err) {
    console.error('Pickup failed', err);
    alert('Could not complete pickup.');
  }
}

export function initDashboard() {
  loadPackages();
  initLabelPhotoButtons();
  const searchBtn = document.getElementById('pickupSearchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', searchPackagesForPickup);
  }
  const clearSigBtn = document.getElementById('clearSignatureBtn');
  if (clearSigBtn) {
    clearSigBtn.addEventListener('click', clearSignature);
  }
  const completePickupBtn = document.getElementById('completePickupBtn');
  if (completePickupBtn) {
    completePickupBtn.addEventListener('click', completePickup);
  }
  const scriptelBtn = document.getElementById('scriptelPickupBtn');
  if (scriptelBtn) {
    scriptelBtn.addEventListener('click', () => {
      alert('Scriptel integration to be implemented.');
    });
  }
  initSignaturePad();
}
