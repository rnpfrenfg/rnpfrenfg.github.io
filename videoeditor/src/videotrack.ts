export enum ContentType {
  image = "image",
  audio = "audio",
  text = "text",
  mp4 = "mp4",
}

export interface BaseContent {
  id: string;
  name: string;
  type: ContentType;
  width: number;
  height: number;
}

export class ImageContent implements BaseContent {
  readonly type = ContentType.image;
  constructor(
    public id: string,
    public name: string,
    public source: TexImageSource,
    public width: number,
    public height: number
  ) {}
}

export class AudioContent implements BaseContent {
  readonly type = ContentType.audio;
  // width/height are irrelevant for audio; keep 0
  constructor(
    public id: string,
    public name: string,
    public buffer: AudioBuffer,
    public width: number = 0,
    public height: number = 0
  ) {}
}

export interface TextStyle {
  font: string;
  fontSize: number;
  color: string;
}

export class TextContent implements BaseContent {
  readonly type = ContentType.text;
  constructor(
    public id: string,
    public name: string,
    public text: string,
    public style: TextStyle,
    public width: number,
    public height: number
  ) {}
}

export class Mp4Content implements BaseContent {
  readonly type = ContentType.mp4;
  constructor(
    public id: string,
    public name: string,
    public video: HTMLVideoElement,
    public audioBuffer: AudioBuffer | null,
    private audioContext: AudioContext,
    public width: number,
    public height: number
  ) {}
}

export type AnyContent = ImageContent | AudioContent | TextContent | Mp4Content;

export enum VideoEffectType {
  DEFAULT = "default",
  neon = "neon",
  glitch = "glitch",
}

export class VideoEffect {
  type: VideoEffectType;
  intensity: number;
  range: number;
  [key: string]: VideoEffectType | number;

  constructor(type: VideoEffectType) {
    this.type = type;
    this.intensity = 1;
    this.range = 1;
  }
}

export interface Keyframe {
  time: number;
  targetId: string;
  x?: number;
  y?: number;
  scale?: number;
  effect?: VideoEffect;
}

export interface VideoTrackItem {
  id: string;
  content: AnyContent;
  start: number;
  duration: number;
  offset: number;

  x: number;
  y: number;
  scale: number;
  effect: VideoEffect[];
  keyframes: Keyframe[];
}

export class VideoTrack {
  id: string;
  name: string;
  type: ContentType;
  items: VideoTrackItem[];
  keyframes: Keyframe[];

  constructor(id: string, type: ContentType, name: string) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.items = [];
    this.keyframes = [];
  }

  getEndtime(): number {
    return this.items.reduce((max, item) => Math.max(max, item.start + item.duration), 0);
  }
}

export class VideoProjectStorage {
  private uidcount = 0;
  private videowidth = 1280;
  private videoheight = 720;
  private fps = 60;
  private tracks: VideoTrack[] = [];
  private contents: AnyContent[] = [];

  constructor() {
    // default tracks
    this.createTrack(ContentType.audio, "sound");
    this.createTrack(ContentType.mp4, "mp4");
    this.createTrack(ContentType.image, "image");
    this.createTrack(ContentType.text, "text");
  }

  private createUID(): string {
    return (++this.uidcount).toString();
  }

  public createTrack(type: ContentType, name: string): VideoTrack {
    const id = this.createUID();
    const track = new VideoTrack(id, type, name);
    this.tracks.push(track);
    return track;
  }

  /** Content factories (no any) */
  public createImageContent(source: TexImageSource, name: string, width: number, height: number): ImageContent {
    const id = this.createUID();
    const content = new ImageContent(id, name, source, width, height);
    this.contents.push(content);
    return content;
  }

  public createAudioContent(buffer: AudioBuffer, name: string): AudioContent {
    const id = this.createUID();
    const content = new AudioContent(id, name, buffer);
    this.contents.push(content);
    return content;
  }

  public createTextContent(text: string, style: TextStyle, name: string, width = 10, height = 10): TextContent {
    const id = this.createUID();
    const content = new TextContent(id, name, text, style, width, height);
    this.contents.push(content);
    return content;
  }

  public async createMp4Content(video: HTMLVideoElement, name: string, width: number, height: number): Promise<Mp4Content> {
    const id = this.createUID();

    const response = await fetch(video.src);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const content = new Mp4Content(id, name, video, audioBuffer, audioContext, width, height);
    this.contents.push(content);
    return content;
  }

  public getVideoEndTime(): number {
    return this.tracks.reduce((max, track) => Math.max(max, track.getEndtime()), 0);
  }

  public getTracks(): VideoTrack[] {
    return this.tracks;
  }

  public getContents(): AnyContent[] {
    return this.contents;
  }

  public getVideoTrack(id: string): VideoTrack | null {
    return this.tracks.find((t) => t.id === id) || null;
  }

  public getContent(id: string): AnyContent | null {
    return this.contents.find((c) => c.id === id) || null;
  }

  public getIteamOfTrack(id: string): [VideoTrack, VideoTrackItem] | null {
    for (const track of this.tracks) {
      for (const item of track.items) {
        if (item.id === id) return [track, item];
      }
    }
    return null;
  }

  public addTrackKeyframe(trackId: string, keyframe: Keyframe): void {
    const track = this.getVideoTrack(trackId);
    if (!track) return;
    track.keyframes.push(keyframe);
    track.keyframes.sort((a, b) => a.time - b.time);
  }

  public removeTrackKeyframe(trackId: string, time: number): void {
    const track = this.getVideoTrack(trackId);
    if (!track) return;
    track.keyframes = track.keyframes.filter((kf) => kf.time !== time);
  }

  public resize(width: number, height: number) {
    this.videowidth = width;
    this.videoheight = height;
  }

  public getWidth(): number {
    return this.videowidth;
  }

  public getHeight(): number {
    return this.videoheight;
  }

  public getFPS(): number {
    return this.fps;
  }

  public setFPS(fps: number) {
    this.fps = fps;
  }

  public async addContentToTrack(
    trackID: string,
    con: AnyContent,
    start: number,
    duration: number,
    x: number,
    y: number,
    scale: number,
    offset: number = 0
  ) {
    const track = this.getVideoTrack(trackID);
    if (!track) return;
    if (track.type !== con.type) return;

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

  public async addContentToTrackToBack(
    trackID: string,
    con: AnyContent,
    duration: number,
    x: number,
    y: number,
    scale: number
  ) {
    const track = this.getVideoTrack(trackID);
    if (!track) return;
    if (track.type !== con.type) return;
    const end = track.getEndtime();
    await this.addContentToTrack(trackID, con, end, duration, x, y, scale);
  }
}
