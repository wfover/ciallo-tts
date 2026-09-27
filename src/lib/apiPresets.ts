// 常见 TTS 服务预设：点击后把配置预填进“管理自定义API”表单，用户只需补 apiKey / 区域等。
// 预设本质就是模板（或 openai/edge 格式）的预填值，不引入额外的硬编码请求逻辑。
import type { CustomApi } from "./types";

export interface ApiPreset {
  id: string;
  name: string;
  description: string;
  /** 预填的 API 配置（id 由调用方生成） */
  api: Omit<CustomApi, "id">;
}

export const API_PRESETS: ApiPreset[] = [
  {
    id: "openai",
    name: "OpenAI 官方 TTS",
    description: "api.openai.com /v1/audio/speech，需填 API Key",
    api: {
      name: "OpenAI TTS",
      format: "openai",
      endpoint: "https://api.openai.com/v1/audio/speech",
      model: "gpt-4o-mini-tts",
      modelEndpoint: "https://api.openai.com/v1/models",
      manual: ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"],
      maxLength: 400,
      enableSegmentation: true,
    },
  },
  {
    id: "siliconflow",
    name: "硅基流动 SiliconFlow",
    description: "OpenAI 兼容 /v1/audio/speech，CosyVoice2 开源音色",
    api: {
      name: "SiliconFlow",
      format: "openai",
      endpoint: "https://api.siliconflow.cn/v1/audio/speech",
      model: "FunAudioLLM/CosyVoice2-0.5B",
      modelEndpoint: "https://api.siliconflow.cn/v1/models",
      manual: [
        "FunAudioLLM/CosyVoice2-0.5B:alex",
        "FunAudioLLM/CosyVoice2-0.5B:anna",
        "FunAudioLLM/CosyVoice2-0.5B:bella",
        "FunAudioLLM/CosyVoice2-0.5B:benjamin",
        "FunAudioLLM/CosyVoice2-0.5B:charles",
        "FunAudioLLM/CosyVoice2-0.5B:diana",
      ],
      maxLength: 1000,
      enableSegmentation: true,
    },
  },
  {
    id: "oneapi",
    name: "One-API / New-API 网关",
    description: "自建 OpenAI 兼容聚合网关，请替换为你的网关地址",
    api: {
      name: "One-API 网关",
      format: "openai",
      endpoint: "https://your-gateway.example.com/v1/audio/speech",
      model: "tts-1",
      modelEndpoint: "https://your-gateway.example.com/v1/models",
      manual: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
      maxLength: 400,
      enableSegmentation: true,
    },
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "模板格式，xi-api-key 鉴权；端点中的 {{voice}} 为 voice_id",
    api: {
      name: "ElevenLabs",
      format: "template",
      endpoint: "https://api.elevenlabs.io/v1/text-to-speech/{{voice}}",
      model: "eleven_multilingual_v2",
      manual: ["21m00Tcm4TlvDq8ikWAM", "EXAVITQu4vr4xnSDxMaL"],
      maxLength: 1000,
      enableSegmentation: true,
      template: {
        method: "POST",
        headers: "xi-api-key: {{apiKey}}\nContent-Type: application/json\nAccept: audio/mpeg",
        bodyType: "json",
        body: '{"text":"{{text}}","model_id":"{{model}}"}',
        responseType: "audio",
      },
    },
  },
  {
    id: "minimax",
    name: "MiniMax 语音",
    description: "模板格式，T2A v2；如你的接口需要 GroupId 请在端点补 ?GroupId=xxx",
    api: {
      name: "MiniMax",
      format: "template",
      endpoint: "https://api.minimax.chat/v1/t2a_v2",
      model: "speech-01-turbo",
      manual: ["male-qn-qingse", "female-shaonv", "female-yujie", "male-qn-jingying", "presenter_male"],
      maxLength: 1000,
      enableSegmentation: true,
      template: {
        method: "POST",
        headers: "Authorization: Bearer {{apiKey}}\nContent-Type: application/json",
        bodyType: "json",
        body:
          '{"model":"{{model}}","text":"{{text}}","stream":false,"voice_setting":{"voice_id":"{{voice}}","speed":1.0,"pitch":0},"audio_setting":{"sample_rate":32000,"bitrate":128000,"format":"{{format}}"}}',
        responseType: "json",
        responsePath: "data.audio",
        responseEncoding: "hex",
      },
    },
  },
  {
    id: "fish-audio",
    name: "Fish Audio",
    description: "模板格式，响应直出音频；需要指定音色时在 body 中加 reference_id",
    api: {
      name: "Fish Audio",
      format: "template",
      endpoint: "https://api.fish.audio/v1/tts",
      model: "s1",
      manual: ["默认音色"],
      maxLength: 1000,
      enableSegmentation: true,
      template: {
        method: "POST",
        headers: "Authorization: Bearer {{apiKey}}\nContent-Type: application/json",
        bodyType: "json",
        body: '{"text":"{{text}}","format":"{{format}}"}',
        responseType: "audio",
      },
    },
  },
  {
    id: "google",
    name: "Google Cloud TTS",
    description: "模板格式，audioContent 为 base64；voice 已含语言，请按需改 languageCode",
    api: {
      name: "Google Cloud TTS",
      format: "template",
      endpoint: "https://texttospeech.googleapis.com/v1/text:synthesize?key={{apiKey}}",
      manual: ["cmn-CN-Wavenet-A", "cmn-CN-Standard-A", "en-US-Neural2-F"],
      maxLength: 1000,
      enableSegmentation: true,
      template: {
        method: "POST",
        headers: "Content-Type: application/json",
        bodyType: "json",
        body:
          '{"input":{"text":"{{text}}"},"voice":{"languageCode":"cmn-CN","name":"{{voice}}"},"audioConfig":{"audioEncoding":"MP3"}}',
        responseType: "json",
        responsePath: "audioContent",
        responseEncoding: "base64",
      },
    },
  },
  {
    id: "azure-speech",
    name: "Azure 官方 Speech",
    description: "模板格式（SSML）；把端点里的 eastus 换成你的区域，用订阅密钥鉴权",
    api: {
      name: "Azure Speech",
      format: "template",
      endpoint: "https://eastus.tts.speech.microsoft.com/cognitiveservices/v1",
      manual: ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural", "en-US-JennyNeural"],
      maxLength: 2000,
      enableSegmentation: true,
      template: {
        method: "POST",
        headers:
          "Ocp-Apim-Subscription-Key: {{apiKey}}\nContent-Type: application/ssml+xml\nX-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3",
        bodyType: "raw",
        body:
          '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN"><voice name="{{voice}}"><prosody rate="{{rate}}%" pitch="{{pitch}}%">{{textXml}}</prosody></voice></speak>',
        responseType: "audio",
      },
    },
  },
  {
    id: "volcengine",
    name: "火山引擎 豆包语音",
    description: "模板格式，data 为 base64 音频；需填 appid、token（在 body 中替换 appid 占位）",
    api: {
      name: "火山引擎 TTS",
      format: "template",
      endpoint: "https://openspeech.bytedance.com/api/v1/tts",
      manual: ["BV700_streaming", "BV001_streaming"],
      maxLength: 500,
      enableSegmentation: true,
      template: {
        method: "POST",
        headers: "Authorization: Bearer;{{apiKey}}\nContent-Type: application/json",
        bodyType: "json",
        body:
          '{"app":{"appid":"请替换为你的appid","token":"{{apiKey}}","cluster":"volcano_tts"},"user":{"uid":"libretts"},"audio":{"voice_type":"{{voice}}","encoding":"mp3","speed_ratio":1.0},"request":{"reqid":"libretts","text":"{{text}}","operation":"query"}}',
        responseType: "json",
        responsePath: "data",
        responseEncoding: "base64",
      },
    },
  },
  {
    id: "gpt-sovits",
    name: "GPT-SoVITS / 本地推理",
    description: "模板格式（GET）；按你本地服务的参数名调整 query，{{voice}} 可填参考音频路径",
    api: {
      name: "GPT-SoVITS",
      format: "template",
      endpoint: "http://127.0.0.1:9880/tts",
      manual: ["默认音色"],
      maxLength: 1000,
      enableSegmentation: true,
      template: {
        method: "GET",
        query: "text={{text}}&text_lang=zh&ref_audio_path={{voice}}&media_type={{format}}",
        responseType: "audio",
      },
    },
  },
];
