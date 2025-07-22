import {VideoGenerator} from "./videoGenerator.js";
import { Logger } from "./Logger.js";
import { VideoLine,ContentType,Content,ContentEffect } from "./videoline.js";

let imageInput: HTMLInputElement = document.getElementById('imageInput') as HTMLInputElement;
let createVideoButton: HTMLButtonElement = document.getElementById('createVideo') as HTMLButtonElement;
let addTrackButton: HTMLButtonElement = document.getElementById('addtrackbutton') as HTMLButtonElement;
let downloadLink: HTMLAnchorElement = document.getElementById('downloadLink') as HTMLAnchorElement;
let audioInput: HTMLInputElement = document.getElementById('audioInput') as HTMLInputElement;
let audioPreview: HTMLAudioElement = document.getElementById('audioPreview') as HTMLAudioElement;
let videoPreview: HTMLVideoElement = document.getElementById('videoPreview') as HTMLVideoElement;
const timelineNow = document.querySelector('.timeline-header .time') as HTMLDivElement;
const timelineStart = document.getElementById('header-starttime') as HTMLDivElement;
const timelineEnd = document.getElementById('header-endtime') as HTMLDivElement;
const timelineTrakcs: HTMLDivElement = document.getElementById('timeline-tracks') as HTMLDivElement;
let sidebar: HTMLDivElement = document.getElementById('sidebargrid') as HTMLDivElement;
let canvas: HTMLCanvasElement = document.getElementById('canvas') as HTMLCanvasElement;

let __uid_ = 0;

const videoGenerator = new VideoGenerator(1280,720,canvas);

changeTimeline(0,30,3);

const line = createVideoLineDiv('test', createUID());
timelineTrakcs.appendChild(line);
const sampleContent: Content = { start: 5, duration: 3, type: ContentType.image, src: new Image(), effect: ContentEffect.DEFAULT };
renderTimelineContent(sampleContent, line);

setupDragAndDrop(sidebar, line);

imageInput.addEventListener('change', handleImageInput.bind(this));
audioInput.addEventListener('change', handleAudioInput);
//createVideoButton.addEventListener('click', createVideo.bind(this));
addTrackButton.addEventListener('click',clickAddLineButton.bind(this));

function createUID(): number{
    __uid_++;
    return __uid_;
}

function addContent(file: File, id:number){
    const div = document.createElement('div');
    div.className = 'file';
    div.id = id.toString();

    const iconDiv = document.createElement('div');
    iconDiv.className = 'icon';
    iconDiv.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"></path>
            <path d="M14 3v5h5"></path>
            <path d="M16 13H8"></path>
            <path d="M16 17H8"></path>
            <path d="M10 9H8"></path>
        </svg>
    `;

    const fileNameDiv = document.createElement('div');
    fileNameDiv.className = 'file-name';
    fileNameDiv.textContent = file.name.length > 10 ? file.name.slice(0, 10) + '...' : file.name;

    div.appendChild(iconDiv);
    div.appendChild(fileNameDiv);
    sidebar.appendChild(div);
}

async function handleImageInput(event: Event): Promise<void> {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;

    for(const file of Array.from(files || [])){
        if (file.type.startsWith('image/')) {
            //await new Promise(resolve => img.onload = resolve);
            addContent(file, createUID());
        }
        else{
            Logger.log(`이미지 파일이 아닙니다.`);
        }
    }
}

async function handleAudioInput(event: Event): Promise<void> {
    audioPreview.style.display = 'none';
    const files = (event.target as HTMLInputElement).files;
    if (!files || files.length === 0) {
        videoGenerator.clearAudioContents();
        return;
    }

    const file = files[0];
    if (!file.type.startsWith('audio/')) {
        Logger.log('오디오 파일이 아닙니다.');
        return;
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        videoGenerator.addAudioContent(audioBuffer,0,audioBuffer.duration);
        audioPreview.src = URL.createObjectURL(file);
        audioPreview.style.display = 'block';
        Logger.log('오디오 파일이 업로드되었습니다.');
    } catch (e) {
        Logger.log('오디오 로딩 실패:', (e as Error).message);
        videoGenerator.clearAudioContents();
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
        URL.revokeObjectURL(videoPreview.src);
    }

    const videoUrl = URL.createObjectURL(blob);
    videoPreview.src = videoUrl;
    videoPreview.style.display = 'block';
    downloadLink.href = videoUrl;
    downloadLink.style.display = 'inline-block';
    createVideoButton.disabled = false;
}

function clickAddLineButton(){
    const uid = createUID();
    const div = createVideoLineDiv(`test${uid}`,uid);
    timelineTrakcs.appendChild(div);
}

function changeTimeline(start: number, end: number, now: number) {
    timelineNow.textContent=now.toString();
    timelineStart.textContent=start.toString();
    timelineEnd.textContent=end.toString();
}

function createVideoLineDiv(name: string, id: number): HTMLDivElement {
    const trackDiv = document.createElement('div');
    trackDiv.id= id.toString();
    trackDiv.className = 'timeline-track';

    const labelDiv = document.createElement('div');
    labelDiv.className = 'label';
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

    console.log(trackDiv);
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
            const rect = timeline.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const start = Math.floor((x / 50) || 0);
            const content: Content = {
                start,
                duration: 2,
                type: ContentType.image,
                src: new Image(),
                effect: ContentEffect.DEFAULT,
            };
            const line = timeline;
            handleDrop([draggedItem], line, content);
            draggedItem.remove();
        }
    });
}

function handleDrop(sidebarItems: HTMLElement[], line: HTMLElement, content: Content) {
    console.log('Dropped items:', sidebarItems.map(item => item.querySelector('.file-name')?.textContent));
    console.log('Timeline:', line);
    console.log('Content:', content);
}

function renderTimelineContent(content: Content, track: HTMLDivElement) {
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