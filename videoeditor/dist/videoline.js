export var ContentType;
(function (ContentType) {
    ContentType["image"] = "image";
    ContentType["sound"] = "sound";
})(ContentType || (ContentType = {}));
export var ContentEffect;
(function (ContentEffect) {
    ContentEffect["DEFAULT"] = "default";
    ContentEffect["RANDOM_MOVE"] = "randomMove";
})(ContentEffect || (ContentEffect = {}));
export class VideoLine {
    constructor() {
        this.type = ContentType.image;
        this.contents = [];
    }
    addImageContent(image, start, duration) {
        this.contents.push({
            start: 0,
            duration,
            type: ContentType.image,
            src: image,
            effect: ContentEffect.RANDOM_MOVE,
        });
    }
    clearContents() {
        this.contents.forEach(content => URL.revokeObjectURL(content.src.src));
        this.contents = [];
    }
    getContents() {
        return this.contents;
    }
    getType() { return this.type; }
}
