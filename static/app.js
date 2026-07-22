document.addEventListener('DOMContentLoaded', () => {

    // Elements
    const labelVideo = document.getElementById('now-playing-video');
    const labelAudio = document.getElementById('now-playing-audio');
    const video = document.getElementById('main-video');
    const asmrAudio = document.getElementById('asmr-audio');
    
    // Controls
    const btnPlayPause = document.getElementById('btn-play-pause');
    const btnStop = document.getElementById('btn-stop');
    const overlayPlay = document.getElementById('overlay-play');
    const videoWrapper = document.getElementById('video-wrapper');
    const controlsPanel = document.querySelector('.controls-panel');
    const btnSub = document.getElementById('btn-sub');
    const btnSubSize = document.getElementById('btn-sub-size');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    
    // Volumes
    const volVideo = document.getElementById('vol-video');
    const volAudio = document.getElementById('vol-audio');
    
    // Timeline Video
    const progressBgVid = document.getElementById('progress-bar-vid');
    const progressFillVid = document.getElementById('progress-fill-vid');
    const progressThumbVid = document.getElementById('progress-thumb-vid');
    const timeCurrentVid = document.getElementById('time-current-vid');
    const timeTotalVid = document.getElementById('time-total-vid');

    // Timeline Audio
    const progressBgAud = document.getElementById('progress-bar-aud');
    const progressFillAud = document.getElementById('progress-fill-aud');
    const progressThumbAud = document.getElementById('progress-thumb-aud');
    const timeCurrentAud = document.getElementById('time-current-aud');
    const timeTotalAud = document.getElementById('time-total-aud');

    // State
    let controlsTimeout;
    let isDraggingVid = false;
    let isDraggingAud = false;
    let currentMedia = null;
    let isGlobalPlaying = false;
    let globalPlayInitiated = false;

    // Default init volumes
    video.volume = volVideo.value;
    asmrAudio.volume = volAudio.value;

    function formatTime(seconds) {
        if (isNaN(seconds)) return "00:00";
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // --- Tab Logic ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // --- Local Folder Logic ---
    const listVideo = document.getElementById('list-video');
    const listAudio = document.getElementById('list-audio');

    let videoData = {};
    let audioData = {};

    // --- Helper: group files with subtitle matching ---
    function matchSubtitles(medias, subs) {
        const result = {};
        for (let m of medias) {
            let base1 = m.name.substring(0, m.name.lastIndexOf('.'));
            let base2 = m.name;
            let matchingSub = subs.find(s => {
                let sbase = s.name.substring(0, s.name.lastIndexOf('.'));
                return sbase === base1 || sbase === base2;
            });
            result[m.name] = { video: m, audio: m, subtitle: matchingSub || null };
        }
        return result;
    }

    // --- Browser file picker (click to browse) ---
    const btnVideoBrowse = document.getElementById('btn-video-folder');
    const inputVideo = document.getElementById('input-video-folder');
    const btnAudioBrowse = document.getElementById('btn-audio-folder');
    const inputAudio = document.getElementById('input-audio-folder');

    btnVideoBrowse.addEventListener('click', () => inputVideo.click());
    btnAudioBrowse.addEventListener('click', () => inputAudio.click());

    inputVideo.addEventListener('change', (e) => {
        let videos = [], subs = [];
        for (let file of e.target.files) {
            const ext = file.name.split('.').pop().toLowerCase();
            const obj = { name: file.name, isAlist: false, url: URL.createObjectURL(file), _file: file };
            if (['mp4', 'webm', 'mkv', 'ogg'].includes(ext)) videos.push(obj);
            else if (['vtt', 'srt'].includes(ext)) subs.push(obj);
        }
        pcLibraryState.video.source = 'device';
        videoData = matchSubtitles(videos, subs);
        renderVideoList();
    });

    inputAudio.addEventListener('change', (e) => {
        let audios = [], subs = [];
        for (let file of e.target.files) {
            const ext = file.name.split('.').pop().toLowerCase();
            const obj = { name: file.name, isAlist: false, url: URL.createObjectURL(file), _file: file };
            if (['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'mka'].includes(ext)) audios.push(obj);
            else if (['vtt', 'srt'].includes(ext)) subs.push(obj);
        }
        pcLibraryState.audio.source = 'device';
        audioData = matchSubtitles(audios, subs);
        renderAudioList();
    });

    // --- Restricted PC media library ---
    const libraryControls = {
        video: {
            root: document.getElementById('library-video-root'),
            path: document.getElementById('library-video-path'),
            up: document.getElementById('btn-library-video-up'),
            refresh: document.getElementById('btn-library-video-refresh'),
            list: listVideo,
            mediaExts: ['mp4', 'webm', 'mkv', 'ogg']
        },
        audio: {
            root: document.getElementById('library-audio-root'),
            path: document.getElementById('library-audio-path'),
            up: document.getElementById('btn-library-audio-up'),
            refresh: document.getElementById('btn-library-audio-refresh'),
            list: listAudio,
            mediaExts: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'mka']
        }
    };

    const pcLibraryState = {
        video: { root: '', path: '', parent: null, directories: [], source: 'pc' },
        audio: { root: '', path: '', parent: null, directories: [], source: 'pc' }
    };

    async function fetchJson(url) {
        const response = await fetch(url);
        let payload = null;
        try {
            payload = await response.json();
        } catch (_) {
            // Status text below is enough when the server returned HTML.
        }
        if (!response.ok) {
            throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
        }
        return payload;
    }

    function updateLibraryNavigation(kind) {
        const controls = libraryControls[kind];
        const state = pcLibraryState[kind];
        const displayPath = state.path ? `/${state.path}` : '/';
        controls.path.textContent = displayPath;
        controls.path.title = displayPath;
        controls.up.disabled = state.parent === null;
    }

    async function loadPcDirectory(kind, targetPath = '', allowRootFallback = true) {
        const controls = libraryControls[kind];
        const state = pcLibraryState[kind];
        if (!state.root) return;

        controls.list.innerHTML = '<div class="loading">Loading PC library...</div>';
        const query = new URLSearchParams({ root: state.root, path: targetPath });
        try {
            const result = await fetchJson(`/api/library/list?${query.toString()}`);
            state.path = result.path || '';
            state.parent = result.parent;
            state.directories = result.directories || [];
            state.source = 'pc';
            localStorage.setItem(`pcLibrary${kind}Root`, state.root);
            localStorage.setItem(`pcLibrary${kind}Path`, state.path);
            updateLibraryNavigation(kind);

            const media = [];
            const subtitles = [];
            for (const file of result.files || []) {
                const ext = file.name.split('.').pop().toLowerCase();
                const item = { name: file.name, isAlist: false, url: file.url };
                if (controls.mediaExts.includes(ext)) media.push(item);
                else if (['vtt', 'srt'].includes(ext)) subtitles.push(item);
            }

            if (kind === 'video') {
                videoData = matchSubtitles(media, subtitles);
                renderVideoList();
            } else {
                audioData = matchSubtitles(media, subtitles);
                renderAudioList();
            }
        } catch (error) {
            if (targetPath && allowRootFallback) {
                localStorage.removeItem(`pcLibrary${kind}Path`);
                await loadPcDirectory(kind, '', false);
                return;
            }
            controls.list.innerHTML = `<div class="empty-state">PC library error: ${escapeHtml(error.message)}</div>`;
        }
    }

    async function initializePcLibraries() {
        try {
            const result = await fetchJson('/api/library/roots');
            const availableRoots = (result.roots || []).filter(root => root.available);

            for (const kind of ['video', 'audio']) {
                const controls = libraryControls[kind];
                controls.root.innerHTML = '';
                for (const root of result.roots || []) {
                    const option = document.createElement('option');
                    option.value = root.id;
                    option.textContent = root.available ? root.name : `${root.name} (unavailable)`;
                    option.disabled = !root.available;
                    controls.root.appendChild(option);
                }

                if (availableRoots.length === 0) {
                    controls.list.innerHTML = '<div class="empty-state">No available PC media roots. Check media_roots.json on the PC.</div>';
                    continue;
                }

                const savedRoot = localStorage.getItem(`pcLibrary${kind}Root`);
                const selectedRoot = availableRoots.some(root => root.id === savedRoot)
                    ? savedRoot
                    : availableRoots[0].id;
                controls.root.value = selectedRoot;
                pcLibraryState[kind].root = selectedRoot;
                const savedPath = localStorage.getItem(`pcLibrary${kind}Path`) || '';
                await loadPcDirectory(kind, savedPath);
            }
        } catch (error) {
            const message = `<div class="empty-state">PC library error: ${escapeHtml(error.message)}</div>`;
            listVideo.innerHTML = message;
            listAudio.innerHTML = message;
        }
    }

    for (const kind of ['video', 'audio']) {
        const controls = libraryControls[kind];
        controls.root.addEventListener('change', () => {
            pcLibraryState[kind].root = controls.root.value;
            pcLibraryState[kind].path = '';
            loadPcDirectory(kind, '');
        });
        controls.up.addEventListener('click', () => {
            const parent = pcLibraryState[kind].parent;
            if (parent !== null) loadPcDirectory(kind, parent);
        });
        controls.refresh.addEventListener('click', () => {
            loadPcDirectory(kind, pcLibraryState[kind].path);
        });
    }

    const pcLibrariesReady = initializePcLibraries();

    // --- Alist Logic ---
    let currentAlistBaseUrl = localStorage.getItem('alistUrl') || 'http://127.0.0.1:5244';
    let currentAlistToken = localStorage.getItem('alistToken') || '';
    
    // Auto-fill path forms if stored
    document.getElementById('alist-vid-path').value = localStorage.getItem('alistVidPath') || '';
    document.getElementById('alist-aud-path').value = localStorage.getItem('alistAudPath') || '';

    const btnAlistConfig = document.getElementById('btn-alist-config');
    const alistModal = document.getElementById('alist-modal');
    const modalBtnCancel = document.getElementById('modal-btn-cancel');
    const modalBtnLogin = document.getElementById('modal-btn-login');
    const modalError = document.getElementById('modal-alist-error');
    
    const autoLoadAlist = localStorage.getItem('alistAutoLoad') === '1';
    if (autoLoadAlist) {
        document.getElementById('modal-alist-remember').checked = true;
        if (currentAlistToken) {
            btnAlistConfig.innerHTML = '<i class="fa-solid fa-cloud" style="color:var(--accent);"></i>';
        }
    }

    btnAlistConfig.addEventListener('click', () => {
        alistModal.style.display = 'flex';
    });

    modalBtnCancel.addEventListener('click', () => {
        alistModal.style.display = 'none';
        modalError.style.display = 'none';
    });

    modalBtnLogin.addEventListener('click', async () => {
        const url = document.getElementById('modal-alist-url').value;
        const user = document.getElementById('modal-alist-user').value;
        const pass = document.getElementById('modal-alist-pass').value;
        
        modalBtnLogin.textContent = 'Auth...';
        modalError.style.display = 'none';
        
        try {
            const req = await fetch('/api/alist/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base_url: url, username: user, password: pass })
            });
            const res = await req.json();
            if (res.error) throw new Error(res.error);
            if (res.code !== 200) throw new Error(res.message);
            
            currentAlistBaseUrl = url;
            currentAlistToken = res.data.token || '';
            
            if (document.getElementById('modal-alist-remember').checked) {
                localStorage.setItem('alistUrl', url);
                localStorage.setItem('alistToken', currentAlistToken);
                localStorage.setItem('alistAutoLoad', '1');
            } else {
                localStorage.removeItem('alistUrl');
                localStorage.removeItem('alistToken');
                localStorage.setItem('alistAutoLoad', '0');
            }
            
            alistModal.style.display = 'none';
            btnAlistConfig.innerHTML = '<i class="fa-solid fa-cloud" style="color:var(--accent);"></i>';
        } catch(e) {
            modalError.textContent = "Login Failed: " + e.message;
            modalError.style.display = 'block';
        } finally {
            modalBtnLogin.textContent = 'Save / Auth';
        }
    });

    const btnAlistVideo = document.getElementById('btn-alist-video');
    const btnAlistAudio = document.getElementById('btn-alist-audio');

    btnAlistVideo.addEventListener('click', async () => {
        const baseUrl = currentAlistBaseUrl;
        const token = currentAlistToken;
        const targetPath = document.getElementById('alist-vid-path').value;
        if (document.getElementById('modal-alist-remember').checked) {
            localStorage.setItem('alistVidPath', targetPath);
        }
        
        listVideo.innerHTML = '<div class="loading">Loading AList...</div>';
        try {
            const req = await fetch('/api/alist/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base_url: baseUrl, path: targetPath, token })
            });
            const res = await req.json();
            if (res.error) throw new Error(res.error);
            if (res.code !== 200) throw new Error(res.message);

            pcLibraryState.video.source = 'alist';
            videoData = {}; // Clear previous
            
            const files = res.data.content || [];
            
            let videos = [];
            let subs = [];
            files.forEach(file => {
                if(file.is_dir) return;
                const ext = file.name.split('.').pop().toLowerCase();
                let cleanPath = targetPath.endsWith('/') ? targetPath : targetPath + '/';
                let fileUrl = `${baseUrl.replace(/\/$/, '')}/d${cleanPath}${encodeURIComponent(file.name)}`;
                if (file.sign) fileUrl += `?sign=${file.sign}`;
                const alistFileObj = { name: file.name, isAlist: true, url: fileUrl };

                if (['mp4', 'webm', 'mkv', 'ogg'].includes(ext)) videos.push(alistFileObj);
                else if (['vtt', 'srt'].includes(ext)) subs.push(alistFileObj);
            });
            for (let vst of videos) {
                let base1 = vst.name.substring(0, vst.name.lastIndexOf('.'));
                let base2 = vst.name;
                let matchingSub = subs.find(s => {
                    let sbase = s.name.substring(0, s.name.lastIndexOf('.'));
                    return sbase === base1 || sbase === base2;
                });
                videoData[vst.name] = { video: vst, subtitle: matchingSub || null };
            }
            renderVideoList();
            
        } catch (e) {
            listVideo.innerHTML = `<div class="empty-state">Alist Error: ${escapeHtml(e.message)}</div>`;
        }
    });

    btnAlistAudio.addEventListener('click', async () => {
        const baseUrl = currentAlistBaseUrl;
        const token = currentAlistToken;
        const targetPath = document.getElementById('alist-aud-path').value;
        if (document.getElementById('modal-alist-remember').checked) {
            localStorage.setItem('alistAudPath', targetPath);
        }
        
        listAudio.innerHTML = '<div class="loading">Loading AList...</div>';
        try {
            const req = await fetch('/api/alist/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base_url: baseUrl, path: targetPath, token })
            });
            const res = await req.json();
            if (res.error) throw new Error(res.error);
            if (res.code !== 200) throw new Error(res.message);

            pcLibraryState.audio.source = 'alist';
            audioData = {}; 
            const files = res.data.content || [];
            
            let audios = [];
            let subs = [];
            files.forEach(file => {
                if(file.is_dir) return;
                const ext = file.name.split('.').pop().toLowerCase();
                let cleanPath = targetPath.endsWith('/') ? targetPath : targetPath + '/';
                let fileUrl = `${baseUrl.replace(/\/$/, '')}/d${cleanPath}${encodeURIComponent(file.name)}`;
                if (file.sign) fileUrl += `?sign=${file.sign}`;
                const alistFileObj = { name: file.name, isAlist: true, url: fileUrl };

                if (['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'mka'].includes(ext)) audios.push(alistFileObj);
                else if (['vtt', 'srt'].includes(ext)) subs.push(alistFileObj);
            });
            for (let ast of audios) {
                let base1 = ast.name.substring(0, ast.name.lastIndexOf('.'));
                let base2 = ast.name;
                let matchingSub = subs.find(s => {
                    let sbase = s.name.substring(0, s.name.lastIndexOf('.'));
                    return sbase === base1 || sbase === base2;
                });
                audioData[ast.name] = { audio: ast, subtitle: matchingSub || null };
            }
            renderAudioList();
            
        } catch (e) {
            listAudio.innerHTML = `<div class="empty-state">Alist Error: ${escapeHtml(e.message)}</div>`;
        }
    });

    if (autoLoadAlist && currentAlistToken) {
        pcLibrariesReady.finally(() => {
            if (document.getElementById('alist-vid-path').value) btnAlistVideo.click();
            if (document.getElementById('alist-aud-path').value) btnAlistAudio.click();
        });
    }

    function renderPcDirectories(kind, container) {
        const state = pcLibraryState[kind];
        if (state.source !== 'pc') return 0;

        for (const directory of state.directories) {
            const div = document.createElement('div');
            div.className = 'media-item directory-item';
            div.innerHTML = `
                <div class="media-icon"><i class="fa-solid fa-folder"></i></div>
                <div class="media-info">
                    <div class="media-title">${escapeHtml(directory.name)}</div>
                    <div class="media-tags"><span class="tag">Folder</span></div>
                </div>
                <i class="fa-solid fa-chevron-right directory-chevron"></i>
            `;
            div.addEventListener('click', () => loadPcDirectory(kind, directory.path));
            container.appendChild(div);
        }
        return state.directories.length;
    }

    function renderVideoList() {
        listVideo.innerHTML = '';
        const directoryCount = renderPcDirectories('video', listVideo);
        let count = 0;

        for (const [name, files] of Object.entries(videoData)) {
            if (!files.video) continue;

            count++;
            const div = document.createElement('div');
            div.className = 'media-item';
            const hasSub = !!files.subtitle;

            div.innerHTML = `
                <div class="media-icon"><i class="fa-solid fa-film"></i></div>
                <div class="media-info">
                    <div class="media-title">${escapeHtml(name)}</div>
                    <div class="media-tags">
                        <span class="tag has">Video</span>
                        <span class="tag ${hasSub ? 'has' : ''}">${hasSub ? 'CC' : 'No CC'}</span>
                    </div>
                </div>
            `;
            
            div.addEventListener('click', () => {
                listVideo.querySelectorAll('.media-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
                loadVideoSequence(name, files);
            });

            listVideo.appendChild(div);
        }
        if (count === 0 && directoryCount === 0) {
            listVideo.innerHTML = '<div class="empty-state">No videos found in this folder.</div>';
        }
    }

    function renderAudioList() {
        listAudio.innerHTML = '';
        const directoryCount = renderPcDirectories('audio', listAudio);
        let count = 0;

        for (const [name, files] of Object.entries(audioData)) {
            if (!files.audio) continue;
            count++;
            const div = document.createElement('div');
            div.className = 'media-item';
            const hasSub = !!files.subtitle;

            div.innerHTML = `
                <div class="media-icon"><i class="fa-solid fa-volume-high"></i></div>
                <div class="media-info">
                    <div class="media-title">${escapeHtml(name)}</div>
                    <div class="media-tags">
                        <span class="tag has">Audio</span>
                        <span class="tag ${hasSub ? 'has' : ''}">${hasSub ? 'CC' : 'No CC'}</span>
                    </div>
                </div>
            `;
            
            div.addEventListener('click', () => {
                listAudio.querySelectorAll('.media-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
                loadAudioSequence(name, files);
            });

            listAudio.appendChild(div);
        }
        if (count === 0 && directoryCount === 0) {
            listAudio.innerHTML = '<div class="empty-state">No audios found in this folder.</div>';
        }
    }

    let subState = 0; // 0: Off, 1: Video, 2: Audio
    let trackVideoParams = document.getElementById('track-video');
    let audioSubCues = []; // parsed cues for audio subtitle
    const audioSubOverlay = document.getElementById('audio-sub-overlay');

    function loadVideoSequence(name, files) {
        labelVideo.textContent = `Video: ${name}`;
        labelVideo.title = name;

        if (video.src.startsWith('blob:')) URL.revokeObjectURL(video.src);
        video.src = files.video.url;

        if (files.subtitle) {
            loadSubtitle(files.subtitle, 'video');
        } else {
            // Clear video track
            let oldTrack = document.getElementById('track-video');
            if (oldTrack) oldTrack.remove();
        }
        
        video.load();
        
        isGlobalPlaying = true;
        globalPlayInitiated = true;
        video.play().catch(e=>console.log(e));
        if(asmrAudio.src && !asmrAudio.src.endsWith(window.location.host + '/')) asmrAudio.play().catch(e=>console.log(e));
        
        overlayPlay.classList.remove('show');
        updatePlayBtn();
    }

    function loadAudioSequence(name, files) {
        labelAudio.textContent = `Audio: ${name}`;
        labelAudio.title = name;

        if (asmrAudio.src.startsWith('blob:')) URL.revokeObjectURL(asmrAudio.src);
        asmrAudio.src = files.audio.url;

        if (files.subtitle) {
            loadSubtitle(files.subtitle, 'audio');
        } else {
            audioSubCues = [];
            audioSubOverlay.innerHTML = '';
        }

        asmrAudio.load();
        
        isGlobalPlaying = true;
        globalPlayInitiated = true;
        asmrAudio.play().catch(e=>console.log(e));
        if(video.src && !video.src.endsWith(window.location.host + '/')) video.play().catch(e=>console.log(e));
        
        overlayPlay.classList.remove('show');
        updatePlayBtn();
    }

    function parseVTTCues(text) {
        // Parse VTT/SRT text into array of {start, end, text}
        const cues = [];
        const blocks = text.split(/\n\s*\n/);
        for (const block of blocks) {
            const lines = block.trim().split('\n');
            for (let i = 0; i < lines.length; i++) {
                const timeMatch = lines[i].match(/(\d{1,2}:\d{2}[\.:]\d{2}[\.,]\d{3})\s*-->\s*(\d{1,2}:\d{2}[\.:]\d{2}[\.,]\d{3})/);
                if (timeMatch) {
                    const start = parseTimestamp(timeMatch[1]);
                    const end = parseTimestamp(timeMatch[2]);
                    const text = lines.slice(i + 1).join('\n').trim();
                    if (text) cues.push({ start, end, text });
                    break;
                }
            }
        }
        return cues;
    }

    function parseTimestamp(ts) {
        // Convert "HH:MM:SS.mmm" or "MM:SS.mmm" to seconds
        ts = ts.replace(/,/g, '.');
        const parts = ts.split(':');
        if (parts.length === 3) {
            return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
        } else {
            return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
        }
    }

    // Render audio subtitle overlay based on asmrAudio.currentTime
    function updateAudioSubOverlay() {
        if (subState !== 2 || audioSubCues.length === 0) {
            audioSubOverlay.innerHTML = '';
            return;
        }
        const t = asmrAudio.currentTime;
        const activeCue = audioSubCues.find(c => t >= c.start && t <= c.end);
        if (activeCue) {
            audioSubOverlay.innerHTML = `<span>${escapeHtml(activeCue.text).replace(/\n/g, '<br>')}</span>`;
        } else {
            audioSubOverlay.innerHTML = '';
        }
    }

    asmrAudio.addEventListener('timeupdate', updateAudioSubOverlay);

    const subtitleSizes = [
        { key: '80', label: '80%', name: 'Small' },
        { key: '100', label: '100%', name: 'Standard' },
        { key: '125', label: '125%', name: 'Large' },
        { key: '150', label: '150%', name: 'Extra large' }
    ];
    const savedSubtitleSize = localStorage.getItem('subtitleSize');
    let subtitleSizeIndex = subtitleSizes.findIndex(size => size.key === savedSubtitleSize);
    if (subtitleSizeIndex < 0) subtitleSizeIndex = 1;

    function applySubtitleSize() {
        const selected = subtitleSizes[subtitleSizeIndex];
        for (const size of subtitleSizes) {
            videoWrapper.classList.remove(`subtitle-size-${size.key}`);
        }
        videoWrapper.classList.add(`subtitle-size-${selected.key}`);
        btnSubSize.textContent = `A ${selected.label}`;
        btnSubSize.title = `Subtitle size: ${selected.name}`;
        btnSubSize.setAttribute('aria-label', `Subtitle size: ${selected.label}. Activate for next size.`);
        localStorage.setItem('subtitleSize', selected.key);
    }

    btnSubSize.addEventListener('click', () => {
        subtitleSizeIndex = (subtitleSizeIndex + 1) % subtitleSizes.length;
        applySubtitleSize();
    });

    applySubtitleSize();

    async function loadSubtitle(file, targetTrack) {
        let content = '';
        try {
            if (file._file) {
                // Browser file picker: read via FileReader
                content = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onload = e => resolve(e.target.result);
                    reader.readAsText(file._file);
                });
            } else if (file.isAlist) {
                const req = await fetch('/api/alist/subtitle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: file.url })
                });
                content = await req.text();
            } else {
                // Server-backed local file
                const req = await fetch(file.url);
                content = await req.text();
            }
        } catch(e) {
            console.error("Failed to load subtitle:", e);
            return;
        }

        const ext = file.name.split('.').pop().toLowerCase();
        let parsed = content;
        if (ext === 'srt') {
            parsed = parsed.replace(/,/g, '.');
            parsed = 'WEBVTT\n\n' + parsed;
        }
        // Ensure WEBVTT header for .vtt files too
        if (!parsed.trim().startsWith('WEBVTT')) {
            parsed = 'WEBVTT\n\n' + parsed;
        }

        if (targetTrack === 'video') {
            const blob = new Blob([parsed], { type: 'text/vtt' });
            const url = URL.createObjectURL(blob);
            // Remove old track and create new one
            let oldTrack = document.getElementById('track-video');
            if (oldTrack) oldTrack.remove();
            let newTrack = document.createElement('track');
            newTrack.id = 'track-video';
            newTrack.kind = 'subtitles';
            newTrack.label = 'Video CC';
            newTrack.srclang = 'en';
            newTrack.src = url;
            video.appendChild(newTrack);
            trackVideoParams = newTrack;
            newTrack.track.mode = (subState === 1) ? 'showing' : 'hidden';
        } else {
            // For audio: parse cues and render via custom overlay
            audioSubCues = parseVTTCues(parsed);
            console.log(`Loaded ${audioSubCues.length} audio subtitle cues`);
            updateAudioSubOverlay();
        }
    }


    // --- Core Playback Sync Logic ---

    // Subtitle toggling
    btnSub.addEventListener('click', () => {
        subState = (subState + 1) % 3;
        
        // Hide all native video tracks
        for (let t of video.textTracks) { t.mode = 'hidden'; }
        // Clear audio overlay
        audioSubOverlay.innerHTML = '';

        if (subState === 1) {
            if (trackVideoParams && trackVideoParams.track) trackVideoParams.track.mode = 'showing';
            btnSub.textContent = 'CC: VID';
        } else if (subState === 2) {
            // Audio subs will be rendered by updateAudioSubOverlay on timeupdate
            updateAudioSubOverlay();
            btnSub.textContent = 'CC: AUD';
        } else {
            btnSub.textContent = 'CC: OFF';
        }

        btnSub.classList.toggle('active', subState !== 0);
    });

    
    // --- UI Controls ---

    function togglePlay() {
        isGlobalPlaying = !isGlobalPlaying;
        globalPlayInitiated = true;
        
        if (isGlobalPlaying) {
            if (video.src && !video.src.endsWith(window.location.host + '/')) video.play().catch(()=>{});
            if (asmrAudio.src && !asmrAudio.src.endsWith(window.location.host + '/')) asmrAudio.play().catch(()=>{});
            overlayPlay.classList.remove('show');
        } else {
            if (video.src) video.pause();
            if (asmrAudio.src) asmrAudio.pause();
            overlayPlay.classList.add('show');
        }
        updatePlayBtn();
    }

    function stop() {
        isGlobalPlaying = false;
        if (video.src) { video.pause(); video.currentTime = 0; }
        if (asmrAudio.src) { asmrAudio.pause(); asmrAudio.currentTime = 0; }
        updatePlayBtn();
        overlayPlay.classList.add('show');
    }

    btnPlayPause.addEventListener('click', togglePlay);
    overlayPlay.addEventListener('click', togglePlay);
    btnStop.addEventListener('click', stop);

    // Touch gestures: one tap toggles controls, two taps toggle playback.
    const touchDoubleTapDelay = 300;
    let touchTapTimer = null;
    let lastTouchTapAt = 0;
    let suppressVideoClickUntil = 0;

    function isPlayerControlTarget(target) {
        return target instanceof Element && Boolean(target.closest(
            '.controls-panel, .overlay-play-btn, button, input, select, a'
        ));
    }

    function setTouchControlsVisible(visible) {
        controlsPanel.classList.toggle('active', visible);
        videoWrapper.classList.toggle('controls-show', visible);
    }

    function handleTouchTap(event) {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
        if (isPlayerControlTarget(event.target)) return;

        event.preventDefault();
        suppressVideoClickUntil = Date.now() + 600;
        const now = performance.now();

        if (lastTouchTapAt && now - lastTouchTapAt <= touchDoubleTapDelay) {
            clearTimeout(touchTapTimer);
            touchTapTimer = null;
            lastTouchTapAt = 0;
            togglePlay();
            return;
        }

        lastTouchTapAt = now;
        clearTimeout(touchTapTimer);
        touchTapTimer = setTimeout(() => {
            const controlsVisible = controlsPanel.classList.contains('active');
            setTouchControlsVisible(!controlsVisible);
            lastTouchTapAt = 0;
            touchTapTimer = null;
        }, touchDoubleTapDelay);
    }

    videoWrapper.addEventListener('pointerup', handleTouchTap);
    videoWrapper.addEventListener('pointercancel', () => {
        clearTimeout(touchTapTimer);
        touchTapTimer = null;
        lastTouchTapAt = 0;
    });

    // Preserve the original single-click play/pause behavior for mouse users.
    video.addEventListener('click', () => {
        if (Date.now() >= suppressVideoClickUntil) togglePlay();
    });

    function updatePlayBtn() {
        btnPlayPause.innerHTML = isGlobalPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    }


    // Volumes
    volVideo.addEventListener('input', (e) => {
        video.volume = e.target.value;
    });

    volAudio.addEventListener('input', (e) => {
        asmrAudio.volume = e.target.value;
    });


    // --- Progress Bar Logic ---

    function updateTimelineVid() {
        if (!video.duration) return;
        timeCurrentVid.textContent = formatTime(video.currentTime);
        timeTotalVid.textContent = formatTime(video.duration);

        if (!isDraggingVid) {
            const pct = (video.currentTime / video.duration) * 100;
            progressFillVid.style.width = `${pct}%`;
            progressThumbVid.style.left = `${pct}%`;
        }
    }

    function updateTimelineAud() {
        if (!asmrAudio.duration) return;
        timeCurrentAud.textContent = formatTime(asmrAudio.currentTime);
        timeTotalAud.textContent = formatTime(asmrAudio.duration);

        if (!isDraggingAud) {
            const pct = (asmrAudio.currentTime / asmrAudio.duration) * 100;
            progressFillAud.style.width = `${pct}%`;
            progressThumbAud.style.left = `${pct}%`;
        }
    }

    video.addEventListener('timeupdate', updateTimelineVid);
    video.addEventListener('loadedmetadata', updateTimelineVid);

    asmrAudio.addEventListener('timeupdate', updateTimelineAud);
    asmrAudio.addEventListener('loadedmetadata', updateTimelineAud);

    function setProgressVid(e) {
        const rect = progressBgVid.getBoundingClientRect();
        let posX = e.clientX - rect.left;
        posX = Math.max(0, Math.min(posX, rect.width));
        const pct = posX / rect.width;
        progressFillVid.style.width = `${pct * 100}%`;
        progressThumbVid.style.left = `${pct * 100}%`;
        video.currentTime = pct * video.duration;
    }

    function setProgressAud(e) {
        const rect = progressBgAud.getBoundingClientRect();
        let posX = e.clientX - rect.left;
        posX = Math.max(0, Math.min(posX, rect.width));
        const pct = posX / rect.width;
        progressFillAud.style.width = `${pct * 100}%`;
        progressThumbAud.style.left = `${pct * 100}%`;
        asmrAudio.currentTime = pct * asmrAudio.duration;
    }

    progressBgVid.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        isDraggingVid = true;
        setProgressVid(e);
    });

    progressBgAud.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        isDraggingAud = true;
        setProgressAud(e);
    });

    document.addEventListener('pointermove', (e) => {
        if (isDraggingVid) setProgressVid(e);
        if (isDraggingAud) setProgressAud(e);
    });

    document.addEventListener('pointerup', () => {
        isDraggingVid = false;
        isDraggingAud = false;
    });

    document.addEventListener('pointercancel', () => {
        isDraggingVid = false;
        isDraggingAud = false;
    });


    // --- UI Activity auto-hide ---
    let cursorTimeout;

    function showControls() {
        controlsPanel.classList.add('active');
        videoWrapper.classList.add('controls-show');
        videoWrapper.style.cursor = 'default';
        clearTimeout(controlsTimeout);
        clearTimeout(cursorTimeout);
        const hideDelay = document.fullscreenElement ? 1000 : 3000;
        controlsTimeout = setTimeout(() => {
            if (isGlobalPlaying) {
                hideControlsImmediate();
                videoWrapper.style.cursor = 'none';
            }
        }, hideDelay);
    }

    function hideControlsImmediate() {
        if (isGlobalPlaying) {
            controlsPanel.classList.remove('active');
            videoWrapper.classList.remove('controls-show');
        }
    }

    videoWrapper.addEventListener('mousemove', (e) => {
        if (Date.now() < suppressVideoClickUntil) return;
        const rect = videoWrapper.getBoundingClientRect();
        const triggerY = rect.bottom - (rect.height / 3);

        if (e.clientY >= triggerY) {
            showControls();
        } else {
            hideControlsImmediate();
            videoWrapper.style.cursor = 'default';
            clearTimeout(cursorTimeout);
            cursorTimeout = setTimeout(() => {
                if (isGlobalPlaying && document.fullscreenElement) {
                    videoWrapper.style.cursor = 'none';
                }
            }, 1000);
        }
    });

    videoWrapper.addEventListener('mouseleave', () => {
        clearTimeout(controlsTimeout);
        clearTimeout(cursorTimeout);
        hideControlsImmediate();
    });


    // Fullscreen
    btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            videoWrapper.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable fullscreen: ${err.message}`);
            });
            btnFullscreen.innerHTML = '<i class="fa-solid fa-compress"></i>';
        } else {
            document.exitFullscreen();
            btnFullscreen.innerHTML = '<i class="fa-solid fa-expand"></i>';
        }
    });

});
