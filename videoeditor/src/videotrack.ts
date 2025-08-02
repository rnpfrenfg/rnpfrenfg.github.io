export enum ContentType {
    image = 'image',
    audio = 'audio',
    text='text',
    mp4 = 'mp4'
}
export enum ContentEffect {
    DEFAULT = 'default',
    RANDOM_MOVE = 'randomMove',
}

export interface Content {
    id: string;
    name: string;
    type: ContentType;
    src: any;

    width: number;
    height: number;
}

export interface TextSrc{
    font: string;
    fontSize: number;
    color: string;
}

export interface VideoTrackItem{
    id: string;
    content: Content;
    start: number;
    duration: number;
    
    x: number;
    y: number;
    scale:number;
}

export class VideoTrack{
    id: string;
    name: string;
    type: ContentType;
    contents: VideoTrackItem[];

    child: VideoTrack| null;

    constructor(id:string, type:ContentType,name:string){
        this.id=id;
        this.name=name;
        this.type=type;
        this.contents=[];
        this.child=null;
    }

    getEndtime():number{
        return this.contents.reduce((max, item) => Math.max(max, item.start + item.duration), 0);
    }
}

export class VideoProjectStorage{
    private uidcount: number;
    private videowidth: number;
    private videoheight: number;
    private fps: number;
    private tracks: VideoTrack[];
    private contents: Content[];

    constructor(){
        this.uidcount=0;
        this.videowidth = 1280;
        this.videoheight = 720;
        this.tracks=[];
        this.contents=[];
        this.fps = 60;

        this.createTrack(ContentType.audio, 'sound');
        this.createTrack(ContentType.mp4, 'mp4');
        this.createTrack(ContentType.image, 'image');
        this.createTrack(ContentType.text, 'text');
    }

    public createTrack(type: ContentType, name: string): VideoTrack{
        let id = this.createUID();
        let track:VideoTrack = new VideoTrack(id,type,name);
        this.tracks.push(track);
        return track;
    }

    public createContent(type:ContentType, src: any, name: string, width:number, height:number):Content{
        const id = this.createUID();
        let content:Content = {id,name,type,src,width,height };
        this.contents.push(content);
        return content;
    }

    public getVideoEndTime(): number {
        return this.tracks.reduce((max, track) => Math.max(max, track.getEndtime()), 0);
    }

    public async addContentToTrackToBack(trackID:string, con: Content, duration: number, x:number ,y:number, scale:number){
        const track = this.getVideoTrack(trackID);
        if(track === null)return;

        if(track.type != con.type)return;
        let end = track.getEndtime();
        await this.addContentToTrack(trackID,con,end,duration,x,y,scale);
    }

    public async addContentToTrack(trackID:string, con: Content, start: number, duration: number, x:number ,y:number, scale:number){
        const track = this.getVideoTrack(trackID);
        if(track === null)return;

        if(track.type != con.type)return;
        track.contents.push({content:con,start:start,id:this.createUID(),duration,x,y, scale});

        if(track.type == ContentType.mp4){
            if(track.child == null)
                track.child = this.createTrack(ContentType.audio,'mp4/audio');

            const video: HTMLVideoElement = con.src as HTMLVideoElement;
            const response = await fetch(video.src);
            const arrayBuffer = await response.arrayBuffer();
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const child = track.child;
            const content = this.createContent(ContentType.audio,audioBuffer,con.name+'/audio',0,0);
            child.contents.push({content,start:start,id:this.createUID(),duration,x,y,scale});
        }
    }

    public getVideoTrack(id: string):VideoTrack | null{
        for(const d of this.tracks)if(d.id == id)return d;
        return null;
    }

    public getContent(id:string):Content|null{for(const d of this.contents)if(d.id==id)return d;return null;}

    public getIteamOfTrack(id: string) : [VideoTrack, VideoTrackItem] | null{
        for(const track of this.getTracks()){
            for(const item of track.contents)
                if(item.id === id){
                    return [track, item];
                }
        }
        return null;
    }

    private createUID(): string{
        return (++this.uidcount).toString();
    }
    
    public getFPS():number{return this.fps;}public setFPS(fps:number){this.fps=fps;}
    public getTracks():VideoTrack[]{return this.tracks;}
    public resize(width: number, height:number){this.videowidth=width;this.videoheight=height;}
    public getWidth(): number{return this.videowidth}
    public getHeight(): number{return this.videoheight}
    public getContents(): Content[]{return this.contents}
}