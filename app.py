from flask import Flask, request, jsonify, render_template, send_from_directory, make_response
import sqlite3
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'bodhifinal2026'

DB_PATH = os.path.join(os.path.dirname(__file__), 'bodhi.db')
API_KEY = 'bodhi-local-2026'

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('''CREATE TABLE IF NOT EXISTS bodhi_data (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    conn.commit()
    return conn

def add_cors(resp):
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-API-Key'
    return resp

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api.php', methods=['GET', 'POST', 'OPTIONS'])
def api():
    if request.method == 'OPTIONS':
        return add_cors(make_response('', 200))
    
    key = request.headers.get('X-API-Key', request.args.get('k', ''))
    
    if request.method == 'GET':
        conn = get_db()
        rows = conn.execute('SELECT key, value FROM bodhi_data').fetchall()
        data = {row['key']: row['value'] for row in rows}
        conn.close()
        resp = make_response(jsonify({'ok': True, 'data': data}))
        return add_cors(resp)
    
    elif request.method == 'POST':
        if key != API_KEY:
            resp = make_response(jsonify({'error': 'Unauthorized'}), 403)
            return add_cors(resp)
        
        body = request.get_json(silent=True) or {}
        action = body.get('action', '')
        conn = get_db()
        
        if action == 'save' and 'key' in body:
            conn.execute('''INSERT INTO bodhi_data (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP''',
                (body['key'], body['value']))
            conn.commit()
            resp = make_response(jsonify({'ok': True}))
        
        elif action == 'save_batch' and 'data' in body:
            items = [(k, v) for k, v in body['data'].items()]
            conn.executemany('''INSERT INTO bodhi_data (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP''', items)
            conn.commit()
            resp = make_response(jsonify({'ok': True, 'saved': len(body['data'])}))
        
        elif action == 'delete' and 'key' in body:
            conn.execute('DELETE FROM bodhi_data WHERE key=?', (body['key'],))
            conn.commit()
            resp = make_response(jsonify({'ok': True}))
        
        elif action == 'reset_all':
            conn.execute('DELETE FROM bodhi_data')
            conn.commit()
            resp = make_response(jsonify({'ok': True}))
        else:
            resp = make_response(jsonify({'error': 'Unknown action'}), 400)
        
        conn.close()
        return add_cors(resp)

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

if __name__ == '__main__':
    port = 5002
    print(f"Starting BodhiFinal on port {port}")
    print(f"API_KEY: {API_KEY}")
    app.run(host='0.0.0.0', port=port, debug=True)
