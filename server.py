from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import hashlib
import secrets
from datetime import datetime
import os
import base64
import openai

app = Flask(__name__, static_folder='.')
CORS(app)

# OpenAI API configuration
openai.api_key = os.getenv('OPENAI_API_KEY', '')  # Set your OpenAI API key in environment variable

# Database file
DATABASE = 'packages.db'

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
            signed_at TIMESTAMP,
            created_by TEXT
        )''')
        
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
    
    db = get_db()
    cursor = db.execute('''INSERT INTO packages 
                          (courier, name, tracking, phone, postal, label_image, created_by)
                          VALUES (?, ?, ?, ?, ?, ?, ?)''',
                       (data['courier'], data['name'], data['tracking'],
                        data.get('phone', ''), data['postal'],
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
                        {"type": "text", "text": "Extract the following information from this package label: 1) Courier company name (Purolator/FedEx/UPS/Dragonfly), 2) Tracking number, 3) Recipient name. Return ONLY a JSON object with keys 'courier', 'tracking', and 'name'. If you cannot find any field, use empty string."},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
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
        
        return jsonify({'success': True, 'data': result})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})
    if search:
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

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)


