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
            effect: ContentEffect.RANDOM_MOVE
        });
    }
    clearContents() {
        this.contents.forEach(content => URL.revokeObjectURL(content.src.src));
        this.contents = [];
        this.chunks = [];
    }
    async createVideo() {
        if (this.contents.length === 0) {
            this.logError('이미지를 먼저 업로드하세요.');
            return null;
        }
        this.clearLog();
        this.logError('영상 생성 중');
        const fps = 60;
        const bufTarget = new Mp4Muxer.ArrayBufferTarget();
        const muxer = new Mp4Muxer.Muxer({
            target: bufTarget,
            video: {
                codec: 'avc',
                width: this.videoWidth,
                height: this.videoHeight,
            },
            fastStart: 'in-memory',
        });
        const videoEncoder = new VideoEncoder({
            output: (chunk, meta) => {
                this.chunks.push({ chunk, meta });
            },
            error: (e) => {
                this.logError('인코딩 에러', e.message);
            },
        });
        const encoderConfig = {
            codec: 'avc1.42001f',
            width: this.videoWidth,
            height: this.videoHeight,
            framerate: fps,
            bitrate: 1000000,
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
            const duration = con.duration;
            if (con.type === ContentType.IMAGE) {
                if (ContentEffect.DEFAULT == con.effect) {
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
                        duration: duration * 1000000,
                    });
                    videoEncoder.encode(frame, { keyFrame: true });
                    frame.close();
                }
                else if (ContentEffect.RANDOM_MOVE == con.effect) {
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
                    for (let i = 0; i < fps * duration; i++) {
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
                        if (0 > x || x > maxX || 0 > y || y > maxY) {
                            spdX = Math.floor(Math.random() * maxSpd * 2) - maxSpd;
                            spdY = Math.floor(Math.random() * maxSpd * 2) - maxSpd;
                        }
                        spdX += (Math.floor(Math.random() * maxSpd * 2) - maxSpd) * 30 / fps;
                    }
                }
            }
            timestamp += duration * 1000000;
        }
        // 마지막 프레임
        const frame = new VideoFrame(this.canvas, { timestamp, duration: 0 });
        videoEncoder.encode(frame, { keyFrame: true });
        frame.close();
        await videoEncoder.flush();
        for (const chunk of this.chunks) {
            muxer.addVideoChunk(chunk.chunk, chunk.meta);
        }
        muxer.finalize();
        videoEncoder.close();
        const blob = new Blob([bufTarget.buffer], { type: 'video/mp4' });
        this.logError('영상 생성 완료!');
        return blob;
    }
}
