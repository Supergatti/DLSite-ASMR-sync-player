import os
import re
import json
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from flask import Flask, send_from_directory, jsonify, make_response, request


app = Flask(__name__, static_folder='static', static_url_path='/static')

# Base directory for media. We'll use the current directory or a subfolder 'media'
# Let's create a 'media' folder to keep it clean.
MEDIA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'media')
os.makedirs(MEDIA_DIR, exist_ok=True)

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/media', methods=['GET'])
def list_media():
    groups = {}
    
    # Extensions we look for
    video_exts = {'.mp4', '.webm', '.mkv', '.ogg'}
    audio_exts = {'.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg'}
    sub_exts = {'.vtt', '.srt'}
    
    for filename in os.listdir(MEDIA_DIR):
        path = os.path.join(MEDIA_DIR, filename)
        if not os.path.isfile(path):
            continue
            
        base_name, ext = os.path.splitext(filename)
        ext = ext.lower()
        
        if base_name not in groups:
            groups[base_name] = {'video': None, 'audio': None, 'subtitle': None}
            
        if ext in video_exts:
            groups[base_name]['video'] = filename
        elif ext in audio_exts:
            groups[base_name]['audio'] = filename
        elif ext in sub_exts:
            groups[base_name]['subtitle'] = filename

    # Only return groups that have at least a video.
    valid_groups = []
    for name, files in groups.items():
        if files['video']:
            valid_groups.append({
                'name': name,
                'video': files['video'],
                'audio': files['audio'],
                'subtitle': files['subtitle']
            })
            
    return jsonify(valid_groups)

@app.route('/media/<path:filename>')
def serve_media(filename):
    return send_from_directory(MEDIA_DIR, filename, conditional=True)

@app.route('/subtitle/<path:filename>')
def serve_subtitle(filename):
    filepath = os.path.join(MEDIA_DIR, filename)
    if not os.path.exists(filepath):
        return "File not found", 404
        
    base_name, ext = os.path.splitext(filename)
    ext = ext.lower()
    
    if ext == '.srt':
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                srt_content = f.read()
            # Convert SRT timestamp to VTT
            vtt_content = srt_content.replace(',', '.')
            vtt_content = 'WEBVTT\n\n' + vtt_content
            
            response = make_response(vtt_content)
            response.headers['Content-Type'] = 'text/vtt; charset=utf-8'
            return response
        except Exception as e:
            return str(e), 500
    else:
        # Default vtt serve
        return send_from_directory(MEDIA_DIR, filename)

# --- Local Directory API ---
@app.route('/api/local/list', methods=['POST'])
def local_list():
    data = request.json
    dir_path = data.get('path', '')
    if not dir_path or not os.path.isdir(dir_path):
        return jsonify({"error": f"Directory not found: {dir_path}"}), 400
    
    files = []
    try:
        for name in os.listdir(dir_path):
            full = os.path.join(dir_path, name)
            if os.path.isfile(full):
                files.append({"name": name, "size": os.path.getsize(full)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    return jsonify({"files": files})

@app.route('/api/local/file')
def local_file():
    file_path = request.args.get('path', '')
    if not file_path or not os.path.isfile(file_path):
        return "File not found", 404
    
    directory = os.path.dirname(file_path)
    filename = os.path.basename(file_path)
    
    # Detect MIME type for subtitle
    ext = os.path.splitext(filename)[1].lower()
    if ext == '.vtt':
        resp = send_from_directory(directory, filename)
        resp.headers['Content-Type'] = 'text/vtt; charset=utf-8'
        return resp
    elif ext == '.srt':
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            content = content.replace(',', '.')
            content = 'WEBVTT\n\n' + content
            resp = make_response(content)
            resp.headers['Content-Type'] = 'text/vtt; charset=utf-8'
            return resp
        except Exception as e:
            return str(e), 500
    else:
        return send_from_directory(directory, filename, conditional=True)

@app.route('/api/alist/list', methods=['POST'])
def alist_proxy_list():
    data = request.json
    base_url = data.get('base_url', '').rstrip('/')
    target_path = data.get('path', '/')
    token = data.get('token', '')
    
    if not base_url:
        return jsonify({"error": "No base_url"}), 400
        
    api_url = f"{base_url}/api/fs/list"
    payload = json.dumps({
        "path": target_path,
        "password": "",
        "page": 1,
        "per_page": 0,
        "refresh": False
    }).encode('utf-8')
    
    req = urllib.request.Request(api_url, data=payload)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', token)
        
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            return jsonify(res_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/alist/login', methods=['POST'])
def alist_proxy_login():
    data = request.json
    base_url = data.get('base_url', '').rstrip('/')
    username = data.get('username', '')
    password = data.get('password', '')
    
    if not base_url:
        return jsonify({"error": "No base_url"}), 400
        
    api_url = f"{base_url}/api/auth/login"
    payload = json.dumps({
        "username": username,
        "password": password
    }).encode('utf-8')
    
    req = urllib.request.Request(api_url, data=payload)
    req.add_header('Content-Type', 'application/json')
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            return jsonify(res_data)
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='ignore')
        return jsonify({"error": err_msg}), e.code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/alist/subtitle', methods=['POST'])
def alist_proxy_subtitle():
    data = request.json
    sub_url = data.get('url', '')
    if not sub_url:
        return "No url", 400
        
    try:
        req = urllib.request.Request(sub_url)
        # Avoid caching or 403s
        req.add_header('User-Agent', 'Mozilla/5.0')
        with urllib.request.urlopen(req) as response:
            content = response.read().decode('utf-8', errors='ignore')
            
        ext = sub_url.split('?')[0].split('.')[-1].lower()
        if ext == 'srt':
            content = content.replace(',', '.')
            content = 'WEBVTT\n\n' + content
            
        res = make_response(content)
        res.headers['Content-Type'] = 'text/vtt; charset=utf-8'
        return res
    except Exception as e:
        return str(e), 500

if __name__ == '__main__':
    print(f"Server is running. Place your media files in: {MEDIA_DIR}")
    # Run server
    app.run(host='0.0.0.0', port=5000, debug=True)
