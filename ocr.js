// ocr.js
// Tesseract.js wrapper for SAV label OCR with weight and size classification

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

    // Extract fields from OCR text
    const extracted = extractFieldsFromText(text, courier);

    // Determine package size category
    const packageSize = extracted.weight_lbs < 10 ? 'Small Package' : 'Large Package';

    const pkg = {
      id: Date.now() + i,
      courier: courier,
      tracking: extracted.tracking || `UNK-${Date.now()}-${i}`,
      name: extracted.name || '',
      phone: extracted.phone || '',
      postal: extracted.postal || '',
      address: extracted.address || '',
      weight_kg: extracted.weight_kg || 0,
      weight_lbs: extracted.weight_lbs || 0,
      size: packageSize,
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

// Advanced field extraction with better pattern matching
function extractFieldsFromText(text, courier) {
  const out = {
    name: '',
    tracking: '',
    phone: '',
    postal: '',
    address: '',
    weight_kg: 0,
    weight_lbs: 0,
    service: '',
    shipper: ''
  };

  if (!text) return out;

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  // Patterns
  const postalRegex = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d\b/i;
  const phoneRegex = /(\+?1[-.,\s])?(\(?\d{3}\)?[-.,\s]?\d{3}[-.,\s]?\d{4})/;
  const weightRegex = /Ship\s+Wt[:\s]+([\d.]+)\s*(kg|lbs?|KG|LBS?)/i;
  const trackingRegex = /\b[0-9A-Z]{8,}\b/g;

  // Extract weight (Kg) and convert to lbs
  const weightMatch = text.match(weightRegex);
  if (weightMatch) {
    const weightValue = parseFloat(weightMatch[1]);
    const weightUnit = (weightMatch[2] || 'kg').toLowerCase();
    
    if (weightUnit.includes('kg')) {
      out.weight_kg = weightValue;
      out.weight_lbs = parseFloat((weightValue * 2.20462).toFixed(2)); // kg to lbs
    } else {
      out.weight_lbs = weightValue;
      out.weight_kg = parseFloat((weightValue / 2.20462).toFixed(2)); // lbs to kg
    }
  }

  // Extract postal code
  const postalMatch = text.match(postalRegex);
  if (postalMatch) {
    out.postal = postalMatch[0].toUpperCase();
  }

  // Extract phone number
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) {
    out.phone = phoneMatch[0];
  }

  // Extract name - look for patterns with addresses
  // For labels like the Intelcom/Dragonfly one, find customer name before postal code
  const postalIdx = lines.findIndex(l => postalRegex.test(l));
  if (postalIdx > 0) {
    // Get the line before postal (usually city, province)
    // Look backwards from postal line to find name
    let nameIdx = postalIdx - 1;
    while (nameIdx >= 0) {
      const line = lines[nameIdx];
      // Skip lines that are clearly city/province/address
      if (!/^[A-Z\s,]+$/.test(line) || line.length < 5) {
        // This might be the name
        if (line.toLowerCase() !== line && line.length > 2) {
          out.name = line;
          break;
        }
      }
      nameIdx--;
    }
  }

  // Handle Intelcom/Dragonfly - they often repeat the name
  // Only take the first occurrence
  if (out.name) {
    // If name appears in text twice consecutively, clean it
    const namePattern = new RegExp(`\\b${out.name.split(' ')[0]}\\b.*${out.name.split(' ')[0]}\\b`, 'gi');
    if (text.match(namePattern) && (text.match(namePattern).length > 1)) {
      // Name is repeated, just use it once (already captured)
    }
  }

  // Extract address
  if (postalIdx > 1) {
    // Address is usually the line before postal code line (if name is before that)
    for (let i = postalIdx - 2; i >= 0; i--) {
      const line = lines[i];
      if (line.length > 5 && !phoneRegex.test(line)) {
        out.address = line;
        break;
      }
    }
  }

  // Extract tracking number
  // For Intelcom/Dragonfly, format is often: "INTLCM" followed by numbers
  if (courier && courier.toUpperCase().includes('INTELCOM')) {
    const intlcmMatch = text.match(/INTLCM[0-9]{8,}/i);
    if (intlcmMatch) {
      out.tracking = intlcmMatch[0];
    }
  } else if (courier && courier.toUpperCase().includes('DRAGONFLY')) {
    const intlcmMatch = text.match(/INTLCM[0-9]{8,}/i);
    if (intlcmMatch) {
      out.tracking = intlcmMatch[0];
    }
  }

  // Fallback: if no specific tracking found, look for longest alphanumeric sequence
  if (!out.tracking) {
    const trackings = text.match(trackingRegex);
    if (trackings && trackings.length) {
      out.tracking = trackings.sort((a, b) => b.length - a.length)[0];
    }
  }

  return out;
}
