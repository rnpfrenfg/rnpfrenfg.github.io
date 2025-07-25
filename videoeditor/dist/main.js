import { VideoGenerator } from "./videoGenerator.js";
import { Logger } from "./Logger.js";
import { VideoProjectStorage, ContentType } from "./videotrack.js";
let imageInput = document.getElementById('imageInput');
let createVideoButton = document.getElementById('createvideo');
let addTrackButton = document.getElementById('addtrackbutton');
let downloadLink = document.getElementById('downloadLink');
let audioInput = document.getElementById('audioInput');
const timelineNow = document.querySelector('.timeline-header .time');
const timelineStart = document.getElementById('header-starttime');
const timelineEnd = document.getElementById('header-endtime');
const timelineTrakcs = document.getElementById('timeline-tracks');
let sidebar = document.getElementById('sidebargrid');
let canvas = document.getElementById('canvas');
const storage = new VideoProjectStorage();
const videoGenerator = new VideoGenerator(storage, canvas);
drawStorage(storage);
changeTimeline(0, 30, 3);
imageInput.addEventListener('change', handleImageInput.bind(this));
audioInput.addEventListener('change', handleAudioInput);
addTrackButton.addEventListener('click', clickAddLineButton.bind(this));
createVideoButton.addEventListener('click', async () => {
    try {
        await createVideo.call(this);
    }
    catch (error) {
        console.error('Video creation failed:', error);
    }
});
function drawStorage(storage) {
    let now = 0;
    changeTimeline(0, storage.getVideoEndTime() + 5, now);
    videoGenerator.drawImage(now);
    sidebar.innerHTML = '';
    for (const content of storage.getContents()) {
        drawContent(content.name, content.id, content.type);
    }
    timelineTrakcs.innerHTML = '';
    for (const track of storage.getTracks()) {
        const trackDiv = createVideoTrackDiv(track.name, track.id);
        timelineTrakcs.appendChild(trackDiv);
        for (const content of track.contents) {
            renderVideoTrackItem(content, trackDiv);
        }
        setupDragAndDrop(sidebar, trackDiv);
    }
}
function handleClickTrack() {
}
function handleClickTrackItem() {
}
function handleClickSidebarItem() {
}
function drawContent(name, id, type) {
    const div = document.createElement('div');
    div.className = 'file';
    div.id = id.toString();
    const iconDiv = document.createElement('div');
    iconDiv.className = 'icon';
    if (type === ContentType.image) {
        iconDiv.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"></path>
                <path d="M14 3v5h5"></path>
                <path d="M16 13H8"></path>
                <path d="M16 17H8"></path>
                <path d="M10 9H8"></path>
            </svg>
        `;
    }
    else if (type == ContentType.audio) {
        iconDiv.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12l8-4-8-4z"></path></svg>';
    }
    const fileNameDiv = document.createElement('div');
    fileNameDiv.className = 'file-name';
    fileNameDiv.textContent = name.length > 10 ? name.slice(0, 10) + '...' : name;
    div.appendChild(iconDiv);
    div.appendChild(fileNameDiv);
    sidebar.appendChild(div);
}
async function handleImageInput(event) {
    const files = event.target.files;
    if (!files)
        return;
    for (const file of Array.from(files || [])) {
        if (file.type.startsWith('image/')) {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            await new Promise(resolve => img.onload = resolve);
            storage.createContent(ContentType.image, img);
            drawStorage(storage);
        }
        else {
            Logger.log(`이미지 파일이 아닙니다.`);
        }
    }
}
async function handleAudioInput(event) {
    const files = event.target.files;
    if (files === null)
        return;
    const file = files[0];
    if (!files[0].type.startsWith('audio/')) {
        Logger.log('오디오 파일이 아닙니다.');
        return;
    }
    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        storage.createContent(ContentType.audio, audioBuffer);
        drawStorage(storage);
        Logger.log('오디오 파일이 업로드되었습니다.');
    }
    catch (e) {
        Logger.log('오디오 로딩 실패:', e.message);
    }
}
async function createVideo() {
    createVideoButton.disabled = true;
    let blob = await videoGenerator.createVideo();
    if (blob == null) {
        Logger.log('영상 생성 실패');
        return;
    }
    if (!createVideoButton.disabled) {
        URL.revokeObjectURL(downloadLink.href);
    }
    const videoUrl = URL.createObjectURL(blob);
    downloadLink.href = videoUrl;
    downloadLink.style.display = 'inline-block';
    createVideoButton.disabled = false;
}
function clickAddLineButton() {
    storage.createTrack(ContentType.image);
    drawStorage(storage);
}
function changeTimeline(start, end, now) {
    timelineNow.textContent = now.toString();
    timelineStart.textContent = start.toString();
    timelineEnd.textContent = end.toString();
}
function createVideoTrackDiv(name, id) {
    const trackDiv = document.createElement('div');
    trackDiv.id = id.toString();
    trackDiv.className = 'timeline-track';
    const labelDiv = document.createElement('div');
    labelDiv.className = 'timeline-trackheader';
    const indentDiv = document.createElement('div');
    indentDiv.className = 'indent';
    const iconDiv = document.createElement('div');
    iconDiv.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f472b6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
        </svg>
    `;
    const span = document.createElement('span');
    span.textContent = name;
    labelDiv.appendChild(indentDiv);
    labelDiv.appendChild(iconDiv);
    labelDiv.appendChild(span);
    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    const trackBarDiv = document.createElement('div');
    trackBarDiv.className = 'track-bar';
    const innerDiv = document.createElement('div');
    const trackSpan = document.createElement('span');
    innerDiv.appendChild(trackSpan);
    trackBarDiv.appendChild(innerDiv);
    contentDiv.appendChild(trackBarDiv);
    trackDiv.appendChild(labelDiv);
    trackDiv.appendChild(contentDiv);
    return trackDiv;
}
function setupDragAndDrop(sidebar, timeline) {
    const sidebarItems = Array.from(sidebar.getElementsByClassName('file'));
    let draggedItem = null;
    sidebarItems.forEach(item => {
        item.draggable = true;
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            e.dataTransfer?.setData('text/plain', item.querySelector('.file-name')?.textContent || '');
        });
        item.addEventListener('dragend', () => {
            draggedItem = null;
        });
    });
    timeline.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    timeline.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedItem) {
            const line = timeline;
            handleDrop([draggedItem], line);
        }
    });
}
function handleDrop(sidebarItems, trackDiv) {
    console.log('Dropped items:', sidebarItems.map(item => item.querySelector('.file-name')?.textContent), 'to', trackDiv.id);
    const trackID = trackDiv.id;
    const track = storage.getVideoTrack(trackID);
    if (track === null)
        return;
    for (const itemDiv of sidebarItems) {
        const item = storage.getContent(itemDiv.id);
        if (item == null)
            continue;
        storage.addContentToTrack(trackID, item, 2);
    }
    drawStorage(storage);
}
function renderVideoTrackItem(content, track) {
    console.log(`start:${content.start}, duration:${content.duration}, trackID:${track.id}`);
    const contentDiv = document.createElement('div');
    contentDiv.className = 'track-bar';
    contentDiv.style.left = `${content.start * 50}px`;
    contentDiv.style.width = `${content.duration * 50}px`;
    contentDiv.style.backgroundColor = '#34d399';
    contentDiv.innerHTML = `<span>${content.duration}s</span>`;
    const contentArea = track.querySelector('.content');
    if (contentArea) {
        contentArea.appendChild(contentDiv);
    }
}
