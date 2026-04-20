from flask import Flask, render_template, send_from_directory
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'bodhifinal2026'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

if __name__ == '__main__':
    # Check if port 5002 is available (5000=bamboo, 5001=kursus)
    port = 5002
    print(f"Starting BodhiFinal on port {port}")
    app.run(host='0.0.0.0', port=port, debug=True)
