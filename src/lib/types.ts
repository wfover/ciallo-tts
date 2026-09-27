// 共享的 API 契约类型（前后端通用）

/** 内置 API 标识 */
export type BuiltinApiId = "edge-api" | "oai-tts";

/**
 * 请求协议：
 * - openai：OpenAI /v1/audio/speech 风格请求体
 * - edge：内置 /api/tts 的 { text, voice, rate, pitch, preview } 契约
 * - template：通用请求模板，用户自定义 method/headers/body/响应解析
 */
export type ApiFormat = "openai" | "edge" | "template";

/** 通用请求模板配置（format === "template" 时使用） */
export interface TemplateConfig {
  /** HTTP 方法，默认 POST */
  method?: "POST" | "GET";
  /** 请求头，每行 "Key: Value"，值支持占位符，如 `xi-api-key: {{apiKey}}` */
  headers?: string;
  /** GET 时拼接到 URL 的查询串模板，如 `text={{text}}&voice={{voice}}` */
  query?: string;
  /** 请求体模板；bodyType=json 时须为合法 JSON，占位符按 JSON 字符串转义 */
  body?: string;
  /** 请求体类型：json（默认，会 JSON.parse 校验）| raw（原样发送，如 SSML/XML） */
  bodyType?: "json" | "raw";
  /** 响应类型：audio（直接返回音频，默认）| json（从 JSON 中取字段） */
  responseType?: "audio" | "json";
  /** responseType=json 时音频字段路径，如 data.audio / audioContent */
  responsePath?: string;
  /** JSON 音频编码：base64（默认）| hex | url（字段是音频地址，需再下载） */
  responseEncoding?: "base64" | "hex" | "url";
}

/** 自定义 API 配置（存于 localStorage） */
export interface CustomApi {
  id: string;
  name: string;
  format: ApiFormat;
  endpoint: string;
  apiKey?: string;
  modelEndpoint?: string;
  manual?: string[];
  maxLength?: number | null;
  enableSegmentation?: boolean;
  /** 固定模型名；openai 格式留空时沿用旧行为（把讲述人当 model） */
  model?: string;
  /** 额外请求体参数（JSON 对象字符串），会合并进请求体 */
  extraParams?: string;
  /** 通用请求模板配置 */
  template?: TemplateConfig;
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
