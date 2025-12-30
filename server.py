from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import hashlib
from datetime import datetime, timedelta
import base64
import cv2
import numpy as np
from paddleocr import PaddleOCR
import re
import requests

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/login', methods=['POST'])
def login():
    """Handle staff login"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password required'}), 400
    
    db = get_db()
    user = db.execute(
        "SELECT * FROM users WHERE username = ?",
        (username,)
    ).fetchone()
    db.close()
    
    if not user:
        return jsonify({'success': False, 'message': 'Invalid username or password'}), 401
    
    # Check password (supports both plain text 'password' field and hashed 'password_hash')
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    if user['password'] == password or user['password_hash'] == password_hash:
        return jsonify({
            'success': True,
            'username': user['username'],
            'role': user['role']
        })
    else:
        return jsonify({'success': False, 'message': 'Invalid username or password'}), 401

# Initialize PaddleOCR (runs locally, no external API calls)
ocr = PaddleOCR(use_angle_cls=True, lang='en')

# Database file
DATABASE = 'packages.db'

# Default location for packages
DEFAULT_CITY = "Elliot Lake"
DEFAULT_PROVINCE = "ON"
DEFAULT_POSTAL_PREFIX = "P5A"

# Grandstream UCM6302A Configuration (defaults; overridden by DB settings)
GRANDSTREAM_IP = "192.168.1.100"       # Default IP (can be overridden)
GRANDSTREAM_USERNAME = "admin"         # Default admin username
GRANDSTREAM_PASSWORD = "admin"         # Default admin password
GRANDSTREAM_EXTENSION = "8000"         # Default extension to make outbound calls
GRANDSTREAM_RECORDING_ID = "1"         # Default prerecorded message ID

# ---------------------------------------------------------------------
# Existing helpers: get_db, init_db, add_package_columns_if_missing,
# get_setting, set_setting, etc. remain unchanged here.
# ---------------------------------------------------------------------

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
        db.execute(
            '''CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )'''
        )
        db.execute(
            '''CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT UNIQUE,
                email TEXT,
                street TEXT,
                postal TEXT,
                profile_locked INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )'''
        )
        db.execute(
            '''CREATE TABLE IF NOT EXISTS packages (
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
                shipping_company TEXT,
                shipping_service TEXT,
                weight_lbs REAL,
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            )'''
        )
        db.execute(
            '''CREATE TABLE IF NOT EXISTS pickups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL,
                pickup_name TEXT,
                pickup_id_type TEXT,
                pickup_id_number TEXT,
                pickup_signature TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            )'''
        )
        db.execute(
            '''CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )'''
        )

        try:
            password = 'admin123'
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            db.execute(
                "INSERT INTO users (username, password, password_hash, role) "
                "VALUES (?, ?, ?, ?)",
                ('sav', password, password_hash, 'admin')
            )
            db.commit()
        except sqlite3.IntegrityError:
            pass

        db.close()

def add_package_columns_if_missing():
    """Safety migration if DB already exists without new columns."""
    db = get_db()
    try:
        db.execute("ALTER TABLE packages ADD COLUMN shipping_company TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        db.execute("ALTER TABLE packages ADD COLUMN shipping_service TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        db.execute("ALTER TABLE packages ADD COLUMN weight_lbs REAL")
    except sqlite3.OperationalError:
        pass
    db.commit()
    db.close()

def get_setting(key, default=None):
    db = get_db()
    row = db.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    db.close()
    if row:
        return row['value']
    return default

def set_setting(key, value):
    db = get_db()
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        (key, value)
    )
    db.commit()
    db.close()

# ... all your existing API routes above /api/settings stay as-is ...

@app.route('/api/settings', methods=['GET'])
def get_settings():
    db = get_db()
    rows = db.execute("SELECT key, value FROM settings").fetchall()
    db.close()
    return jsonify({r['key']: r['value'] for r in rows})

@app.route('/api/settings', methods=['POST'])
def update_settings():
    data = request.json

    logo_url = data.get('logo_url')
    tagline = data.get('tagline')
    text_color = data.get('text_color')
    header_bg_color = data.get('header_bg_color')
    page_bg_color = data.get('page_bg_color')
    tracking_bg_color = data.get('tracking_bg_color')
    staff_bar_bg_color = data.get('staff_bar_bg_color')

    if logo_url is not None:
        set_setting('logo_url', logo_url)
    if tagline is not None:
        set_setting('tagline', tagline)
    if text_color is not None:
        set_setting('text_color', text_color)
    if header_bg_color is not None:
        set_setting('header_bg_color', header_bg_color)
    if page_bg_color is not None:
        set_setting('page_bg_color', page_bg_color)
    if tracking_bg_color is not None:
        set_setting('tracking_bg_color', tracking_bg_color)
    if staff_bar_bg_color is not None:
        set_setting('staff_bar_bg_color', staff_bar_bg_color)

    return jsonify({'success': True})

# ---------------------------------------------------------------------
# NEW: Grandstream PBX settings stored in DB and used by call endpoints
# ---------------------------------------------------------------------

@app.route('/api/grandstream', methods=['GET'])
def get_grandstream_settings():
    return jsonify({
        'ip': get_setting('grandstream_ip', GRANDSTREAM_IP),
        'extension': get_setting('grandstream_extension', GRANDSTREAM_EXTENSION),
        'username': get_setting('grandstream_username', GRANDSTREAM_USERNAME),
        'password': get_setting('grandstream_password', GRANDSTREAM_PASSWORD),
        'message_id': get_setting('grandstream_message_id', GRANDSTREAM_RECORDING_ID),
    })

@app.route('/api/grandstream', methods=['POST'])
def update_grandstream_settings():
    data = request.json or {}

    ip = data.get('ip')
    extension = data.get('extension')
    username = data.get('username')
    password = data.get('password')
    message_id = data.get('message_id')

    if ip is not None:
        set_setting('grandstream_ip', ip)
    if extension is not None:
        set_setting('grandstream_extension', extension)
    if username is not None:
        set_setting('grandstream_username', username)
    if password is not None:
        set_setting('grandstream_password', password)
    if message_id is not None:
        set_setting('grandstream_message_id', message_id)

    return jsonify({'success': True})

def get_grandstream_config():
    ip = get_setting('grandstream_ip', GRANDSTREAM_IP)
    username = get_setting('grandstream_username', GRANDSTREAM_USERNAME)
    password = get_setting('grandstream_password', GRANDSTREAM_PASSWORD)
    extension = get_setting('grandstream_extension', GRANDSTREAM_EXTENSION)
    recording_id = get_setting('grandstream_message_id', GRANDSTREAM_RECORDING_ID)
    return ip, username, password, extension, recording_id

# GRANDSTREAM UCM6302A INTEGRATION

@app.route('/api/call/customer/<int:customer_id>', methods=['POST'])
def call_customer(customer_id):
    """Trigger automated call to customer via Grandstream UCM6302A"""
    try:
        db = get_db()
        customer = db.execute(
            "SELECT * FROM customers WHERE id = ?",
            (customer_id,),
        ).fetchone()
        db.close()

        if not customer or not customer['phone']:
            return jsonify({'success': False, 'message': 'Customer or phone not found'}), 404

        phone = re.sub(r'[^0-9]', '', customer['phone'])
        ip, username, password, extension, recording_id = get_grandstream_config()

        api_url = f"http://{ip}/api/make_call"
        response = requests.post(
            api_url,
            auth=(username, password),
            json={
                'extension': extension,
                'destination': phone,
                'recording_id': recording_id
            },
            timeout=10
        )

        if response.status_code == 200:
            return jsonify({'success': True, 'message': f'Call initiated to {customer["name"]}'})
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to initiate call',
                'error': response.text
            }), 500

    except requests.exceptions.RequestException as e:
        return jsonify({
            'success': False,
            'message': 'Connection error to Grandstream',
            'error': str(e)
        }), 500

@app.route('/api/call/bulk', methods=['POST'])
def call_bulk_customers():
    """Trigger automated calls to multiple customers (after bulk package processing)"""
    data = request.json
    customer_ids = data.get('customer_ids', [])

    if not customer_ids:
        return jsonify({'success': False, 'message': 'No customers selected'}), 400

    results = []
    db = get_db()
    ip, username, password, extension, recording_id = get_grandstream_config()

    for customer_id in customer_ids:
        customer = db.execute(
            "SELECT * FROM customers WHERE id = ?",
            (customer_id,),
        ).fetchone()

        if customer and customer['phone']:
            phone = re.sub(r'[^0-9]', '', customer['phone'])
            try:
                api_url = f"http://{ip}/api/make_call"
                response = requests.post(
                    api_url,
                    auth=(username, password),
                    json={
                        'extension': extension,
                        'destination': phone,
                        'recording_id': recording_id
                    },
                    timeout=10
                )

                if response.status_code == 200:
                    results.append({
                        'customer_id': customer_id,
                        'name': customer['name'],
                        'success': True
                    })
                else:
                    results.append({
                        'customer_id': customer_id,
                        'name': customer['name'],
                        'success': False,
                        'error': 'API error'
                    })
            except Exception:
                results.append({
                    'customer_id': customer_id,
                    'name': customer['name'],
                    'success': False,
                    'error': 'Connection error'
                })
        else:
            results.append({
                'customer_id': customer_id,
                'success': False,
                'error': 'No phone number'
            })

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
    add_package_columns_if_missing()
    app.run(host='0.0.0.0', port=5000, debug=True)


