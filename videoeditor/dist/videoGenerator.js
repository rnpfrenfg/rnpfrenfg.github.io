import { Logger } from "./Logger.js";
import { ContentType } from "./videotrack.js";
class CGlContext {
    constructor(canvas) {
        const gl = canvas.getContext('webgl');
        if (!gl) {
            Logger.log('WebGL을 지원하지 않는 브라우저');
            throw new Error('WebGL을 지원하지 않는 브라우저');
        }
        this.gl = gl;
        this.positionLocation = 0;
        this.texCoordLocation = 0;
        this.resolutionLocation = null;
        this.positionUniformLocation = null;
        this.scaleLocation = null;
        this.imageLocation = null;
        const vertexShaderSource = `
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
            void main() {
                gl_FragColor = texture2D(u_image, v_texCoord);
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
    }
}
export class VideoGenerator {
    //for performance
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
    async processLine(glContext, line, now) {
        const gl = glContext.gl;
        if (line.type == ContentType.audio)
            return;
        if (line.type === ContentType.text) {
            for (const con of line.contents) {
                if (!(con.start <= now && now < con.start + con.duration)) {
                    continue;
                }
                const textCanvas = new OffscreenCanvas(con.content.width, con.content.height);
                const textCtx = textCanvas.getContext('2d');
                if (!textCtx) {
                    continue;
                }
                const textSrc = con.content.src;
                const measure = textCtx.measureText(con.content.name);
                const fontSize = con.scale;
                con.content.width = measure.width * fontSize * 1.5;
                con.content.height = fontSize * 15;
                textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
                textCtx.font = `${textSrc.font}`;
                textCtx.scale(fontSize, fontSize);
                textCtx.fillStyle = textSrc.color;
                textCtx.textAlign = 'left';
                textCtx.textBaseline = 'top';
                textCtx.fillText(con.content.name, 0, 0);
                gl.bindTexture(gl.TEXTURE_2D, glContext.texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
                gl.uniform2f(glContext.positionUniformLocation, con.x, con.y);
                gl.uniform2f(glContext.scaleLocation, con.scale * con.content.width, con.scale * con.content.height);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
            return;
        }
        for (const con of line.contents) {
            if (!(con.start <= now && now < con.start + con.duration))
                continue;
            if (line.type == ContentType.image) {
                gl.bindTexture(gl.TEXTURE_2D, glContext.texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, con.content.src);
            }
            else if (line.type === ContentType.mp4) {
                gl.bindTexture(gl.TEXTURE_2D, glContext.texture);
                const video = con.content.src;
                video.currentTime = (now - con.start);
                await new Promise(resolve => video.addEventListener('seeked', resolve, { once: true }));
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
            }
            gl.uniform2f(glContext.positionUniformLocation, con.x, con.y);
            gl.uniform2f(glContext.scaleLocation, con.scale * con.content.width, con.scale * con.content.height);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
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
            await this.processLine(glContext, line, now);
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
                for (const content of track.contents) {
                    audioBuffers.push({
                        buffer: content.content.src,
                        start: content.start,
                        duration: content.duration,
                    });
                    audioDuration = Math.max(audioDuration, content.start + content.duration);
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
        for (const { buffer, start } of audioBuffers) {
            const source = offlineContext.createBufferSource();
            source.buffer = buffer;
            source.connect(offlineContext.destination);
            source.start(start);
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
    async createVideo(onProgress) {
        const storage = this.storage;
        const width = storage.getWidth();
        const height = storage.getHeight();
        const tracks = storage.getTracks();
        const totalVideoDuration = storage.getVideoEndTime();
        const fps = storage.getFPS();
        const functionStartTime = Date.now();
        this.resize(width, height);
        if (tracks.length === 0) {
            Logger.log('컨텐츠를 먼저 업로드하세요.');
            return null;
        }
        Logger.log('영상 생성 중');
        const mixedAudio = await this.mixToOneAudio();
        let audioSampleRate = 0;
        let audioChannels = 0;
        let audioBitrate = 128000;
        if (mixedAudio !== null) {
            audioSampleRate = mixedAudio.sampleRate;
            audioChannels = mixedAudio.numberOfChannels;
        }
        //init
        const muxerOptions = {
            target: new Mp4Muxer.ArrayBufferTarget(),
            video: {
                codec: 'avc',
                width: width,
                height: height,
            },
            fastStart: 'in-memory',
        };
        if (mixedAudio !== null) {
            muxerOptions.audio = {
                codec: 'aac',
                numberOfChannels: audioChannels,
                sampleRate: audioSampleRate,
            };
        }
        const muxer = new Mp4Muxer.Muxer(muxerOptions);
        const videoEncoder = new VideoEncoder({
            output: (chunk, meta) => {
                muxer.addVideoChunk(chunk, meta);
            },
            error: (e) => {
                Logger.log('비디오 인코딩 에러:', e.message);
            },
        });
        const encoderConfig = {
            codec: 'avc1.42001f',
            width: width,
            height: height,
            framerate: fps,
            bitrate: 8000000,
            hardwareAcceleration: 'prefer-hardware'
        };
        const support = await VideoEncoder.isConfigSupported(encoderConfig);
        if (!support.supported) {
            Logger.log('비디오 코덱이 지원되지 않습니다!');
            return null;
        }
        videoEncoder.configure(encoderConfig);
        Logger.log('이미지 처리 시작');
        let lastLogTime = Date.now();
        const totalMicroseconds = totalVideoDuration * 1000000;
        let frameCount = 0;
        //draw
        for (let timestamp = 0; timestamp < totalVideoDuration * 1000000; timestamp += 1000000 / fps) {
            await this._drawImage(this.offscreenGlContext, timestamp / 1000000);
            const frame = new VideoFrame(this.offscreenCanvas, {
                timestamp: timestamp,
                duration: fps,
            });
            frameCount++;
            videoEncoder.encode(frame, { keyFrame: frameCount % 2 == 1 });
            frame.close();
            const currentTime = Date.now();
            if (currentTime - lastLogTime >= 2000) {
                if (onProgress)
                    onProgress((timestamp / totalMicroseconds) * 100);
                lastLogTime = currentTime;
            }
        }
        //draw :: final frame // for some video player
        const frame = new VideoFrame(this.offscreenCanvas, { timestamp: totalVideoDuration * 1000000, duration: 0 });
        videoEncoder.encode(frame, { keyFrame: true });
        frame.close();
        await videoEncoder.flush();
        Logger.log('사운드 처리 시작');
        //audio
        if (mixedAudio) {
            const audioEncoder = new AudioEncoder({
                output: (chunk, meta) => {
                    muxer.addAudioChunk(chunk, meta);
                },
                error: (e) => {
                    Logger.log('오디오 인코딩 에러:', e.message);
                },
            });
            const audioConfig = {
                codec: 'mp4a.40.2',
                numberOfChannels: audioChannels,
                sampleRate: audioSampleRate,
                bitrate: audioBitrate,
            };
            const audioSupport = await AudioEncoder.isConfigSupported(audioConfig);
            if (!audioSupport.supported) {
                Logger.log('오디오 코덱이 지원되지 않습니다!');
                return null;
            }
            audioEncoder.configure(audioConfig);
            const numberOfFrames = mixedAudio.length;
            const channelData = new Float32Array(numberOfFrames * audioChannels);
            for (let i = 0; i < audioChannels; i++) {
                const channel = mixedAudio.getChannelData(i);
                for (let j = 0; j < numberOfFrames; j++) {
                    channelData[j * audioChannels + i] = j < channel.length ? channel[j] : 0;
                }
            }
            const audioData = new AudioData({
                format: 'f32',
                sampleRate: audioSampleRate,
                numberOfFrames,
                numberOfChannels: audioChannels,
                timestamp: 0,
                data: channelData,
            });
            audioEncoder.encode(audioData);
            audioData.close();
            await audioEncoder.flush();
        }
        //
        muxer.finalize();
        videoEncoder.close();
        const buffer = muxerOptions.target.buffer;
        if (!buffer) {
            Logger.log('비디오 생성 실패: 출력 버퍼가 비어 있습니다.');
            return null;
        }
        const blob = new Blob([buffer], { type: 'video/mp4' });
        if (onProgress)
            onProgress(100);
        Logger.log(`영상 생성 완료! 소요시간 ${(Date.now() - functionStartTime) / 1000}s`);
        return blob;
    }
}
