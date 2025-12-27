from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta
import os
import base64
import cv2
import json
import numpy as np
from paddleocr import PaddleOCR
import re
import requests

app = Flask(__name__, static_folder='.')
CORS(app)

# Initialize PaddleOCR (runs locally, no external API calls)
ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)

# Database file
DATABASE = 'packages.db'

# Default location for packages
DEFAULT_CITY = "Elliot Lake"
DEFAULT_PROVINCE = "ON"
DEFAULT_POSTAL_PREFIX = "P5A"

# Grandstream UCM6302A Configuration
GRANDSTREAM_IP = "192.168.1.100"  # Change to your Grandstream IP
GRANDSTREAM_USERNAME = "admin"    # Change to your admin username
GRANDSTREAM_PASSWORD = "admin"    # Change to your admin password
GRANDSTREAM_EXTENSION = "8000"    # Extension to make outbound calls
GRANDSTREAM_RECORDING_ID = "1"    # ID of your prerecorded message

# Function to normalize postal code
def normalize_postal_code(postal):
    """Ensure postal code is in correct format and add default prefix if needed"""
    if not postal:
        return DEFAULT_POSTAL_PREFIX
    
    postal = postal.upper().strip().replace(" ", "")
    
    if len(postal) == 3:
        return f"{DEFAULT_POSTAL_PREFIX} {postal}"
    
    if len(postal) == 6:
        return f"{postal[:3]} {postal[3:]}"
    
    return postal

def normalize_address(address, postal):
    """Add Elliot Lake, ON if not present in address"""
    if not address:
        return f"{DEFAULT_CITY}, {DEFAULT_PROVINCE}"
    
    address_lower = address.lower()
    has_city = 'elliot lake' in address_lower or 'elliott lake' in address_lower
    has_province = ', on' in address_lower or ', ontario' in address_lower
    
    if not has_city and not has_province:
        return f"{address}, {DEFAULT_CITY}, {DEFAULT_PROVINCE}"
    elif not has_province:
        return f"{address}, {DEFAULT_PROVINCE}"
    
    return address

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with app.app_context():
        db = get_db()
        
        db.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')
        
        db.execute('''CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT UNIQUE,
            email TEXT,
            street TEXT,
            postal TEXT,
            profile_locked INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')
        
        db.execute('''CREATE TABLE IF NOT EXISTS packages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            courier TEXT NOT NULL,
            name TEXT NOT NULL,
            tracking TEXT NOT NULL,
            phone TEXT,
            postal TEXT NOT NULL,
            label_image TEXT,
            signature_image TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            address TEXT,
            signed_at TIMESTAMP,
            created_by TEXT,
            customer_id INTEGER,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )''')
        
        db.execute('''CREATE TABLE IF NOT EXISTS pickups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            pickup_name TEXT,
            pickup_id_type TEXT,
            pickup_id_number TEXT,
            pickup_signature TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )''')
        
        try:
            password = 'admin123'
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            db.execute("INSERT INTO users (username, password, password_hash, role) VALUES (?, ?, ?, ?)",
                ('sav', password, password_hash, 'admin'))
            db.commit()
        except sqlite3.IntegrityError:
            pass
        
        db.close()

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_file(path):
    return send_from_directory('.', path)

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username = ? AND password_hash = ?",
        (username, password_hash)).fetchone()
    db.close()
    
    if user:
        return jsonify({
            'success': True,
            'username': user['username'],
            'role': user['role']
        })
    return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@app.route('/api/packages', methods=['POST'])
def create_package():
    data = request.json
    postal = normalize_postal_code(data.get('postal', ''))
    address = normalize_address(data.get('address', ''), postal)
    
    customer_id = None
    phone = data.get('phone', '')
    name = data.get('name', '')
    
    if phone or name:
        customer_id = find_or_create_customer(name, phone, address, postal)
    
    db = get_db()
    cursor = db.execute('''INSERT INTO packages 
        (courier, name, tracking, phone, postal, address, label_image, created_by, customer_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (data['courier'], data['name'], data['tracking'],
         phone, postal, address,
         data.get('labelImage', ''), data.get('createdBy', ''), customer_id))
    db.commit()
    package_id = cursor.lastrowid
    db.close()
    
    return jsonify({'success': True, 'id': package_id, 'customer_id': customer_id})
def find_or_create_customer(name, phone, address, postal):
    """Find existing customer or create new one, return customer_id. Respects profile_locked."""
    db = get_db()
    
    if phone:
        customer = db.execute("SELECT id, profile_locked FROM customers WHERE phone = ?", (phone,)).fetchone()
        if customer:
            db.close()
            return customer['id']
    
    if name:
        customer = db.execute("SELECT id, profile_locked FROM customers WHERE LOWER(name) = LOWER(?)", (name,)).fetchone()
        if customer:
            db.close()
            return customer['id']
    
    street = address.split(',')[0] if address else ''
    cursor = db.execute('''INSERT INTO customers (name, phone, street, postal, profile_locked)
        VALUES (?, ?, ?, ?, 0)''',
        (name, phone, street, postal))
    db.commit()
    customer_id = cursor.lastrowid
    db.close()
    
    return customer_id

@app.route('/api/packages/pending', methods=['GET'])
def get_pending_packages():
    db = get_db()
    packages = db.execute('''SELECT * FROM packages 
        WHERE status = 'pending' 
        ORDER BY created_at DESC''').fetchall()
    db.close()
    
    return jsonify([dict(p) for p in packages])

@app.route('/api/packages/old', methods=['GET'])
def get_old_packages():
    """Get packages older than 5 days that are still pending"""
    five_days_ago = (datetime.now() - timedelta(days=5)).strftime('%Y-%m-%d %H:%M:%S')
    
    db = get_db()
    packages = db.execute('''SELECT * FROM packages 
        WHERE status = 'pending' 
        AND created_at <= ?
        ORDER BY created_at ASC''', (five_days_ago,)).fetchall()
    db.close()
    
    return jsonify([dict(p) for p in packages])

@app.route('/api/packages/<int:package_id>', methods=['PUT'])
def update_package(package_id):
    """Update package details and status"""
    data = request.json
    
    db = get_db()
    db.execute('''UPDATE packages 
        SET courier = ?, name = ?, tracking = ?, phone = ?, postal = ?, address = ?, status = ?
        WHERE id = ?''',
        (data.get('courier'), data.get('name'), data.get('tracking'),
         data.get('phone'), data.get('postal'), data.get('address'),
         data.get('status'), package_id))
    db.commit()
    db.close()
    
    return jsonify({'success': True})

@app.route('/api/packages/bulk-status', methods=['POST'])
def bulk_update_status():
    """Mass update package status (e.g., mark as sent back)"""
    data = request.json
    package_ids = data.get('package_ids', [])
    new_status = data.get('status', 'sent_back')
    
    if not package_ids:
        return jsonify({'success': False, 'message': 'No packages selected'}), 400
    
    db = get_db()
    placeholders = ','.join('?' * len(package_ids))
    db.execute(f'''UPDATE packages 
        SET status = ?
        WHERE id IN ({placeholders})''',
        [new_status] + package_ids)
    db.commit()
    db.close()
    
    return jsonify({'success': True, 'updated': len(package_ids)})

@app.route('/api/packages/archived', methods=['GET'])
def get_archived_packages():
    search = request.args.get('search', '')
    
    db = get_db()
    if search:
        packages = db.execute('''SELECT * FROM packages 
            WHERE status = 'signed' AND
            (name LIKE ? OR tracking LIKE ? OR phone LIKE ? OR postal LIKE ?)
            ORDER BY signed_at DESC''',
            (f'%{search}%', f'%{search}%', f'%{search}%', f'%{search}%')).fetchall()
    else:
        packages = db.execute('''SELECT * FROM packages 
            WHERE status = 'signed' 
            ORDER BY signed_at DESC''').fetchall()
    db.close()
    
    return jsonify([dict(p) for p in packages])

@app.route('/api/process-image', methods=['POST'])
def process_image():
    try:
        data = request.json
        image_data = data.get('image', '')
        
        if 'base64,' in image_data:
            image_data = image_data.split('base64,')[1]
        
        img_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        result = ocr.ocr(img, cls=True)
        
        extracted_text = []
        if result and len(result) > 0:
            for line in result[0]:
                if line[1][0]:
                    extracted_text.append(line[1][0])
        
        full_text = ' '.join(extracted_text)
        parsed_data = parse_shipping_label(full_text)
        
        if parsed_data.get('name'):
            customer = lookup_customer_by_name(parsed_data['name'])
            if customer and not customer.get('profile_locked'):
                if not parsed_data.get('phone'):
                    parsed_data['phone'] = customer.get('phone', '')
                if not parsed_data.get('postal'):
                    parsed_data['postal'] = customer.get('postal', '')
                if not parsed_data.get('address'):
                    parsed_data['address'] = f"{customer.get('street', '')}, {DEFAULT_CITY}, {DEFAULT_PROVINCE}"
        
        if 'postal' in parsed_data:
            parsed_data['postal'] = normalize_postal_code(parsed_data.get('postal', ''))
        if 'address' in parsed_data:
            parsed_data['address'] = normalize_address(parsed_data.get('address', ''), parsed_data.get('postal', ''))
        
        return jsonify({'success': True, 'data': parsed_data})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

def lookup_customer_by_name(name):
    try:
        db = get_db()
        customer = db.execute("SELECT * FROM customers WHERE LOWER(name) = LOWER(?)", (name,)).fetchone()
        db.close()
        if customer:
            return dict(customer)
    except:
        pass
    return None

def parse_shipping_label(text):
    result = {
        'courier': '',
        'name': '',
        'tracking': '',
        'phone': '',
        'postal': '',
        'address': ''
    }
    
    text_upper = text.upper()
    
    if 'PUROLATOR' in text_upper:
        result['courier'] = 'Purolator'
    elif 'FEDEX' in text_upper or 'FED EX' in text_upper:
        result['courier'] = 'FedEx'
    elif 'UPS' in text_upper:
        result['courier'] = 'UPS'
    elif 'CANADA POST' in text_upper or 'POSTES CANADA' in text_upper:
        result['courier'] = 'Canada Post'
    elif 'DRAGONFLY' in text_upper:
        result['courier'] = 'Dragonfly'
    
    tracking_patterns = [
        r'\b[0-9]{12,}\b',
        r'\b[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}\b',
        r'\b[A-Z0-9]{10,}\b',
    ]
    
    for pattern in tracking_patterns:
        match = re.search(pattern, text)
        if match:
            result['tracking'] = match.group(0).replace(' ', '')
            break
    
    postal_match = re.search(r'\b[A-Z][0-9][A-Z]\s?[0-9][A-Z][0-9]\b', text_upper)
    if postal_match:
        result['postal'] = postal_match.group(0)
    
    phone_patterns = [
        r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',
        r'\(\d{3}\)\s?\d{3}[-.]?\d{4}',
    ]
    for pattern in phone_patterns:
        match = re.search(pattern, text)
        if match:
            result['phone'] = match.group(0)
            break
    
    lines = text.split('\n')
    for line in lines:
        line_stripped = line.strip()
        if len(line_stripped) > 3 and len(line_stripped) < 50:
            if sum(c.isalpha() for c in line_stripped) > len(line_stripped) * 0.6:
                if not any(keyword in line_stripped.upper() for keyword in ['TRACKING', 'DELIVERY', 'SHIP', 'FROM', 'PUROLATOR', 'FEDEX', 'UPS']):
                    result['name'] = line_stripped
                    break
    
    return result

@app.route('/api/packages/<int:package_id>/sign', methods=['POST'])
def sign_package(package_id):
    data = request.json
    signature = data.get('signature')
    
    db = get_db()
    db.execute('''UPDATE packages 
        SET signature_image = ?, status = 'signed', signed_at = CURRENT_TIMESTAMP
        WHERE id = ?''',
        (signature, package_id))
    db.commit()
    db.close()
    
    return jsonify({'success': True})

@app.route('/api/packages/skip/<int:package_id>', methods=['POST'])
def skip_package(package_id):
    db = get_db()
    db.execute("DELETE FROM packages WHERE id = ?", (package_id,))
    db.commit()
    db.close()
    
    return jsonify({'success': True})

@app.route('/api/track/<tracking_number>', methods=['GET'])
def track_package(tracking_number):
    db = get_db()
    package = db.execute('''SELECT courier, name, tracking, status, created_at, signed_at 
        FROM packages WHERE tracking = ?''',
        (tracking_number,)).fetchone()
    db.close()
    
    if package:
        return jsonify(dict(package))
    return jsonify({'error': 'Package not found'}), 404
@app.route('/api/users', methods=['GET'])
def get_users():
    db = get_db()
    users = db.execute("SELECT id, username, password, role, created_at FROM users").fetchall()
    db.close()
    
    return jsonify([dict(u) for u in users])

@app.route('/api/users/<username>/password', methods=['GET'])
def get_user_password(username):
    """Admin-only: Get user's plain password"""
    db = get_db()
    user = db.execute("SELECT password FROM users WHERE username = ?", (username,)).fetchone()
    db.close()
    
    if user:
        return jsonify({'success': True, 'password': user['password']})
    return jsonify({'success': False, 'message': 'User not found'}), 404

@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'standard')
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    try:
        db = get_db()
        db.execute("INSERT INTO users (username, password, password_hash, role) VALUES (?, ?, ?, ?)",
            (username, password, password_hash, role))
        db.commit()
        db.close()
        return jsonify({'success': True})
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'Username already exists'}), 400

@app.route('/api/users/<username>/password', methods=['PUT'])
def reset_password(username):
    data = request.json
    new_password = data.get('password')
    
    password_hash = hashlib.sha256(new_password.encode()).hexdigest()
    
    db = get_db()
    db.execute("UPDATE users SET password = ?, password_hash = ? WHERE username = ?",
        (new_password, password_hash, username))
    db.commit()
    db.close()
    
    return jsonify({'success': True})

@app.route('/api/customers', methods=['GET'])
def get_customers():
    db = get_db()
    customers = db.execute("SELECT * FROM customers ORDER BY name").fetchall()
    db.close()
    return jsonify({'addresses': [dict(c) for c in customers]})

@app.route('/api/customers', methods=['POST'])
def add_customer():
    data = request.json
    
    db = get_db()
    try:
        cursor = db.execute('''INSERT INTO customers (name, phone, email, street, postal, profile_locked)
            VALUES (?, ?, ?, ?, ?, ?)''',
            (data.get('name'), data.get('phone'), data.get('email'),
             data.get('street'), data.get('postal'), data.get('profile_locked', 0)))
        db.commit()
        customer_id = cursor.lastrowid
        db.close()
        return jsonify({'success': True, 'id': customer_id})
    except sqlite3.IntegrityError:
        db.close()
        return jsonify({'success': False, 'message': 'Customer with this phone already exists'}), 400

@app.route('/api/customers/<int:customer_id>', methods=['PUT'])
def update_customer(customer_id):
    data = request.json
    
    db = get_db()
    db.execute('''UPDATE customers 
        SET name = ?, phone = ?, email = ?, street = ?, postal = ?, profile_locked = ?
        WHERE id = ?''',
        (data.get('name'), data.get('phone'), data.get('email'),
         data.get('street'), data.get('postal'), data.get('profile_locked', 0), customer_id))
    db.commit()
    db.close()
    
    return jsonify({'success': True})

@app.route('/api/customers/<int:customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    db = get_db()
    db.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    db.commit()
    db.close()
    
    return jsonify({'success': True})

@app.route('/api/customers/<int:customer_id>/packages', methods=['GET'])
def get_customer_packages(customer_id):
    status = request.args.get('status', 'pending')
    
    db = get_db()
    packages = db.execute('''SELECT * FROM packages 
        WHERE customer_id = ? AND status = ?
        ORDER BY created_at DESC''',
        (customer_id, status)).fetchall()
    db.close()
    
    return jsonify([dict(p) for p in packages])

@app.route('/api/pickups/bulk', methods=['POST'])
def bulk_pickup():
    data = request.json
    package_ids = data.get('package_ids', [])
    customer_id = data.get('customer_id')
    pickup_name = data.get('pickup_name', '')
    pickup_id_type = data.get('pickup_id_type', '')
    pickup_id_number = data.get('pickup_id_number', '')
    pickup_signature = data.get('pickup_signature', '')
    
    if not package_ids:
        return jsonify({'success': False, 'message': 'No packages selected'}), 400
    
    db = get_db()
    
    cursor = db.execute('''INSERT INTO pickups 
        (customer_id, pickup_name, pickup_id_type, pickup_id_number, pickup_signature)
        VALUES (?, ?, ?, ?, ?)''',
        (customer_id, pickup_name, pickup_id_type, pickup_id_number, pickup_signature))
    pickup_id = cursor.lastrowid
    
    placeholders = ','.join('?' * len(package_ids))
    db.execute(f'''UPDATE packages 
        SET status = 'signed', 
        signed_at = CURRENT_TIMESTAMP,
        signature_image = ?
        WHERE id IN ({placeholders})''',
        [pickup_signature] + package_ids)
    
    db.commit()
    db.close()
    
    return jsonify({'success': True, 'pickup_id': pickup_id, 'packages_updated': len(package_ids)})

@app.route('/api/pickups', methods=['GET'])
def get_pickups():
    db = get_db()
    pickups = db.execute('''SELECT p.*, c.name as customer_name 
        FROM pickups p
        LEFT JOIN customers c ON p.customer_id = c.id
        ORDER BY p.timestamp DESC
        LIMIT 100''').fetchall()
    db.close()
    
    return jsonify([dict(p) for p in pickups])

# GRANDSTREAM UCM6302A INTEGRATION
@app.route('/api/call/customer/<int:customer_id>', methods=['POST'])
def call_customer(customer_id):
    """Trigger automated call to customer via Grandstream UCM6302A"""
    try:
        db = get_db()
        customer = db.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
        db.close()
        
        if not customer or not customer['phone']:
            return jsonify({'success': False, 'message': 'Customer or phone not found'}), 404
        
        # Clean phone number (remove formatting)
        phone = re.sub(r'[^0-9]', '', customer['phone'])
        
        # Grandstream API call to initiate outbound call with recording
        # Note: Adjust API endpoint and parameters based on your Grandstream model/firmware
        api_url = f"http://{GRANDSTREAM_IP}/api/make_call"
        
        response = requests.post(
            api_url,
            auth=(GRANDSTREAM_USERNAME, GRANDSTREAM_PASSWORD),
            json={
                'extension': GRANDSTREAM_EXTENSION,
                'destination': phone,
                'recording_id': GRANDSTREAM_RECORDING_ID
            },
            timeout=10
        )
        
        if response.status_code == 200:
            return jsonify({'success': True, 'message': f'Call initiated to {customer["name"]}'})
        else:
            return jsonify({'success': False, 'message': 'Failed to initiate call', 'error': response.text}), 500
    
    except requests.exceptions.RequestException as e:
        return jsonify({'success': False, 'message': 'Connection error to Grandstream', 'error': str(e)}), 500

@app.route('/api/call/bulk', methods=['POST'])
def call_bulk_customers():
    """Trigger automated calls to multiple customers (after bulk package processing)"""
    data = request.json
    customer_ids = data.get('customer_ids', [])
    
    if not customer_ids:
        return jsonify({'success': False, 'message': 'No customers selected'}), 400
    
    results = []
    db = get_db()
    
    for customer_id in customer_ids:
        customer = db.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
        
        if customer and customer['phone']:
            phone = re.sub(r'[^0-9]', '', customer['phone'])
            
            try:
                api_url = f"http://{GRANDSTREAM_IP}/api/make_call"
                response = requests.post(
                    api_url,
                    auth=(GRANDSTREAM_USERNAME, GRANDSTREAM_PASSWORD),
                    json={
                        'extension': GRANDSTREAM_EXTENSION,
                        'destination': phone,
                        'recording_id': GRANDSTREAM_RECORDING_ID
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    results.append({'customer_id': customer_id, 'name': customer['name'], 'success': True})
                else:
                    results.append({'customer_id': customer_id, 'name': customer['name'], 'success': False, 'error': 'API error'})
            
            except:
                results.append({'customer_id': customer_id, 'name': customer['name'], 'success': False, 'error': 'Connection error'})
        else:
            results.append({'customer_id': customer_id, 'success': False, 'error': 'No phone number'})
    
    db.close()
    
    successful = sum(1 for r in results if r.get('success'))
    return jsonify({
        'success': True,
        'total': len(results),
        'successful': successful,
        'failed': len(results) - successful,
        'results': results
    })

if __name__ == '__main__':
    init_db()
    app.run(host='127.0.0.1', port=5000, debug=True)
