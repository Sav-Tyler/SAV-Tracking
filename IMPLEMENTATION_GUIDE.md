# SAV-Tracking Enhancement Implementation Guide

Date: December 27, 2025

## Status Summary

### ✅ Already Implemented (in server.py)
- Local AI OCR (PaddleOCR) 
- Customer database with profile_locked feature
- Bulk pickup API endpoints
- Grandstream UCM6302A API integration skeleton
- Package modification endpoints
- 5-day old packages query

### 🔧 Required Changes

## 1. ARCHIVED VIEW ALL - Show all packages with filters
**Files to modify:** archived.html, archive.js
**Current issue:** "View All" shows search instead of listing all packages
**Fix:** Display all archived packages on load with filter dropdowns

## 2. ADMIN USER MANAGEMENT - View/change passwords
**Files to modify:** admin.html, admin.js
**Current:** Passwords hidden
**Add:** Show password button, change password functionality
**Backend:** Already exists in server.py (/api/users/<username>/password)

## 3. LOGIN - Show password toggle
**Files to modify:** index.html
**Add:** Eye icon to toggle password visibility

## 4. CUSTOMER DATABASE UI
**Files to modify:** customers.html, customers.js
**Current:** Basic CRUD exists
**Enhance:** Add profile_locked checkbox, better UI
**Backend:** Already complete

## 5. GRANDSTREAM UCM6302A INTEGRATION  
**Files to modify:** dashboard.html, dashboard.js, server.py
**Status:** Backend API exists in server.py
**Add:** Frontend buttons to trigger calls after package processing

## 6. PACKAGE MANAGEMENT & 5-DAY FILTER
**Files to modify:** dashboard.html, dashboard.js
**Add:**
- Edit package button
- 5-day old packages section on dashboard
- Bulk "Mark as Sent Back" functionality
**Backend:** Endpoints exist

## 7. BULK PICKUP ENHANCEMENTS
**Files to modify:** dashboard.html, dashboard.js  
**Add:**
- Multi-package selection
- Customer ID photo capture
- Select All functionality
- Show customer package count

## 8. CUSTOMER AUTO-LOOKUP DURING OCR
**Files to modify:** server.py (process_image function)
**Enhancement:** Auto-fill phone/postal from database
**Status:** Partially implemented, needs completion

## 9. CUSTOMER HISTORY & PROFILE LOCKED INDICATOR
**Files to modify:** dashboard.js, customers.html
**Add:** Show 🔒 icon for locked profiles, display package history

## Implementation Order
1. index.html - Login password toggle
2. admin.html, admin.js - User password management  
3. archived.html, archive.js - View All fix
4. customers.html, customers.js - Profile lock UI
5. dashboard.html, dashboard.js - All package mgmt features
6. server.py - Complete customer lookup
7. Code verification and cleanup

---

## Files to be modified:
1. index.html
2. admin.html
3. admin.js
4. archived.html
5. archive.js
6. customers.html
7. customers.js
8. dashboard.html
9. dashboard.js
10. server.py

Proceeding with implementation...
