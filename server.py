from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import hashlib
import secrets
from datetime import datetime
import os
import base64
import openai
import cv2
import json

app = Flask(__name__, static_folder='.')
CORS(app)

# OpenAI API configuration
openai.api_key = os.getenv('OPENAI_API_KEY', '')  # Set your OpenAI API key in environment variable

# Database file
DATABASE = 'packages.db'

# Default location for packages
DEFAULT_CITY = "Elliot Lake"
DEFAULT_PROVINCE = "ON"
DEFAULT_POSTAL_PREFIX = "P5A"

# Function to normalize postal code
def normalize_postal_code(postal):
    """Ensure postal code is in correct format and add default prefix if needed"""
    if not postal:
        return DEFAULT_POSTAL_PREFIX
    
    postal = postal.upper().strip().replace(" ", "")
    
    # If only 3 characters provided (like "2S9"), add default prefix
    if len(postal) == 3:
        return f"{DEFAULT_POSTAL_PREFIX} {postal}"
    
    # If 6 characters without space, add space in middle
    if len(postal) == 6:
        return f"{postal[:3]} {postal[3:]}"
    
    return postal

# Function to normalize address
def normalize_address(address, postal):
    """Add Elliot Lake, ON if not present in address"""
    if not address:
        return f"{DEFAULT_CITY}, {DEFAULT_PROVINCE}"
    
    address_lower = address.lower()
    
    # Check if city and province are already in address
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
        
        # Users table
        db.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')
        
        # Packages table
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
                            postal TEXT,
                address TEXT,
            signed_at TIMESTAMP,
            created_by TEXT
        
        # Create default admin user if doesn't exist
        try:
            password_hash = hashlib.sha256('admin123'.encode()).hexdigest()
            db.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                      ('sav', password_hash, 'admin'))
            db.commit()
        except sqlite3.IntegrityError:
            pass  # User already exists
        
        db.close()

# Serve HTML files
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_file(path):
    return send_from_directory('.', path)

# Authentication API
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

# Package APIs
@app.route('/api/packages', methods=['POST'])
def create_package():
        data = request.json
    
    # Normalize postal code and address
    postal = normalize_postal_code(data.get('postal', ''))
    address = normalize_address(data.get('address', ''), postal)
    
    db = get_db()
    cursor = db.execute('''INSERT INTO packages 
        (courier, name, tracking, phone, postal, address, label_image, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
        (data['courier'], data['name'], data['tracking'],
         data.get('phone', ''), postal, address,
                        data.get('labelImage', ''), data.get('createdBy', '')))
    db.commit()
    package_id = cursor.lastrowid
    db.close()
    
    return jsonify({'success': True, 'id': package_id})

@app.route('/api/packages/pending', methods=['GET'])
def get_pending_packages():
    db = get_db()
    packages = db.execute('''SELECT * FROM packages 
                            WHERE status = 'pending' 
                            ORDER BY created_at DESC''').fetchall()
    db.close()
    
    return jsonify([dict(p) for p in packages])

@app.route('/api/packages/archived', methods=['GET'])
def get_archived_packages():
    search = request.args.get('search', '')
    
    db = get_db()

    # Vision API for OCR
@app.route('/api/process-image', methods=['POST'])
def process_image():
    try:
        data = request.json
        image_data = data.get('image', '')
        
        # Remove data URL prefix if present
        if 'base64,' in image_data:
            image_data = image_data.split('base64,')[1]
        
        # Call OpenAI Vision API
        response = openai.ChatCompletion.create(
            model="gpt-4-vision-preview",
            messages=[
                {
                    "role": "user",
                    "content": [
                            {"type": "text", "text": "following information from this shipping label and return ONLY a valid JSON object with these
                                                                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}exact keys: 'courier' (company name: Purolator/FedEx/UPS/Dragonfly), 'name' (recipient full name), 'tracking' (tracking number - for Purolator look for PIN number, for others look for tracking/waybill number), 'phone' (phone number if visible), 'postal' (postal code), 'address' (full street address including city and province). If any field cannot be found, use empty string ''. Do not include any explanation, only return the JSON object."},
                    ]
                }
            ],
            max_tokens=300
        )
        
        # Parse the response
        result_text = response.choices[0].message.content
        
        # Try to parse as JSON
        try:
            import json
            result = json.loads(result_text)
        except:
            # If not valid JSON, return error
            return jsonify({'success': False, 'error': 'Failed to parse OCR result'})

                
        # Normalize postal code and address for Elliot Lake
        if 'postal' in result:
            result['postal'] = normalize_postal_code(result.get('postal', ''))
        if 'address' in result:
        
                    # Try to lookup customer in database
        if 'name' in result and result.get('name'):
            customer = lookup_customer(result['name'])
            if customer:
                # Auto-fill missing data from customer database
                if not result.get('street') or not result.get('address'):
                    result['street'] = customer.get('street', '')
                    result['address'] = f"{customer['street']}, Elliot Lake, ON"
                if not result.get('postal'):
                    result['postal'] = customer.get('postal', '')
                if not result.get('phone'):
                    result['phone'] = customer.get('phone', '')
result['address'] = normalize_address(result.get('address', ''), result.get('postal', ''))
        return jsonify({'success': True, 'data': result})
        
    except Exception as e:
        result['address'] = normalize_address(result.get('address', ''), result.get('postal', ''))    if search:
        packages = db.execute('''SELECT * FROM packages 
                                WHERE status = 'signed' AND
                                (name LIKE ? OR tracking LIKE ? OR phone LIKE ? OR postal LIKE ?)
                                ORDER BY signed_at DESC''',
                             (f'%{search}%', f'%{search}%', f'%{search}%', f'%{search}%')).fetchall()
    else:
        packages = db.execute('''SELECT * FROM packages 
                                WHERE status = 'signed' 
                                ORDER BY signed_at DESC LIMIT 100''').fetchall()
    db.close()
    
    return jsonify([dict(p) for p in packages])

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

# Customer tracking API (public - no auth required)
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

# User management APIs
@app.route('/api/users', methods=['GET'])
def get_users():
    db = get_db()
    users = db.execute("SELECT id, username, role, created_at FROM users").fetchall()
    db.close()
    
    return jsonify([dict(u) for u in users])

@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'standard')
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    try:
        db = get_db()
        db.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                  (username, password_hash, role))
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
    db.execute("UPDATE users SET password_hash = ? WHERE username = ?",
              (password_hash, username))
    db.commit()
    db.close()
    
    return jsonify({'success': True})



# Customer Management APIs
@app.route('/api/customers', methods=['GET'])
def get_customers():
    try:
        with open('addresses.json', 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify({'addresses': []})

@app.route('/api/customers', methods=['POST'])
def add_customer():
    data = request.json
    try:
        with open('addresses.json', 'r') as f:
            customers = json.load(f)
    except FileNotFoundError:
        customers = {'addresses': []}
    
    customers['addresses'].append(data)
    
    with open('addresses.json', 'w') as f:
        json.dump(customers, f, indent=2)
    
    return jsonify({'success': True})

@app.route('/api/customers/<int:index>', methods=['PUT'])
def update_customer(index):
    data = request.json
    with open('addresses.json', 'r') as f:
        customers = json.load(f)
    
    if 0 <= index < len(customers['addresses']):
        customers['addresses'][index] = data
        with open('addresses.json', 'w') as f:
            json.dump(customers, f, indent=2)
        return jsonify({'success': True})
    return jsonify({'success': False}), 404

@app.route('/api/customers/<int:index>', methods=['DELETE'])
def delete_customer(index):
    with open('addresses.json', 'r') as f:
        customers = json.load(f)
    
    if 0 <= index < len(customers['addresses']):
        customers['addresses'].pop(index)
        with open('addresses.json', 'w') as f:
            json.dump(customers, f, indent=2)
        return jsonify({'success': True})
    return jsonify({'success': False}), 404

# Customer lookup helper
def lookup_customer(name):
    try:
        with open('addresses.json', 'r') as f:
            customers = json.load(f)
        for customer in customers.get('addresses', []):
            if customer['name'].lower() == name.lower():
                return customer
    except:
        pass
    return None
if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)








