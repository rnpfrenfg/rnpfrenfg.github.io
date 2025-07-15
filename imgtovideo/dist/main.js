import { VideoGenerator } from "./videoGenerator.js";
import { Logger } from "./Logger.js";
let imageInput = document.getElementById('imageInput');
let createVideoButton = document.getElementById('createVideo');
let previewContainer = document.getElementById('preview');
let downloadLink = document.getElementById('downloadLink');
let canvas = document.getElementById('canvas');
let logger = new Logger('error');
const videoGenerator = new VideoGenerator(1280, 720, canvas, logger);
imageInput.addEventListener('change', handleImageInput.bind(this));
createVideoButton.addEventListener('click', createVideo.bind(this));
async function handleImageInput(event) {
    previewContainer.innerHTML = '';
    downloadLink.style.display = 'none';
    const files = event.target.files;
    if (!files)
        return;
    let validContents = 0;
    for (const file of Array.from(files || [])) {
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
async function createVideo() {
    createVideoButton.disabled = true;
    let blob = await videoGenerator.createVideo();
    if (blob == null)
        return;
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.style.display = 'inline-block';
    createVideoButton.disabled = false;
}
