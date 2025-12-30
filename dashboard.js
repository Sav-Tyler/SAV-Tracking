// dashboard.js
import {
  apiGet,
  apiPost,
  cachePackages,
  readCachedPackages,
} from './common.js';
import { showToast } from './toast.js';
import { processLabelFiles } from './ocr.js';

let allPackages = [];
let pendingPackages = [];
let selectedPackages = [];
let batchProcessedPackages = [];
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

function sizeClass(size) {
  if (size === 'Large Package') return 'size-large';
  if (size === 'Small Package') return 'size-small';
  return '';
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
      const sizeLabel = p.size ? ` • ${p.size}` : '';
      const weight = p.weight_lbs ? ` (${p.weight_lbs} lbs)` : '';
      return `
        <div class="package-row">
          <div class="pkg-main">
            <div class="pkg-name">${p.tracking || '(no tracking)'} — ${p.name || ''}</div>
            <div class="pkg-meta">${p.courier || ''} · ${created}${sizeLabel}${weight}</div>
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
    // Note: 'capture' attribute only works on mobile browsers
    // For development/desktop, users can still select files
    // Mobile users will get camera option when available
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    
    if (isMobile) {
      input.capture = 'environment';
    }
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      capturedPhotoBlob = file;
      displayCapturedPhoto(file);
      showToast('📸 Photo loaded! Click "Process" to extract label data.', 3000);
    };
    
    input.click();
  } catch (error) {
    console.error('File picker error:', error);
    showToast('❌ Could not open file picker. Check browser permissions.', 4000);
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

async function processLabelPhoto() {
  if (!capturedPhotoBlob) {
    showToast('❌ No photo loaded. Click "Take Photo" first.', 3000);
    return;
  }
  const courier = document.getElementById('courierSelect')?.value || '';
  if (!courier) {
    showToast('❌ Please select a courier first.', 3000);
    return;
  }
  if (typeof Tesseract === 'undefined') {
    showToast('⏳ OCR library loading. Try again in a moment.', 3000);
    return;
  }
  try {
    const processingToast = showToast('🔄 Processing label with OCR... Please wait (15-30 sec)', 0);
    
    const { data } = await Tesseract.recognize(capturedPhotoBlob, 'eng', {
      logger: m => console.log('OCR Progress:', m)
    });
    
    processingToast.remove();
    
    const text = (data.text || '').replace(/\s+/g, ' ').trim();
    console.log('OCR Result:', text);
    
    // Use ocr.js extraction function if available, else fall back to inline
    const extracted = extractFieldsFromText(text, courier);
    
    // Calculate weight and size
    let weight_lbs = 0;
    let weight_kg = 0;
    const weightRegex = /Ship\s+Wt[:\s]+([\d.]+)\s*(kg|lbs?|KG|LBS?)/i;
    const weightMatch = text.match(weightRegex);
    if (weightMatch) {
      const weightValue = parseFloat(weightMatch[1]);
      const weightUnit = (weightMatch[2] || 'kg').toLowerCase();
      if (weightUnit.includes('kg')) {
        weight_kg = weightValue;
        weight_lbs = parseFloat((weightValue * 2.20462).toFixed(2));
      } else {
        weight_lbs = weightValue;
        weight_kg = parseFloat((weightValue / 2.20462).toFixed(2));
      }
    }
    
    const packageSize = weight_lbs < 10 ? 'Small Package' : 'Large Package';
    
    const trackingInput = document.getElementById('trackingInput');
    const nameInput = document.getElementById('nameInput');
    const phoneInput = document.getElementById('phoneInput');
    const postalInput = document.getElementById('postalInput');
    const weightInput = document.getElementById('weightInput');
    const sizeInput = document.getElementById('sizeInput');
    
    if (trackingInput) trackingInput.value = extracted.tracking || '';
    if (nameInput) nameInput.value = extracted.name || '';
    if (phoneInput) phoneInput.value = extracted.phone || '';
    if (postalInput) postalInput.value = extracted.postal || '';
    if (weightInput) weightInput.value = weight_lbs.toFixed(2) || '';
    if (sizeInput) sizeInput.value = packageSize || '';
    
    showToast(`✅ OCR Complete! Found: ${extracted.tracking || 'no tracking'} (${packageSize})`, 3000);
  } catch (error) {
    console.error('OCR error:', error);
    showToast(`❌ OCR failed: ${error.message}`, 4000);
  }
}

function extractFieldsFromText(text, courier) {
  const out = { name: '', tracking: '', phone: '', postal: '', address: '' };
  if (!text) return out;
  
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const postalRegex = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d\b/i;
  const phoneRegex = /(\+?1[-.,\s])?(\(?\d{3}\)?[-.,\s]?\d{3}[-.,\s]?\d{4})/;
  const trackingRegex = /\b[0-9A-Z]{8,}\b/g;
  
  const postalMatch = text.match(postalRegex);
  if (postalMatch) out.postal = postalMatch[0].toUpperCase();
  
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) out.phone = phoneMatch[0];
  
  const postalIdx = lines.findIndex(l => postalRegex.test(l));
  if (postalIdx > 0) out.name = lines[postalIdx - 1];
  
  // Special handling for Intelcom Dragonfly tracking
  if (courier.toUpperCase().includes('INTELCOM') || courier.toUpperCase().includes('DRAGONFLY')) {
    const intlcmMatch = text.match(/INTLCM[0-9]{8,}/i);
    if (intlcmMatch) {
      out.tracking = intlcmMatch[0];
      return out;
    }
  }
  
  const trackings = text.match(trackingRegex);
  if (trackings && trackings.length) {
    out.tracking = trackings.sort((a, b) => b.length - a.length)[0];
  }
  
  return out;
}

async function addSinglePackage() {
  const courier = document.getElementById('courierSelect')?.value || '';
  const tracking = document.getElementById('trackingInput')?.value.trim() || '';
  const name = document.getElementById('nameInput')?.value.trim() || '';
  const phone = document.getElementById('phoneInput')?.value.trim() || '';
  const postal = document.getElementById('postalInput')?.value.trim() || '';
  const address = document.getElementById('addressInput')?.value.trim() || '';
  const weight_lbs = parseFloat(document.getElementById('weightInput')?.value || 0);
  const size = document.getElementById('sizeInput')?.value || '';
  
  if (!courier || !tracking || !name) {
    showToast('❌ Courier, tracking, and name required.', 3000);
    return;
  }
  
  const payload = {
    courier,
    tracking,
    name,
    phone,
    postal,
    address,
    weight_lbs: weight_lbs || 0,
    weight_kg: weight_lbs > 0 ? parseFloat((weight_lbs / 2.20462).toFixed(2)) : 0,
    size: size || (weight_lbs < 10 ? 'Small Package' : 'Large Package'),
    status: 'pending',
  };
  
  try {
    await apiPost('/packages', payload);
    batchProcessedPackages.push(payload);
    
    document.getElementById('trackingInput').value = '';
    document.getElementById('nameInput').value = '';
    document.getElementById('phoneInput').value = '';
    document.getElementById('postalInput').value = '';
    document.getElementById('addressInput').value = '';
    document.getElementById('weightInput').value = '';
    document.getElementById('sizeInput').value = '';
    capturedPhotoBlob = null;
    const photoPreview = document.querySelector('[data-photo-preview]');
    if (photoPreview) photoPreview.remove();
    
    await loadPackages();
    showToast('✅ Package added successfully!', 3000);
  } catch (err) {
    console.error('Failed to add package', err);
    showToast('❌ Could not add package.', 3000);
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
      showToast('📋 Ready for next label!', 3000);
      capturedPhotoBlob = null;
      const photoPreview = document.querySelector('[data-photo-preview]');
      if (photoPreview) photoPreview.remove();
    });
  }
  if (finish) {
    finish.addEventListener('click', showBatchReport);
  }
}

function showBatchReport() {
  if (!batchProcessedPackages.length) {
    showToast('❌ No packages processed in this batch.', 3000);
    return;
  }
  
  const smallCount = batchProcessedPackages.filter(
    p => p.size === 'Small Package' || p.weight_lbs < 10
  ).length;
  const largeCount = batchProcessedPackages.filter(
    p => p.size === 'Large Package' || p.weight_lbs >= 10
  ).length;
  const totalWeight = batchProcessedPackages.reduce((sum, p) => sum + (p.weight_lbs || 0), 0);
  
  const reportModal = document.createElement('div');
  reportModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  reportModal.innerHTML = `
    <div style="
      background: #1f2937;
      color: #e5e7eb;
      padding: 24px;
      border-radius: 12px;
      max-width: 400px;
      border: 1px solid #374151;
    ">
      <h2 style="margin-top: 0; color: #60a5fa;">📦 Batch Processing Report</h2>
      <div style="background: #111827; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 8px 0;"><strong>Total Packages:</strong> ${batchProcessedPackages.length}</p>
        <p style="margin: 8px 0; color: #10b981;"><strong>Small Packages (&lt;10 lbs):</strong> ${smallCount}</p>
        <p style="margin: 8px 0; color: #f97316;"><strong>Large Packages (≥10 lbs):</strong> ${largeCount}</p>
        <p style="margin: 8px 0;"><strong>Total Weight:</strong> ${totalWeight.toFixed(2)} lbs</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
          flex: 1;
          padding: 10px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        ">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(reportModal);
  
  // Reset batch for next processing
  setTimeout(() => {
    batchProcessedPackages = [];
    showToast('✅ Batch report displayed. Ready for next batch!', 3000);
  }, 100);
}

function searchPackagesForPickup() {
  const q =
    document.getElementById('pickupSearchInput')?.value.trim().toLowerCase() ||
    '';
  if (!q) {
    showToast('❌ Enter name, tracking, or phone to search.', 3000);
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
    showToast('❌ No packages found for that customer.', 3000);
    return;
  }
  const first = selectedPackages[0];
  const nameInput = document.getElementById('pickupCustomerName');
  if (nameInput && first.name) {
    nameInput.value = first.name;
  }
  showToast(`✅ Found ${selectedPackages.length} package(s)!`, 3000);
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
    showToast('❌ Search for packages first.', 3000);
    return;
  }
  const name =
    document.getElementById('pickupCustomerName')?.value.trim() || '';
  if (!name) {
    showToast('❌ Enter customer name.', 3000);
    return;
  }
  let signatureData = null;
  if (signatureCanvas) {
    signatureData = signatureCanvas.toDataURL('image/png');
  }
  const ids = selectedPackages.map((p) => p.id).filter((id) => id != null);
  if (!ids.length) {
    showToast('❌ No valid packages for pickup.', 3000);
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
    showToast('✅ Pickup recorded successfully!', 3000);
  } catch (err) {
    console.error('Pickup failed', err);
    showToast('❌ Could not complete pickup.', 3000);
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
      showToast('🖊️ Scriptel integration coming soon!', 3000);
    });
  }
  initSignaturePad();
}
