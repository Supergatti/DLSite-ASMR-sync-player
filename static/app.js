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

    // Restore saved local paths
    const savedVidPath = localStorage.getItem('localVidPath');
    const savedAudPath = localStorage.getItem('localAudPath');
    if (savedVidPath) document.getElementById('local-vid-path').value = savedVidPath;
    if (savedAudPath) document.getElementById('local-aud-path').value = savedAudPath;

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
        audioData = matchSubtitles(audios, subs);
        renderAudioList();
    });

    // --- Server-backed path loading (type path + click icon) ---
    function groupServerFiles(fileList, mediaExts, dirPath) {
        let medias = [], subs = [];
        for (const f of fileList) {
            const ext = f.name.split('.').pop().toLowerCase();
            const filePath = dirPath.replace(/[\/\\]$/, '') + '\\' + f.name;
            const fileObj = { name: f.name, isAlist: false, url: '/api/local/file?path=' + encodeURIComponent(filePath) };
            if (mediaExts.includes(ext)) medias.push(fileObj);
            else if (['vtt', 'srt'].includes(ext)) subs.push(fileObj);
        }
        return matchSubtitles(medias, subs);
    }

    document.getElementById('btn-local-video').addEventListener('click', async () => {
        const dirPath = document.getElementById('local-vid-path').value.trim();
        if (!dirPath) return;
        localStorage.setItem('localVidPath', dirPath);
        listVideo.innerHTML = '<div class="loading">Loading...</div>';
        try {
            const req = await fetch('/api/local/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: dirPath })
            });
            const res = await req.json();
            if (res.error) throw new Error(res.error);
            videoData = groupServerFiles(res.files, ['mp4', 'webm', 'mkv', 'ogg'], dirPath);
            renderVideoList();
        } catch(e) {
            listVideo.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
        }
    });

    document.getElementById('btn-local-audio').addEventListener('click', async () => {
        const dirPath = document.getElementById('local-aud-path').value.trim();
        if (!dirPath) return;
        localStorage.setItem('localAudPath', dirPath);
        listAudio.innerHTML = '<div class="loading">Loading...</div>';
        try {
            const req = await fetch('/api/local/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: dirPath })
            });
            const res = await req.json();
            if (res.error) throw new Error(res.error);
            audioData = groupServerFiles(res.files, ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'mka'], dirPath);
            renderAudioList();
        } catch(e) {
            listAudio.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
        }
    });

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
    
    // Auto Load Alist path triggers if configured
    if (localStorage.getItem('alistAutoLoad') === '1') {
        document.getElementById('modal-alist-remember').checked = true;
        // Check if token exists, change cloud color
        if (currentAlistToken) {
            btnAlistConfig.innerHTML = '<i class="fa-solid fa-cloud" style="color:var(--accent);"></i>';
            if (document.getElementById('alist-vid-path').value) document.getElementById('btn-alist-video').click();
            if (document.getElementById('alist-aud-path').value) document.getElementById('btn-alist-audio').click();
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
            listVideo.innerHTML = `<div class="empty-state">Alist Error: ${e.message}</div>`;
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
            listAudio.innerHTML = `<div class="empty-state">Alist Error: ${e.message}</div>`;
        }
    });

    function renderVideoList() {
        listVideo.innerHTML = '';
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
                    <div class="media-title">${name}</div>
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
        if (count === 0) listVideo.innerHTML = '<div class="empty-state">No videos found.</div>';
    }

    function renderAudioList() {
        listAudio.innerHTML = '';
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
                    <div class="media-title">${name}</div>
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
        if (count === 0) listAudio.innerHTML = '<div class="empty-state">No audios found.</div>';
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
            audioSubOverlay.innerHTML = `<span>${activeCue.text}</span>`;
        } else {
            audioSubOverlay.innerHTML = '';
        }
    }

    asmrAudio.addEventListener('timeupdate', updateAudioSubOverlay);

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
    video.addEventListener('click', togglePlay);
    btnStop.addEventListener('click', stop);

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

    progressBgVid.addEventListener('mousedown', (e) => {
        isDraggingVid = true;
        setProgressVid(e);
    });

    progressBgAud.addEventListener('mousedown', (e) => {
        isDraggingAud = true;
        setProgressAud(e);
    });

    document.addEventListener('mousemove', (e) => {
        if (isDraggingVid) setProgressVid(e);
        if (isDraggingAud) setProgressAud(e);
    });

    document.addEventListener('mouseup', () => {
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
