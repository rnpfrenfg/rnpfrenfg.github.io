import { VideoGenerator } from "./videoGenerator.js";
import { Logger } from "./Logger.js";
import { VideoProjectStorage, ContentType } from "./videotrack.js";
var PropertyType;
(function (PropertyType) {
    PropertyType[PropertyType["TrackItem"] = 0] = "TrackItem";
    PropertyType[PropertyType["sidebarItem"] = 1] = "sidebarItem";
    PropertyType[PropertyType["trackheader"] = 2] = "trackheader";
})(PropertyType || (PropertyType = {}));
const createVideoButton = document.getElementById('createvideo');
const downloadLink = document.getElementById('downloadLink');
const timelineNow = document.querySelector('.timeline-header .time');
const timelineStart = document.getElementById('header-starttime');
const timelineEnd = document.getElementById('header-endtime');
const timelineTrakcs = document.getElementById('timeline-tracks');
const sidebar = document.getElementById('sidebargrid');
const canvas = document.getElementById('canvas');
const playhead = document.getElementById('playhead');
const timelineruler = document.getElementById('timelineruler');
const property = document.getElementById('properties-panel');
const storage = new VideoProjectStorage();
const videoGenerator = new VideoGenerator(storage, canvas);
//property
let selectedElement = null;
let selectedElementType = PropertyType.TrackItem;
//mousemove on canvas // move items
let selectedTrackItem;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
//timeline
let tlStart = 0;
let tlEnd = 0;
let tlNow = 0;
//video preview
let isPlaying = false;
let playbackInterval = null;
let audioContext = null;
let audioSource;
drawStorage(storage);
document.getElementById('imageInput').addEventListener('change', handleImageInput);
document.getElementById('audioInput').addEventListener('change', handleAudioInput);
document.getElementById('mp4Input').addEventListener('change', handleMp4Input);
document.getElementById('previewstartbutton').addEventListener('click', startPlayback);
document.getElementById('previewstopbutton').addEventListener('click', stopPlayback);
document.getElementById('addtrackbutton').addEventListener('click', clickAddLineButton);
document.getElementById('createvideo').addEventListener('click', async () => {
    try {
        createVideo();
    }
    catch (error) {
        console.error('Video creation failed:', error);
        hideProgressModal();
    }
});
let isRulerDragging = false;
timelineruler.draggable = false;
timelineruler.addEventListener('mousedown', (e) => {
    isRulerDragging = true;
    controlTimeline(e);
});
timelineruler.addEventListener('mousemove', (e) => {
    if (isRulerDragging) {
        controlTimeline(e);
    }
});
timelineruler.addEventListener('mouseup', () => {
    isRulerDragging = false;
});
timelineruler.addEventListener('mouseleave', () => {
    isRulerDragging = false;
});
sidebar.addEventListener('click', (e) => {
    const target = e.target;
    if (target.parentElement == null)
        return;
    if (target.classList.contains('click-layer')) {
        selectedElement = target.parentElement;
        selectedElementType = PropertyType.sidebarItem;
        updatePropertiesPanel(target.parentElement);
    }
});
timelineTrakcs.addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList.contains('timeline-trackheader')) {
        if (target == null)
            return;
        selectedElement = target;
        selectedElementType = PropertyType.trackheader;
        updatePropertiesPanel(target);
    }
    else if (target.classList.contains('track-bar')) {
        selectedElement = target;
        selectedElementType = PropertyType.TrackItem;
        updatePropertiesPanel(target);
    }
});
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hitItem = findItemAtPosition(x, y, tlNow);
    if (hitItem) {
        selectedTrackItem = hitItem;
        selectedElement = null;
        selectedElementType = PropertyType.TrackItem;
        updatePropertiesPanelForTrackItem(hitItem);
    }
    else {
        clearProperty();
    }
});
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hitItem = findItemAtPosition(x, y, tlNow);
    if (hitItem) {
        selectedTrackItem = hitItem;
        selectedElementType = PropertyType.TrackItem;
        updatePropertiesPanelForTrackItem(hitItem);
        isDragging = true;
        dragStartX = x - hitItem.x;
        dragStartY = y - hitItem.y;
    }
});
canvas.addEventListener('mousemove', (e) => {
    if (!isDragging)
        return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (selectedTrackItem) {
        const newX = x - dragStartX;
        const newY = y - dragStartY;
        selectedTrackItem.x = newX;
        selectedTrackItem.y = newY;
        updatePropertiesPanelForTrackItem(selectedTrackItem);
    }
});
canvas.addEventListener('mouseup', () => {
    if (isDragging)
        videoGenerator.drawImage(tlNow);
    isDragging = false;
});
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!selectedTrackItem)
        return;
    const delta = e.deltaY > 0 ? -1 : 1;
    selectedTrackItem.scale = selectedTrackItem.scale + selectedTrackItem.scale * 0.1 * delta;
    videoGenerator.drawImage(tlNow);
    updatePropertiesPanelForTrackItem(selectedTrackItem);
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && selectedElement) {
        e.preventDefault();
        if (selectedElementType === PropertyType.TrackItem) {
            const trackItem = storage.getTracks()
                .flatMap(track => track.contents)
                .find(item => item.id === selectedElement.id);
            if (trackItem) {
                const track = storage.getTracks().find(t => t.contents.includes(trackItem));
                if (track) {
                    track.contents = track.contents.filter(item => item.id !== trackItem.id);
                    drawStorage(storage);
                    clearProperty();
                }
            }
        }
        else if (selectedElementType === PropertyType.trackheader) {
            storage.getTracks()
                .filter(track => track.id === selectedElement.id)
                .forEach(track => {
                const index = storage.getTracks().indexOf(track);
                if (index !== -1) {
                    storage.getTracks().splice(index, 1);
                    drawStorage(storage);
                    clearProperty();
                }
            });
        }
        else if (selectedElementType === PropertyType.sidebarItem) {
            const content = storage.getContent(selectedElement.id);
            if (content) {
                storage.getContents()
                    .splice(storage.getContents().findIndex(c => c.id === content.id), 1);
                drawStorage(storage);
                clearProperty();
            }
        }
    }
});
function drawStorage(storage) {
    sidebar.innerHTML = '';
    for (const content of storage.getContents()) {
        drawContent(content.name, content.id, content.type);
    }
    changeTimeline(0, storage.getVideoEndTime() + 5);
    timelineTrakcs.innerHTML = '';
    storage.getTracks().forEach(track => {
        const trackDiv = createVideoTrackDiv(track.name, track.id);
        timelineTrakcs.appendChild(trackDiv);
        track.contents.forEach(content => renderVideoTrackItem(content, trackDiv));
        setupDragAndDrop(trackDiv);
    });
}
function updatePropertiesPanel(element) {
    if (selectedElementType === PropertyType.TrackItem) {
        const res = storage.getIteamOfTrack(element.id);
        if (res == null)
            return;
        const [track, trackItem] = res;
        updatePropertiesPanelForTrackItem(trackItem);
    }
    else if (selectedElementType === PropertyType.trackheader) {
        const track = storage.getVideoTrack(element.id);
        const name = track ? track.name : 'Track';
        const contentType = track ? track.type : ContentType.image;
        property.innerHTML = `
            <div>
                <label>Name:</label>
                <input type="text" value="${name}" data-prop="name">
            </div>
            <div>
                <label>Content Type:</label>
                <select data-prop="contentType">
                    <option value="image" ${contentType === ContentType.image ? 'selected' : ''}>Image</option>
                    <option value="audio" ${contentType === ContentType.audio ? 'selected' : ''}>Audio</option>
                    <option value="text" ${contentType === ContentType.text ? 'selected' : ''}>Text</option>
                    <option value="mp4" ${contentType === ContentType.mp4 ? 'selected' : ''}>mp4</option>
                </select>
            </div>
        `;
    }
    else if (selectedElementType === PropertyType.sidebarItem) {
        const content = storage.getContent(element.id);
        const name = content ? content.name : 'File';
        property.innerHTML = `
            <div>
                <label>Name:</label>
                <input type="text" value="${name}" data-prop="name">
            </div>
        `;
    }
    const applyButton = document.createElement('button');
    applyButton.textContent = 'Apply';
    applyButton.addEventListener('click', applyPropertyChange);
    property.appendChild(applyButton);
}
function updatePropertiesPanelForTrackItem(trackItem) {
    let additionalFields = '';
    if (trackItem.content.type === ContentType.text) {
        additionalFields = `
            <div>
                <label>Font:</label>
                <input type="text" value="${trackItem.content.src.font || '궁서체'}" data-prop="font">
            </div>
            <div>
                <label>Font Size (px):</label>
                <input type="number" value="${trackItem.content.src.fontSize || 32}" data-prop="fontSize">
            </div>
            <div>
                <label>Color:</label>
                <input type="color" value="${trackItem.content.src.color || '#FFFFFF'}" data-prop="color">
            </div>
        `;
    }
    property.innerHTML = `
        <div>
            <label>Duration (s):</label>
            <input type="number" step="0.1" value="${trackItem.duration}" data-prop="duration">
        </div>
        <div>
            <label>Start Time (s):</label>
            <input type="number" step="0.1" value="${trackItem.start}" data-prop="startTime">
        </div>
        <div>
            <label>X:</label>
            <input type="number" step="0.1" value="${trackItem.x}" data-prop="x">
        </div>
        <div>
            <label>Y:</label>
            <input type="number" step="0.1" value="${trackItem.y}" data-prop="y">
        </div>
        <div>
            <label>Scale:</label>
            <input type="number" step="0.1" value="${trackItem.scale}" data-prop="scale">
        </div>
        ${additionalFields}
    `;
    const applyButton = document.createElement('button');
    applyButton.textContent = 'Apply';
    applyButton.addEventListener('click', applyPropertyChange);
    property.appendChild(applyButton);
}
function applyPropertyChange() {
    if (!selectedElement)
        return;
    const properties = {};
    const inputs = property.querySelectorAll('input[data-prop], select[data-prop]');
    const id = selectedElement.id;
    inputs.forEach((t) => {
        const input = t;
        const propName = input.dataset.prop;
        if (propName) {
            properties[propName] = input.value;
        }
    });
    if (selectedElementType === PropertyType.TrackItem) {
        const duration = parseFloat(properties['duration']);
        const startTime = parseFloat(properties['startTime']);
        const x = parseFloat(properties['x']);
        const y = parseFloat(properties['y']);
        const scale = parseFloat(properties['scale']);
        const res = storage.getIteamOfTrack(id);
        if (res == null)
            return;
        const [track, item] = res;
        item.start = startTime;
        item.duration = duration; // TODO : 근처 아이템 시간 밀기
        item.x = x;
        item.y = y;
        item.scale = scale;
        drawStorage(storage);
    }
    else if (selectedElementType === PropertyType.trackheader) {
        const name = properties['name'];
        const contentType = properties['contentType'];
        const track = storage.getVideoTrack(selectedElement.id);
        if (track == null)
            return;
        if (track && track.type !== contentType) {
            track.contents = [];
            track.type = contentType;
        }
        track.name = name;
        drawStorage(storage);
    }
    else if (selectedElementType === PropertyType.sidebarItem) {
        const name = properties['name'];
        const content = storage.getContent(selectedElement.id);
        if (content) {
            content.name = name;
            drawStorage(storage);
        }
    }
}
function clearProperty() {
    property.innerHTML = '';
    selectedElement = null;
}
function drawContent(name, id, type) {
    const div = document.createElement('div');
    div.className = 'file';
    div.id = id.toString();
    const clicklayer = document.createElement('div');
    clicklayer.className = 'click-layer';
    const iconDiv = document.createElement('div');
    iconDiv.className = 'icon';
    iconDiv.innerHTML = contnetTypeToSvg(type);
    const fileNameDiv = document.createElement('span');
    fileNameDiv.className = 'file-name';
    fileNameDiv.textContent = name.length > 10 ? name.slice(0, 10) + '...' : name;
    div.appendChild(clicklayer);
    div.appendChild(iconDiv);
    div.appendChild(fileNameDiv);
    sidebar.appendChild(div);
}
async function handleImageInput(event) {
    const files = event.target.files;
    if (!files?.length)
        return;
    for (const file of Array.from(files || [])) {
        if (file.type.startsWith('image/')) {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            await new Promise(resolve => img.onload = resolve);
            storage.createContent(ContentType.image, img, file.name, img.naturalWidth, img.naturalHeight);
            drawStorage(storage);
        }
        else {
            Logger.log(`이미지 파일이 아닙니다.`);
        }
    }
}
async function handleAudioInput(event) {
    const files = event.target.files;
    if (!files?.length)
        return;
    for (let t = 0; t < files.length; t++) {
        const file = files[t];
        if (!file.type.startsWith('audio/')) {
            Logger.log('오디오 파일이 아닙니다.');
            return;
        }
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            storage.createContent(ContentType.audio, audioBuffer, file.name, 0, 0);
            Logger.log('오디오 파일이 업로드되었습니다.');
        }
        catch (e) {
            Logger.log('오디오 로딩 실패:', e.message);
        }
    }
    drawStorage(storage);
}
async function handleMp4Input(event) {
    const files = event.target.files;
    if (!files?.length)
        return;
    for (const file of Array.from(files)) {
        if (file.type !== 'video/mp4')
            return;
        const videoUrl = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.src = videoUrl;
        await new Promise(resolve => video.onloadedmetadata = resolve);
        storage.createContent(ContentType.mp4, video, file.name, video.videoWidth, video.videoHeight);
        drawStorage(storage);
    }
}
async function createVideo() {
    stopPlayback();
    createVideoButton.disabled = true;
    showProgressModal();
    const blob = await videoGenerator.createVideo((progress) => updateProgress(progress));
    if (blob == null) {
        Logger.log('영상 생성 실패');
        hideProgressModal();
        return;
    }
    URL.revokeObjectURL(downloadLink.href);
    const videoUrl = URL.createObjectURL(blob);
    downloadLink.href = videoUrl;
    downloadLink.style.display = 'inline-block';
    hideProgressModal();
    createVideoButton.disabled = false;
}
function updateProgress(progress) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    if (progressBar && progressText) {
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
    }
}
function hideProgressModal() {
    const modal = document.getElementById('progress-modal');
    if (modal) {
        modal.remove();
    }
}
function clickAddLineButton() {
    storage.createTrack(ContentType.image, 'image');
    drawStorage(storage);
}
function changeTimeline(start, end, now = tlNow) {
    timelineNow.textContent = now.toString();
    timelineStart.textContent = start.toString();
    timelineEnd.textContent = end.toString();
    playhead.style.left = `${videoTimeToClient(now)}px`;
    tlStart = start;
    tlEnd = end;
    tlNow = now;
    videoGenerator.drawImage(now);
}
function contnetTypeToSvg(type) {
    switch (type) {
        case ContentType.image:
            return `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="9" cy="9" r="2"></circle>
                    <path d="M21 15l-3-3-4 4-2-2-3 3"></path>
                </svg>
            `;
        case ContentType.audio:
            return `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                </svg>
            `;
        case ContentType.text:
            return `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a3e4db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 6H3"></path>
                    <path d="M21 12H3"></path>
                    <path d="M15 18H3"></path>
                    <path d="M21 6v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6"></path>
                </svg>
            `;
        case ContentType.mp4:
            return `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f472b6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                        <polygon points="10 8 16 12 10 16 10 8"></polygon>
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="6" y1="2" x2="18" y2="2"></line>
                    </svg>
            `;
        default:
            return `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f472b6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                </svg>
            `;
    }
}
function createVideoTrackDiv(name, id) {
    const trackDiv = document.createElement('div');
    trackDiv.id = id.toString();
    trackDiv.className = 'timeline-track';
    const labelDiv = document.createElement('div');
    labelDiv.className = 'timeline-trackheader';
    labelDiv.id = id;
    const indentDiv = document.createElement('div');
    indentDiv.className = 'indent';
    const iconDiv = document.createElement('div');
    const span = document.createElement('span');
    span.textContent = name;
    labelDiv.appendChild(indentDiv);
    labelDiv.appendChild(iconDiv);
    labelDiv.appendChild(span);
    const track = storage.getVideoTrack(id);
    if (track) {
        iconDiv.innerHTML = contnetTypeToSvg(track.type);
        if (track.type == ContentType.text) {
            const button = document.createElement('button');
            button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`;
            button.className = 'cyclebutton';
            button.addEventListener('click', () => {
                let t = { font: '궁서체', fontSize: 13, color: '#000000' };
                let c = storage.createContent(ContentType.text, t, '예시 메시지', storage.getWidth(), 3333);
                storage.addContentToTrack(track.id, c, tlNow, 2, storage.getWidth() / 2, storage.getHeight() * 4 / 5, 2.5);
                drawStorage(storage);
                videoGenerator.drawImage(tlNow);
            });
            labelDiv.appendChild(button);
        }
    }
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    const innerDiv = document.createElement('div');
    const trackSpan = document.createElement('span');
    innerDiv.appendChild(trackSpan);
    trackDiv.appendChild(labelDiv);
    trackDiv.appendChild(contentDiv);
    return trackDiv;
}
let draggedItem = null;
sidebar.addEventListener('dragstart', (e) => {
    const target = e.target;
    if (target.classList.contains('click-layer')) {
        draggedItem = target.parentElement;
        e.dataTransfer?.setData('text/plain', target.id);
    }
});
sidebar.addEventListener('dragend', () => {
    draggedItem = null;
});
function setupDragAndDrop(timeline) {
    timeline.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    timeline.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (draggedItem) {
            const trackID = timeline.id;
            const content = storage.getContent(draggedItem.id);
            if (content) {
                const width = content.width;
                const height = content.height;
                const scale = Math.min(storage.getWidth() / width, storage.getHeight() / height);
                const scaledWidth = width * scale;
                const scaledHeight = height * scale;
                const offsetX = (storage.getWidth() - scaledWidth) / 2;
                const offsetY = (storage.getHeight() - scaledHeight) / 2;
                let duration = 2;
                if (content.type == ContentType.audio) {
                    const audioBuffer = content.src;
                    duration = audioBuffer.duration;
                }
                else if (content.type == ContentType.mp4) {
                    const video = content.src;
                    duration = video.duration;
                }
                await storage.addContentToTrackToBack(trackID, content, duration, offsetX, offsetY, scale);
                drawStorage(storage);
            }
            draggedItem = null;
        }
    });
}
function renderVideoTrackItem(content, track) {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'track-bar';
    let startPos = videoTimeToClient(content.start);
    contentDiv.style.left = `${startPos}px`;
    contentDiv.style.width = `${videoTimeToClient(content.duration + content.start) - startPos}px`;
    contentDiv.style.backgroundColor = '#34d399';
    contentDiv.innerHTML = `<span>${content.content.name}</span>`;
    contentDiv.id = content.id;
    const contentArea = track.querySelector('.content');
    if (contentArea) {
        contentArea.appendChild(contentDiv);
    }
}
function controlTimeline(e) {
    const rect = timelineruler.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let now = tlStart + (x / (rect.right - rect.left)) * (tlEnd - tlStart);
    if (now < 0)
        now = 0;
    changeTimeline(tlStart, tlEnd, now);
}
function videoTimeToClient(now) {
    const rect = timelineruler.getBoundingClientRect();
    const ret = ((now - tlStart) / (tlEnd - tlStart)) * (rect.right - rect.left);
    return ret;
}
function findItemAtPosition(x, y, now) {
    const rect = canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const storageWidth = storage.getWidth();
    const storageHeight = storage.getHeight();
    const scaleX = storageWidth / canvasWidth;
    const scaleY = storageHeight / canvasHeight;
    const storageX = x * scaleX;
    const storageY = y * scaleY;
    let ret = null;
    for (const track of storage.getTracks()) {
        if (track.type === ContentType.image || track.type === ContentType.mp4 || track.type == ContentType.text) {
            for (const item of track.contents) {
                if (item.start <= now && now < item.start + item.duration) {
                    const scaledWidth = item.content.width * item.scale;
                    const scaledHeight = item.content.height * item.scale;
                    if (storageX >= item.x &&
                        storageX <= item.x + scaledWidth &&
                        storageY >= item.y &&
                        storageY <= item.y + scaledHeight) {
                        ret = item;
                    }
                }
            }
        }
    }
    return ret; // find most front
}
async function startPlayback() {
    if (isPlaying)
        return;
    isPlaying = true;
    audioContext = new AudioContext();
    const audio = await videoGenerator.mixToOneAudio();
    audioSource = audioContext.createBufferSource();
    if (audio !== null) {
        audioSource.buffer = audio;
        audioSource.connect(audioContext.destination);
    }
    const frameDuration = 1000 / 10;
    const startTime = performance.now() - tlNow * 1000;
    const videoEndTime = storage.getVideoEndTime();
    audioSource.start(0, tlNow);
    playbackInterval = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;
        tlNow = Math.min(elapsed, videoEndTime);
        changeTimeline(tlStart, tlEnd, tlNow);
        videoGenerator.drawImage(tlNow);
        if (tlNow >= videoEndTime) {
            stopPlayback();
        }
    }, frameDuration);
}
function stopPlayback() {
    if (!isPlaying)
        return;
    isPlaying = false;
    if (playbackInterval !== null) {
        clearInterval(playbackInterval);
        playbackInterval = null;
    }
    if (audioSource !== null) {
        audioSource.stop();
        audioSource.disconnect();
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    changeTimeline(tlStart, tlEnd, tlNow);
}
function showProgressModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'progress-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>비디오 생성 중...</h2>
            <div class="progress-bar">
                <div class="progress" id="progress-bar"></div>
                <div class="progress-text" id="progress-text">0%</div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}
