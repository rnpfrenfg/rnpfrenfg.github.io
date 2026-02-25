import * as Mp4Muxer from "./lib/mp4-muxer.js";
import * as MP4Box from "./lib/mp4box.all.js";

type WorkerContentType = "image" | "audio" | "text" | "mp4";

interface WorkerTextStyleDto {
  font: string;
  fontSize: number;
  color: string;
}

interface WorkerEffectDto {
  type: string;
  intensity: number;
  range: number;
}

interface WorkerTrackItemDto {
  id: string;
  contentId: string;
  start: number;
  duration: number;
  offset: number;
  x: number;
  y: number;
  scale: number;
  effects: WorkerEffectDto[];
}

interface WorkerTrackDto {
  id: string;
  name: string;
  type: WorkerContentType;
  items: WorkerTrackItemDto[];
}

interface WorkerImageAssetDto {
  id: string;
  name: string;
  width: number;
  height: number;
  bitmap: ImageBitmap;
}

interface WorkerTextAssetDto {
  id: string;
  name: string;
  width: number;
  height: number;
  text: string;
  style: WorkerTextStyleDto;
}

interface WorkerMp4AssetDto {
  id: string;
  name: string;
  width: number;
  height: number;
  bytes: ArrayBuffer;
  videoDescription?: ArrayBuffer;
}

interface WorkerMixedAudioDto {
  sampleRate: number;
  numberOfChannels: number;
  length: number;
  channels: ArrayBuffer[];
}

interface WorkerProjectDto {
  width: number;
  height: number;
  fps: number;
  duration: number;
  tracks: WorkerTrackDto[];
  images: WorkerImageAssetDto[];
  texts: WorkerTextAssetDto[];
  mp4s: WorkerMp4AssetDto[];
  mixedAudio?: WorkerMixedAudioDto;
}

interface WorkerStartMessage {
  type: "start";
  project: WorkerProjectDto;
}

interface WorkerCancelMessage {
  type: "cancel";
}

type WorkerInMessage = WorkerStartMessage | WorkerCancelMessage;

type WorkerOutMessage =
  | { type: "ready" }
  | { type: "progress"; progress: number }
  | { type: "done"; buffer: ArrayBuffer }
  | { type: "error"; message: string }
  | { type: "debug"; message: string };

interface DecodedVideoFrame {
  timestampSec: number;
  frame: VideoFrame;
}

interface PCMBuffer {
  sampleRate: number;
  numberOfChannels: number;
  channels: Float32Array[];
  durationSec: number;
}

interface Mp4DecodedAsset {
  id: string;
  width: number;
  height: number;
  videoTrack: DecodedMp4Track | null;
  audioPcm: PCMBuffer | null;
}

interface DecodedMp4Track {
  id: number;
  codec: string;
  width?: number;
  height?: number;
  sampleRate?: number;
  channelCount?: number;
  description?: ArrayBuffer;
  samples: any[];
  timescale?: number;
}

interface DemuxResult {
  videoTrack: DecodedMp4Track | null;
  audioTrack: null;
}

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let cancelRequested = false;
let debugEnabled = true;

function debugLog(message: string) {
  if (!debugEnabled) return;
  try {
    workerScope.postMessage({ type: "debug", message } satisfies WorkerOutMessage);
  } catch {}
}


class WorkerRenderer {
  public readonly canvas: OffscreenCanvas;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private posBuffer: WebGLBuffer;
  private uvBuffer: WebGLBuffer;
  private aPosition: number;
  private aUv: number;
  private uResolution: WebGLUniformLocation;
  private uPosition: WebGLUniformLocation;
  private uScale: WebGLUniformLocation;
  private uEffect: WebGLUniformLocation;
  private uTime: WebGLUniformLocation;

  constructor(width: number, height: number) {
    this.canvas = new OffscreenCanvas(width, height);
    const gl = this.canvas.getContext("webgl2", {
      premultipliedAlpha: false,
      alpha: true,
      antialias: true,
    });
    if (!gl) throw new Error("WebGL2 is not available in worker.");
    this.gl = gl;

    const vertexShaderSource = `#version 300 es
    in vec2 a_position;
    in vec2 a_uv;
    uniform vec2 u_resolution;
    uniform vec2 u_position;
    uniform vec2 u_scale;
    out vec2 v_uv;
    void main() {
      vec2 p = a_position * u_scale + u_position;
      vec2 clip = (p / u_resolution) * 2.0 - 1.0;
      gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
      v_uv = a_uv;
    }`;

    const fragmentShaderSource = `#version 300 es
    precision mediump float;
    in vec2 v_uv;
    uniform sampler2D u_tex;
    uniform int u_effect;
    uniform float u_time;
    out vec4 outColor;

    float rand(vec2 st) {
      return fract(sin(dot(st, vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      vec4 src = texture(u_tex, v_uv);
      if (u_effect == 1) {
        float glow = smoothstep(0.2, 1.0, src.a);
        outColor = vec4(src.rgb + vec3(glow * 0.25, 0.0, glow * 0.25), src.a);
        return;
      }
      if (u_effect == 2) {
        float noise = rand(v_uv + u_time * 0.2);
        outColor = vec4(src.rgb + vec3((noise - 0.5) * 0.08), src.a);
        return;
      }
      outColor = src;
    }`;

    const vs = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = this.linkProgram(vs, fs);
    gl.useProgram(this.program);

    this.aPosition = gl.getAttribLocation(this.program, "a_position");
    this.aUv = gl.getAttribLocation(this.program, "a_uv");
    this.uResolution = this.getUniformLocation("u_resolution");
    this.uPosition = this.getUniformLocation("u_position");
    this.uScale = this.getUniformLocation("u_scale");
    this.uEffect = this.getUniformLocation("u_effect");
    this.uTime = this.getUniformLocation("u_time");

    this.texture = gl.createTexture() as WebGLTexture;
    this.posBuffer = gl.createBuffer() as WebGLBuffer;
    this.uvBuffer = gl.createBuffer() as WebGLBuffer;

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(this.aUv);
    gl.vertexAttribPointer(this.aUv, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      gl.DYNAMIC_DRAW
    );
    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);

    gl.viewport(0, 0, width, height);
    gl.uniform2f(this.uResolution, width, height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  public clear() {
    const gl = this.gl;
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  public draw(
    source: TexImageSource,
    x: number,
    y: number,
    width: number,
    height: number,
    effectType: number,
    timeSec: number
  ) {
    const gl = this.gl;
    gl.useProgram(this.program);

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform2f(this.uPosition, x, y);
    gl.uniform2f(this.uScale, width, height);
    gl.uniform1i(this.uEffect, effectType);
    gl.uniform1f(this.uTime, timeSec);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader.");
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error(this.gl.getShaderInfoLog(shader) || "Shader compile failed.");
    }
    return shader;
  }

  private linkProgram(vs: WebGLShader, fs: WebGLShader): WebGLProgram {
    const program = this.gl.createProgram();
    if (!program) throw new Error("Failed to create WebGL program.");
    this.gl.attachShader(program, vs);
    this.gl.attachShader(program, fs);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error(this.gl.getProgramInfoLog(program) || "Program link failed.");
    }
    return program;
  }

  private getUniformLocation(name: string): WebGLUniformLocation {
    const location = this.gl.getUniformLocation(this.program, name);
    if (!location) throw new Error(`Missing uniform: ${name}`);
    return location;
  }
}

function assertNotCancelled() {
  if (cancelRequested) throw new Error("Export canceled");
}

function effectToInt(effects: WorkerEffectDto[]): number {
  for (const effect of effects) {
    if (effect.type === "neon") return 1;
    if (effect.type === "glitch") return 2;
  }
  return 0;
}

function trackDescriptionFromInfo(trackInfo: any): ArrayBuffer | undefined {
  const candidates = [
    trackInfo?.description,
    trackInfo?.avcC,
    trackInfo?.hvcC,
    trackInfo?.vpcC,
    trackInfo?.av1C,
    trackInfo?.esds?.data,
  ];
  const toArrayBuffer = (value: any): ArrayBuffer | undefined => {
    if (!value) return undefined;
    if (value instanceof ArrayBuffer) return value;
    if (value instanceof Uint8Array) {
      const copy = new Uint8Array(value.byteLength);
      copy.set(value);
      return copy.buffer;
    }
    if (value.data) return toArrayBuffer(value.data);
    if (value.buffer instanceof ArrayBuffer) return value.buffer;
    return undefined;
  };
  for (const candidate of candidates) {
    const buffer = toArrayBuffer(candidate);
    if (buffer) return buffer;
  }
  return undefined;
}

function findTrackEntry(mp4File: any, trackId: number): any | null {
  const traks = mp4File?.moov?.traks;
  if (!Array.isArray(traks)) return null;
  for (const trak of traks) {
    const id = trak?.tkhd?.track_id ?? trak?.tkhd?.trackId ?? trak?.tkhd?.trackID;
    if (id !== trackId) continue;
    const entries = trak?.mdia?.minf?.stbl?.stsd?.entries;
    if (!Array.isArray(entries) || entries.length === 0) return null;
    const preferred = entries.find((entry: any) => {
      const name = entry?.box_name ?? entry?.type ?? "";
      return typeof name === "string" && name.startsWith("avc");
    });
    return preferred ?? entries[0];
  }
  return null;
}

function findAvcCFromRawBytes(bytes: ArrayBuffer): ArrayBuffer | undefined {
  const data = new DataView(bytes);
  const typeBytes = new Uint8Array(4);
  for (let i = 0; i + 8 <= data.byteLength; i++) {
    typeBytes[0] = data.getUint8(i + 0);
    typeBytes[1] = data.getUint8(i + 1);
    typeBytes[2] = data.getUint8(i + 2);
    typeBytes[3] = data.getUint8(i + 3);
    const type = String.fromCharCode(...typeBytes);
    if (type !== "avcC") continue;
    const size = data.getUint32(i - 4, false);
    if (size < 8) continue;
    const start = i + 4;
    const end = (i - 4) + size;
    if (end > data.byteLength || start >= end) continue;
    return bytes.slice(start, end);
  }
  return undefined;
}

function sampleToVideoChunk(sample: any): EncodedVideoChunk {
  const timestamp = Math.round((sample.cts / sample.timescale) * 1_000_000);
  const duration = Math.max(1, Math.round((sample.duration / sample.timescale) * 1_000_000));
  return new EncodedVideoChunk({
    type: sample.is_sync ? "key" : "delta",
    timestamp,
    duration,
    data: sample.data instanceof Uint8Array ? sample.data : new Uint8Array(sample.data),
  });
}

function buildAvccFromSpsPps(sps: Uint8Array, pps: Uint8Array, lengthSize: number): ArrayBuffer {
  const lengthSizeMinusOne = Math.max(0, Math.min(3, lengthSize - 1));
  const size =
    6 +
    2 + sps.byteLength +
    1 +
    2 + pps.byteLength;
  const out = new Uint8Array(size);
  let offset = 0;
  out[offset++] = 1;
  out[offset++] = sps[1] ?? 0;
  out[offset++] = sps[2] ?? 0;
  out[offset++] = sps[3] ?? 0;
  out[offset++] = 0xfc | lengthSizeMinusOne;
  out[offset++] = 0xe0 | 1;
  out[offset++] = (sps.byteLength >> 8) & 0xff;
  out[offset++] = sps.byteLength & 0xff;
  out.set(sps, offset);
  offset += sps.byteLength;
  out[offset++] = 1;
  out[offset++] = (pps.byteLength >> 8) & 0xff;
  out[offset++] = pps.byteLength & 0xff;
  out.set(pps, offset);
  return out.buffer;
}

function extractNalUnitsAnnexB(data: Uint8Array): Uint8Array[] {
  const units: Uint8Array[] = [];
  let i = 0;
  const len = data.length;
  const findStart = (pos: number) => {
    for (let j = pos; j + 3 < len; j++) {
      if (data[j] === 0 && data[j + 1] === 0) {
        if (data[j + 2] === 1) return j;
        if (data[j + 2] === 0 && data[j + 3] === 1) return j;
      }
    }
    return -1;
  };
  let start = findStart(0);
  while (start !== -1) {
    let startCodeSize = data[start + 2] === 1 ? 3 : 4;
    let next = findStart(start + startCodeSize);
    const unitStart = start + startCodeSize;
    const unitEnd = next === -1 ? len : next;
    if (unitEnd > unitStart) {
      units.push(data.subarray(unitStart, unitEnd));
    }
    start = next;
  }
  return units;
}

function extractNalUnitsLengthPrefixed(data: Uint8Array, lengthSize: number): Uint8Array[] {
  const units: Uint8Array[] = [];
  let offset = 0;
  if (data.length < lengthSize) return units;
  while (offset + lengthSize <= data.length) {
    let size = 0;
    for (let i = 0; i < lengthSize; i++) {
      size = (size << 8) | data[offset + i];
    }
    offset += lengthSize;
    if (size <= 0 || offset + size > data.length) break;
    units.push(data.subarray(offset, offset + size));
    offset += size;
  }
  return units;
}

function extractAvcDescriptionFromSamples(samples: any[]): ArrayBuffer | null {
  const maxSamples = Math.min(samples.length, 50);
  const lengthSizes = [4, 3, 2, 1];
  let loggedHead = false;

  for (let i = 0; i < maxSamples; i++) {
    const sample = samples[i];
    if (!sample?.data) continue;
    const data = sample.data instanceof Uint8Array ? sample.data : new Uint8Array(sample.data);
    const isAnnexB =
      (data[0] === 0 && data[1] === 0 && data[2] === 1) ||
      (data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 1);
    if (!loggedHead) {
      debugLog(`avcC from samples: dataLen=${data.byteLength} annexB=${isAnnexB}`);
      loggedHead = true;
    }

    if (isAnnexB) {
      const units = extractNalUnitsAnnexB(data);
      let sps: Uint8Array | null = null;
      let pps: Uint8Array | null = null;
      for (const unit of units) {
        const nalType = unit[0] & 0x1f;
        if (nalType === 7 && !sps) sps = unit;
        if (nalType === 8 && !pps) pps = unit;
        if (sps && pps) break;
      }
      if (sps && pps) {
        return buildAvccFromSpsPps(sps, pps, 4);
      }
      continue;
    }

    for (const lengthSize of lengthSizes) {
      const units = extractNalUnitsLengthPrefixed(data, lengthSize);
      if (!units.length) continue;
      let sps: Uint8Array | null = null;
      let pps: Uint8Array | null = null;
      for (const unit of units) {
        const nalType = unit[0] & 0x1f;
        if (nalType === 7 && !sps) sps = unit;
        if (nalType === 8 && !pps) pps = unit;
        if (sps && pps) break;
      }
      if (sps && pps) {
        return buildAvccFromSpsPps(sps, pps, lengthSize);
      }
    }
  }
  return null;
}

function ensureVideoDescription(track: DecodedMp4Track): void {
  if (track.description || !track.codec?.startsWith("avc1")) return;
  const desc = extractAvcDescriptionFromSamples(track.samples);
  if (desc) {
    track.description = desc;
    debugLog(`avcC built from samples: bytes=${desc.byteLength}`);
  } else {
    debugLog("avcC build failed from samples");
  }
}

function filterSamplesByRange(samples: any[], minStart: number, maxEnd: number): any[] {
  if (!samples.length) return samples;
  if (!(minStart < maxEnd)) return samples;
  let lastSyncIndex = -1;
  let started = false;
  const filtered: any[] = [];
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (sample.is_sync) lastSyncIndex = i;
    const timeSec = sample.cts / sample.timescale;
    if (!started) {
      if (timeSec >= minStart) {
        started = true;
        if (lastSyncIndex >= 0) {
          for (let j = lastSyncIndex; j <= i; j++) filtered.push(samples[j]);
        } else {
          filtered.push(sample);
        }
      }
    } else {
      if (timeSec <= maxEnd) {
        filtered.push(sample);
      } else {
        break;
      }
    }
  }
  return filtered;
}

async function demuxMp4(bytes: ArrayBuffer): Promise<DemuxResult> {
  return new Promise<DemuxResult>((resolve, reject) => {
    const mp4File = MP4Box.createFile();
    let videoTrack: DecodedMp4Track | null = null;
    const audioTrack: null = null;
    let resolved = false;
    let expectedVideoSamples = 0;

    const maybeResolve = () => {
      if (resolved) return;
      const videoReady = !videoTrack || videoTrack.samples.length >= expectedVideoSamples;
      if (videoReady) {
        resolved = true;
        resolve({ videoTrack, audioTrack });
      }
    };

    mp4File.onError = (error: string) => {
      if (resolved) return;
      resolved = true;
      reject(new Error(`mp4 demux error: ${error}`));
    };

    mp4File.onReady = (info: any) => {
      const readyVideoTrack = info.videoTracks?.[0] || null;
      if (readyVideoTrack) {
        const entry = findTrackEntry(mp4File, readyVideoTrack.id);
        if (entry) {
          const keys = Object.keys(entry).slice(0, 12).join(",");
          debugLog(`mp4box track entry keys: ${keys}`);
          if (entry.avcC) {
            const avcDesc = trackDescriptionFromInfo(entry.avcC);
            debugLog(`mp4box entry.avcC present: bytes=${avcDesc ? avcDesc.byteLength : 0}`);
          }
        } else {
          debugLog(`mp4box track entry not found for track=${readyVideoTrack.id}`);
        }
        const description =
          trackDescriptionFromInfo(readyVideoTrack) ||
          trackDescriptionFromInfo(entry);
        if (!description) {
          debugLog(`mp4box video description not found for track=${readyVideoTrack.id}`);
        }
        debugLog(`mp4box video track: codec=${readyVideoTrack.codec} samples=${readyVideoTrack.nb_samples} timescale=${readyVideoTrack.timescale}`);
        videoTrack = {
          id: readyVideoTrack.id,
          codec: readyVideoTrack.codec,
          width: readyVideoTrack.video?.width,
          height: readyVideoTrack.video?.height,
          description,
          samples: [],
          timescale: readyVideoTrack.timescale,
        };
        expectedVideoSamples = Number(readyVideoTrack.nb_samples || 0);
        mp4File.setExtractionOptions(readyVideoTrack.id, null, { nbSamples: 500 });
      }

      mp4File.start();
    };

  mp4File.onSamples = (trackId: number, _user: unknown, samples: any[]) => {
    if (videoTrack && trackId === videoTrack.id) {
      videoTrack.samples.push(...samples);
    }
    if (samples?.length) {
      const first = samples[0];
      const kind = videoTrack && trackId === videoTrack.id ? "video" : "audio";
      debugLog(
        `mp4box onSamples ${kind}: count=${samples.length} first={cts=${first.cts} dur=${first.duration} sync=${first.is_sync}}`
      );
    }
    maybeResolve();
  };

    const copy = bytes.slice(0) as any;
    copy.fileStart = 0;
    mp4File.appendBuffer(copy);
    mp4File.flush();

    setTimeout(maybeResolve, 0);
  });
}


class Mp4VideoStream {
  private decoder: VideoDecoder;
  private samples: any[];
  private sampleIndex = 0;
  private latestFrame: VideoFrame | null = null;
  private latestTimestampSec = -Infinity;
  private pendingResolve: (() => void) | null = null;
  private decodeError: Error | null = null;
  private config: VideoDecoderConfig;

  private constructor(track: DecodedMp4Track) {
    this.config = {
      codec: track.codec,
      codedWidth: track.width,
      codedHeight: track.height,
      description: track.description,
      hardwareAcceleration: "prefer-hardware",
      optimizeForLatency: false,
    };
    this.samples = track.samples;
    this.decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        if (this.latestFrame) {
          try { this.latestFrame.close(); } catch {}
        }
        this.latestFrame = frame;
        this.latestTimestampSec = frame.timestamp / 1_000_000;
        if (this.pendingResolve) {
          const resolve = this.pendingResolve;
          this.pendingResolve = null;
          resolve();
        }
      },
      error: (error: DOMException) => {
        this.decodeError = new Error(error.message);
        if (this.pendingResolve) {
          const resolve = this.pendingResolve;
          this.pendingResolve = null;
          resolve();
        }
      },
    });
  }

  public static async create(track: DecodedMp4Track): Promise<Mp4VideoStream> {
    const stream = new Mp4VideoStream(track);
    const support = await VideoDecoder.isConfigSupported(stream.config);
    debugLog(
      `VideoDecoder support: supported=${support.supported} codec=${stream.config.codec} w=${stream.config.codedWidth} h=${stream.config.codedHeight} desc=${stream.config.description ? (stream.config.description.byteLength ?? 0) : 0}`
    );
    if (!support.supported) {
      throw new Error("Unsupported video decoder configuration.");
    }
    stream.decoder.configure(stream.config);
    return stream;
  }

  public async ensureFrameAt(timeSec: number): Promise<void> {
    const epsilon = 1 / 1_000;
    if (this.latestTimestampSec >= timeSec - epsilon) return;
    while (this.sampleIndex < this.samples.length && this.latestTimestampSec < timeSec - epsilon) {
      if (this.decodeError) throw this.decodeError;
      const sample = this.samples[this.sampleIndex++];
      const prevTimestamp = this.latestTimestampSec;
      this.decoder.decode(sampleToVideoChunk(sample));
      if (this.latestTimestampSec >= timeSec - epsilon) break;
      if (this.decoder.decodeQueueSize > 8) {
        await this.waitForOutput(prevTimestamp, 2000);
      }
    }
    if (this.latestTimestampSec < timeSec - epsilon) {
      if (this.sampleIndex >= this.samples.length) return;
      await this.waitForOutput(this.latestTimestampSec, 2000);
    }
  }

  public getFrame(): VideoFrame | null {
    return this.latestFrame;
  }

  public close() {
    try { this.decoder.close(); } catch {}
    if (this.latestFrame) {
      try { this.latestFrame.close(); } catch {}
      this.latestFrame = null;
    }
  }

  private async waitForOutput(prevTimestamp: number, timeoutMs: number): Promise<void> {
    if (this.decodeError) throw this.decodeError;
    if (this.latestTimestampSec > prevTimestamp) return;
    await Promise.race([
      new Promise<void>((resolve) => {
        this.pendingResolve = resolve;
      }),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error("VideoDecoder output timeout")), timeoutMs);
      }),
    ]);
    if (this.decodeError) throw this.decodeError;
  }
}

function toPcmBufferFromMixed(asset: WorkerMixedAudioDto): PCMBuffer {
  const channels = asset.channels.map((channel) => new Float32Array(channel));
  return {
    sampleRate: asset.sampleRate,
    numberOfChannels: asset.numberOfChannels,
    channels,
    durationSec: asset.length / asset.sampleRate,
  };
}

function createTextCanvas(textAsset: WorkerTextAssetDto): OffscreenCanvas {
  const width = Math.max(1, Math.ceil(textAsset.width));
  const height = Math.max(1, Math.ceil(textAsset.height));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable in worker.");
  ctx.clearRect(0, 0, width, height);
  ctx.font = textAsset.style.font;
  ctx.fillStyle = textAsset.style.color;
  ctx.textBaseline = "top";
  ctx.fillText(textAsset.text, 0, 0);
  return canvas;
}

async function encodeAudio(muxer: any, audioPcm: PCMBuffer): Promise<void> {
  const audioConfig: AudioEncoderConfig = {
    codec: "mp4a.40.2",
    sampleRate: audioPcm.sampleRate,
    numberOfChannels: audioPcm.numberOfChannels,
    bitrate: 128_000,
  };
  const support = await AudioEncoder.isConfigSupported(audioConfig);
  if (!support.supported) throw new Error("AAC audio encoding is not supported.");

  const encoder = new AudioEncoder({
    output: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => {
      muxer.addAudioChunk(chunk, meta);
    },
    error: (error: DOMException) => {
      throw new Error(error.message);
    },
  });
  encoder.configure(audioConfig);

  const chunkFrames = 1024;
  const totalFrames = audioPcm.channels[0]?.length || 0;
  let frameOffset = 0;

  while (frameOffset < totalFrames) {
    assertNotCancelled();
    const frameCount = Math.min(chunkFrames, totalFrames - frameOffset);
    const interleaved = new Float32Array(frameCount * audioPcm.numberOfChannels);
    for (let frame = 0; frame < frameCount; frame++) {
      for (let channel = 0; channel < audioPcm.numberOfChannels; channel++) {
        interleaved[frame * audioPcm.numberOfChannels + channel] =
          audioPcm.channels[channel][frameOffset + frame] || 0;
      }
    }
    const audioData = new AudioData({
      format: "f32",
      sampleRate: audioPcm.sampleRate,
      numberOfFrames: frameCount,
      numberOfChannels: audioPcm.numberOfChannels,
      timestamp: Math.round((frameOffset / audioPcm.sampleRate) * 1_000_000),
      data: interleaved,
    });
    encoder.encode(audioData);
    audioData.close();
    frameOffset += frameCount;
  }

  await encoder.flush();
  encoder.close();
}

function buildMp4UsageRanges(tracks: WorkerTrackDto[]): Map<string, { minStart: number; maxEnd: number }> {
  const ranges = new Map<string, { minStart: number; maxEnd: number }>();
  for (const track of tracks) {
    if (track.type !== "mp4") continue;
    for (const item of track.items) {
      const minStart = item.offset;
      const maxEnd = item.offset + item.duration;
      const existing = ranges.get(item.contentId);
      if (!existing) {
        ranges.set(item.contentId, { minStart, maxEnd });
      } else {
        existing.minStart = Math.min(existing.minStart, minStart);
        existing.maxEnd = Math.max(existing.maxEnd, maxEnd);
      }
    }
  }
  return ranges;
}

async function decodeMp4Assets(
  mp4s: WorkerMp4AssetDto[],
  usageRanges: Map<string, { minStart: number; maxEnd: number }>
): Promise<Map<string, Mp4DecodedAsset>> {
  const decoded = new Map<string, Mp4DecodedAsset>();
  for (const mp4 of mp4s) {
    assertNotCancelled();
    const demux = await demuxMp4(mp4.bytes);
    const usage = usageRanges.get(mp4.id);
    if (usage && demux.videoTrack) {
      demux.videoTrack.samples = filterSamplesByRange(
        demux.videoTrack.samples,
        usage.minStart,
        usage.maxEnd
      );
    }
    if (demux.videoTrack) {
      if (!demux.videoTrack.description && mp4.videoDescription) {
        demux.videoTrack.description = mp4.videoDescription;
      }
      if (!demux.videoTrack.description) {
        const rawAvcC = findAvcCFromRawBytes(mp4.bytes);
        if (rawAvcC) {
          demux.videoTrack.description = rawAvcC;
          debugLog(`avcC extracted in worker from raw bytes: ${rawAvcC.byteLength} bytes`);
        }
      }
      ensureVideoDescription(demux.videoTrack);
    }
    decoded.set(mp4.id, {
      id: mp4.id,
      width: mp4.width,
      height: mp4.height,
      videoTrack: demux.videoTrack,
      audioPcm: null,
    });
  }
  return decoded;
}

async function renderAndEncodeProject(project: WorkerProjectDto): Promise<ArrayBuffer> {
  const renderer = new WorkerRenderer(project.width, project.height);
  const imageMap = new Map(project.images.map((asset) => [asset.id, asset.bitmap] as const));
  const textCanvasMap = new Map(project.texts.map((asset) => [asset.id, createTextCanvas(asset)] as const));
  const usageRanges = buildMp4UsageRanges(project.tracks);
  const decodedMp4Map = await decodeMp4Assets(project.mp4s, usageRanges);
  const mp4ItemStreams = new Map<string, Mp4VideoStream>();
  const mp4Items: { item: WorkerTrackItemDto; decoded: Mp4DecodedAsset }[] = [];

  for (const track of project.tracks) {
    if (track.type !== "mp4") continue;
    for (const item of track.items) {
      const decoded = decodedMp4Map.get(item.contentId);
      if (!decoded?.videoTrack) continue;
      mp4Items.push({ item, decoded });
    }
  }

  for (const { item, decoded } of mp4Items) {
    const stream = await Mp4VideoStream.create(decoded.videoTrack as DecodedMp4Track);
    mp4ItemStreams.set(item.id, stream);
  }

  const muxerTarget = new Mp4Muxer.ArrayBufferTarget();
  const muxerOptions: any = {
    target: muxerTarget,
    video: {
      codec: "avc",
      width: project.width,
      height: project.height,
    },
    fastStart: "in-memory",
  };

  const mixedAudio = project.mixedAudio ? toPcmBufferFromMixed(project.mixedAudio) : null;
  if (mixedAudio) {
    muxerOptions.audio = {
      codec: "aac",
      numberOfChannels: mixedAudio.numberOfChannels,
      sampleRate: mixedAudio.sampleRate,
    };
  }

  const muxer = new Mp4Muxer.Muxer(muxerOptions);

  const videoConfig: VideoEncoderConfig = {
    codec: "avc1.42001f",
    width: project.width,
    height: project.height,
    framerate: project.fps,
    bitrate: 8_000_000,
    hardwareAcceleration: "prefer-hardware",
  };
  const videoSupport = await VideoEncoder.isConfigSupported(videoConfig);
  if (!videoSupport.supported) throw new Error("H264 encoding is not supported.");

  const videoEncoder = new VideoEncoder({
    output: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (error: DOMException) => {
      throw new Error(error.message);
    },
  });
  videoEncoder.configure(videoConfig);

  const frameCount = Math.max(1, Math.ceil(project.duration * project.fps));
  const frameDurationMicros = Math.round(1_000_000 / project.fps);

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    assertNotCancelled();
    const timeSec = frameIndex / project.fps;
    renderer.clear();

    for (const track of project.tracks) {
      if (track.type === "audio") continue;
      for (const item of track.items) {
        if (!(item.start <= timeSec && timeSec < item.start + item.duration)) continue;
        const drawWidth = item.scale * (
          project.images.find((asset) => asset.id === item.contentId)?.width ??
          project.texts.find((asset) => asset.id === item.contentId)?.width ??
          decodedMp4Map.get(item.contentId)?.width ??
          0
        );
        const drawHeight = item.scale * (
          project.images.find((asset) => asset.id === item.contentId)?.height ??
          project.texts.find((asset) => asset.id === item.contentId)?.height ??
          decodedMp4Map.get(item.contentId)?.height ??
          0
        );
        if (drawWidth <= 0 || drawHeight <= 0) continue;

        let source: TexImageSource | null = null;
        if (track.type === "image") {
          source = imageMap.get(item.contentId) || null;
        } else if (track.type === "text") {
          source = textCanvasMap.get(item.contentId) || null;
        } else if (track.type === "mp4") {
          const decoded = decodedMp4Map.get(item.contentId);
          if (!decoded?.videoTrack) continue;
          const localVideoTime = Math.max(0, timeSec - item.start + item.offset);
          const stream = mp4ItemStreams.get(item.id);
          if (!stream) continue;
          await stream.ensureFrameAt(localVideoTime);
          source = stream.getFrame();
        }

        if (!source) continue;
        renderer.draw(source, item.x, item.y, drawWidth, drawHeight, effectToInt(item.effects), timeSec);
      }
    }

    const outputFrame = new VideoFrame(renderer.canvas, {
      timestamp: frameIndex * frameDurationMicros,
      duration: frameDurationMicros,
    });
    videoEncoder.encode(outputFrame, { keyFrame: frameIndex % 2 === 1 });
    outputFrame.close();

    if (frameIndex % Math.max(1, Math.floor(project.fps / 2)) === 0) {
      workerScope.postMessage({
        type: "progress",
        progress: 20 + (frameIndex / frameCount) * 70,
      } satisfies WorkerOutMessage);
    }
  }

  await videoEncoder.flush();
  videoEncoder.close();

  if (mixedAudio) {
    assertNotCancelled();
    await encodeAudio(muxer, mixedAudio);
  }

  muxer.finalize();

  for (const stream of mp4ItemStreams.values()) {
    stream.close();
  }

  const outputBuffer = muxerTarget.buffer as ArrayBuffer;
  if (!outputBuffer) throw new Error("Muxer produced an empty result buffer.");
  return outputBuffer;
}

async function startExport(project: WorkerProjectDto) {
  if (
    !("VideoEncoder" in self) ||
    !("VideoDecoder" in self) ||
    !("AudioDecoder" in self) ||
    !("OffscreenCanvas" in self)
  ) {
    throw new Error("Required worker APIs are unavailable.");
  }
  workerScope.postMessage({ type: "progress", progress: 5 } satisfies WorkerOutMessage);
  const result = await renderAndEncodeProject(project);
  workerScope.postMessage({ type: "progress", progress: 100 } satisfies WorkerOutMessage);
  workerScope.postMessage({ type: "done", buffer: result } satisfies WorkerOutMessage, [result]);
}

workerScope.onerror = (event: ErrorEvent) => {
  try {
    workerScope.postMessage({
      type: "error",
      message: `Worker error: ${event.message || "unknown"}`,
    } satisfies WorkerOutMessage);
  } catch {}
};

(workerScope as any).onunhandledrejection = (event: PromiseRejectionEvent) => {
  try {
    const reason = (event as any).reason;
    const msg = typeof reason === "string" ? reason : (reason?.message || String(reason));
    workerScope.postMessage({
      type: "error",
      message: `Worker unhandled rejection: ${msg}`,
    } satisfies WorkerOutMessage);
  } catch {}
};

workerScope.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const message = event.data;
  if (!message) return;

  if (message.type === "cancel") {
    cancelRequested = true;
    return;
  }

  if (message.type === "start") {
    cancelRequested = false;
    startExport(message.project).catch((error: Error) => {
      workerScope.postMessage({
        type: "error",
        message: error.message || "Worker export failed.",
      } satisfies WorkerOutMessage);
    });
  }
};

workerScope.postMessage({ type: "ready" } satisfies WorkerOutMessage);
