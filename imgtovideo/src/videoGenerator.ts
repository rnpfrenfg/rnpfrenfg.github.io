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
    private ctx: CanvasRenderingContext2D;
    private logger: Logger;
    private videoWidth: number;
    private videoHeight: number;
    private contents: Content[] = [];
    private chunks: { chunk: EncodedVideoChunk; meta: EncodedVideoChunkMetadata }[] = [];
    private audioList: [bufffer: AudioBuffer, start: number, duration: number][] = [];
    private audioChunks: { chunk: EncodedAudioChunk; meta: EncodedAudioChunkMetadata }[] = [];

    constructor(width: number, height: number, canvas: HTMLCanvasElement, log: Logger) {
        this.videoWidth = width;
        this.videoHeight = height;
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d')!;
        this.logger = log;
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
        this.logger.log('Clearing audio content');
        this.audioList = [];
        this.audioChunks = [];
    }

    public clearContents(): void {
        this.logger.log('Clearing all contents');
        this.contents.forEach(content => URL.revokeObjectURL(content.src.src));
        this.contents = [];
        this.clearAudioContents();
    }

    private clearChunks(): void {
        this.audioChunks = [];
        this.chunks = [];
    }

    public async createVideo(): Promise<Blob | null> {
        if (this.contents.length === 0) {
            this.logError('이미지를 먼저 업로드하세요.');
            return null;
        }
        this.clearLog();
        this.clearChunks();
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
                this.chunks.push({ chunk, meta });
                this.logger.log(`Video chunk added: timestamp=${chunk.timestamp / 1_000_000}s`);
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
        this.canvas.width = this.videoWidth;
        this.canvas.height = this.videoHeight;

        let timestamp = 0;
        for (const con of this.contents) {
            const duration = con.duration * 1_000_000;
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
                } else if (con.effect === ContentEffect.RANDOM_MOVE) {
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
                output: (chunk: EncodedAudioChunk, meta: any) => {
                    this.audioChunks.push({ chunk, meta });
                    this.logger.log(`Audio chunk added: timestamp=${chunk.timestamp / 1_000_000}s, byteLength=${chunk.byteLength}`);
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