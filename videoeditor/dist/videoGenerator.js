import { Logger } from "./Logger.js";
import { ContentType, ContentEffect } from "./videoline.js";
export class VideoGenerator {
    constructor(width, height, canvas) {
        this.audioList = [];
        this.glProgram = null;
        this.positionLocation = 0;
        this.texCoordLocation = 0;
        this.resolutionLocation = null;
        this.positionUniformLocation = null;
        this.scaleLocation = null;
        this.imageLocation = null;
        this.videoWidth = width;
        this.videoHeight = height;
        this.videoLine = [];
        this.canvas = canvas;
        this.canvas.width = this.videoWidth;
        this.canvas.height = this.videoHeight;
        const gl = this.canvas.getContext('webgl');
        if (!gl) {
            Logger.log('WebGL을 지원하지 않는 브라우저');
            throw new Error('WebGL을 지원하지 않는 브라우저');
        }
        this.gl = gl;
        this.setupWebGL();
    }
    addAudioContent(audioBuffer, start, duration) {
        Logger.log(`Adding audio: duration=${audioBuffer.duration}s, start=${start}s, requested duration=${duration}s`);
        this.audioList.push([audioBuffer, start, duration]);
    }
    clearAudioContents() {
        this.audioList = [];
    }
    setupWebGL() {
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
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexShaderSource);
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            Logger.log('Vertex Shader 컴파일 실패:', gl.getShaderInfoLog(vertexShader));
            return;
        }
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentShaderSource);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            Logger.log('Fragment Shader 컴파일 실패:', gl.getShaderInfoLog(fragmentShader));
            return;
        }
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            Logger.log('Program 링크 실패:', gl.getProgramInfoLog(program));
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
    processLine(gl, line, now) {
        const contents = line.getContents();
        if (line.getType() == ContentType.image) {
        }
        if (line.getType() === ContentType.image) {
            for (const con of line.getContents()) {
                if (!(con.start < now && now < con.start + con.duration))
                    continue;
                if (con.effect === ContentEffect.DEFAULT) {
                    const image = con.src;
                    const scale = Math.min(this.videoWidth / image.naturalWidth, this.videoHeight / image.naturalHeight);
                    const scaledWidth = image.naturalWidth * scale;
                    const scaledHeight = image.naturalHeight * scale;
                    const offsetX = (this.videoWidth - scaledWidth) / 2;
                    const offsetY = (this.videoHeight - scaledHeight) / 2;
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    const texture = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, con.src);
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
    }
    async createVideo() {
        if (this.videoLine.length === 0) {
            Logger.log('컨텐츠를 먼저 업로드하세요.');
            return null;
        }
        Logger.log('영상 생성 중');
        const fps = 60;
        const muxerOptions = {
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
            Logger.log(`Audio config: channels=${firstAudio.numberOfChannels}, sampleRate=${firstAudio.sampleRate}`);
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
            width: this.videoWidth,
            height: this.videoHeight,
            framerate: fps,
            bitrate: 8000000,
        };
        const support = await VideoEncoder.isConfigSupported(encoderConfig);
        if (!support.supported) {
            Logger.log('비디오 코덱이 지원되지 않습니다!');
            return null;
        }
        videoEncoder.configure(encoderConfig);
        const gl = this.gl;
        gl.uniform2f(this.resolutionLocation, this.videoWidth, this.videoHeight);
        let totalVideoDuration = 0;
        for (const line of this.videoLine)
            for (const con of line.getContents()) {
                let end = con.start + con.duration;
                totalVideoDuration = totalVideoDuration > end ? totalVideoDuration : end;
            }
        for (let timestamp = 0; timestamp < totalVideoDuration; timestamp += fps) {
            gl.clearColor(1, 1, 1.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            for (const line of this.videoLine) {
                this.processLine(gl, line, timestamp);
            }
            const frame = new VideoFrame(this.canvas, {
                timestamp: timestamp * 1000000,
                duration: fps,
            });
            videoEncoder.encode(frame, { keyFrame: true });
            frame.close();
        }
        // 마지막 프레임
        const frame = new VideoFrame(this.canvas, { timestamp: totalVideoDuration, duration: 0 });
        videoEncoder.encode(frame, { keyFrame: true });
        frame.close();
        await videoEncoder.flush();
        if (this.audioList.length > 0) {
            const audioEncoder = new AudioEncoder({
                output: (chunk, meta) => {
                    muxer.addAudioChunk(chunk, meta);
                },
                error: (e) => {
                    Logger.log('오디오 인코딩 에러:', e.message);
                },
            });
            const [firstAudio] = this.audioList[0];
            const audioConfig = {
                codec: 'mp4a.40.2',
                numberOfChannels: firstAudio.numberOfChannels,
                sampleRate: firstAudio.sampleRate,
                bitrate: 128000,
            };
            const audioSupport = await AudioEncoder.isConfigSupported(audioConfig);
            if (!audioSupport.supported) {
                Logger.log('오디오 코덱이 지원되지 않습니다!');
                return null;
            }
            audioEncoder.configure(audioConfig);
            Logger.log(`Total video duration: ${totalVideoDuration / 1000000}s`);
            for (const [audioBuffer, start, duration] of this.audioList) {
                const sampleRate = audioBuffer.sampleRate;
                const numberOfChannels = audioBuffer.numberOfChannels;
                const audioDuration = Math.min(duration, audioBuffer.duration, (totalVideoDuration - start * 1000000) / 1000000) * 1000000;
                const startTime = start * 1000000;
                const numberOfFrames = Math.floor((audioDuration * sampleRate) / 1000000);
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
            Logger.log('비디오 생성 실패: 출력 버퍼가 비어 있습니다.');
            return null;
        }
        const blob = new Blob([buffer], { type: 'video/mp4' });
        Logger.log('영상 생성 완료!');
        return blob;
    }
}
