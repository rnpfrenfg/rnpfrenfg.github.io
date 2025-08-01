export var ContentType;
(function (ContentType) {
    ContentType["image"] = "image";
    ContentType["audio"] = "audio";
    ContentType["text"] = "text";
})(ContentType || (ContentType = {}));
export var ContentEffect;
(function (ContentEffect) {
    ContentEffect["DEFAULT"] = "default";
    ContentEffect["RANDOM_MOVE"] = "randomMove";
})(ContentEffect || (ContentEffect = {}));
export class VideoTrack {
    constructor(id, type, name) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.contents = [];
    }
    getEndtime() {
        return this.contents.reduce((max, item) => Math.max(max, item.start + item.duration), 0);
    }
}
export class VideoProjectStorage {
    ;
    constructor() {
        this.uidcount = 0;
        this.videowidth = 1280;
        this.videoheight = 720;
        this.tracks = [];
        this.contents = [];
        this.fps = 60;
        this.createTrack(ContentType.image, 'image');
        this.createTrack(ContentType.audio, 'sound');
        this.createTrack(ContentType.text, 'text');
    }
    createTrack(type, name) {
        let id = this.createUID();
        let track = new VideoTrack(id, type, name);
        this.tracks.push(track);
        return track;
    }
    createContent(type, src) {
        const id = this.createUID();
        let content = {
            id: id,
            name: 'name' + id.toString(),
            type,
            src
        };
        this.contents.push(content);
        return content;
    }
    getVideoEndTime() {
        return this.tracks.reduce((max, track) => Math.max(max, track.getEndtime()), 0);
    }
    addContentToTrackacc(trackID, con, start, duration) {
        const track = this.getVideoTrack(trackID);
        if (track === null)
            return;
        if (track.type != con.type)
            return;
        track.contents.push({ content: con, start: start, id: this.createUID(), duration: duration });
    }
    addContentToTrack(trackID, con, duration) {
        const track = this.getVideoTrack(trackID);
        if (track === null)
            return;
        if (track.type != con.type)
            return;
        let end = track.getEndtime();
        track.contents.push({ content: con, start: end, id: this.createUID(), duration: 2 });
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
    editTrackItem(id, start, duration) {
        for (const track of this.getTracks()) {
            for (const item of track.contents)
                if (item.id === id) {
                    item.start = start;
                    item.duration = duration; // TODO : 근처 아이템 시간 밀기
                }
        }
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
