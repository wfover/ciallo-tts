// 共享的 API 契约类型（前后端通用）

/** 内置 API 标识 */
export type BuiltinApiId = "edge-api" | "oai-tts";

/** 自定义 API 配置（存于 localStorage） */
export interface CustomApi {
  id: string;
  name: string;
  /** openai | edge */
  format: "openai" | "edge";
  endpoint: string;
  apiKey?: string;
  modelEndpoint?: string;
  manual?: string[];
  maxLength?: number | null;
  enableSegmentation?: boolean;
}

/** 讲述人映射：{ ShortName: 显示名 } */
export type SpeakerMap = Record<string, string>;

/** 历史记录条目（内存态） */
export interface HistoryItem {
  id: number;
  /** 请求号 + 可选段号（如 "3(2/5)"、"3(合并)"） */
  label: string;
  timestamp: string;
  speaker: string;
  text: string;
  audioUrl: string;
  blob: Blob;
  requestInfo: string;
}

/** 生成进度 */
export interface GenerateProgress {
  message: string;
  percent: number;
}
