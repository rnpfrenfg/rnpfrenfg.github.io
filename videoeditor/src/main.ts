import {VideoGenerator} from "./videoGenerator.js";
import { Logger } from "./Logger.js";
import {VideoProjectStorage,VideoTrackItem,VideoTrack,ContentType,Content,ContentEffect } from "./videotrack.js";
import { create } from "domain";
import { start } from "repl";

enum PropertyType{
    TrackItem,sidebarItem,trackheader
}

const imageInput: HTMLInputElement = document.getElementById('imageInput') as HTMLInputElement;
const createVideoButton: HTMLButtonElement = document.getElementById('createvideo') as HTMLButtonElement;
const addTrackButton: HTMLButtonElement = document.getElementById('addtrackbutton') as HTMLButtonElement;
const downloadLink: HTMLAnchorElement = document.getElementById('downloadLink') as HTMLAnchorElement;
const audioInput: HTMLInputElement = document.getElementById('audioInput') as HTMLInputElement;
const timelineNow = document.querySelector('.timeline-header .time') as HTMLDivElement;
const timelineStart = document.getElementById('header-starttime') as HTMLDivElement;
const timelineEnd = document.getElementById('header-endtime') as HTMLDivElement;
const timelineTrakcs: HTMLDivElement = document.getElementById('timeline-tracks') as HTMLDivElement;
const sidebar: HTMLDivElement = document.getElementById('sidebargrid') as HTMLDivElement;
const canvas: HTMLCanvasElement = document.getElementById('canvas') as HTMLCanvasElement;
const playhead: HTMLDivElement = document.getElementById('playhead') as HTMLDivElement;
const timelineruler: HTMLDivElement = document.getElementById('timelineruler') as HTMLDivElement;
const property: HTMLDivElement = document.getElementById('properties-panel') as HTMLDivElement;

const storage: VideoProjectStorage = new VideoProjectStorage();
const videoGenerator: VideoGenerator = new VideoGenerator(storage,canvas);
let selectedElement: HTMLElement | null = null;// for property
let selectedElementType: PropertyType = PropertyType.TrackItem;

let tlStart = 0;
let tlEnd = 0;
let tlNow = 0;

drawStorage(storage);

imageInput.addEventListener('change', handleImageInput);
audioInput.addEventListener('change', handleAudioInput);
addTrackButton.addEventListener('click',clickAddLineButton);
createVideoButton.addEventListener('click', async () => {
    try {
        createVideo();
    } catch (error) {
        console.error('Video creation failed:', error);
    }
});
let isRulerDragging = false;
timelineruler.draggable=false;
timelineruler.addEventListener('mousedown', (e: MouseEvent) => {
    isRulerDragging = true;
    controlTimeline(e);
});
timelineruler.addEventListener('mousemove', (e: MouseEvent) => {
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

sidebar.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if(target.parentElement == null)return;
    if (target.classList.contains('click-layer')) {
        selectedElement = target.parentElement;
        selectedElementType = PropertyType.sidebarItem;
        updatePropertiesPanel(target.parentElement);
    }
});
timelineTrakcs.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    console.log(target);
    if (target.classList.contains('timeline-trackheader')) {
        if(target == null) return;
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

function drawStorage(storage: VideoProjectStorage){
    sidebar.innerHTML='';
    for(const content of storage.getContents()){
        drawContent(content.name,content.id,content.type);
    }

    changeTimeline(0,storage.getVideoEndTime() + 5);
    timelineTrakcs.innerHTML = '';
    storage.getTracks().forEach(track => {
        const trackDiv = createVideoTrackDiv(track.name,track.id);
        timelineTrakcs.appendChild(trackDiv);
        track.contents.forEach(content => renderVideoTrackItem(content, trackDiv));
        setupDragAndDrop(trackDiv);
    });
}

function updatePropertiesPanel(element: HTMLElement) {

    if (selectedElementType === PropertyType.TrackItem) {
        const trackItem = storage.getTracks()
            .flatMap(track => track.contents)
            .find(item => item.id === element.id);
        const duration = trackItem ? trackItem.duration : 2;
        const startTime = trackItem ? trackItem.start : 0;
        property.innerHTML = `
            <div>
                <label>Duration (s):</label>
                <input type="number" step="0.1" value="${duration}" data-prop="duration">
            </div>
            <div>
                <label>Start Time (s):</label>
                <input type="number" step="0.1" value="${startTime}" data-prop="startTime">
            </div>
        `;
    } else if (selectedElementType === PropertyType.trackheader) {
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
                </select>
            </div>
        `;
    } else if (selectedElementType === PropertyType.sidebarItem) {
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

function applyPropertyChange() {//todo : if storage size big >>> 
    if (!selectedElement) return;

    const properties: { [key: string]: string } = {};
    const inputs = property.querySelectorAll('input[data-prop], select[data-prop]');
    const id = selectedElement.id;

    inputs.forEach((t) => {
        const input = t as HTMLInputElement;
        const propName = input.dataset.prop;
        if (propName) {
            properties[propName] = input.value;
        }
    });

    if (selectedElementType === PropertyType.TrackItem) {
        const duration = properties['duration'];
        const startTime = properties['startTime'];

        storage.editTrackItem(id,parseFloat(startTime),parseFloat(duration));
        drawStorage(storage);
    } else if (selectedElementType === PropertyType.trackheader) {
        const name = properties['name'];
        const contentType = properties['contentType'] as ContentType;

        const track = storage.getVideoTrack(selectedElement.id);
        if(track == null) return;
        if (track && track.type !== contentType) {
            track.contents=[];
            track.type = contentType;
        }
        track.name = name;
        drawStorage(storage);
    } else if (selectedElementType === PropertyType.sidebarItem) {
        const name = properties['name'];
        const content = storage.getContent(selectedElement.id);
        if (content) {
            content.name = name;
            drawStorage(storage);
        }
    }
}

function drawContent(name: string, id:string, type:ContentType){
    const div = document.createElement('div');
    div.className = 'file';
    div.id = id.toString();

    const clicklayer = document.createElement('div');
    clicklayer.className = 'click-layer';
    const iconDiv = document.createElement('div');
    iconDiv.className = 'icon';

    if(type===ContentType.image){
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
    else if(type==ContentType.audio){
        iconDiv.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12l8-4-8-4z"></path></svg>'
    }

    const fileNameDiv = document.createElement('span');
    fileNameDiv.className = 'file-name';
    fileNameDiv.textContent = name.length > 10 ? name.slice(0, 10) + '...' : name;

    div.appendChild(clicklayer);
    div.appendChild(iconDiv);
    div.appendChild(fileNameDiv);
    sidebar.appendChild(div);
}

async function handleImageInput(event: Event): Promise<void> {
    const files = (event.target as HTMLInputElement).files;
    if (!files?.length) return;

    for(const file of Array.from(files || [])){
        if (file.type.startsWith('image/')) {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            await new Promise(resolve => img.onload = resolve);
            storage.createContent(ContentType.image, img);
            drawStorage(storage);
        }
        else{
            Logger.log(`이미지 파일이 아닙니다.`);
        }
    }
}

async function handleAudioInput(event: Event): Promise<void> {
    const files = (event.target as HTMLInputElement).files;
    if(!files?.length)return;

    const file = files[0];
    if (!files[0].type.startsWith('audio/')) {
        Logger.log('오디오 파일이 아닙니다.');
        return;
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        storage.createContent(ContentType.audio,audioBuffer);
        drawStorage(storage);
        Logger.log('오디오 파일이 업로드되었습니다.');
    } catch (e) {
        Logger.log('오디오 로딩 실패:', (e as Error).message);
    }
}

async function createVideo(){
    createVideoButton.disabled = true;
    const blob = await videoGenerator.createVideo();
    if(blob == null){
        Logger.log('영상 생성 실패');
        return;
    }
    URL.revokeObjectURL(downloadLink.href);
    const videoUrl = URL.createObjectURL(blob);
    downloadLink.href = videoUrl;
    downloadLink.style.display = 'inline-block';
    createVideoButton.disabled = false;
}

function clickAddLineButton(){
    storage.createTrack(ContentType.image, 'image');
    drawStorage(storage);
}

function changeTimeline(start: number, end: number, now: number = tlNow) {
    timelineNow.textContent=now.toString();
    timelineStart.textContent=start.toString();
    timelineEnd.textContent=end.toString();

    playhead.style.left = `${videoTimeToClient(now)}px`;

    tlStart = start;
    tlEnd = end;
    tlNow = now;
    videoGenerator.drawImage(now);
}

function createVideoTrackDiv(name: string, id: string): HTMLDivElement {
    const trackDiv = document.createElement('div');
    trackDiv.id= id.toString();
    trackDiv.className = 'timeline-track';

    const labelDiv = document.createElement('div');
    labelDiv.className = 'timeline-trackheader';
    labelDiv.id=id;
    const indentDiv = document.createElement('div');
    indentDiv.className = 'indent';
    const iconDiv = document.createElement('div');

    const track = storage.getVideoTrack(id);
    let svgContent = '';
    if (track) {
        switch (track.type) {
            case ContentType.image:
                svgContent = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="9" cy="9" r="2"></circle>
                        <path d="M21 15l-3-3-4 4-2-2-3 3"></path>
                    </svg>
                `;
                break;
            case ContentType.audio:
                svgContent = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                    </svg>
                `;
                break;
            case ContentType.text:
                svgContent = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a3e4db" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 6H3"></path>
                        <path d="M21 12H3"></path>
                        <path d="M15 18H3"></path>
                        <path d="M21 6v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6"></path>
                    </svg>
                `;
                break;
            default:
                svgContent = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f472b6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                    </svg>
                `;
        }
    }
    iconDiv.innerHTML = svgContent;
    const span = document.createElement('span');
    span.textContent = name;

    labelDiv.appendChild(indentDiv);
    labelDiv.appendChild(iconDiv);
    labelDiv.appendChild(span);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'content';
    
    const innerDiv = document.createElement('div');
    const trackSpan = document.createElement('span');
    innerDiv.appendChild(trackSpan);
    trackDiv.appendChild(labelDiv);
    trackDiv.appendChild(contentDiv);
    return trackDiv;
}

let draggedItem: HTMLElement | null = null;
sidebar.addEventListener('dragstart', (e: DragEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('click-layer')) {
        draggedItem = target.parentElement;
        e.dataTransfer?.setData('text/plain', target.id);
    }
});
sidebar.addEventListener('dragend', () => {
    draggedItem = null;
});
function setupDragAndDrop(timeline: HTMLDivElement) {
    timeline.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
    });

    timeline.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        if (draggedItem) {
            const trackID = timeline.id;
            const content = storage.getContent(draggedItem.id);
            if (content) {
                storage.addContentToTrack(trackID,content, 2);
                drawStorage(storage);
            }
            draggedItem = null;
        }
    });
}

function renderVideoTrackItem(content: VideoTrackItem, track: HTMLDivElement) {
    const contentDiv = document.createElement('div');
    contentDiv.className = 'track-bar';
    let startPos = videoTimeToClient(content.start);
    contentDiv.style.left = `${startPos}px`;
    contentDiv.style.width = `${videoTimeToClient(content.duration + content.start) - startPos}px`;
    contentDiv.style.backgroundColor = '#34d399';
    contentDiv.innerHTML = `<span>${content.content.name}</span>`;
    contentDiv.id=content.id;

    const contentArea = track.querySelector('.content') as HTMLDivElement;
    if (contentArea) {
        contentArea.appendChild(contentDiv);
    }
}

function controlTimeline(e: MouseEvent){
    const rect = timelineruler.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let now = tlStart + (x/(rect.right-rect.left))*(tlEnd-tlStart);
    if(now<0)now=0;
    changeTimeline(tlStart, tlEnd, now)
}

function videoTimeToClient(now: number){
    const rect = timelineruler.getBoundingClientRect();
    const ret = ((now-tlStart)/(tlEnd-tlStart))*(rect.right-rect.left);
    return ret;
}