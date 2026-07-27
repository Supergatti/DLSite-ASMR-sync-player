document.addEventListener('DOMContentLoaded', () => {

    // Elements
    const labelVideo = document.getElementById('now-playing-video');
    const labelImage = document.getElementById('now-playing-image');
    const labelAudio = document.getElementById('now-playing-audio');
    const video = document.getElementById('main-video');
    const mainImage = document.getElementById('main-image');
    const imageEmptyState = document.getElementById('image-empty-state');
    const asmrAudio = document.getElementById('asmr-audio');
    
    // Controls
    const btnVisualPlayPause = document.getElementById('btn-play-pause');
    const btnAudioPlayPause = document.getElementById('btn-audio-play-pause');
    const btnStop = document.getElementById('btn-stop');
    const videoWrapper = document.getElementById('video-wrapper');
    const controlsPanel = document.querySelector('.controls-panel');
    const btnSub = document.getElementById('btn-sub');
    const btnSubSize = document.getElementById('btn-sub-size');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnModeVideo = document.getElementById('btn-mode-video');
    const btnModeImage = document.getElementById('btn-mode-image');
    const slideshowControls = document.getElementById('slideshow-controls');
    const btnImageEdgePrev = document.getElementById('btn-image-edge-prev');
    const btnImageEdgeNext = document.getElementById('btn-image-edge-next');
    const btnImageOrder = document.getElementById('btn-image-order');
    const slideshowCounter = document.getElementById('slideshow-counter');
    const imageIntervalSelect = document.getElementById('image-interval');
    const btnImageZoom = document.getElementById('btn-image-zoom');
    const imageZoomLabel = document.getElementById('image-zoom-label');
    const btnSeekBack = document.getElementById('btn-seek-back');
    const btnSeekForward = document.getElementById('btn-seek-forward');
    const btnNextMedia = document.getElementById('btn-next-media');
    const btnEndMode = document.getElementById('btn-end-mode');
    
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
    let isVisualPlaying = false;
    let isAudioPlaying = false;
    let playerMode = localStorage.getItem('playerMode') === 'image' ? 'image' : 'video';
    let mediaEndMode = ['repeat', 'next', 'stop'].includes(localStorage.getItem('mediaEndMode'))
        ? localStorage.getItem('mediaEndMode')
        : 'stop';
    let currentVideoName = null;
    let currentAudioName = null;

    const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp'];

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
    const listImage = document.getElementById('list-image');
    const listAudio = document.getElementById('list-audio');

    let videoData = {};
    let imageData = {};
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
    const btnImageBrowse = document.getElementById('btn-image-folder');
    const inputImage = document.getElementById('input-image-folder');
    const btnAudioBrowse = document.getElementById('btn-audio-folder');
    const inputAudio = document.getElementById('input-audio-folder');

    btnVideoBrowse.addEventListener('click', () => inputVideo.click());
    btnImageBrowse.addEventListener('click', () => inputImage.click());
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

    inputImage.addEventListener('change', (e) => {
        revokeImageObjectUrls();
        const images = [];
        for (const file of e.target.files) {
            const ext = file.name.split('.').pop().toLowerCase();
            if (!IMAGE_EXTENSIONS.includes(ext)) continue;
            images.push({
                name: file.webkitRelativePath || file.name,
                isAlist: false,
                url: URL.createObjectURL(file),
                _file: file
            });
        }
        images.sort((left, right) => left.name.localeCompare(right.name, undefined, {
            numeric: true,
            sensitivity: 'base'
        }));
        pcLibraryState.image.source = 'device';
        imageData = Object.fromEntries(images.map(image => [image.name, image]));
        renderImageList();
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
        image: {
            root: document.getElementById('library-image-root'),
            path: document.getElementById('library-image-path'),
            up: document.getElementById('btn-library-image-up'),
            refresh: document.getElementById('btn-library-image-refresh'),
            list: listImage,
            mediaExts: IMAGE_EXTENSIONS
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
        image: { root: '', path: '', parent: null, directories: [], source: 'pc' },
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
            } else if (kind === 'image') {
                revokeImageObjectUrls();
                imageData = Object.fromEntries(media.map(image => [image.name, image]));
                renderImageList();
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

            for (const kind of ['video', 'image', 'audio']) {
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
            listImage.innerHTML = message;
            listAudio.innerHTML = message;
        }
    }

    for (const kind of ['video', 'image', 'audio']) {
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
    document.getElementById('alist-img-path').value = localStorage.getItem('alistImgPath') || '';
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
    const btnAlistImage = document.getElementById('btn-alist-image');
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

    btnAlistImage.addEventListener('click', async () => {
        const baseUrl = currentAlistBaseUrl;
        const token = currentAlistToken;
        const targetPath = document.getElementById('alist-img-path').value;
        if (document.getElementById('modal-alist-remember').checked) {
            localStorage.setItem('alistImgPath', targetPath);
        }

        listImage.innerHTML = '<div class="loading">Loading AList...</div>';
        try {
            const req = await fetch('/api/alist/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base_url: baseUrl, path: targetPath, token })
            });
            const res = await req.json();
            if (res.error) throw new Error(res.error);
            if (res.code !== 200) throw new Error(res.message);

            pcLibraryState.image.source = 'alist';
            revokeImageObjectUrls();
            imageData = {};
            const files = res.data.content || [];

            for (const file of files) {
                if (file.is_dir) continue;
                const ext = file.name.split('.').pop().toLowerCase();
                if (!IMAGE_EXTENSIONS.includes(ext)) continue;

                const cleanPath = targetPath.endsWith('/') ? targetPath : `${targetPath}/`;
                let fileUrl = `${baseUrl.replace(/\/$/, '')}/d${cleanPath}${encodeURIComponent(file.name)}`;
                if (file.sign) fileUrl += `?sign=${file.sign}`;
                imageData[file.name] = { name: file.name, isAlist: true, url: fileUrl };
            }
            renderImageList();
        } catch (e) {
            listImage.innerHTML = `<div class="empty-state">Alist Error: ${escapeHtml(e.message)}</div>`;
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
            if (document.getElementById('alist-img-path').value) btnAlistImage.click();
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

        for (const [name, files] of playableMediaEntries('video')) {
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

    const storedImageInterval = Number.parseInt(localStorage.getItem('imageIntervalSeconds'), 10);
    let imageIntervalSeconds = [3, 5, 10, 15, 30].includes(storedImageInterval)
        ? storedImageInterval
        : 5;
    let imageOrderMode = localStorage.getItem('imageOrderMode') === 'random'
        ? 'random'
        : 'sequential';
    let imagePlaylist = [];
    let imagePlaybackOrder = [];
    let currentImage = null;
    let slideshowAnchorStep = 0;
    let slideshowAnchorOrderIndex = 0;
    let standaloneElapsedSeconds = 0;
    let standaloneStartedAt = null;
    let slideshowFrameId = null;
    let imageZoom = 1;
    let imagePanX = 0;
    let imagePanY = 0;
    let imageGesture = null;
    let suppressTouchControlsUntil = 0;
    const activeImagePointers = new Map();
    const MIN_IMAGE_ZOOM = 1;
    const MAX_IMAGE_ZOOM = 4;
    const IMAGE_SWIPE_THRESHOLD = 50;

    function mediaHasSource(element) {
        return Boolean(element.getAttribute('src'));
    }

    function sameImage(left, right) {
        return Boolean(left && right && left.url === right.url && left.name === right.name);
    }

    function shuffleImages(images) {
        const shuffled = [...images];
        for (let index = shuffled.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
        }
        return shuffled;
    }

    function positiveModulo(value, divisor) {
        return ((value % divisor) + divisor) % divisor;
    }

    function setImageEmptyMessage(message) {
        const messageElement = imageEmptyState.querySelector('span');
        if (messageElement) messageElement.textContent = message;
    }

    function clearCurrentImage(message = 'Select an image folder to start the slideshow') {
        currentImage = null;
        resetImageView();
        mainImage.hidden = true;
        btnImageEdgePrev.hidden = true;
        btnImageEdgeNext.hidden = true;
        mainImage.removeAttribute('src');
        mainImage.alt = '';
        labelImage.textContent = 'Image: None';
        labelImage.removeAttribute('title');
        setImageEmptyMessage(message);
        updateActiveImageItem();
        updateSlideshowCounter();
    }

    function revokeImageObjectUrls() {
        let revokedCurrent = false;
        for (const image of Object.values(imageData)) {
            if (!image.url?.startsWith('blob:')) continue;
            if (sameImage(image, currentImage)) revokedCurrent = true;
            URL.revokeObjectURL(image.url);
        }
        if (revokedCurrent) clearCurrentImage();
    }

    function updateActiveImageItem() {
        listImage.querySelectorAll('.media-item').forEach(item => {
            item.classList.toggle('active', sameImage(item._imageItem, currentImage));
        });
    }

    function getSlideshowClockSeconds() {
        if (standaloneStartedAt !== null && isVisualPlaying) {
            return standaloneElapsedSeconds + (performance.now() - standaloneStartedAt) / 1000;
        }
        return standaloneElapsedSeconds;
    }

    function startStandaloneClock() {
        if (standaloneStartedAt === null) standaloneStartedAt = performance.now();
    }

    function pauseStandaloneClock() {
        if (standaloneStartedAt === null) return;
        standaloneElapsedSeconds += (performance.now() - standaloneStartedAt) / 1000;
        standaloneStartedAt = null;
    }

    function resetStandaloneClock() {
        standaloneElapsedSeconds = 0;
        standaloneStartedAt = isVisualPlaying && playerMode === 'image' ? performance.now() : null;
    }

    function slideshowStep() {
        return Math.floor(getSlideshowClockSeconds() / imageIntervalSeconds);
    }

    function updateSlideshowCounter() {
        if (!currentImage || imagePlaybackOrder.length === 0) {
            slideshowCounter.textContent = `0 / ${imagePlaybackOrder.length}`;
            return;
        }
        const currentIndex = imagePlaybackOrder.findIndex(image => sameImage(image, currentImage));
        slideshowCounter.textContent = `${currentIndex + 1} / ${imagePlaybackOrder.length}`;
    }

    function clampImagePan() {
        if (imageZoom <= 1) {
            imagePanX = 0;
            imagePanY = 0;
            return;
        }
        const maxPanX = (videoWrapper.clientWidth * (imageZoom - 1)) / 2;
        const maxPanY = (videoWrapper.clientHeight * (imageZoom - 1)) / 2;
        imagePanX = Math.max(-maxPanX, Math.min(imagePanX, maxPanX));
        imagePanY = Math.max(-maxPanY, Math.min(imagePanY, maxPanY));
    }

    function applyImageTransform() {
        clampImagePan();
        mainImage.style.transform = `translate3d(${imagePanX}px, ${imagePanY}px, 0) scale(${imageZoom})`;
        const zoomPercent = Math.round(imageZoom * 100);
        imageZoomLabel.textContent = `${zoomPercent}%`;
        btnImageZoom.title = `Image zoom: ${zoomPercent}%. Click to change.`;
        btnImageZoom.setAttribute('aria-label', `Image zoom: ${zoomPercent} percent. Click to change.`);
        videoWrapper.classList.toggle('image-zoomed', imageZoom > 1.01);
    }

    function setImageZoom(nextZoom) {
        imageZoom = Math.max(MIN_IMAGE_ZOOM, Math.min(nextZoom, MAX_IMAGE_ZOOM));
        if (imageZoom <= MIN_IMAGE_ZOOM) {
            imageZoom = MIN_IMAGE_ZOOM;
            imagePanX = 0;
            imagePanY = 0;
        }
        applyImageTransform();
    }

    function resetImageView() {
        imageZoom = MIN_IMAGE_ZOOM;
        imagePanX = 0;
        imagePanY = 0;
        applyImageTransform();
    }

    function cycleImageZoom() {
        const zoomSteps = [1, 1.5, 2, 3, 4];
        const nextZoom = zoomSteps.find(zoom => zoom > imageZoom + 0.01) || zoomSteps[0];
        setImageZoom(nextZoom);
    }

    function displayImage(image) {
        if (!image) return;
        if (!sameImage(image, currentImage)) resetImageView();
        currentImage = image;
        mainImage.hidden = false;
        btnImageEdgePrev.hidden = false;
        btnImageEdgeNext.hidden = false;
        mainImage.src = image.url;
        mainImage.alt = image.name;
        labelImage.textContent = `Image: ${image.name}`;
        labelImage.title = image.name;
        updateActiveImageItem();
        updateSlideshowCounter();
    }

    function reanchorSlideshow() {
        slideshowAnchorStep = slideshowStep();
        const currentIndex = imagePlaybackOrder.findIndex(image => sameImage(image, currentImage));
        slideshowAnchorOrderIndex = currentIndex >= 0 ? currentIndex : 0;
    }

    function rebuildImagePlaybackOrder() {
        imagePlaybackOrder = imageOrderMode === 'random'
            ? shuffleImages(imagePlaylist)
            : [...imagePlaylist];

        if (currentImage && !imagePlaylist.some(image => sameImage(image, currentImage))) {
            clearCurrentImage('Select an image to start the slideshow');
        }
        reanchorSlideshow();
        updateSlideshowCounter();
    }

    function updateSlideshowFromClock() {
        if (playerMode !== 'image' || imagePlaybackOrder.length === 0) return;
        if (!isVisualPlaying) return;
        if (!currentImage) {
            displayImage(imagePlaybackOrder[0]);
            reanchorSlideshow();
            return;
        }

        const stepOffset = slideshowStep() - slideshowAnchorStep;
        const targetIndex = positiveModulo(
            slideshowAnchorOrderIndex + stepOffset,
            imagePlaybackOrder.length
        );
        const targetImage = imagePlaybackOrder[targetIndex];
        if (!sameImage(targetImage, currentImage)) displayImage(targetImage);
    }

    function requestSlideshowFrame() {
        if (slideshowFrameId !== null) return;
        slideshowFrameId = requestAnimationFrame(function tick() {
            slideshowFrameId = null;
            if (playerMode !== 'image' || !isVisualPlaying) return;
            updateSlideshowFromClock();
            slideshowFrameId = requestAnimationFrame(tick);
        });
    }

    function moveSlideshow(direction) {
        if (imagePlaybackOrder.length === 0) return;
        const currentIndex = imagePlaybackOrder.findIndex(image => sameImage(image, currentImage));
        const baseIndex = currentIndex >= 0 ? currentIndex : 0;
        const targetIndex = positiveModulo(baseIndex + direction, imagePlaybackOrder.length);
        displayImage(imagePlaybackOrder[targetIndex]);
        reanchorSlideshow();
    }

    function imagePointerDistance() {
        const points = [...activeImagePointers.values()];
        if (points.length < 2) return 0;
        return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    }

    function beginImagePointerGesture(event) {
        if (playerMode !== 'image' || mainImage.hidden || isPlayerControlTarget(event.target)) return;
        if (event.pointerType === 'mouse' && (event.button !== 0 || imageZoom <= 1)) return;
        if (!['touch', 'pen', 'mouse'].includes(event.pointerType)) return;

        activeImagePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (activeImagePointers.size === 1) {
            imageGesture = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                startPanX: imagePanX,
                startPanY: imagePanY,
                moved: false,
                pinching: false
            };
        } else if (activeImagePointers.size === 2) {
            imageGesture = {
                pinching: true,
                startDistance: imagePointerDistance(),
                startZoom: imageZoom,
                moved: true
            };
            suppressTouchControlsUntil = Date.now() + 500;
        }

        if (videoWrapper.setPointerCapture) {
            try {
                videoWrapper.setPointerCapture(event.pointerId);
            } catch (_) {
                // Pointer capture may be unavailable after a rapid multi-touch transition.
            }
        }
        event.preventDefault();
    }

    function updateImagePointerGesture(event) {
        if (!activeImagePointers.has(event.pointerId) || !imageGesture) return;
        activeImagePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (activeImagePointers.size >= 2 && imageGesture.pinching) {
            const distance = imagePointerDistance();
            if (imageGesture.startDistance > 0) {
                setImageZoom(imageGesture.startZoom * distance / imageGesture.startDistance);
            }
            suppressTouchControlsUntil = Date.now() + 500;
            event.preventDefault();
            return;
        }

        if (activeImagePointers.size !== 1 || imageGesture.pinching) return;
        const deltaX = event.clientX - imageGesture.startX;
        const deltaY = event.clientY - imageGesture.startY;

        if (imageZoom > 1) {
            imagePanX = imageGesture.startPanX + deltaX;
            imagePanY = imageGesture.startPanY + deltaY;
            imageGesture.moved = imageGesture.moved
                || Math.abs(deltaX) > 4
                || Math.abs(deltaY) > 4;
            applyImageTransform();
            if (imageGesture.moved) suppressTouchControlsUntil = Date.now() + 500;
            event.preventDefault();
        } else if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
            imageGesture.moved = true;
            event.preventDefault();
        }
    }

    function finishImagePointerGesture(event) {
        if (!activeImagePointers.has(event.pointerId) || !imageGesture) return;
        const finishingGesture = imageGesture;
        const deltaX = event.clientX - (finishingGesture.startX ?? event.clientX);
        const deltaY = event.clientY - (finishingGesture.startY ?? event.clientY);
        const wasSinglePointerGesture = activeImagePointers.size === 1 && !finishingGesture.pinching;

        if (wasSinglePointerGesture
            && imageZoom <= 1
            && Math.abs(deltaX) >= IMAGE_SWIPE_THRESHOLD
            && Math.abs(deltaX) > Math.abs(deltaY)) {
            moveSlideshow(deltaX < 0 ? 1 : -1);
            suppressTouchControlsUntil = Date.now() + 500;
        } else if (finishingGesture.moved || finishingGesture.pinching) {
            suppressTouchControlsUntil = Date.now() + 500;
        }

        activeImagePointers.delete(event.pointerId);
        if (activeImagePointers.size === 1) {
            const [pointerId, point] = activeImagePointers.entries().next().value;
            imageGesture = {
                pointerId,
                startX: point.x,
                startY: point.y,
                startPanX: imagePanX,
                startPanY: imagePanY,
                moved: true,
                pinching: false
            };
        } else if (activeImagePointers.size === 0) {
            imageGesture = null;
        }
    }

    function cancelImagePointerGesture(event) {
        activeImagePointers.delete(event.pointerId);
        if (activeImagePointers.size === 0) imageGesture = null;
        suppressTouchControlsUntil = Date.now() + 300;
    }

    function updateImageOrderButton() {
        const random = imageOrderMode === 'random';
        btnImageOrder.classList.toggle('active', random);
        btnImageOrder.setAttribute('aria-pressed', String(random));
        btnImageOrder.title = `Playback order: ${random ? 'random' : 'sequential'}`;
        btnImageOrder.innerHTML = random
            ? '<i class="fa-solid fa-shuffle"></i><span>Random</span>'
            : '<i class="fa-solid fa-arrow-down-1-9"></i><span>Sequential</span>';
    }

    function applyPlayerMode() {
        const imageMode = playerMode === 'image';
        const visualAvailable = imageMode
            ? Boolean(currentImage || imagePlaybackOrder.length > 0)
            : mediaHasSource(video);
        if (!visualAvailable) isVisualPlaying = false;
        videoWrapper.classList.toggle('image-mode', imageMode);
        videoWrapper.classList.toggle('video-mode', !imageMode);
        btnModeVideo.classList.toggle('active', !imageMode);
        btnModeImage.classList.toggle('active', imageMode);
        btnModeVideo.setAttribute('aria-pressed', String(!imageMode));
        btnModeImage.setAttribute('aria-pressed', String(imageMode));
        slideshowControls.hidden = !imageMode;

        if (imageMode) {
            if (!currentImage && imagePlaybackOrder.length > 0) {
                displayImage(imagePlaybackOrder[0]);
                reanchorSlideshow();
            }
            video.pause();
            if (subState === 1) subState = 2;
            if (isVisualPlaying) {
                startStandaloneClock();
                requestSlideshowFrame();
            }
        } else {
            pauseStandaloneClock();
            if (isVisualPlaying && mediaHasSource(video)) video.play().catch(() => {});
        }
        applySubtitleState();
        syncGlobalPlaybackState();
    }

    function setPlayerMode(mode) {
        if (!['video', 'image'].includes(mode)) return;
        playerMode = mode;
        localStorage.setItem('playerMode', playerMode);
        applyPlayerMode();
        showControls();
    }

    function loadImageSequence(name, image) {
        displayImage(image);
        reanchorSlideshow();
        setPlayerMode('image');

        setVisualPlayback(true);
    }

    function renderImageList() {
        listImage.innerHTML = '';
        const directoryCount = renderPcDirectories('image', listImage);
        imagePlaylist = Object.values(imageData);
        rebuildImagePlaybackOrder();

        for (const [name, image] of Object.entries(imageData)) {
            const div = document.createElement('div');
            div.className = 'media-item';
            div._imageItem = image;
            div.innerHTML = `
                <div class="media-icon"><i class="fa-regular fa-image"></i></div>
                <div class="media-info">
                    <div class="media-title">${escapeHtml(name)}</div>
                    <div class="media-tags"><span class="tag has">Image</span></div>
                </div>
            `;
            div.classList.toggle('active', sameImage(image, currentImage));
            div.addEventListener('click', () => loadImageSequence(name, image));
            listImage.appendChild(div);
        }

        if (imagePlaylist.length === 0 && directoryCount === 0) {
            listImage.innerHTML = '<div class="empty-state">No images found in this folder.</div>';
        }
    }

    function renderAudioList() {
        listAudio.innerHTML = '';
        const directoryCount = renderPcDirectories('audio', listAudio);
        let count = 0;

        for (const [name, files] of playableMediaEntries('audio')) {
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
        setPlayerMode('video');
        currentVideoName = name;
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
        setVisualPlayback(true);
    }

    function loadAudioSequence(name, files) {
        currentAudioName = name;
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
        setAudioPlayback(true);
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
            newTrack.track.mode = (subState === 1 && playerMode === 'video') ? 'showing' : 'hidden';
        } else {
            // For audio: parse cues and render via custom overlay
            audioSubCues = parseVTTCues(parsed);
            console.log(`Loaded ${audioSubCues.length} audio subtitle cues`);
            updateAudioSubOverlay();
        }
    }


    // --- Core Playback Sync Logic ---

    // Subtitle toggling
    function applySubtitleState() {
        // Hide all native video tracks
        for (let t of video.textTracks) { t.mode = 'hidden'; }
        // Clear audio overlay
        audioSubOverlay.innerHTML = '';

        if (subState === 1 && playerMode === 'video') {
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
    }

    btnSub.addEventListener('click', () => {
        if (playerMode === 'image') {
            subState = subState === 2 ? 0 : 2;
        } else {
            subState = (subState + 1) % 3;
        }
        applySubtitleState();
    });

    btnModeVideo.addEventListener('click', () => setPlayerMode('video'));
    btnModeImage.addEventListener('click', () => setPlayerMode('image'));
    btnImageEdgePrev.addEventListener('click', () => moveSlideshow(-1));
    btnImageEdgeNext.addEventListener('click', () => moveSlideshow(1));
    btnImageZoom.addEventListener('click', cycleImageZoom);

    videoWrapper.addEventListener('pointerdown', beginImagePointerGesture);
    videoWrapper.addEventListener('pointermove', updateImagePointerGesture);
    videoWrapper.addEventListener('pointerup', finishImagePointerGesture);
    videoWrapper.addEventListener('pointercancel', cancelImagePointerGesture);

    mainImage.addEventListener('wheel', (event) => {
        if (playerMode !== 'image') return;
        event.preventDefault();
        setImageZoom(imageZoom + (event.deltaY < 0 ? 0.25 : -0.25));
    }, { passive: false });

    mainImage.addEventListener('dblclick', (event) => {
        if (playerMode !== 'image') return;
        event.preventDefault();
        setImageZoom(imageZoom > 1 ? 1 : 2);
        suppressTouchControlsUntil = Date.now() + 500;
    });

    window.addEventListener('resize', applyImageTransform);

    btnImageOrder.addEventListener('click', () => {
        imageOrderMode = imageOrderMode === 'sequential' ? 'random' : 'sequential';
        localStorage.setItem('imageOrderMode', imageOrderMode);
        rebuildImagePlaybackOrder();
        updateImageOrderButton();
        updateSlideshowFromClock();
    });

    imageIntervalSelect.value = String(imageIntervalSeconds);
    imageIntervalSelect.addEventListener('change', () => {
        const requestedInterval = Number.parseInt(imageIntervalSelect.value, 10);
        if (![3, 5, 10, 15, 30].includes(requestedInterval)) return;
        imageIntervalSeconds = requestedInterval;
        localStorage.setItem('imageIntervalSeconds', String(imageIntervalSeconds));
        reanchorSlideshow();
    });

    mainImage.addEventListener('error', () => {
        mainImage.hidden = true;
        setImageEmptyMessage(`Unable to display ${currentImage?.name || 'this image'}`);
    });

    function playableMediaEntries(kind) {
        const source = kind === 'video' ? videoData : audioData;
        return Object.entries(source)
            .filter(([, files]) => Boolean(files[kind]))
            .sort(([leftName], [rightName]) => leftName.localeCompare(rightName, undefined, {
                numeric: true,
                sensitivity: 'base'
            }));
    }

    function advanceMediaKind(kind, direction = 1) {
        const entries = playableMediaEntries(kind);
        if (entries.length === 0) return false;

        const currentName = kind === 'video' ? currentVideoName : currentAudioName;
        const currentIndex = entries.findIndex(([name]) => name === currentName);
        const targetIndex = currentIndex < 0
            ? (direction >= 0 ? 0 : entries.length - 1)
            : positiveModulo(currentIndex + direction, entries.length);
        const [name, files] = entries[targetIndex];

        if (kind === 'video') loadVideoSequence(name, files);
        else loadAudioSequence(name, files);
        return true;
    }

    function advanceCurrentMediaGroup() {
        let advanced = false;
        if (playerMode === 'image') {
            advanced = advanceMediaKind('audio', 1);
        } else {
            const hasVideoSelection = mediaHasSource(video) || currentVideoName !== null;
            const hasAudioSelection = mediaHasSource(asmrAudio) || currentAudioName !== null;
            if (hasVideoSelection) advanced = advanceMediaKind('video', 1) || advanced;
            if (hasAudioSelection) advanced = advanceMediaKind('audio', 1) || advanced;
            if (!hasVideoSelection && !hasAudioSelection) {
                advanced = advanceMediaKind('video', 1) || advanceMediaKind('audio', 1);
            }
        }
        if (advanced) showControls();
    }

    function seekMediaElement(element, deltaSeconds) {
        if (!mediaHasSource(element)) return;
        const wasEnded = element.ended;
        const duration = Number.isFinite(element.duration) ? element.duration : Infinity;
        const target = Math.max(0, Math.min(element.currentTime + deltaSeconds, duration));
        element.currentTime = target;
        const componentWasPlaying = element === video ? isVisualPlaying : isAudioPlaying;
        if (componentWasPlaying && wasEnded && target < duration) {
            element.play().catch(() => {});
        }
    }

    function seekCurrentPlayback(deltaSeconds) {
        if (playerMode === 'video') {
            seekMediaElement(video, deltaSeconds);
            updateTimelineVid();
        }
        seekMediaElement(asmrAudio, deltaSeconds);
        updateTimelineAud();
        showControls();
    }

    function updateMediaEndModeButton() {
        const modes = {
            repeat: {
                icon: 'fa-repeat',
                label: 'Loop',
                title: 'After playback: repeat current file'
            },
            next: {
                icon: 'fa-forward-step',
                label: 'Auto next',
                title: 'After playback: automatically play next file'
            },
            stop: {
                icon: 'fa-stop',
                label: 'Stop',
                title: 'After playback: stop'
            }
        };
        const selected = modes[mediaEndMode];
        btnEndMode.innerHTML = `<i class="fa-solid ${selected.icon}"></i><span>${selected.label}</span>`;
        btnEndMode.title = selected.title;
        btnEndMode.setAttribute('aria-label', `${selected.title}. Activate for next mode.`);
    }

    function cycleMediaEndMode() {
        const modes = ['repeat', 'next', 'stop'];
        mediaEndMode = modes[(modes.indexOf(mediaEndMode) + 1) % modes.length];
        localStorage.setItem('mediaEndMode', mediaEndMode);
        updateMediaEndModeButton();
    }

    function replayEndedMedia(kind) {
        const element = kind === 'video' ? video : asmrAudio;
        if (!mediaHasSource(element)) return;
        element.currentTime = 0;
        const componentIsPlaying = kind === 'video' ? isVisualPlaying : isAudioPlaying;
        if (componentIsPlaying) element.play().catch(() => {});
    }

    function handleMediaEnded(kind) {
        if (kind === 'video' && playerMode !== 'video') return;
        if (mediaEndMode === 'repeat') {
            replayEndedMedia(kind);
            return;
        }
        if (mediaEndMode === 'next' && advanceMediaKind(kind, 1)) return;

        if (kind === 'video') {
            isVisualPlaying = false;
        } else {
            isAudioPlaying = false;
        }
        syncGlobalPlaybackState();
    }

    btnSeekBack.addEventListener('click', () => seekCurrentPlayback(-10));
    btnSeekForward.addEventListener('click', () => seekCurrentPlayback(10));
    btnNextMedia.addEventListener('click', advanceCurrentMediaGroup);
    btnEndMode.addEventListener('click', cycleMediaEndMode);

    
    // --- UI Controls ---

    function syncGlobalPlaybackState() {
        isGlobalPlaying = isVisualPlaying || isAudioPlaying;
        updatePlayButtons();
    }

    function setVisualPlayback(shouldPlay) {
        const wasVisualPlaying = isVisualPlaying;
        const hasVisual = playerMode === 'video'
            ? mediaHasSource(video)
            : Boolean(currentImage || imagePlaybackOrder.length > 0);
        isVisualPlaying = shouldPlay && hasVisual;

        if (playerMode === 'video') {
            pauseStandaloneClock();
            if (mediaHasSource(video)) {
                if (isVisualPlaying) {
                    if (video.ended) video.currentTime = 0;
                    video.play().catch(() => {});
                } else {
                    video.pause();
                }
            }
        } else {
            video.pause();
            if (isVisualPlaying) {
                startStandaloneClock();
                if (!wasVisualPlaying) reanchorSlideshow();
                updateSlideshowFromClock();
                requestSlideshowFrame();
            } else {
                pauseStandaloneClock();
            }
        }
        syncGlobalPlaybackState();
    }

    function setAudioPlayback(shouldPlay) {
        isAudioPlaying = shouldPlay && mediaHasSource(asmrAudio);
        if (mediaHasSource(asmrAudio)) {
            if (isAudioPlaying) {
                if (asmrAudio.ended) asmrAudio.currentTime = 0;
                asmrAudio.play().catch(() => {});
            } else {
                asmrAudio.pause();
            }
        }
        syncGlobalPlaybackState();
    }

    function toggleVisualPlayback() {
        setVisualPlayback(!isVisualPlaying);
        showControls();
    }

    function toggleAudioPlayback() {
        setAudioPlayback(!isAudioPlaying);
        showControls();
    }

    function stop() {
        isVisualPlaying = false;
        isAudioPlaying = false;
        if (mediaHasSource(video)) { video.pause(); video.currentTime = 0; }
        if (mediaHasSource(asmrAudio)) { asmrAudio.pause(); asmrAudio.currentTime = 0; }
        pauseStandaloneClock();
        resetStandaloneClock();
        reanchorSlideshow();
        updateSlideshowFromClock();
        syncGlobalPlaybackState();
    }

    btnVisualPlayPause.addEventListener('click', toggleVisualPlayback);
    btnAudioPlayPause.addEventListener('click', toggleAudioPlayback);
    btnStop.addEventListener('click', stop);

    function isPlayerControlTarget(target) {
        return target instanceof Element && Boolean(target.closest(
            '.controls-panel, button, input, select, a'
        ));
    }

    function setTouchControlsVisible(visible) {
        controlsPanel.classList.toggle('active', visible);
        videoWrapper.classList.toggle('controls-show', visible);
    }

    function handleTouchTap(event) {
        if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
        if (isPlayerControlTarget(event.target)) return;
        if (Date.now() < suppressTouchControlsUntil) return;

        event.preventDefault();
        const controlsVisible = controlsPanel.classList.contains('active');
        setTouchControlsVisible(!controlsVisible);
    }

    videoWrapper.addEventListener('pointerup', handleTouchTap);

    function updatePlayButtons() {
        const visualLabel = playerMode === 'image' ? 'image slideshow' : 'video';
        const visualAction = isVisualPlaying ? 'Pause' : 'Play';
        const visualIcon = isVisualPlaying ? 'fa-pause' : 'fa-play';
        const visualBadge = playerMode === 'image' ? 'fa-images' : 'fa-video';
        btnVisualPlayPause.innerHTML = `
            <i class="fa-solid ${visualIcon}"></i>
            <span class="component-badge"><i class="fa-solid ${visualBadge}"></i></span>
        `;
        btnVisualPlayPause.title = `${visualAction} ${visualLabel}`;
        btnVisualPlayPause.setAttribute('aria-label', `${visualAction} ${visualLabel}`);
        btnVisualPlayPause.classList.toggle('active', isVisualPlaying);

        const audioAction = isAudioPlaying ? 'Pause' : 'Play';
        const audioIcon = isAudioPlaying ? 'fa-pause' : 'fa-play';
        btnAudioPlayPause.innerHTML = `
            <i class="fa-solid ${audioIcon}"></i>
            <span class="component-badge"><i class="fa-solid fa-microphone"></i></span>
        `;
        btnAudioPlayPause.title = `${audioAction} audio`;
        btnAudioPlayPause.setAttribute('aria-label', `${audioAction} audio`);
        btnAudioPlayPause.classList.toggle('active', isAudioPlaying);
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
    video.addEventListener('ended', () => handleMediaEnded('video'));

    asmrAudio.addEventListener('timeupdate', updateTimelineAud);
    asmrAudio.addEventListener('loadedmetadata', updateTimelineAud);
    asmrAudio.addEventListener('ended', () => handleMediaEnded('audio'));

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
    let controlsHovered = false;

    function showControls() {
        controlsPanel.classList.add('active');
        videoWrapper.classList.add('controls-show');
        videoWrapper.style.cursor = 'default';
        clearTimeout(controlsTimeout);
        clearTimeout(cursorTimeout);
        const hideDelay = document.fullscreenElement ? 1000 : 3000;
        controlsTimeout = setTimeout(() => {
            if (isGlobalPlaying && !controlsHovered) {
                hideControlsImmediate();
                videoWrapper.style.cursor = 'none';
            }
        }, hideDelay);
    }

    function hideControlsImmediate() {
        if (isGlobalPlaying && !controlsHovered) {
            controlsPanel.classList.remove('active');
            videoWrapper.classList.remove('controls-show');
        }
    }

    controlsPanel.addEventListener('mouseenter', () => {
        controlsHovered = true;
        clearTimeout(controlsTimeout);
        controlsPanel.classList.add('active');
        videoWrapper.classList.add('controls-show');
        videoWrapper.style.cursor = 'default';
    });

    controlsPanel.addEventListener('mouseleave', () => {
        controlsHovered = false;
        showControls();
    });

    videoWrapper.addEventListener('mousemove', (e) => {
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

    updateImageOrderButton();
    updateMediaEndModeButton();
    applyPlayerMode();
    syncGlobalPlaybackState();

});
