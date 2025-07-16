var ContentType;
(function (ContentType) {
    ContentType["IMAGE"] = "image";
})(ContentType || (ContentType = {}));
var ContentEffect;
(function (ContentEffect) {
    ContentEffect["DEFAULT"] = "default";
    ContentEffect["RANDOM_MOVE"] = "randomMove";
})(ContentEffect || (ContentEffect = {}));
export class VideoGenerator {
    constructor(width, height, canvas, log) {
        this.contents = [];
        this.chunks = [];
        this.audioList = [];
        this.audioChunks = [];
        this.videoWidth = width;
        this.videoHeight = height;
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.logger = log;
    }
    logError(...txt) {
        this.logger.log(...txt);
    }
    clearLog() {
        this.logger.clear();
    }
    addImageContent(image, duration) {
        this.contents.push({
            duration,
            type: ContentType.IMAGE,
            src: image,
            effect: ContentEffect.RANDOM_MOVE,
        });
    }
    addAudioContent(audioBuffer, start, duration) {
        this.logger.log(`Adding audio: duration=${audioBuffer.duration}s, start=${start}s, requested duration=${duration}s`);
        this.audioList.push([audioBuffer, start, duration]);
    }
    clearAudioContents() {
        this.logger.log('Clearing audio content');
        this.audioList = [];
        this.audioChunks = [];
    }
    clearContents() {
        this.logger.log('Clearing all contents');
        this.contents.forEach(content => URL.revokeObjectURL(content.src.src));
        this.contents = [];
        this.clearAudioContents();
    }
    clearChunks() {
        this.audioChunks = [];
        this.chunks = [];
    }
    async createVideo() {
        if (this.contents.length === 0) {
            this.logError('이미지를 먼저 업로드하세요.');
            return null;
        }
        this.clearLog();
        this.clearChunks();
        this.logError('영상 생성 중');
        const fps = 60;
        const totalVideoDuration = this.contents.reduce((sum, content) => sum + content.duration, 0) * 1000000; // 마이크로초
        this.logger.log(`Total video duration: ${totalVideoDuration / 1000000}s`);
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
            this.logger.log(`Audio config: channels=${firstAudio.numberOfChannels}, sampleRate=${firstAudio.sampleRate}`);
        }
        const muxer = new Mp4Muxer.Muxer(muxerOptions);
        const videoEncoder = new VideoEncoder({
            output: (chunk, meta) => {
                this.chunks.push({ chunk, meta });
                this.logger.log(`Video chunk added: timestamp=${chunk.timestamp / 1000000}s`);
            },
            error: (e) => {
                this.logError('비디오 인코딩 에러:', e.message);
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
            this.logError('비디오 코덱이 지원되지 않습니다!');
            return null;
        }
        videoEncoder.configure(encoderConfig);
        this.canvas.width = this.videoWidth;
        this.canvas.height = this.videoHeight;
        let timestamp = 0;
        for (const con of this.contents) {
            const duration = con.duration * 1000000;
            if (con.type === ContentType.IMAGE) {
                if (con.effect === ContentEffect.DEFAULT) {
                    const image = con.src;
                    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                    const scale = Math.min(this.videoWidth / image.naturalWidth, this.videoHeight / image.naturalHeight);
                    const scaledWidth = image.naturalWidth * scale;
                    const scaledHeight = image.naturalHeight * scale;
                    const offsetX = (this.videoWidth - scaledWidth) / 2;
                    const offsetY = (this.videoHeight - scaledHeight) / 2;
                    this.ctx.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight);
                    const frame = new VideoFrame(this.canvas, {
                        timestamp,
                        duration,
                    });
                    videoEncoder.encode(frame, { keyFrame: true });
                    frame.close();
                }
                else if (con.effect === ContentEffect.RANDOM_MOVE) {
                    const image = con.src;
                    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
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
                        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                        this.ctx.drawImage(image, x, y, scaledWidth, scaledHeight);
                        const frame = new VideoFrame(this.canvas, {
                            timestamp: timestamp + (1000000 / fps) * i,
                            duration: 1000000 / fps + 1,
                        });
                        videoEncoder.encode(frame, { keyFrame: true });
                        frame.close();
                        x += Math.floor(spdX / fps);
                        y += Math.floor(spdY / fps);
                        if (x < 0 || x > maxX)
                            spdX = Math.floor(Math.random() * maxSpd * 2) - maxSpd;
                        if (y < 0 || y > maxY)
                            spdY = Math.floor(Math.random() * maxSpd * 2) - maxSpd;
                        spdX += (Math.floor(Math.random() * maxSpd * 2) - maxSpd) * 30 / fps;
                    }
                }
            }
            timestamp += duration;
        }
        // 마지막 프레임
        const frame = new VideoFrame(this.canvas, { timestamp, duration: 0 });
        videoEncoder.encode(frame, { keyFrame: true });
        frame.close();
        await videoEncoder.flush();
        this.logger.log(`Video encoding complete: ${this.chunks.length} chunks`);
        // 오디오 인코딩
        if (this.audioList.length > 0) {
            const audioEncoder = new AudioEncoder({
                output: (chunk, meta) => {
                    this.audioChunks.push({ chunk, meta });
                    this.logger.log(`Audio chunk added: timestamp=${chunk.timestamp / 1000000}s, byteLength=${chunk.byteLength}`);
                },
                error: (e) => {
                    this.logger.log('오디오 인코딩 에러:', e.message);
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
                this.logger.log('오디오 코덱이 지원되지 않습니다!');
                return null;
            }
            audioEncoder.configure(audioConfig);
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
            this.logger.log(`Audio encoding complete: ${this.audioChunks.length} chunks`);
        }
        // 청크 추가
        for (const chunk of this.chunks) {
            muxer.addVideoChunk(chunk.chunk, chunk.meta);
        }
        for (const audio of this.audioChunks) {
            muxer.addAudioChunk(audio.chunk, audio.meta);
        }
        this.logger.log(`Muxing: ${this.chunks.length} video chunks, ${this.audioChunks.length} audio chunks`);
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
