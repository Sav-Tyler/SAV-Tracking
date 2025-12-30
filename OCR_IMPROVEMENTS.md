# OCR Improvements & Package Sizing

## Summary of Changes

Updated SAV-Tracking to improve OCR accuracy for Intelcom Dragonfly labels and implement package weight classification.

---

## 1. ✅ Merged Courier Options

**Before:** "Dragonfly" and "Intelecom" were separate options
**After:** Single "Intelcom Dragonfly" option in dropdown

**File:** `dashboard.html`
- Replaced two separate courier options with one unified entry
- Simplifies customer data and reduces classification errors

---

## 2. 📦 Weight Extraction & Conversion

**New Capability:** Automatically extracts weight from label and converts to pounds

**File:** `ocr.js`

### Weight Parsing:
```javascript
// Extracts: "Ship Wt: 0.69 Kg" → 0.69 kg → 1.52 lbs
const weightRegex = /Ship\s+Wt[:\s]+([\d.]+)\s*(kg|lbs?|KG|LBS?)/i;

// Automatic unit conversion
if (kg_value) {
  lbs = kg_value * 2.20462;  // Convert kg to lbs
}
```

### Target Label Sections (from your image):
- **Orange Box:** "Ship Wt: 0.69 Kg" - OCR extracts the numeric value
- Regex pattern finds the weight line and converts to pounds
- Result: `0.69 kg = 1.52 lbs`

---

## 3. 📊 Package Size Classification

**Logic:**
- **Small Package:** < 10 lbs
- **Large Package:** ≥ 10 lbs

**Files:** `ocr.js`, `dashboard.js`, `dashboard.html`

### Implementation:
```javascript
const packageSize = weight_lbs < 10 ? 'Small Package' : 'Large Package';
```

### Display:
- Weight field (readonly): Shows extracted weight in lbs
- Size field (readonly): Shows "Small Package" or "Large Package"
- Pending packages list: Shows size badge with color coding
  - 🔵 Small Package (blue)
  - 🟠 Large Package (orange)

---

## 4. 📋 Batch Processing Report

**New Feature:** After clicking "Finish" button, see comprehensive report:

```
📦 Batch Processing Report
─────────────────────────
Total Packages:        12
Small Packages (<10 lbs):  8
Large Packages (≥10 lbs):  4
Total Weight:         95.4 lbs
```

**File:** `dashboard.js` - `showBatchReport()` function
- Tracks all packages processed in current batch
- Counts small vs. large automatically
- Calculates total weight
- Displays in modal with summary statistics
- Resets batch tracker for next processing session

---

## 5. 🎯 OCR Target Areas (Your Label)

Based on your color-coded image, the OCR now focuses on:

### Yellow Box - Customer Information
```
First name, Last name     ← Extract this (ignore duplicate)
First name, Last name     ← Skip (duplicate)
Address line              ← Extract this
City, Province, Postal    ← Extract postal code
Country                   ← Skip
```

**Improvement:** Handles duplicate names - only extracts first occurrence

### Orange Box - Weight
```
Ship Wt: 0.69 Kg          ← Extract number + unit
```

**Improvement:** Regex pattern specifically looks for "Ship Wt:" format

### Red Boxes - Courier
```
INTELCOM DRAGONFLY        ← Identifies as merged courier
```

### Purple Boxes - Tracking
```
INTLCMH564415634         ← Text format
[QR Code]                ← QR format (decoded by Tesseract)
```

**Improvement:** Prioritizes "INTLCM" prefix pattern for accurate tracking extraction

---

## 6. 🔧 Implementation Details

### Updated Form Fields:
- **weightInput** - Auto-filled by OCR, shows lbs (readonly)
- **sizeInput** - Auto-calculated from weight (readonly)

### API Payload Includes:
```javascript
{
  tracking: "INTLCMH564415634",
  name: "Dave Krouskie",
  courier: "Intelcom Dragonfly",
  weight_kg: 0.69,
  weight_lbs: 1.52,
  size: "Small Package",
  phone: "+1 (705) 555-1234",
  postal: "P5A 2S9",
  address: "1408 Dunlop Shores Rd",
  status: "pending"
}
```

---

## 7. 📝 Testing Your Label

With your Intelcom Dragonfly sample label, OCR should now:

✅ Extract customer name once (ignore duplicate)
✅ Extract weight: 0.69 kg
✅ Convert to lbs: 1.52 lbs
✅ Classify as: Small Package
✅ Extract tracking: INTLCMH564415634
✅ Extract postal: P5A 2S9
✅ Extract phone: Found if present
✅ Extract address: 1408 Dunlop Shores Rd

---

## 8. 🚀 How to Use

### Workflow:
1. Select "Intelcom Dragonfly" from courier dropdown
2. Take photo of label
3. Click "Process" - OCR runs
4. Auto-populated fields:
   - Tracking number
   - Customer name
   - Phone
   - Postal code
   - **Weight (lbs)** ← NEW
   - **Package size** ← NEW
5. Verify/adjust if needed
6. Click "Process" button again to add package
7. Repeat for more labels
8. Click "Finish" to see batch report
9. View summary: small vs large package count + total weight

---

## 9. 📊 Files Modified

| File | Changes |
|------|----------|
| `ocr.js` | Weight extraction, kg→lbs conversion, improved tracking pattern |
| `dashboard.js` | Weight/size display, batch report modal, toast notifications |
| `dashboard.html` | Merged courier option, weight/size fields, search button fix |
| `toast.js` | Auto-closing notifications (created in earlier update) |

---

## 10. 🐛 Known Limitations

- OCR accuracy depends on label quality and lighting
- Weight unit must be recognizable (kg, lbs, KG, LBS)
- Duplicate name handling works best with exact duplicates
- QR code tracking extracted same as text (Tesseract decodes both)

---

## 📞 Next Steps

1. Test with multiple Intelcom Dragonfly labels
2. Verify weight extraction accuracy
3. Confirm batch report counts are correct
4. Adjust weight thresholds if needed (currently < 10 lbs = small)
5. Monitor OCR accuracy over time

