import os
import re
import json
import sys
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from flask import (
    Flask,
    abort,
    jsonify,
    make_response,
    request,
    send_file,
    send_from_directory,
    url_for,
)
from werkzeug.exceptions import HTTPException


SOURCE_DIR = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
BASE_DIR = Path(sys.executable).resolve().parent if getattr(sys, 'frozen', False) else SOURCE_DIR

app = Flask(
    __name__,
    static_folder=str(SOURCE_DIR / 'static'),
    static_url_path='/static',
)


@app.errorhandler(HTTPException)
def handle_http_error(error):
    if request.path.startswith('/api/'):
        return jsonify({'error': error.description}), error.code
    return error

DEFAULT_MEDIA_DIR = BASE_DIR / 'media'
MEDIA_ROOTS_CONFIG = BASE_DIR / 'media_roots.json'

VIDEO_EXTS = {'.mp4', '.webm', '.mkv', '.ogg'}
AUDIO_EXTS = {'.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.mka'}
SUBTITLE_EXTS = {'.vtt', '.srt'}
ALLOWED_MEDIA_EXTS = VIDEO_EXTS | AUDIO_EXTS | SUBTITLE_EXTS


def load_media_roots():
    """Load the directories that LAN clients are allowed to browse."""
    config = {
        'roots': [
            {'id': 'media', 'name': 'Media', 'path': './media'},
        ]
    }

    if MEDIA_ROOTS_CONFIG.exists():
        try:
            config = json.loads(MEDIA_ROOTS_CONFIG.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError) as exc:
            raise RuntimeError(f'Cannot read {MEDIA_ROOTS_CONFIG.name}: {exc}') from exc

    entries = config.get('roots') if isinstance(config, dict) else None
    if not isinstance(entries, list) or not entries:
        raise RuntimeError(f'{MEDIA_ROOTS_CONFIG.name} must contain a non-empty "roots" list')

    roots = {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise RuntimeError('Each media root must be an object')

        root_id = str(entry.get('id', '')).strip()
        name = str(entry.get('name', root_id)).strip()
        raw_path = str(entry.get('path', '')).strip()
        if not re.fullmatch(r'[A-Za-z0-9_-]+', root_id):
            raise RuntimeError(f'Invalid media root id: {root_id!r}')
        if not name or not raw_path:
            raise RuntimeError(f'Media root {root_id!r} needs both name and path')
        if root_id in roots:
            raise RuntimeError(f'Duplicate media root id: {root_id}')

        expanded = Path(os.path.expandvars(os.path.expanduser(raw_path)))
        if not expanded.is_absolute():
            expanded = BASE_DIR / expanded
        roots[root_id] = {'id': root_id, 'name': name, 'path': expanded.resolve()}

    return roots


DEFAULT_MEDIA_DIR.mkdir(exist_ok=True)
MEDIA_DIR = str(DEFAULT_MEDIA_DIR)  # Kept for launcher/backward compatibility.
MEDIA_ROOTS = load_media_roots()


def is_within_root(root, target):
    try:
        return os.path.commonpath((str(root), str(target))) == str(root)
    except ValueError:
        return False


def resolve_library_path(root_id, relative_path='', require_exists=True):
    root_info = MEDIA_ROOTS.get(root_id)
    if not root_info:
        abort(404, description='Unknown media root')

    root = root_info['path']
    relative_path = str(relative_path or '').strip()
    candidate = (root / relative_path).resolve()
    if not is_within_root(root, candidate):
        abort(403, description='Path is outside the configured media root')
    if require_exists and not candidate.exists():
        abort(404, description='Path not found')
    return root_info, candidate


def relative_library_path(root_info, target):
    relative = target.relative_to(root_info['path']).as_posix()
    return '' if relative == '.' else relative


def configured_absolute_path(raw_path, expected_type=None):
    """Resolve a legacy absolute path only when it is inside an allowed root."""
    if not raw_path:
        return None
    try:
        target = Path(raw_path).resolve()
    except (OSError, RuntimeError):
        return None

    for root_info in MEDIA_ROOTS.values():
        if is_within_root(root_info['path'], target):
            if not target.exists():
                return None
            if expected_type == 'file' and not target.is_file():
                return None
            if expected_type == 'dir' and not target.is_dir():
                return None
            return root_info, target
    return None


def serve_allowed_file(file_path):
    ext = file_path.suffix.lower()
    if ext not in ALLOWED_MEDIA_EXTS:
        abort(415, description='Unsupported media type')

    if ext == '.srt':
        try:
            content = file_path.read_text(encoding='utf-8-sig')
        except (OSError, UnicodeError) as exc:
            abort(500, description=f'Cannot read subtitle: {exc}')
        content = 'WEBVTT\n\n' + content.replace(',', '.')
        response = make_response(content)
        response.headers['Content-Type'] = 'text/vtt; charset=utf-8'
        return response

    response = send_file(file_path, conditional=True)
    if ext == '.vtt':
        response.headers['Content-Type'] = 'text/vtt; charset=utf-8'
    return response

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/media', methods=['GET'])
def list_media():
    groups = {}
    
    for filename in os.listdir(MEDIA_DIR):
        path = os.path.join(MEDIA_DIR, filename)
        if not os.path.isfile(path):
            continue
            
        base_name, ext = os.path.splitext(filename)
        ext = ext.lower()
        
        if base_name not in groups:
            groups[base_name] = {'video': None, 'audio': None, 'subtitle': None}
            
        if ext in VIDEO_EXTS:
            groups[base_name]['video'] = filename
        elif ext in AUDIO_EXTS:
            groups[base_name]['audio'] = filename
        elif ext in SUBTITLE_EXTS:
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
    filepath = (DEFAULT_MEDIA_DIR / filename).resolve()
    if not is_within_root(DEFAULT_MEDIA_DIR, filepath) or not filepath.is_file():
        abort(404, description='Subtitle not found')
    if filepath.suffix.lower() not in SUBTITLE_EXTS:
        abort(415, description='Unsupported subtitle type')
    return serve_allowed_file(filepath)

# --- Restricted PC Media Library API ---
@app.route('/api/library/roots', methods=['GET'])
def library_roots():
    roots = [
        {
            'id': root_id,
            'name': root_info['name'],
            'available': root_info['path'].is_dir(),
        }
        for root_id, root_info in MEDIA_ROOTS.items()
    ]
    return jsonify({'roots': roots})


@app.route('/api/library/list', methods=['GET'])
def library_list():
    root_id = request.args.get('root', '')
    relative_path = request.args.get('path', '')
    root_info, directory = resolve_library_path(root_id, relative_path)
    if not directory.is_dir():
        abort(400, description='Requested path is not a directory')

    directories = []
    files = []
    try:
        entries = sorted(directory.iterdir(), key=lambda item: (not item.is_dir(), item.name.casefold()))
        for entry in entries:
            try:
                resolved = entry.resolve()
                if not is_within_root(root_info['path'], resolved):
                    continue
                entry_path = relative_library_path(root_info, resolved)
                if entry.is_dir():
                    directories.append({'name': entry.name, 'path': entry_path})
                elif entry.is_file() and entry.suffix.lower() in ALLOWED_MEDIA_EXTS:
                    files.append({
                        'name': entry.name,
                        'path': entry_path,
                        'size': entry.stat().st_size,
                        'url': url_for('library_file', root=root_id, path=entry_path),
                    })
            except (OSError, RuntimeError):
                continue
    except OSError as exc:
        abort(500, description=f'Cannot list directory: {exc}')

    current_path = relative_library_path(root_info, directory)
    parent_path = None
    if current_path:
        parent_path = relative_library_path(root_info, directory.parent)
    return jsonify({
        'root': root_id,
        'path': current_path,
        'parent': parent_path,
        'directories': directories,
        'files': files,
    })


@app.route('/api/library/file', methods=['GET'])
def library_file():
    root_id = request.args.get('root', '')
    relative_path = request.args.get('path', '')
    _, file_path = resolve_library_path(root_id, relative_path)
    if not file_path.is_file():
        abort(404, description='File not found')
    return serve_allowed_file(file_path)


# --- Backward-compatible local APIs, restricted to configured roots ---
@app.route('/api/local/list', methods=['POST'])
def local_list():
    data = request.get_json(silent=True) or {}
    dir_path = data.get('path', '')
    resolved = configured_absolute_path(dir_path, expected_type='dir')
    if not resolved:
        return jsonify({'error': 'Directory is not inside a configured media root'}), 403
    _, directory = resolved
    
    files = []
    try:
        for entry in directory.iterdir():
            if entry.is_file() and entry.suffix.lower() in ALLOWED_MEDIA_EXTS:
                files.append({'name': entry.name, 'size': entry.stat().st_size})
    except OSError as exc:
        return jsonify({'error': str(exc)}), 500
    
    files.sort(key=lambda item: item['name'].casefold())
    return jsonify({'files': files})

@app.route('/api/local/file')
def local_file():
    file_path = request.args.get('path', '')
    resolved = configured_absolute_path(file_path, expected_type='file')
    if not resolved:
        abort(403, description='File is not inside a configured media root')
    _, target = resolved
    return serve_allowed_file(target)

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
    print(f"Server is running. Configure media roots in: {MEDIA_ROOTS_CONFIG}")
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False, threaded=True)
