export var ContentType;
(function (ContentType) {
    ContentType["image"] = "image";
    ContentType["audio"] = "audio";
    ContentType["text"] = "text";
    ContentType["mp4"] = "mp4";
})(ContentType || (ContentType = {}));
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
        this.child = null;
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
        this.tracks = [];
        this.contents = [];
        this.fps = 60;
        this.createTrack(ContentType.audio, 'sound');
        this.createTrack(ContentType.mp4, 'mp4');
        this.createTrack(ContentType.image, 'image');
        this.createTrack(ContentType.text, 'text');
    }
    createTrack(type, name) {
        let id = this.createUID();
        let track = new VideoTrack(id, type, name);
        this.tracks.push(track);
        return track;
    }
    createContent(type, src, name, width, height) {
        const id = this.createUID();
        let content = { id, name, type, src, width, height };
        this.contents.push(content);
        return content;
    }
    getVideoEndTime() {
        return this.tracks.reduce((max, track) => Math.max(max, track.getEndtime()), 0);
    }
    async addContentToTrackToBack(trackID, con, duration, x, y, scale) {
        const track = this.getVideoTrack(trackID);
        if (track === null)
            return;
        if (track.type != con.type)
            return;
        let end = track.getEndtime();
        await this.addContentToTrack(trackID, con, end, duration, x, y, scale);
    }
    async addContentToTrack(trackID, con, start, duration, x, y, scale, offset = 0) {
        const track = this.getVideoTrack(trackID);
        if (track === null)
            return;
        if (track.type != con.type)
            return;
        track.items.push({ content: con, start: start, id: this.createUID(), duration, x, y, scale, effect: [], offset });
        if (track.type == ContentType.mp4) {
            if (track.child == null)
                track.child = this.createTrack(ContentType.audio, 'mp4/audio');
            const video = con.src;
            const response = await fetch(video.src);
            const arrayBuffer = await response.arrayBuffer();
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const child = track.child;
            const content = this.createContent(ContentType.audio, audioBuffer, con.name + '/audio', 0, 0);
            child.items.push({ content, start: start, id: this.createUID(), duration, x, y, scale, effect: [], offset });
        }
    }
    FindChild(track, target) {
        if (track.child === null)
            return null;
        for (const item of track.child.items) {
            if (item.start === target.start && item.duration === target.duration)
                return item;
        }
        return null;
    }
    getVideoTrack(id) {
        for (const d of this.tracks)
            if (d.id == id)
                return d;
        return null;
    }
    getContent(id) { for (const d of this.contents)
        if (d.id == id)
            return d; return null; }
    getIteamOfTrack(id) {
        for (const track of this.getTracks()) {
            for (const item of track.items)
                if (item.id === id) {
                    return [track, item];
                }
        }
        return null;
    }
    createUID() {
        return (++this.uidcount).toString();
    }
    getFPS() { return this.fps; }
    setFPS(fps) { this.fps = fps; }
    getTracks() { return this.tracks; }
    resize(width, height) { this.videowidth = width; this.videoheight = height; }
    getWidth() { return this.videowidth; }
    getHeight() { return this.videoheight; }
    getContents() { return this.contents; }
}
