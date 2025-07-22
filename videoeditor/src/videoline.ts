export enum ContentType {
    image = 'image',
    sound = 'sound'
}
export enum ContentEffect {
    DEFAULT = 'default',
    RANDOM_MOVE = 'randomMove',
}

export interface Content {
    start: number;
    duration: number;
    type: ContentType;
    src: HTMLImageElement;
    effect: ContentEffect;
}

interface VideoLineItem{
    start: number;
    duration: number;

    type: ContentType;
    effect: ContentEffect;
    src: HTMLImageElement;
}

export class VideoLine{
    private type: ContentType;
    private contents: Content[];

    constructor(){
        this.type = ContentType.image;
        this.contents=[];
    }

    public addImageContent(image: HTMLImageElement, start: number, duration: number): void {
        this.contents.push({
            start: 0,
            duration,
            type: ContentType.image,
            src: image,
            effect: ContentEffect.RANDOM_MOVE,
        });
    }
    
    public clearContents(): void {
        this.contents.forEach(content => URL.revokeObjectURL(content.src.src));
        this.contents = [];
    }

    public getContents(): Content[]{
        return this.contents;
    }
    public getType(): ContentType{return this.type;}
}