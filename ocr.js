// ocr.js

// Simple Tesseract.js wrapper for SAV label OCR

async function processLabelFiles(files, courier) {
  if (!window.Tesseract) {
    throw new Error('Tesseract.js not loaded');
  }

  const results = [];
  const now = new Date();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Convert file to data URL so it can be stored with the package
    const dataUrl = await fileToDataURL(file);

    // Run OCR with Tesseract.js (English only for now)
    const { data } = await Tesseract.recognize(file, 'eng', {
      logger: m => console.log('OCR', m)
    });

    const text = (data.text || '').replace(/\s+/g, ' ').trim();

    // Very simple heuristic extraction — adjust as you learn patterns
    const extracted = extractFieldsFromText(text, courier);

    const pkg = {
      id: Date.now() + i,
      courier: courier,
      tracking: extracted.tracking || `UNK-${Date.now()}-${i}`,
      name: extracted.name || '',
      phone: extracted.phone || '',
      postal: extracted.postal || '',
      weight: extracted.weight || '',
      service: extracted.service || '',
      label_image: dataUrl,
      status: 'pending',
      created_at: now.toISOString(),
      raw_ocr: text
    };

    results.push(pkg);
  }

  return results;
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = e => reject(e);
    reader.readAsDataURL(file);
  });
}

// Heuristic parser for label text (very basic; tuned later for your carriers)
function extractFieldsFromText(text, courier) {
  const out = { name: '', tracking: '', phone: '', postal: '', weight: '', service: '', shipper: '' };
  if (!text) return out;

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  const upper = lines.map(l => l.toUpperCase());

  // Common patterns
  const postalRegex = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d\b/i;
  const phoneRegex = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  const weightRegex = /\b(\d+(?:\.\d+)?)\s*(LB|LBS|KG)\b/i;

  // Helper: find first line matching regex
  const findLineIndex = (regex) => lines.findIndex(l => regex.test(l));

  const courierUpper = (courier || '').toUpperCase();

  // ---- UPS pattern ----
  if (courierUpper.includes('UPS')) {
    const trackingLine = lines.find(l => /TRACKING\s*#|1Z[0-9A-Z]/i.test(l));
    if (trackingLine) {
      const m = trackingLine.match(/(1Z[0-9A-Z ]{10,})/i);
      out.tracking = m ? m[1].replace(/\s+/g, ' ').trim() : trackingLine;
    }

    const postalIdx = findLineIndex(postalRegex);
    if (postalIdx > 0) {
      // name is line just above city/postal line
      out.postal = (lines[postalIdx].match(postalRegex) || [''])[0].toUpperCase();
      out.name = lines[postalIdx - 1];
    }

    const phoneLine = lines.find(l => phoneRegex.test(l));
    if (phoneLine) out.phone = phoneLine.match(phoneRegex)[0];

    const weightLine = lines.find(l => weightRegex.test(l));
    if (weightLine) out.weight = weightLine.match(weightRegex)[0];

    const serviceLine = upper.find(l => l.includes('STANDARD') || l.includes('EXPRESS') || l.includes('SAVER'));
    if (serviceLine) out.service = serviceLine;
  }

  // ---- Straightship / Canpar / ICS generic parcel (Temu example) ----
  else if (courierUpper.includes('CANPAR') || courierUpper.includes('ICS') || courierUpper.includes('STRAIGHT') || courierUpper.includes('FLEX')) {
    const trackingLine = lines.find(l => /\bSTRTD[0-9A-Z]{10,}\b/i.test(l));
    if (trackingLine) {
      out.tracking = (trackingLine.match(/\bSTRTD[0-9A-Z]+/i) || [trackingLine])[0];
    }

    const postalIdx = findLineIndex(postalRegex);
    if (postalIdx > 0) {
      out.postal = (lines[postalIdx].match(postalRegex) || [''])[0].toUpperCase();
      out.name = lines[postalIdx - 1]; // "Susan Warlow" style line
    }

    const phoneLine = lines.find(l => phoneRegex.test(l));
    if (phoneLine) out.phone = phoneLine.match(phoneRegex)[0];

    const weightLine = lines.find(l => weightRegex.test(l));
    if (weightLine) out.weight = weightLine.match(weightRegex)[0];
  }

  // ---- Purolator labels ----
  else if (courierUpper.includes('PUROLATOR')) {
    // PIN style
    let trackingLine = lines.find(l => /PUROLATOR\s+PIN/i.test(l));
    if (!trackingLine) {
      trackingLine = lines.find(l => /\b\d{10,}\b/.test(l) && /PKG|ID|I\.D./i.test(l));
    }

    if (trackingLine) {
      const m = trackingLine.match(/\b\d{8,}\b/g);
      if (m && m.length) out.tracking = m[m.length - 1];
    }

    const postalIdx = findLineIndex(postalRegex);
    if (postalIdx > 0) {
      out.postal = (lines[postalIdx].match(postalRegex) || [''])[0].toUpperCase();
      out.name = lines[postalIdx - 1];
    }

    const phoneLine = lines.find(l => phoneRegex.test(l));
    if (phoneLine) out.phone = phoneLine.match(phoneRegex)[0];

    const weightLine = lines.find(l => weightRegex.test(l));
    if (weightLine) out.weight = weightLine.match(weightRegex)[0];
  }

  // ---- Intelcom / Dragonfly ----
  else if (courierUpper.includes('DRAGONFLY') || courierUpper.includes('INTELCOM')) {
    const trackingLine = lines.find(l => /TRACKING\s*:\s*INTLCM/i.test(l));
    if (trackingLine) {
      const m = trackingLine.match(/INTLCM[0-9A-Z]+/i);
      if (m) out.tracking = m[0];
    }

    const postalIdx = findLineIndex(postalRegex);
    if (postalIdx > 0) {
      out.postal = (lines[postalIdx].match(postalRegex) || [''])[0].toUpperCase();
      out.name = lines[postalIdx - 1];
    }

    const phoneLine = lines.find(l => phoneRegex.test(l));
    if (phoneLine) out.phone = phoneLine.match(phoneRegex)[0];

    const weightLine = lines.find(l => weightRegex.test(l));
    if (weightLine) out.weight = weightLine.match(weightRegex)[0];
  }

  // ---- Fallback (any other courier) ----
  if (!out.tracking) {
    const genericTracking = text.match(/\b[0-9A-Z]{8,}\b/g);
    if (genericTracking && genericTracking.length) {
      out.tracking = genericTracking[genericTracking.length - 1];
    }
  }

  if (!out.postal) {
    const m = text.match(postalRegex);
    if (m) out.postal = m[0].toUpperCase();
  }

  if (!out.name && out.postal) {
    const idx = lines.findIndex(l => l.toUpperCase().includes(out.postal));
    if (idx > 0) out.name = lines[idx - 1];
  }

  if (!out.phone) {
    const phoneLine = text.match(phoneRegex);
    if (phoneLine) out.phone = phoneLine[0];
  }

  return out;
}
