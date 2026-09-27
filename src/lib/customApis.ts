// 自定义 API 的 localStorage 读写、导入导出与模型获取（自 script.js 移植）
import type { CustomApi, SpeakerMap } from "./types";

const STORAGE_KEY = "customAPIs";

export type CustomApiMap = Record<string, CustomApi>;

export function loadCustomApis(): CustomApiMap {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as CustomApiMap) : {};
  } catch (error) {
    console.error("加载自定义API失败:", error);
    return {};
  }
}

export function persistCustomApis(apis: CustomApiMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apis));
}

export function newCustomApiId(): string {
  return `custom-${Date.now()}`;
}

/** 获取自定义 API 的讲述人列表（OpenAI /models 格式） */
export async function fetchCustomSpeakers(api: CustomApi): Promise<SpeakerMap> {
  if (!api.modelEndpoint) {
    return { default: "默认讲述者" };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (api.apiKey) {
    headers["Authorization"] = `Bearer ${api.apiKey}`;
  }

  const response = await fetch(api.modelEndpoint, { method: "GET", headers });
  if (!response.ok) {
    throw new Error(`获取讲述者失败: ${response.status}`);
  }

  const data = await response.json();
  if (data.data && Array.isArray(data.data)) {
    const ttsModels = data.data.filter(
      (model: { id: string }) =>
        model.id.startsWith("tts-") ||
        ["alloy", "echo", "fable", "onyx", "nova", "shimmer"].includes(model.id)
    );
    if (ttsModels.length === 0) {
      return { default: "未找到TTS模型" };
    }
    const speakerMap: SpeakerMap = {};
    ttsModels.forEach((model: { id: string }) => {
      speakerMap[model.id] = model.id;
    });
    return speakerMap;
  }
  console.warn("API返回格式不是标准OpenAI格式:", data);
  return { default: "自定义讲述人" };
}

/** 拉取模型列表，返回逗号拼接的讲述人字符串（弹窗“获取模型”按钮用） */
export async function fetchModelList(api: {
  modelEndpoint?: string;
  apiKey?: string;
  format: "openai" | "edge";
}): Promise<string[]> {
  if (!api.modelEndpoint) {
    throw new Error("请先填写模型列表端点");
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (api.apiKey) {
    headers["Authorization"] = `Bearer ${api.apiKey}`;
  }
  const response = await fetch(api.modelEndpoint, { method: "GET", headers });
  if (!response.ok) {
    throw new Error(`获取模型失败: ${response.status}`);
  }
  const data = await response.json();

  if (api.format === "openai" && data.data && Array.isArray(data.data)) {
    return data.data.map((m: { id?: string; name?: string }) => m.id || m.name).filter(Boolean);
  }
  // edge 格式：数组项 m.ShortName || m.name
  if (Array.isArray(data)) {
    return data
      .map((m: { ShortName?: string; name?: string; id?: string }) => m.ShortName || m.name || m.id)
      .filter((v): v is string => Boolean(v));
  }
  throw new Error("无法识别的模型列表格式");
}

export interface ExportFile {
  version: string;
  timestamp: string;
  apis: CustomApi[];
}

export function buildExport(apis: CustomApiMap): ExportFile {
  return {
    version: "1.0",
    timestamp: new Date().toISOString(),
    apis: Object.values(apis),
  };
}

export function exportFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `ciallo-tts-apis-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/** 解析导入文件，校验结构 */
export function parseImportFile(text: string): CustomApi[] {
  const data = JSON.parse(text);
  if (!data.apis || !Array.isArray(data.apis)) {
    throw new Error("文件格式不正确：缺少 apis 数组");
  }
  return data.apis.filter(
    (api: CustomApi) => api && api.name && api.endpoint
  );
}

/** 合并导入的 API：按 name+endpoint 去重，同名同端点则更新，否则新增 */
export function mergeImportedApis(existing: CustomApiMap, incoming: CustomApi[]): CustomApiMap {
  const merged: CustomApiMap = { ...existing };
  for (const api of incoming) {
    const match = Object.entries(merged).find(
      ([, cur]) => cur.name === api.name && cur.endpoint === api.endpoint
    );
    if (match) {
      merged[match[0]] = { ...match[1], ...api, id: match[0] };
    } else {
      const id = `${newCustomApiId()}-${Object.keys(merged).length}`;
      merged[id] = { ...api, id };
    }
  }
  return merged;
}
