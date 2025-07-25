export enum ContentType {
    image = 'image',
    audio = 'audio',
    text='text'
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
}

export interface VideoTrackItem{
    id: string;
    content: Content;
    start: number;
    duration: number;
}

export class VideoTrack{
    id: string;
    name: string;
    type: ContentType;
    contents: VideoTrackItem[];

    constructor(id:string, type:ContentType,name:string){
        this.id=id;
        this.name=name;
        this.type=type;
        this.contents=[];
    }

    getEndtime():number{
        let du = 0;
        for(const con of this.contents){
            let end = con.start + con.duration;
            if(end > du) du=end; 
        }
        return du;
    }
}

export class VideoProjectStorage{
    private uidcount: number;;
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

        this.createTrack(ContentType.image);
    }

    public createTrack(type: ContentType): VideoTrack{
        let id = this.createUID();
        let track:VideoTrack = new VideoTrack(id,type,'images');
        this.tracks.push(track);
        return track;
    }

    public createContent(type:ContentType, src: any):Content{
        const id = this.createUID();
        let content:Content = {
            id:id,
            name:'name'+id.toString(),
            type,
            src
        };
        this.contents.push(content);
        return content;
    }

    public getVideoEndTime():number{
        let totalVideoDuration = 0;
        for(const line of this.tracks){
            let du = line.getEndtime();
            if(du > totalVideoDuration) totalVideoDuration=du;
        }
        return totalVideoDuration;
    }

    public addContentToTrackacc(trackID:string, con: Content, start:number, duration:number){
        const track = this.getVideoTrack(trackID);
        if(track === null)return;

        if(track.type != con.type)return;
        track.contents.push({content:con,start:start,id:this.createUID(),duration:duration});
    }
    public addContentToTrack(trackID:string, con: Content, duration: number){
        const track = this.getVideoTrack(trackID);
        if(track === null)return;

        if(track.type != con.type)return;
        let end = track.getEndtime();
        track.contents.push({content:con,start:end,id:this.createUID(),duration:2});
    }
    public getVideoTrack(id: string):VideoTrack | null{
        for(const d of this.tracks)if(d.id == id)return d;
        return null;
    }
    public getContent(id:string):Content|null{for(const d of this.contents)if(d.id==id)return d;return null;}

    public createUID(): string{
        this.uidcount++;
        return this.uidcount.toString();
    }
    
    public getFPS():number{return this.fps;}public setFPS(fps:number){this.fps=fps;}
    public getTracks():VideoTrack[]{return this.tracks;}
    public resize(width: number, height:number){this.videowidth=width;this.videoheight=height;}
    public getWidth(): number{return this.videowidth}
    public getHeight(): number{return this.videoheight}
    public getContents(): Content[]{return this.contents}
}