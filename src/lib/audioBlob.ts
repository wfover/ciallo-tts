// 音频容器处理：裸 PCM 没有容器头，浏览器 <audio> 无法解码，
// 这里负责把裸 PCM 封装为 WAV，以及把多段 WAV 正确合并成单文件。
// 全部为纯函数，便于单元测试。

const ID_RIFF = 0x52494646; // 'RIFF'
const ID_WAVE = 0x57415645; // 'WAVE'
const ID_FMT = 0x666d7420; // 'fmt '
const ID_DATA = 0x64617461; // 'data'

/** 标准 44 字节 WAV 头长度 */
export const WAV_HEADER_SIZE = 44;

export interface PcmSpec {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

/** Edge 内置 API 的裸 PCM（raw-16khz-16bit-mono-pcm） */
export const PCM_SPEC_EDGE: PcmSpec = { sampleRate: 16000, channels: 1, bitsPerSample: 16 };
/** OpenAI 兼容接口的 pcm（24kHz / 16bit / 单声道，小端） */
export const PCM_SPEC_OPENAI: PcmSpec = { sampleRate: 24000, channels: 1, bitsPerSample: 16 };

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/** 是否已经是 RIFF/WAVE 容器 */
export function isRiffWav(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false;
  const view = new DataView(buffer);
  return view.getUint32(0, false) === ID_RIFF && view.getUint32(8, false) === ID_WAVE;
}

export interface WavLayout {
  spec: PcmSpec;
  /** data chunk 数据起始偏移 */
  dataOffset: number;
  dataSize: number;
}

/** 解析 WAV 的 fmt 与 data chunk（兼容 chunck 顺序与额外 chunk） */
export function parseWav(buffer: ArrayBuffer): WavLayout | null {
  if (buffer.byteLength < WAV_HEADER_SIZE || !isRiffWav(buffer)) return null;
  const view = new DataView(buffer);
  let offset = 12;
  let spec: PcmSpec | null = null;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.byteLength) {
    const id = view.getUint32(offset, false);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;

    if (id === ID_FMT && body + 16 <= buffer.byteLength) {
      spec = {
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === ID_DATA) {
      dataOffset = body;
      dataSize = Math.max(0, Math.min(size, buffer.byteLength - body));
      break;
    }
    // chunk 按偶数字节对齐
    offset = body + size + (size % 2);
  }

  if (!spec || dataOffset < 0) return null;
  return { spec, dataOffset, dataSize };
}

/** 用标准 44 字节头把裸 PCM 封装为可播放的 WAV */
export function pcmToWav(pcm: ArrayBuffer, spec: PcmSpec): Blob {
  const { sampleRate, channels, bitsPerSample } = spec;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = new ArrayBuffer(WAV_HEADER_SIZE);
  const view = new DataView(header);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk 长度
  view.setUint16(20, 1, true); // 编码：PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, pcm.byteLength, true);

  return new Blob([header, pcm], { type: "audio/wav" });
}

/** 按 WAV 头信息组装单文件 WAV */
function buildWav(spec: PcmSpec, chunks: Array<{ buffer: ArrayBuffer; layout: WavLayout }>): Blob {
  const total = chunks.reduce((sum, c) => sum + c.layout.dataSize, 0);
  const blockAlign = (spec.channels * spec.bitsPerSample) / 8;
  const out = new Uint8Array(WAV_HEADER_SIZE + total);
  const view = new DataView(out.buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + total, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, spec.channels, true);
  view.setUint32(24, spec.sampleRate, true);
  view.setUint32(28, spec.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, spec.bitsPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, total, true);

  let offset = WAV_HEADER_SIZE;
  for (const { buffer, layout } of chunks) {
    out.set(new Uint8Array(buffer, layout.dataOffset, layout.dataSize), offset);
    offset += layout.dataSize;
  }
  return new Blob([out], { type: "audio/wav" });
}

/**
 * 合并多段音频。
 * - 全部是 WAV：按 PCM 数据拼接并重写头（直接拼多份 RIFF 头会导致只播第一段）
 * - 其余（如 mp3）：直接顺序拼接（可流式播放）
 */
export async function mergeAudioBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) throw new Error("没有可合并的音频");
  if (blobs.length === 1) return blobs[0];

  const buffers = await Promise.all(blobs.map((b) => b.arrayBuffer()));
  const layouts = buffers.map(parseWav);

  if (layouts.every((l): l is WavLayout => l !== null)) {
    return buildWav(layouts[0].spec, buffers.map((buffer, i) => ({ buffer, layout: layouts[i] })));
  }
  return new Blob(blobs, { type: "audio/mpeg" });
}

/**
 * 请求返回的音频若为裸 PCM，则按给定规格封装为 WAV，使其可播放/可下载；
 * 已经是 RIFF/WAVE 或非 pcm 格式时原样返回。
 */
export async function ensurePlayableAudio(
  blob: Blob,
  audioFormat: string,
  pcmSpec: PcmSpec
): Promise<Blob> {
  if (audioFormat !== "pcm") return blob;
  const buffer = await blob.arrayBuffer();
  if (isRiffWav(buffer)) return blob;
  return pcmToWav(buffer, pcmSpec);
}
