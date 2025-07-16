import { Logger } from "./Logger.js";

enum ContentType {
    IMAGE = 'image',
}
enum ContentEffect {
    DEFAULT = 'default',
    RANDOM_MOVE = 'randomMove',
}

interface Content {
    duration: number;
    type: ContentType;
    src: HTMLImageElement;
    effect: ContentEffect;
}

export class VideoGenerator {
    private canvas: HTMLCanvasElement;
    private logger: Logger;
    private videoWidth: number;
    private videoHeight: number;
    private contents: Content[] = [];
    private audioList: [bufffer: AudioBuffer, start: number, duration: number][] = [];

    private gl: WebGLRenderingContext;
    private glProgram: WebGLProgram | null = null;
    private positionLocation: number = 0;
    private texCoordLocation: number = 0;
    private resolutionLocation: WebGLUniformLocation | null = null;
    private positionUniformLocation: WebGLUniformLocation | null = null;
    private scaleLocation: WebGLUniformLocation | null = null;
    private imageLocation: WebGLUniformLocation | null = null;

    constructor(width: number, height: number, canvas: HTMLCanvasElement, log: Logger) {
        this.logger = log;

        this.videoWidth = width;
        this.videoHeight = height;
        this.canvas = canvas;
        
        this.canvas.width = this.videoWidth;
        this.canvas.height = this.videoHeight;

        const gl = this.canvas.getContext('webgl');
        if (!gl) {
            this.logger.log('WebGL을 지원하지 않는 브라우저');
            throw new Error('WebGL을 지원하지 않는 브라우저');
        }
        this.gl = gl;
        this.setupWebGL();
    }

    private logError(...txt: string[]): void {
        this.logger.log(...txt);
    }

    private clearLog(): void {
        this.logger.clear();
    }

    public addImageContent(image: HTMLImageElement, duration: number): void {
        this.contents.push({
            duration,
            type: ContentType.IMAGE,
            src: image,
            effect: ContentEffect.RANDOM_MOVE,
        });
    }

    public addAudioContent(audioBuffer: AudioBuffer, start: number, duration: number): void {
        this.logger.log(`Adding audio: duration=${audioBuffer.duration}s, start=${start}s, requested duration=${duration}s`);
        this.audioList.push([audioBuffer, start, duration]);
    }

    public clearAudioContents(): void {
        this.audioList = [];
    }
    
    public clearContents(): void {
        this.contents.forEach(content => URL.revokeObjectURL(content.src.src));
        this.contents = [];
        this.clearAudioContents();
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
            this.logError('Vertex Shader 컴파일 실패:', gl.getShaderInfoLog(vertexShader)!);
            return;
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
        gl.shaderSource(fragmentShader, fragmentShaderSource);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            this.logError('Fragment Shader 컴파일 실패:', gl.getShaderInfoLog(fragmentShader)!);
            return;
        }

        const program = gl.createProgram()!;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            this.logError('Program 링크 실패:', gl.getProgramInfoLog(program)!);
            return;
        }
        gl.useProgram(program);

        this.glProgram = program;
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
    }

    public async createVideo(): Promise<Blob | null> {
        if (this.contents.length === 0) {
            this.logError('이미지를 먼저 업로드하세요.');
            return null;
        }
        this.clearLog();
        this.logError('영상 생성 중');

        const fps = 60;
        const totalVideoDuration = this.contents.reduce((sum, content) => sum + content.duration, 0) * 1_000_000; // 마이크로초
        this.logger.log(`Total video duration: ${totalVideoDuration / 1_000_000}s`);

        const muxerOptions: any = {
            target: new Mp4Muxer.ArrayBufferTarget(),
            video: {
                codec: 'avc',
                width: this.videoWidth,
                height: this.videoHeight,
            },
            fastStart: 'in-memory',
        };

        if (this.audioList.length > 0) {
            const [firstAudio] = this.audioList[0];
            muxerOptions.audio = {
                codec: 'aac',
                numberOfChannels: firstAudio.numberOfChannels,
                sampleRate: firstAudio.sampleRate,
            };
            this.logger.log(`Audio config: channels=${firstAudio.numberOfChannels}, sampleRate=${firstAudio.sampleRate}`);
        }

        const muxer = new Mp4Muxer.Muxer(muxerOptions);

        const videoEncoder = new VideoEncoder({
            output: (chunk: EncodedVideoChunk, meta: any) => {
                muxer.addVideoChunk(chunk, meta);
            },
            error: (e: Error) => {
                this.logError('비디오 인코딩 에러:', e.message);
            },
        });

        const encoderConfig: VideoEncoderConfig = {
            codec: 'avc1.42001f',
            width: this.videoWidth,
            height: this.videoHeight,
            framerate: fps,
            bitrate: 8_000_000,
        };

        const support = await VideoEncoder.isConfigSupported(encoderConfig);
        if (!support.supported) {
            this.logError('비디오 코덱이 지원되지 않습니다!');
            return null;
        }
        videoEncoder.configure(encoderConfig);

        const gl = this.gl;
        gl.clearColor(1, 1, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.uniform2f(this.resolutionLocation, this.videoWidth, this.videoHeight);
        let timestamp = 0;
        for (const con of this.contents) {
            const duration = con.duration * 1_000_000;
            if (con.type === ContentType.IMAGE) {

                const texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, con.src);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

                if (con.effect === ContentEffect.DEFAULT) {
                    const image = con.src;
                    const scale = Math.min(this.videoWidth / image.naturalWidth, this.videoHeight / image.naturalHeight);
                    const scaledWidth = image.naturalWidth * scale;
                    const scaledHeight = image.naturalHeight * scale;
                    const offsetX = (this.videoWidth - scaledWidth) / 2;
                    const offsetY = (this.videoHeight - scaledHeight) / 2;

                    gl.clear(gl.COLOR_BUFFER_BIT);

                    gl.uniform2f(this.positionUniformLocation, offsetX, offsetY);
                    gl.uniform2f(this.scaleLocation, scaledWidth, scaledHeight);
                    gl.uniform1i(this.imageLocation, 0);
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

                    const frame = new VideoFrame(this.canvas, {
                        timestamp,
                        duration,
                    });
                    videoEncoder.encode(frame, { keyFrame: true });
                    frame.close();
                }
                else if (con.effect === ContentEffect.RANDOM_MOVE) {
                    const image = con.src;
                    const scale = Math.min(this.videoWidth / image.naturalWidth, this.videoHeight / image.naturalHeight) / 3;
                    const scaledWidth = image.naturalWidth * scale;
                    const scaledHeight = image.naturalHeight * scale;
                    const maxX = this.videoWidth - scaledWidth;
                    const maxY = this.videoHeight - scaledHeight;

                    let x = Math.floor(Math.random() * maxX);
                    let y = Math.floor(Math.random() * maxY);
                    const maxSpd = 500;
                    let spdX = Math.floor(Math.random() * maxSpd * 2) - maxSpd;
                    let spdY = Math.floor(Math.random() * maxSpd * 2) - maxSpd;

                    for (let i = 0; i < fps * con.duration; i++) {
                        gl.clear(gl.COLOR_BUFFER_BIT);
                        gl.uniform2f(this.positionUniformLocation, x, y);
                        gl.uniform2f(this.scaleLocation, scaledWidth, scaledHeight);
                        gl.uniform1i(this.imageLocation, 0);
                        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

                        const frame = new VideoFrame(this.canvas, {
                            timestamp: timestamp + (1_000_000 / fps) * i,
                            duration: 1_000_000 / fps + 1,
                        });
                        videoEncoder.encode(frame, { keyFrame: true });
                        frame.close();

                        x += Math.floor(spdX / fps);
                        y += Math.floor(spdY / fps);

                        if (x < 0 || x > maxX) spdX = Math.floor(Math.random() * maxSpd * 2) - maxSpd;
                        if (y < 0 || y > maxY) spdY = Math.floor(Math.random() * maxSpd * 2) - maxSpd;

                        spdX += (Math.floor(Math.random() * maxSpd * 2) - maxSpd) * 30 / fps;
                    }
                }
                gl.deleteTexture(texture);
            }
            timestamp += duration;
        }

        // 마지막 프레임
        const frame = new VideoFrame(this.canvas, { timestamp, duration: 0 });
        videoEncoder.encode(frame, { keyFrame: true });
        frame.close();

        await videoEncoder.flush();

        if (this.audioList.length > 0) {
            const audioEncoder = new AudioEncoder({
                output: (chunk: EncodedAudioChunk, meta: any) => {
                    muxer.addAudioChunk(chunk, meta);
                },
                error: (e: Error) => {
                    this.logger.log('오디오 인코딩 에러:', e.message);
                },
            });

            const [firstAudio] = this.audioList[0];
            const audioConfig: AudioEncoderConfig = {
                codec: 'mp4a.40.2',
                numberOfChannels: firstAudio.numberOfChannels,
                sampleRate: firstAudio.sampleRate,
                bitrate: 128_000,
            };

            const audioSupport = await AudioEncoder.isConfigSupported(audioConfig);
            if (!audioSupport.supported) {
                this.logger.log('오디오 코덱이 지원되지 않습니다!');
                return null;
            }

            audioEncoder.configure(audioConfig);

            for (const [audioBuffer, start, duration] of this.audioList) {
                const sampleRate = audioBuffer.sampleRate;
                const numberOfChannels = audioBuffer.numberOfChannels;
                const audioDuration = Math.min(duration, audioBuffer.duration, (totalVideoDuration - start * 1_000_000) / 1_000_000) * 1_000_000;
                const startTime = start * 1_000_000;
                const numberOfFrames = Math.floor((audioDuration * sampleRate) / 1_000_000);
                const channelData = new Float32Array(numberOfFrames * numberOfChannels);
                for (let i = 0; i < numberOfChannels; i++) {
                    const channel = audioBuffer.getChannelData(i);
                    for (let j = 0; j < numberOfFrames; j++) {
                        channelData[j * numberOfChannels + i] = j < channel.length ? channel[j] : 0;
                    }
                }

                const audioData = new AudioData({
                    format: 'f32',
                    sampleRate,
                    numberOfFrames,
                    numberOfChannels,
                    timestamp: startTime,
                    data: channelData,
                });

                audioEncoder.encode(audioData);
                audioData.close();
            }

            await audioEncoder.flush();
        }

        muxer.finalize();
        videoEncoder.close();

        const buffer = muxerOptions.target.buffer;
        if (!buffer) {
            this.logger.log('비디오 생성 실패: 출력 버퍼가 비어 있습니다.');
            return null;
        }

        const blob = new Blob([buffer], { type: 'video/mp4' });
        this.logger.log('영상 생성 완료!');
        return blob;
    }
}