// 通用请求模板 / 长度限制 / 输出格式映射 单元测试：node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeAudioPayload,
  getByPath,
  parseHeaderLines,
  renderBody,
  renderTemplate,
  type TemplateVars,
} from "../src/lib/templateTts.ts";
import { getApiLimits, resolveApiLimits } from "../src/lib/segmentation.ts";
import { generateSsml, normalizeOutputFormat, DEFAULT_OUTPUT_FORMAT } from "../src/lib/edgeTts.ts";

const VARS: TemplateVars = {
  text: "你好\"世界\"",
  voice: "voice-id",
  model: "some-model",
  rate: -20,
  pitch: 5,
  format: "mp3",
  instructions: "开心点",
  apiKey: "sk-123",
  preview: false,
};

// ---------- renderTemplate ----------
test("renderTemplate: 普通（非 JSON）占位符原样替换", () => {
  assert.equal(renderTemplate("v={{voice}}&r={{rate}}", VARS), "v=voice-id&r=-20");
});

test("renderTemplate: JSON 模式转义引号，保证拼接后仍是合法 JSON", () => {
  const out = renderTemplate('{"text":"{{text}}"}', VARS, { json: true });
  assert.deepEqual(JSON.parse(out), { text: '你好"世界"' });
});

test("renderTemplate: textXml 做 XML 转义", () => {
  const out = renderTemplate("{{textXml}}", { text: 'a&b<c>"d"' });
  assert.equal(out, "a&amp;b&lt;c&gt;&quot;d&quot;");
});

test("renderTemplate: model 缺省时回退到 voice", () => {
  assert.equal(renderTemplate("{{model}}", { voice: "v1" }), "v1");
});

test("renderTemplate: 未知占位符替换为空串", () => {
  assert.equal(renderTemplate("[{{nope}}]", VARS), "[]");
});

test("renderTemplate: preview 布尔转字符串", () => {
  assert.equal(renderTemplate("{{preview}}", { preview: true }), "true");
});

// ---------- parseHeaderLines ----------
test("parseHeaderLines: 解析多行并替换占位符，跳过注释与非法行", () => {
  const headers = parseHeaderLines(
    "# 注释\nxi-api-key: {{apiKey}}\nContent-Type: application/json\n\n没有冒号",
    VARS
  );
  assert.deepEqual(headers, {
    "xi-api-key": "sk-123",
    "Content-Type": "application/json",
  });
});

test("parseHeaderLines: 空输入返回空对象", () => {
  assert.deepEqual(parseHeaderLines(undefined, VARS), {});
  assert.deepEqual(parseHeaderLines("", VARS), {});
});

// ---------- renderBody ----------
test("renderBody: json 类型校验并规范化", () => {
  const body = renderBody('{"text":"{{text}}","format":"{{format}}"}', VARS, "json");
  assert.deepEqual(JSON.parse(body as string), { text: '你好"世界"', format: "mp3" });
});

test("renderBody: json 类型非法语法抛错", () => {
  assert.throws(() => renderBody("{not json", VARS, "json"), /不是合法 JSON/);
});

test("renderBody: raw 类型不解析（用于 SSML）", () => {
  const out = renderBody('<speak><voice name="{{voice}}"/></speak>', VARS, "raw");
  assert.equal(out, '<speak><voice name="voice-id"/></speak>');
});

test("renderBody: 空模板返回 undefined", () => {
  assert.equal(renderBody(undefined, VARS, "json"), undefined);
});

// ---------- getByPath ----------
test("getByPath: 嵌套对象与数组下标", () => {
  const data = { data: { audio: "AAA", list: [{ url: "u1" }] } };
  assert.equal(getByPath(data, "data.audio"), "AAA");
  assert.equal(getByPath(data, "data.list.0.url"), "u1");
});

test("getByPath: 路径缺失返回 undefined", () => {
  assert.equal(getByPath({ a: 1 }, "a.b.c"), undefined);
  assert.equal(getByPath(null, "a"), undefined);
});

test("getByPath: 空路径返回原对象", () => {
  const obj = { a: 1 };
  assert.equal(getByPath(obj, ""), obj);
});

// ---------- decodeAudioPayload ----------
test("decodeAudioPayload: base64 解码", () => {
  const buf = new Uint8Array(decodeAudioPayload("aGVsbG8=", "base64"));
  assert.equal(new TextDecoder().decode(buf), "hello");
});

test("decodeAudioPayload: hex 解码", () => {
  const buf = new Uint8Array(decodeAudioPayload("68656c6c6f", "hex"));
  assert.equal(new TextDecoder().decode(buf), "hello");
});

// ---------- resolveApiLimits ----------
test("resolveApiLimits: 无自定义限制时用格式默认值", () => {
  assert.deepEqual(resolveApiLimits("openai"), getApiLimits("openai"));
  assert.deepEqual(resolveApiLimits("edge", null), getApiLimits("edge"));
});

test("resolveApiLimits: 自定义 maxLength 同时生效于单段与总量", () => {
  assert.deepEqual(resolveApiLimits("openai", 1000), { maxSegment: 1000, maxTotal: 5000 });
  assert.deepEqual(resolveApiLimits("openai", 0), getApiLimits("openai"));
});

test("getApiLimits: template 使用宽松默认值", () => {
  assert.deepEqual(getApiLimits("template"), { maxSegment: 5000, maxTotal: 100000 });
});

// ---------- normalizeOutputFormat ----------
test("normalizeOutputFormat: UI 简写映射为 Microsoft 格式", () => {
  assert.equal(normalizeOutputFormat("mp3"), "audio-24khz-48kbitrate-mono-mp3");
  assert.equal(normalizeOutputFormat("opus"), "webm-24khz-16bit-mono-opus");
  assert.equal(normalizeOutputFormat("wav"), "riff-24khz-16bit-mono-pcm");
  assert.equal(normalizeOutputFormat("pcm"), "raw-16khz-16bit-mono-pcm");
});

test("normalizeOutputFormat: 完整格式原样透传，空值用默认", () => {
  assert.equal(normalizeOutputFormat("audio-24khz-48kbitrate-mono-mp3"), "audio-24khz-48kbitrate-mono-mp3");
  assert.equal(normalizeOutputFormat(undefined), DEFAULT_OUTPUT_FORMAT);
  assert.equal(normalizeOutputFormat(""), DEFAULT_OUTPUT_FORMAT);
});

// ---------- generateSsml 高级参数 ----------
test("generateSsml: 默认 style/role/volume", () => {
  const ssml = generateSsml("你好", "v", 0, 0);
  assert.ok(ssml.includes('style="general"'));
  assert.ok(ssml.includes('role="default"'));
  assert.ok(ssml.includes('volume="50"'));
});

test("generateSsml: 自定义 style/role/volume 生效并转义", () => {
  const ssml = generateSsml("你好", "v", 10, -5, {
    style: "cheerful",
    role: "YoungAdultFemale",
    volume: 80,
  });
  assert.ok(ssml.includes('style="cheerful"'));
  assert.ok(ssml.includes('role="YoungAdultFemale"'));
  assert.ok(ssml.includes('volume="80"'));
  assert.ok(ssml.includes('rate="10%"'));

  const injected = generateSsml("你好", "v", 0, 0, { style: 'a" onload="x' });
  assert.ok(!injected.includes('style="a" onload="x"'), "style 未转义: " + injected);
});
