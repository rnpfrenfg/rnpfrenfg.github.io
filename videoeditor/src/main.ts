import {VideoGenerator} from "./videoGenerator.js";
import { Logger } from "./Logger.js";
import {VideoProjectStorage,VideoTrackItem,VideoTrack,ContentType,Content,ContentEffect } from "./videotrack.js";

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

const storage: VideoProjectStorage = new VideoProjectStorage();
const videoGenerator: VideoGenerator = new VideoGenerator(storage,canvas);

let tlStart = 0;
let tlEnd = 0;

drawStorage(storage);

imageInput.addEventListener('change', handleImageInput.bind(this));
audioInput.addEventListener('change', handleAudioInput);
addTrackButton.addEventListener('click',clickAddLineButton.bind(this));
createVideoButton.addEventListener('click', async () => {
    try {
        await createVideo.call(this);
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

function drawStorage(storage: VideoProjectStorage){
    sidebar.innerHTML='';
    for(const content of storage.getContents()){
        drawContent(content.name,content.id,content.type);
    }

    timelineTrakcs.innerHTML = '';
    for(const track of storage.getTracks()){
        const trackDiv = createVideoTrackDiv(track.name,track.id);
        timelineTrakcs.appendChild(trackDiv);
        for(const content of track.contents){
            renderVideoTrackItem(content,trackDiv);
        }
        
        setupDragAndDrop(sidebar, trackDiv);
    }

    changeTimeline(0,storage.getVideoEndTime() + 5, 0);
}

function handleClickTrack(){
    
}

function handleClickTrackItem(){

}

function handleClickSidebarItem(){

}

function drawContent(name: string, id:string, type:ContentType){
    const div = document.createElement('div');
    div.className = 'file';
    div.id = id.toString();

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

    const fileNameDiv = document.createElement('div');
    fileNameDiv.className = 'file-name';
    fileNameDiv.textContent = name.length > 10 ? name.slice(0, 10) + '...' : name;

    div.appendChild(iconDiv);
    div.appendChild(fileNameDiv);
    sidebar.appendChild(div);
}

async function handleImageInput(event: Event): Promise<void> {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;

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

async function handleControlRuler(){

}

async function handleAudioInput(event: Event): Promise<void> {
    const files = (event.target as HTMLInputElement).files;
    if(files===null)return;

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
    let blob: Blob|any = await videoGenerator.createVideo();
    if(blob == null){
        Logger.log('영상 생성 실패');
        return;
    }
    if(!createVideoButton.disabled){
        URL.revokeObjectURL(downloadLink.href);
    }

    const videoUrl = URL.createObjectURL(blob);
    downloadLink.href = videoUrl;
    downloadLink.style.display = 'inline-block';
    createVideoButton.disabled = false;
}

function clickAddLineButton(){
    storage.createTrack(ContentType.image);
    drawStorage(storage);
}

function changeTimeline(start: number, end: number, now: number) {
    timelineNow.textContent=now.toString();
    timelineStart.textContent=start.toString();
    timelineEnd.textContent=end.toString();

    tlStart = start;
    tlEnd = end;
    videoGenerator.drawImage(now);
}

function createVideoTrackDiv(name: string, id: string): HTMLDivElement {
    const trackDiv = document.createElement('div');
    trackDiv.id= id.toString();
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

function setupDragAndDrop(sidebar: HTMLDivElement, timeline: HTMLDivElement) {
    const sidebarItems: HTMLElement[] = Array.from(sidebar.getElementsByClassName('file')) as HTMLElement[];
    let draggedItem: HTMLElement | null = null;

    sidebarItems.forEach(item => {
        item.draggable = true;

        item.addEventListener('dragstart', (e: DragEvent) => {
            draggedItem = item;
            e.dataTransfer?.setData('text/plain', item.querySelector('.file-name')?.textContent || '');
        });

        item.addEventListener('dragend', () => {
            draggedItem = null;
        });
    });

    timeline.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
    });

    timeline.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        if (draggedItem) {
            const line = timeline;
            handleDrop([draggedItem], line);
        }
    });
}

function handleDrop(sidebarItems: HTMLElement[], trackDiv: HTMLElement) {
    console.log('Dropped items:', sidebarItems.map(item => item.querySelector('.file-name')?.textContent),'to',trackDiv.id);

    const trackID=trackDiv.id;
    const track = storage.getVideoTrack(trackID);
    if(track===null)return;
    for(const itemDiv of sidebarItems){
        const item = storage.getContent(itemDiv.id);
        if(item == null) continue;
        storage.addContentToTrack(trackID,item, 2);
    }
    drawStorage(storage);
}

function renderVideoTrackItem(content: VideoTrackItem, track: HTMLDivElement) {
    console.log(`start:${content.start}, duration:${content.duration}, trackID:${track.id}`);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'track-bar';
    contentDiv.style.left = `${content.start * 50}px`;
    contentDiv.style.width = `${content.duration * 50}px`;
    contentDiv.style.backgroundColor = '#34d399';
    contentDiv.innerHTML = `<span>${content.duration}s</span>`;

    const contentArea = track.querySelector('.content') as HTMLDivElement;
    if (contentArea) {
        contentArea.appendChild(contentDiv);
    }
}

function controlTimeline(e: MouseEvent){
    const rect = timelineruler.getBoundingClientRect();
    const x = e.clientX - rect.left;
    playhead.style.left = `${x}px`;

    console.log(tlStart,tlEnd,x,rect.right);
    let now = tlStart + (x/(rect.right-rect.left))*(tlEnd-tlStart);
    if(now<0)now=0;
    changeTimeline(tlStart, tlEnd, now)
}