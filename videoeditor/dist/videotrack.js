export var ContentType;
(function (ContentType) {
    ContentType["image"] = "image";
    ContentType["audio"] = "audio";
    ContentType["text"] = "text";
    ContentType["mp4"] = "mp4";
})(ContentType || (ContentType = {}));
export class ImageContent {
    constructor(id, name, source, width, height) {
        this.id = id;
        this.name = name;
        this.source = source;
        this.width = width;
        this.height = height;
        this.type = ContentType.image;
    }
}
export class AudioContent {
    // width/height are irrelevant for audio; keep 0
    constructor(id, name, buffer, width = 0, height = 0) {
        this.id = id;
        this.name = name;
        this.buffer = buffer;
        this.width = width;
        this.height = height;
        this.type = ContentType.audio;
    }
}
export class TextContent {
    constructor(id, name, text, style, width, height) {
        this.id = id;
        this.name = name;
        this.text = text;
        this.style = style;
        this.width = width;
        this.height = height;
        this.type = ContentType.text;
    }
}
export class Mp4Content {
    constructor(id, name, video, audioBuffer, audioContext, width, height) {
        this.id = id;
        this.name = name;
        this.video = video;
        this.audioBuffer = audioBuffer;
        this.audioContext = audioContext;
        this.width = width;
        this.height = height;
        this.type = ContentType.mp4;
    }
}
export var VideoEffectType;
(function (VideoEffectType) {
    VideoEffectType["DEFAULT"] = "default";
    VideoEffectType["neon"] = "neon";
    VideoEffectType["glitch"] = "glitch";
})(VideoEffectType || (VideoEffectType = {}));
export class VideoEffect {
    constructor(type) {
        this.type = type;
        this.intensity = 1;
        this.range = 1;
    }
}
export class VideoTrack {
    constructor(id, type, name) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.items = [];
        this.keyframes = [];
    }
    getEndtime() {
        return this.items.reduce((max, item) => Math.max(max, item.start + item.duration), 0);
    }
}
export class VideoProjectStorage {
    constructor() {
        this.uidcount = 0;
        this.videowidth = 1280;
        this.videoheight = 720;
        this.fps = 60;
        this.tracks = [];
        this.contents = [];
        // default tracks
        this.createTrack(ContentType.audio, "sound");
        this.createTrack(ContentType.mp4, "mp4");
        this.createTrack(ContentType.image, "image");
        this.createTrack(ContentType.text, "text");
    }
    createUID() {
        return (++this.uidcount).toString();
    }
    createTrack(type, name) {
        const id = this.createUID();
        const track = new VideoTrack(id, type, name);
        this.tracks.push(track);
        return track;
    }
    /** Content factories (no any) */
    createImageContent(source, name, width, height) {
        const id = this.createUID();
        const content = new ImageContent(id, name, source, width, height);
        this.contents.push(content);
        return content;
    }
    createAudioContent(buffer, name) {
        const id = this.createUID();
        const content = new AudioContent(id, name, buffer);
        this.contents.push(content);
        return content;
    }
    createTextContent(text, style, name, width = 10, height = 10) {
        const id = this.createUID();
        const content = new TextContent(id, name, text, style, width, height);
        this.contents.push(content);
        return content;
    }
    async createMp4Content(video, name, width, height) {
        const id = this.createUID();
        const response = await fetch(video.src);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const content = new Mp4Content(id, name, video, audioBuffer, audioContext, width, height);
        this.contents.push(content);
        return content;
    }
    getVideoEndTime() {
        return this.tracks.reduce((max, track) => Math.max(max, track.getEndtime()), 0);
    }
    getTracks() {
        return this.tracks;
    }
    getContents() {
        return this.contents;
    }
    getVideoTrack(id) {
        return this.tracks.find((t) => t.id === id) || null;
    }
    getContent(id) {
        return this.contents.find((c) => c.id === id) || null;
    }
    getIteamOfTrack(id) {
        for (const track of this.tracks) {
            for (const item of track.items) {
                if (item.id === id)
                    return [track, item];
            }
        }
        return null;
    }
    addTrackKeyframe(trackId, keyframe) {
        const track = this.getVideoTrack(trackId);
        if (!track)
            return;
        track.keyframes.push(keyframe);
        track.keyframes.sort((a, b) => a.time - b.time);
    }
    removeTrackKeyframe(trackId, time) {
        const track = this.getVideoTrack(trackId);
        if (!track)
            return;
        track.keyframes = track.keyframes.filter((kf) => kf.time !== time);
    }
    resize(width, height) {
        this.videowidth = width;
        this.videoheight = height;
    }
    getWidth() {
        return this.videowidth;
    }
    getHeight() {
        return this.videoheight;
    }
    getFPS() {
        return this.fps;
    }
    setFPS(fps) {
        this.fps = fps;
    }
    async addContentToTrack(trackID, con, start, duration, x, y, scale, offset = 0) {
        const track = this.getVideoTrack(trackID);
        if (!track)
            return;
        if (track.type !== con.type)
            return;
        track.items.push({
            content: con,
            start,
            id: this.createUID(),
            duration,
            x,
            y,
            scale,
            effect: [],
            offset,
            keyframes: [],
        });
        // NOTE: Old behavior: mp4 add would auto-create mp3/audio child.
        // Requirement: remove it. So do nothing here.
    }
    async addContentToTrackToBack(trackID, con, duration, x, y, scale) {
        const track = this.getVideoTrack(trackID);
        if (!track)
            return;
        if (track.type !== con.type)
            return;
        const end = track.getEndtime();
        await this.addContentToTrack(trackID, con, end, duration, x, y, scale);
    }
}
