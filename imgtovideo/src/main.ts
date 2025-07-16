import {VideoGenerator} from "./videoGenerator.js";
import { Logger } from "./Logger.js";

let imageInput: HTMLInputElement = document.getElementById('imageInput') as HTMLInputElement;
let createVideoButton: HTMLButtonElement = document.getElementById('createVideo') as HTMLButtonElement;
let previewContainer: HTMLDivElement = document.getElementById('preview') as HTMLDivElement;
let downloadLink: HTMLAnchorElement = document.getElementById('downloadLink') as HTMLAnchorElement;
let canvas: HTMLCanvasElement = document.getElementById('canvas') as HTMLCanvasElement;
let audioInput: HTMLInputElement = document.getElementById('audioInput') as HTMLInputElement;
let audioPreview: HTMLAudioElement = document.getElementById('audioPreview') as HTMLAudioElement;
let videoPreview: HTMLVideoElement = document.getElementById('videoPreview') as HTMLVideoElement;

let logger:Logger = new Logger('error');
const videoGenerator = new VideoGenerator(1280,720,canvas, logger);

imageInput.addEventListener('change', handleImageInput.bind(this));
audioInput.addEventListener('change', handleAudioInput);
createVideoButton.addEventListener('click', createVideo.bind(this));

async function handleImageInput(event: Event): Promise<void> {
    previewContainer.innerHTML = '';
    downloadLink.style.display = 'none';
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;

    let validContents:number = 0;
    for(const file of Array.from(files || [])){
        if (file.type.startsWith('image/')) {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.className = 'preview-image';
            
            await new Promise(resolve => img.onload = resolve);
            previewContainer.appendChild(img);
            videoGenerator.addImageContent(img, 2);
            validContents++;
        }
    }
    createVideoButton.disabled = validContents === 0;
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
        logger.log('오디오 파일 형식이 아닙니다.');
        return;
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        videoGenerator.addAudioContent(audioBuffer,0,audioBuffer.duration);
        audioPreview.src = URL.createObjectURL(file);
        audioPreview.style.display = 'block';
        logger.log('오디오 파일이 업로드되었습니다.');
    } catch (e) {
        logger.log('오디오 로딩 실패:', (e as Error).message);
        videoGenerator.clearAudioContents();
    }
}

async function createVideo(){
    createVideoButton.disabled = true;
    let blob: Blob|any = await videoGenerator.createVideo();
    if(blob == null){
        logger.log('영상 생성 실패');
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