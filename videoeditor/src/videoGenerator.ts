import { Logger } from "./Logger.js";
import {VideoProjectStorage,VideoTrack, Content,ContentType, ContentEffect} from "./videotrack.js";

export class VideoGenerator {
    private canvas: HTMLCanvasElement;
    private storage: VideoProjectStorage;


    private gl: WebGLRenderingContext;
    private positionLocation: number = 0;
    private texCoordLocation: number = 0;
    private resolutionLocation: WebGLUniformLocation | null = null;
    private positionUniformLocation: WebGLUniformLocation | null = null;
    private scaleLocation: WebGLUniformLocation | null = null;
    private imageLocation: WebGLUniformLocation | null = null;

    constructor(storage: VideoProjectStorage, canvas: HTMLCanvasElement) {
        this.storage=storage;
        this.canvas = canvas;

        const gl = this.canvas.getContext('webgl');
        if (!gl) {
            Logger.log('WebGL을 지원하지 않는 브라우저');
            throw new Error('WebGL을 지원하지 않는 브라우저');
        }
        this.gl = gl;
        this.setupWebGL();
        this.resize(storage.getWidth(), storage.getHeight());
    }

    private setupWebGL() {
        const gl = this.gl;

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

        const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
        gl.shaderSource(vertexShader, vertexShaderSource);
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            Logger.log('Vertex Shader 컴파일 실패:', gl.getShaderInfoLog(vertexShader)!);
            return;
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fragmentShader, fragmentShaderSource);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            Logger.log('Fragment Shader 컴파일 실패:', gl.getShaderInfoLog(fragmentShader)!);
            return;
        }

        const program = gl.createProgram()!;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            Logger.log('Program 링크 실패:', gl.getProgramInfoLog(program)!);
            return;
        }
        gl.useProgram(program);

        this.positionLocation = gl.getAttribLocation(program, 'a_position');
        this.texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
        this.resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
        this.positionUniformLocation = gl.getUniformLocation(program, 'u_position');
        this.scaleLocation = gl.getUniformLocation(program, 'u_scale');
        this.imageLocation = gl.getUniformLocation(program, 'u_image');

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
    }

    private async processLine(gl: WebGLRenderingContext, line: VideoTrack, now: number){
        const width = this.storage.getWidth();
        const height = this.storage.getHeight();
        this.resize(width, height);

        if (line.type === ContentType.image) {
            for(const con of line.contents){
                if(!(con.start <= now && now < con.start + con.duration))
                    continue;

                if (ContentEffect.DEFAULT === ContentEffect.DEFAULT) {
                    const image:HTMLImageElement = con.content.src as HTMLImageElement;
                    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
                    const scaledWidth = image.naturalWidth * scale;
                    const scaledHeight = image.naturalHeight * scale;
                    const offsetX = (width - scaledWidth) / 2;
                    const offsetY = (height - scaledHeight) / 2;

                    const texture = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

                    gl.uniform2f(this.positionUniformLocation, offsetX, offsetY);
                    gl.uniform2f(this.scaleLocation, scaledWidth, scaledHeight);
                    gl.uniform1i(this.imageLocation, 0);
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                    
                    gl.deleteTexture(texture);
                }
            }
        }
        else if(line.type === ContentType.mp4){
            for(const con of line.contents){
                if (!(con.start <= now && now < con.start + con.duration)) continue;

                const video: HTMLVideoElement = con.content.src as HTMLVideoElement;
                video.currentTime = (now - con.start);
                video.muted = true;

                const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
                const scaledWidth = video.videoWidth * scale;
                const scaledHeight = video.videoHeight * scale;
                const offsetX = (width - scaledWidth) / 2;
                const offsetY = (height - scaledHeight) / 2;

                const offscreen = new OffscreenCanvas(video.videoWidth, video.videoHeight);
                const ctx = offscreen.getContext('2d')!;
                video.currentTime = (now - con.start);
                await new Promise(resolve => video.addEventListener('seeked', resolve, { once: true }));
                ctx.drawImage(video, 0, 0);
                const bitmap = offscreen.transferToImageBitmap();

                const texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
                bitmap.close();
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

                gl.uniform2f(this.positionUniformLocation, offsetX, offsetY);
                gl.uniform2f(this.scaleLocation, scaledWidth, scaledHeight);
                gl.uniform1i(this.imageLocation, 0);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

                gl.deleteTexture(texture);
                video.pause();
            }
        }
    }

    public async drawImage(now:number){
        const gl = this.gl;
        gl.clearColor(1, 1, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        for(const line of this.storage.getTracks()){
            await this.processLine(gl, line, now);
        }
    }

    public resize(width: number, height: number): void{
        this.canvas.width = width;
        this.canvas.height = height;
        const gl = this.gl;
        gl.viewport(0, 0, this.storage.getWidth(), this.storage.getHeight());
        gl.uniform2f(this.resolutionLocation, this.storage.getWidth(), this.storage.getHeight());
    }

    public async createVideo(): Promise<Blob | null> {
        const storage = this.storage;
        const width = storage.getWidth();
        const height = storage.getHeight();
        const tracks = storage.getTracks();
        const fps = storage.getFPS();
        const totalVideoDuration = storage.getVideoEndTime();

        this.resize(width, height);
        if (tracks.length === 0) {
            Logger.log('컨텐츠를 먼저 업로드하세요.');
            return null;
        }
        Logger.log('영상 생성 중');

        //init
        const muxerOptions: any = {
            target: new Mp4Muxer.ArrayBufferTarget(),
            video: {
                codec: 'avc',
                width: width,
                height: height,
            },
            fastStart: 'in-memory',
        };

        let audioBuffers: { buffer: AudioBuffer; start: number; duration: number }[] = [];
        for (const track of storage.getTracks()) {
            if (track.type === ContentType.audio) {
                for (const content of track.contents) {
                    audioBuffers.push({
                        buffer: content.content.src as AudioBuffer,
                        start: content.start,
                        duration: content.duration,
                    });
                }
            }else if (track.type === ContentType.mp4) {
                for (const content of track.contents) {
                    const video: HTMLVideoElement = content.content.src as HTMLVideoElement;
                    const response = await fetch(video.src);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioContext = new AudioContext();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    audioBuffers.push({
                        buffer: audioBuffer,
                        start: content.start,
                        duration: Math.min(content.duration, audioBuffer.duration),
                    });
                }
            }
        }

        let audioSampleRate = 0;
        let audioChannels = 0;
        //TODO
        //Grok : audio bitrate = (sampleRate * numberOfChannels * bitDepth) / compressionRatio
        //             weightedBitrate = (Σ (bitrate_i * duration_i)) / totalDuration
        //     video bitrate = (width * height * fps * bitDepth * complexityFactor) / compressionRatio
        let audioBitrate = 128000;
        for(const audio of audioBuffers){
            audioSampleRate = Math.max(audioSampleRate,audio.buffer.sampleRate);
            audioChannels = Math.max(audioChannels,audio.buffer.numberOfChannels);
        }
        if (audioBuffers.length != 0) {
            muxerOptions.audio = {
                codec: 'aac',
                numberOfChannels: audioChannels,
                sampleRate: audioSampleRate,
            };
        }

        const muxer = new Mp4Muxer.Muxer(muxerOptions);

        const videoEncoder = new VideoEncoder({
            output: (chunk: EncodedVideoChunk, meta: any) => {
                muxer.addVideoChunk(chunk, meta);
            },
            error: (e: Error) => {
                Logger.log('비디오 인코딩 에러:', e.message);
            },
        });

        const encoderConfig: VideoEncoderConfig = {
            codec: 'avc1.42001f',
            width: width,
            height: height,
            framerate: fps,
            bitrate: 8_000_000,
        };
        const support = await VideoEncoder.isConfigSupported(encoderConfig);
        if (!support.supported) {
            Logger.log('비디오 코덱이 지원되지 않습니다!');
            return null;
        }
        videoEncoder.configure(encoderConfig);

        Logger.log('이미지 처리 시작');
        //draw
        for(let timestamp=0; timestamp < totalVideoDuration*1_000_000; timestamp+=1_000_000/fps){
            await this.drawImage(timestamp/1_000_000);
            const frame = new VideoFrame(this.canvas, {
                timestamp: timestamp,
                duration: fps,
            });
            videoEncoder.encode(frame, { keyFrame: true });
            frame.close();
        }

        //draw :: final frame // for some video player
        const frame = new VideoFrame(this.canvas, { timestamp:totalVideoDuration*1_000_000, duration: 0 });
        videoEncoder.encode(frame, { keyFrame: true });
        frame.close();

        await videoEncoder.flush();

        Logger.log('사운드 처리 시작');
        //audio
        if (audioBuffers.length > 0) {
            const audioEncoder = new AudioEncoder({
                output: (chunk: EncodedAudioChunk, meta: any) => {
                    muxer.addAudioChunk(chunk, meta);
                },
                error: (e: Error) => {
                    Logger.log('오디오 인코딩 에러:', e.message);
                },
            });

            const audioConfig: AudioEncoderConfig = {
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
                
            for (const { buffer, start, duration } of audioBuffers) {
                const sampleRate = buffer.sampleRate;
                const numberOfChannels = buffer.numberOfChannels;
                const numberOfFrames = Math.floor(duration * sampleRate);
                const channelData = new Float32Array(numberOfFrames * numberOfChannels);
                for (let i = 0; i < numberOfChannels; i++) {
                    const channel = buffer.getChannelData(i);
                    for (let j = 0; j < numberOfFrames; j++) {
                        channelData[j * numberOfChannels + i] = j < channel.length ? channel[j] : 0;
                    }
                }

                const audioData = new AudioData({
                    format: 'f32',
                    sampleRate,
                    numberOfFrames,
                    numberOfChannels,
                    timestamp: start * 1_000_000,
                    data: channelData,
                });

                audioEncoder.encode(audioData);
                audioData.close();
            }

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
        Logger.log('영상 생성 완료!');
        return blob;
    }
}