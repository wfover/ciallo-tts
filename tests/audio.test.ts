// 音频容器处理单元测试（裸 PCM → WAV、多段 WAV 合并）
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ensurePlayableAudio,
  isRiffWav,
  mergeAudioBlobs,
  parseWav,
  pcmToWav,
  PCM_SPEC_EDGE,
  PCM_SPEC_OPENAI,
} from "../src/lib/audioBlob.ts";

function ascii(buffer: ArrayBuffer, offset: number, length: number): string {
  return new TextDecoder().decode(new Uint8Array(buffer, offset, length));
}

// ---------- pcmToWav ----------
test("pcmToWav: 生成合法的 44 字节 RIFF/WAVE 头", async () => {
  const pcm = new Uint8Array([1, 2, 3, 4, 5, 6]).buffer;
  const blob = pcmToWav(pcm, { sampleRate: 24000, channels: 1, bitsPerSample: 16 });
  assert.equal(blob.type, "audio/wav");

  const buf = await blob.arrayBuffer();
  assert.equal(buf.byteLength, 44 + 6);
  assert.equal(ascii(buf, 0, 4), "RIFF");
  assert.equal(ascii(buf, 8, 4), "WAVE");
  assert.equal(ascii(buf, 12, 4), "fmt ");
  assert.equal(ascii(buf, 36, 4), "data");

  const view = new DataView(buf);
  assert.equal(view.getUint32(4, true), 36 + 6); // RIFF chunk size
  assert.equal(view.getUint32(16, true), 16); // fmt chunk size
  assert.equal(view.getUint16(20, true), 1); // PCM
  assert.equal(view.getUint16(22, true), 1); // channels
  assert.equal(view.getUint32(24, true), 24000); // sampleRate
  assert.equal(view.getUint32(28, true), 48000); // byteRate
  assert.equal(view.getUint16(32, true), 2); // blockAlign
  assert.equal(view.getUint16(34, true), 16); // bitsPerSample
  assert.equal(view.getUint32(40, true), 6); // data size
  assert.equal(isRiffWav(buf), true);
});

test("pcmToWav: 立体声 16bit 的 byteRate/blockAlign 正确", async () => {
  const blob = pcmToWav(new Uint8Array(4).buffer, { sampleRate: 16000, channels: 2, bitsPerSample: 16 });
  const view = new DataView(await blob.arrayBuffer());
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint16(32, true), 4);
  assert.equal(view.getUint32(28, true), 64000);
});

// ---------- isRiffWav / parseWav ----------
test("isRiffWav: 裸 PCM 与过短数据返回 false", () => {
  assert.equal(isRiffWav(new Uint8Array([0x52, 0x49, 0x46, 0x46]).buffer), false);
  assert.equal(isRiffWav(new Uint8Array(64).buffer), false);
  assert.equal(isRiffWav(new ArrayBuffer(0)), false);
});

test("parseWav: 回读 fmt 与 data 偏移", async () => {
  const wav = pcmToWav(new Uint8Array(8).buffer, PCM_SPEC_EDGE);
  const layout = parseWav(await wav.arrayBuffer());
  assert.ok(layout);
  assert.deepEqual(layout.spec, { sampleRate: 16000, channels: 1, bitsPerSample: 16 });
  assert.equal(layout.dataOffset, 44);
  assert.equal(layout.dataSize, 8);
});

test("parseWav: 非 WAV 返回 null", () => {
  assert.equal(parseWav(new Uint8Array(4).buffer), null);
  assert.equal(parseWav(new Uint8Array(200).buffer), null);
});

// ---------- mergeAudioBlobs ----------
test("mergeAudioBlobs: 两段 WAV 合并为单个 WAV（只保留一个头）", async () => {
  const first = pcmToWav(new Uint8Array([1, 2, 3, 4]).buffer, PCM_SPEC_OPENAI);
  const second = pcmToWav(new Uint8Array([5, 6]).buffer, PCM_SPEC_OPENAI);
  const merged = await mergeAudioBlobs([first, second]);

  assert.equal(merged.type, "audio/wav");
  const buf = await merged.arrayBuffer();
  assert.equal(buf.byteLength, 44 + 6, "不应出现两份 RIFF 头");
  const view = new DataView(buf);
  assert.equal(view.getUint32(40, true), 6);
  assert.deepEqual([...new Uint8Array(buf, 44, 6)], [1, 2, 3, 4, 5, 6]);
});

test("mergeAudioBlobs: 非 WAV 直接顺序拼接", async () => {
  const merged = await mergeAudioBlobs([
    new Blob([new Uint8Array([1, 2])]),
    new Blob([new Uint8Array([3])]),
  ]);
  assert.equal(merged.size, 3);
  assert.equal(merged.type, "audio/mpeg");
});

test("mergeAudioBlobs: 单段原样返回", async () => {
  const only = new Blob([new Uint8Array([9])]);
  assert.equal(await mergeAudioBlobs([only]), only);
});

test("mergeAudioBlobs: 空数组抛错", async () => {
  await assert.rejects(() => mergeAudioBlobs([]), /没有可合并的音频/);
});

// ---------- ensurePlayableAudio ----------
test("ensurePlayableAudio: 裸 PCM 被封装为可播放的 WAV", async () => {
  const raw = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "application/octet-stream" });
  const out = await ensurePlayableAudio(raw, "pcm", PCM_SPEC_OPENAI);
  assert.equal(out.type, "audio/wav");
  assert.equal(out.size, 44 + 4);
});

test("ensurePlayableAudio: 非 pcm 原样返回", async () => {
  const mp3 = new Blob([new Uint8Array([1, 2])], { type: "audio/mpeg" });
  assert.equal(await ensurePlayableAudio(mp3, "mp3", PCM_SPEC_OPENAI), mp3);
});

test("ensurePlayableAudio: 已是 WAV 时不重复封装", async () => {
  const wav = pcmToWav(new Uint8Array([1, 2]).buffer, PCM_SPEC_OPENAI);
  assert.equal(await ensurePlayableAudio(wav, "pcm", PCM_SPEC_OPENAI), wav);
});
