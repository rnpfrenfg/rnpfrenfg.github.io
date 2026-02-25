import { Logger } from "./Logger.js";
import * as MP4Box from "./lib/mp4box.all.js";
import { ContentType, VideoEffectType, } from "./videotrack.js";
class CGlContext {
    constructor(canvas) {
        const gl = canvas.getContext('webgl');
        if (!gl) {
            Logger.log('WebGL을 지원하지 않는 브라우저');
            throw new Error('WebGL을 지원하지 않는 브라우저');
        }
        this.gl = gl;
        const vertexShaderSource = `
            precision mediump float;
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            uniform vec2 u_resolution;
            uniform vec2 u_position;
            uniform vec2 u_scale;
            varying vec2 v_texCoord;
            void main() {
                vec2 scaledPos = a_position * u_scale + u_position;
                vec2 clipSpace = (scaledPos / u_resolution) * 2.0 - 1.0;
                gl_Position = vec4(clipSpace * vec2(1, -1), 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
        const fragmentShaderSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform int u_effect; // 0: default, 1: neon, 2: glitch
            uniform float u_time;
            uniform mediump vec2 u_resolution;

            float random(vec2 st) {
                return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
            }
            vec2 randomOffset(float seed) {
                float rx = random(vec2(seed,seed)) * 50.0 - 25.0;
                float ry = random(vec2(seed + 1.0,seed + 1.0)) * 50.0 - 25.0;
                return vec2(rx, ry);
            }

            vec4 neonEffect(vec2 texCoord) {
                vec3 neonColor = vec3(1.0, 0.0, 0.0);
                vec3 textColor = vec3(1.0);
                const float radius = 0.02;

                float glow = 0.0;
                const float step = radius / 10.0;
                vec2 pixelSize = 1.0 / u_resolution * vec2(u_resolution.x / u_resolution.y, 1.0);
                for (float x = -radius; x <= radius; x += step) {
                    for (float y = -radius; y <= radius; y += step) {
                        vec2 offset = vec2(x, y) * pixelSize;
                        float dist = length(offset);
                        if (dist < radius) {
                            glow = max(glow, texture2D(u_image, texCoord + offset).a * (1.0 - dist / radius));
                        }
                    }
                }

                vec3 color = neonColor * glow * 1.5;
                color += textColor * texture2D(u_image, texCoord).a;

                return vec4(color, glow * 1.5);
            }

            vec4 glitchEffect(vec2 texCoord) {
                float stepIndex = floor(u_time / 0.33);
                vec2 glitchOffset = randomOffset(stepIndex);
                
                vec2 roffset = glitchOffset / u_resolution;
                vec2 goffset = (glitchOffset * 0.5) / u_resolution;
                vec2 boffset = -glitchOffset / u_resolution;

                float noise = random(texCoord * 10.0);
                float glitchStrength = step(0.9, fract(u_time * 2.0));

                float r = texture2D(u_image, texCoord + roffset).r;
                float g = texture2D(u_image, texCoord + goffset).g;
                float b = texture2D(u_image, texCoord + boffset).b;
                float a = 1.0;

                float scanline = mod(floor(texCoord.y * u_resolution.y * (0.5 + noise * 0.2)), 2.0);
                vec3 color = vec3(r, g, b);
                if (scanline < 1.0 && noise > 0.7) {
                    color *= 0.6 + noise * 0.2;
                }

                if (noise > 0.95 && glitchStrength > 0.5) {
                    color += vec3(random(texCoord + u_time * 0.2) * 0.5);
                }

                return vec4(color, a);
            }

            void main() {
                if (u_effect == 1) {
                    gl_FragColor = neonEffect(v_texCoord);
                } else if (u_effect == 2) {
                    gl_FragColor = glitchEffect(v_texCoord);
                } else {
                    gl_FragColor = texture2D(u_image, v_texCoord);
                }
            }
        `;
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexShaderSource);
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            Logger.log('Vertex Shader 컴파일 실패:', gl.getShaderInfoLog(vertexShader));
            throw new Error('Vertex Shader 컴파일 실패');
        }
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentShaderSource);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            Logger.log('Fragment Shader 컴파일 실패:', gl.getShaderInfoLog(fragmentShader));
            throw new Error('Fragment Shader 컴파일 실패');
        }
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            Logger.log('Program 링크 실패:', gl.getProgramInfoLog(this.program));
            throw new Error('Program 링크 실패');
        }
        gl.useProgram(this.program);
        this.positionLocation = gl.getAttribLocation(this.program, 'a_position');
        this.texCoordLocation = gl.getAttribLocation(this.program, 'a_texCoord');
        this.resolutionLocation = gl.getUniformLocation(this.program, 'u_resolution');
        this.positionUniformLocation = gl.getUniformLocation(this.program, 'u_position');
        this.scaleLocation = gl.getUniformLocation(this.program, 'u_scale');
        this.imageLocation = gl.getUniformLocation(this.program, 'u_image');
        this.effectLocation = gl.getUniformLocation(this.program, 'u_effect');
        this.timeLocation = gl.getUniformLocation(this.program, 'u_time');
        const rectangle = new Float32Array([
            0.0, 0.0, 0.0, 0.0,
            1.0, 0.0, 1.0, 0.0,
            0.0, 1.0, 0.0, 1.0,
            1.0, 1.0, 1.0, 1.0
        ]);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, rectangle, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(this.positionLocation);
        gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(this.texCoordLocation);
        gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 16, 8);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        this.texture = gl.createTexture();
    }
    setViewport(width, height) {
        this.gl.viewport(0, 0, width, height);
        this.gl.uniform2f(this.resolutionLocation, width, height);
        if (this.resolutionLocation) {
            this.gl.uniform2f(this.resolutionLocation, width, height);
        }
    }
}
export class VideoGenerator {
    constructor(storage, canvas) {
        this.storage = storage;
        this.canvas = canvas;
        this.offscreenCanvas = new OffscreenCanvas(storage.getWidth(), storage.getHeight());
        this.doubleBuffering = new OffscreenCanvas(storage.getWidth(), storage.getHeight());
        this.glContext = new CGlContext(this.canvas);
        this.offscreenGlContext = new CGlContext(this.offscreenCanvas);
        this.dbGlContext = new CGlContext(this.doubleBuffering);
        this.resize(storage.getWidth(), storage.getHeight());
    }
    EffectToInt(eft) {
        for (const c of eft)
            return c.type === VideoEffectType.neon ? 1 : c.type === VideoEffectType.glitch ? 2 : 0;
        return 0;
    }
    async drawImage(now) {
        await this._drawImage(this.dbGlContext, now);
        const dbGl = this.dbGlContext.gl;
        const width = this.storage.getWidth();
        const height = this.storage.getHeight();
        const pixels = new Uint8Array(width * height * 4);
        dbGl.readPixels(0, 0, width, height, dbGl.RGBA, dbGl.UNSIGNED_BYTE, pixels);
        const gl = this.glContext.gl;
        const texture = gl.createTexture();
        gl.clearColor(1, 1, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0.0, 1.0,
            1.0, 1.0,
            0.0, 0.0,
            1.0, 0.0
        ]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(this.glContext.texCoordLocation);
        gl.vertexAttribPointer(this.glContext.texCoordLocation, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(this.glContext.positionUniformLocation, 0, 0);
        gl.uniform2f(this.glContext.scaleLocation, width, height);
        gl.uniform1i(this.glContext.imageLocation, 0);
        gl.uniform1i(this.glContext.effectLocation, 0);
        gl.uniform1f(this.glContext.timeLocation, now);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.deleteTexture(texture);
        gl.deleteBuffer(texCoordBuffer);
    }
    async _drawImage(glContext, now) {
        const gl = glContext.gl;
        gl.clearColor(1, 1, 1, 1);
        gl.clear(glContext.gl.COLOR_BUFFER_BIT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(glContext.imageLocation, 0);
        for (const line of this.storage.getTracks()) {
            if (line.type === ContentType.audio)
                continue;
            if (line.type === ContentType.text) {
                for (const item of line.items) {
                    if (!(item.start <= now && now < item.start + item.duration)) {
                        continue;
                    }
                    const fontSize = item.scale;
                    const textCanvas = new OffscreenCanvas(item.content.width + fontSize, item.content.height + 5 * 2);
                    const textCtx = textCanvas.getContext('2d');
                    if (!textCtx) {
                        continue;
                    }
                    const textContent = item.content;
                    const text = textContent.text;
                    const style = textContent.style;
                    const measure = textCtx.measureText(text);
                    textContent.width = measure.width * fontSize * 1.5;
                    textContent.height = fontSize * 15;
                    textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
                    textCtx.font = style.font;
                    textCtx.scale(fontSize, fontSize);
                    textCtx.fillStyle = style.color;
                    textCtx.strokeStyle = style.color;
                    textCtx.imageSmoothingEnabled = false;
                    textCtx.textAlign = 'left';
                    textCtx.textBaseline = 'top';
                    textCtx.fillText(text, fontSize, fontSize);
                    gl.bindTexture(gl.TEXTURE_2D, glContext.texture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
                    gl.uniform2f(glContext.positionUniformLocation, item.x, item.y);
                    gl.uniform2f(glContext.scaleLocation, item.scale * item.content.width, item.scale * item.content.height);
                    gl.uniform1i(glContext.effectLocation, this.EffectToInt(item.effect));
                    gl.uniform1f(glContext.timeLocation, now);
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                }
                continue;
            }
            for (const item of line.items) {
                if (!(item.start <= now && now < item.start + item.duration))
                    continue;
                if (line.type == ContentType.image) {
                    gl.bindTexture(gl.TEXTURE_2D, glContext.texture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, item.content.source);
                }
                else if (line.type === ContentType.mp4) {
                    gl.bindTexture(gl.TEXTURE_2D, glContext.texture);
                    const video = item.content.video;
                    video.currentTime = (now - item.start + item.offset);
                    await new Promise(resolve => video.addEventListener('seeked', resolve, { once: true }));
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
                }
                gl.uniform2f(glContext.positionUniformLocation, item.x, item.y);
                gl.uniform2f(glContext.scaleLocation, item.scale * item.content.width, item.scale * item.content.height);
                gl.uniform1i(glContext.effectLocation, this.EffectToInt(item.effect));
                gl.uniform1f(glContext.timeLocation, now);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
        }
    }
    async mixToOneAudio() {
        const storage = this.storage;
        let audioSampleRate = 0;
        let audioChannels = 0;
        let audioBuffers = [];
        let audioDuration = 0;
        for (const track of storage.getTracks()) {
            if (track.type === ContentType.audio) {
                for (const item of track.items) {
                    audioBuffers.push({
                        buffer: item.content.buffer,
                        start: item.start,
                        offset: item.offset,
                        duration: item.duration,
                    });
                    audioDuration = Math.max(audioDuration, item.start + item.duration);
                }
            }
            else if (track.type === ContentType.mp4) {
                for (const item of track.items) {
                    const mp4 = item.content;
                    if (mp4.audioBuffer === null)
                        continue;
                    Logger.log(String(item), String(mp4.audioBuffer));
                    audioBuffers.push({
                        buffer: mp4.audioBuffer,
                        start: item.start,
                        offset: item.offset,
                        duration: item.duration,
                    });
                    audioDuration = Math.max(audioDuration, item.start + item.duration);
                }
            }
        }
        if (audioBuffers.length === 0)
            return null;
        for (const audio of audioBuffers) {
            audioSampleRate = Math.max(audioSampleRate, audio.buffer.sampleRate);
            audioChannels = Math.max(audioChannels, audio.buffer.numberOfChannels);
        }
        let mixedAudioBuffer = null;
        const offlineContext = new OfflineAudioContext(audioChannels, audioDuration * audioSampleRate, audioSampleRate);
        for (const { buffer, start, duration, offset } of audioBuffers) {
            const source = offlineContext.createBufferSource();
            source.buffer = buffer;
            source.connect(offlineContext.destination);
            source.start(start, offset, duration);
        }
        mixedAudioBuffer = await offlineContext.startRendering();
        return mixedAudioBuffer;
    }
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.offscreenCanvas.width = width;
        this.offscreenCanvas.height = height;
        this.doubleBuffering.width = width;
        this.doubleBuffering.height = height;
        this.glContext.setViewport(this.storage.getWidth(), this.storage.getHeight());
        this.offscreenGlContext.setViewport(this.storage.getWidth(), this.storage.getHeight());
        this.dbGlContext.setViewport(this.storage.getWidth(), this.storage.getHeight());
    }
    async createVideo(onProgress, abortSignal) {
        if (!this.isWorkerExportSupported()) {
            Logger.log("Worker/WebCodecs export path unavailable.");
            return null;
        }
        try {
            const { dto, transferables } = await this.buildWorkerProjectDto();
            const mp4Buffer = await this.runExportWorker(dto, transferables, (p) => {
                if (onProgress)
                    onProgress(Math.max(0, Math.min(100, p)), "worker");
            }, abortSignal);
            if (onProgress)
                onProgress(100, "encode");
            return new Blob([mp4Buffer], { type: "video/mp4" });
        }
        catch (error) {
            Logger.log("Worker export failed:", error.message);
            return null;
        }
    }
    isWorkerExportSupported() {
        return (typeof Worker !== "undefined" &&
            typeof OffscreenCanvas !== "undefined" &&
            typeof VideoEncoder !== "undefined");
    }
    async ensureVideoMetadata(video) {
        if (video.readyState >= 1 && Number.isFinite(video.duration))
            return;
        await new Promise((resolve, reject) => {
            const onLoaded = () => {
                cleanup();
                resolve();
            };
            const onError = () => {
                cleanup();
                reject(new Error("Failed to load video metadata."));
            };
            const cleanup = () => {
                video.removeEventListener("loadedmetadata", onLoaded);
                video.removeEventListener("error", onError);
            };
            video.addEventListener("loadedmetadata", onLoaded, { once: true });
            video.addEventListener("error", onError, { once: true });
        });
    }
    extractMp4Descriptions(bytes) {
        return new Promise((resolve) => {
            const mp4File = MP4Box.createFile();
            let resolved = false;
            const findBoxPayload = (buffer, boxType) => {
                const data = new DataView(buffer);
                const typeBytes = new Uint8Array(4);
                for (let i = 0; i + 8 <= data.byteLength; i++) {
                    typeBytes[0] = data.getUint8(i + 0);
                    typeBytes[1] = data.getUint8(i + 1);
                    typeBytes[2] = data.getUint8(i + 2);
                    typeBytes[3] = data.getUint8(i + 3);
                    const type = String.fromCharCode(...typeBytes);
                    if (type !== boxType)
                        continue;
                    const size = data.getUint32(i - 4, false);
                    if (size < 8)
                        continue;
                    const start = i + 4;
                    const end = (i - 4) + size;
                    if (end > data.byteLength || start >= end)
                        continue;
                    return buffer.slice(start, end);
                }
                return undefined;
            };
            const toArrayBuffer = (value) => {
                if (!value)
                    return undefined;
                if (value instanceof ArrayBuffer)
                    return value;
                if (value instanceof Uint8Array) {
                    const copy = new Uint8Array(value.byteLength);
                    copy.set(value);
                    return copy.buffer;
                }
                if (value.data)
                    return toArrayBuffer(value.data);
                if (value.buffer instanceof ArrayBuffer)
                    return value.buffer;
                return undefined;
            };
            const trackDescriptionFromInfo = (trackInfo) => {
                const candidates = [
                    trackInfo?.description,
                    trackInfo?.avcC,
                    trackInfo?.hvcC,
                    trackInfo?.vpcC,
                    trackInfo?.av1C,
                    trackInfo?.esds?.data,
                ];
                for (const candidate of candidates) {
                    const buffer = toArrayBuffer(candidate);
                    if (buffer)
                        return buffer;
                }
                return undefined;
            };
            const findTrackEntry = (trackId) => {
                const traks = mp4File?.moov?.traks;
                if (!Array.isArray(traks))
                    return null;
                for (const trak of traks) {
                    const id = trak?.tkhd?.track_id ?? trak?.tkhd?.trackId;
                    if (id !== trackId)
                        continue;
                    const entries = trak?.mdia?.minf?.stbl?.stsd?.entries;
                    if (Array.isArray(entries) && entries.length > 0) {
                        return entries[0];
                    }
                }
                return null;
            };
            mp4File.onError = () => {
                if (resolved)
                    return;
                resolved = true;
                resolve({});
            };
            mp4File.onReady = (info) => {
                const readyVideoTrack = info.videoTracks?.[0] || null;
                const readyAudioTrack = info.audioTracks?.[0] || null;
                const videoEntry = readyVideoTrack ? findTrackEntry(readyVideoTrack.id) : null;
                const audioEntry = readyAudioTrack ? findTrackEntry(readyAudioTrack.id) : null;
                const videoDescription = trackDescriptionFromInfo(readyVideoTrack) ||
                    trackDescriptionFromInfo(videoEntry);
                if (resolved)
                    return;
                resolved = true;
                const fallbackVideoDescription = videoDescription ?? findBoxPayload(bytes, "avcC");
                if (!videoDescription && fallbackVideoDescription) {
                    Logger.log(`Mp4 avcC extracted from raw bytes: ${fallbackVideoDescription.byteLength} bytes`);
                }
                resolve({
                    videoDescription: fallbackVideoDescription,
                });
            };
            const copy = bytes.slice(0);
            copy.fileStart = 0;
            mp4File.appendBuffer(copy);
            mp4File.flush();
        });
    }
    async buildWorkerProjectDto() {
        const transferables = [];
        const imageAssets = [];
        const textAssets = [];
        const mp4Assets = [];
        const audioAssets = [];
        for (const content of this.storage.getContents()) {
            if (content.type === ContentType.image) {
                const imageContent = content;
                const bitmap = await createImageBitmap(imageContent.source);
                imageAssets.push({
                    id: imageContent.id,
                    name: imageContent.name,
                    width: imageContent.width,
                    height: imageContent.height,
                    bitmap,
                });
                transferables.push(bitmap);
                continue;
            }
            if (content.type === ContentType.text) {
                const textContent = content;
                textAssets.push({
                    id: textContent.id,
                    name: textContent.name,
                    width: textContent.width,
                    height: textContent.height,
                    text: textContent.text,
                    style: {
                        font: textContent.style.font,
                        fontSize: textContent.style.fontSize,
                        color: textContent.style.color,
                    },
                });
                continue;
            }
            if (content.type === ContentType.mp4) {
                const mp4Content = content;
                const video = mp4Content.video;
                await this.ensureVideoMetadata(video);
                let bytes;
                try {
                    const response = await fetch(video.currentSrc || video.src);
                    bytes = await response.arrayBuffer();
                }
                catch (error) {
                    Logger.log("Mp4 fetch failed:", error.message);
                    continue;
                }
                const { videoDescription } = await this.extractMp4Descriptions(bytes);
                mp4Assets.push({
                    id: mp4Content.id,
                    name: mp4Content.name,
                    width: mp4Content.width,
                    height: mp4Content.height,
                    bytes,
                    videoDescription,
                });
                transferables.push(bytes);
                continue;
            }
            if (content.type === ContentType.audio) {
                const audioContent = content;
                const channels = [];
                for (let channelIndex = 0; channelIndex < audioContent.buffer.numberOfChannels; channelIndex++) {
                    const channelData = audioContent.buffer.getChannelData(channelIndex);
                    const copy = new Float32Array(channelData.length);
                    copy.set(channelData);
                    channels.push(copy.buffer);
                    transferables.push(copy.buffer);
                }
                audioAssets.push({
                    id: audioContent.id,
                    name: audioContent.name,
                    sampleRate: audioContent.buffer.sampleRate,
                    numberOfChannels: audioContent.buffer.numberOfChannels,
                    length: audioContent.buffer.length,
                    channels,
                });
            }
        }
        const tracks = this.storage.getTracks().map((track) => ({
            id: track.id,
            name: track.name,
            type: track.type,
            items: track.items.map((item) => ({
                id: item.id,
                contentId: item.content.id,
                start: item.start,
                duration: item.duration,
                offset: item.offset,
                x: item.x,
                y: item.y,
                scale: item.scale,
                effects: item.effect.map((effect) => ({
                    type: effect.type,
                    intensity: Number(effect.intensity ?? 1),
                    range: Number(effect.range ?? 1),
                })),
            })),
        }));
        const dto = {
            width: this.storage.getWidth(),
            height: this.storage.getHeight(),
            fps: this.storage.getFPS(),
            duration: this.storage.getVideoEndTime(),
            tracks,
            images: imageAssets,
            texts: textAssets,
            mp4s: mp4Assets,
            audios: audioAssets,
        };
        return { dto, transferables };
    }
    runExportWorker(dto, transferables, onProgress, abortSignal) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(new URL("./videoGenerator.worker.js", import.meta.url), { type: "module" });
            const teardown = () => worker.terminate();
            let settled = false;
            const rejectOnce = (error) => {
                if (settled)
                    return;
                settled = true;
                teardown();
                reject(error);
            };
            const resolveOnce = (buffer) => {
                if (settled)
                    return;
                settled = true;
                teardown();
                resolve(buffer);
            };
            const onAbort = () => {
                const cancelMessage = { type: "cancel" };
                worker.postMessage(cancelMessage);
                rejectOnce(new Error("Export canceled"));
            };
            worker.onmessage = (event) => {
                const message = event.data;
                if (!message)
                    return;
                if (message.type === "debug") {
                    Logger.log(`Worker: ${message.message}`);
                    return;
                }
                if (message.type === "progress") {
                    if (onProgress)
                        onProgress(message.progress);
                    return;
                }
                if (message.type === "done") {
                    if (abortSignal)
                        abortSignal.removeEventListener("abort", onAbort);
                    resolveOnce(message.buffer);
                    return;
                }
                if (message.type === "error") {
                    if (abortSignal)
                        abortSignal.removeEventListener("abort", onAbort);
                    rejectOnce(new Error(message.message));
                }
            };
            worker.onerror = (event) => {
                if (abortSignal)
                    abortSignal.removeEventListener("abort", onAbort);
                const where = `${event.filename || "worker"}:${event.lineno || 0}:${event.colno || 0}`;
                const msg = event.message ? `${event.message} @ ${where}` : `Export worker crashed @ ${where}`;
                rejectOnce(new Error(msg));
            };
            worker.onmessageerror = () => {
                if (abortSignal)
                    abortSignal.removeEventListener("abort", onAbort);
                rejectOnce(new Error("Worker message deserialization failed (onmessageerror). Check transferables/structured clone."));
            };
            if (abortSignal) {
                if (abortSignal.aborted) {
                    onAbort();
                    return;
                }
                abortSignal.addEventListener("abort", onAbort, { once: true });
            }
            const startMessage = { type: "start", project: dto };
            worker.postMessage(startMessage, transferables);
        });
    }
}
