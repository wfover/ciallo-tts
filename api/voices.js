export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-auth-token");
  
  // Handle OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  
  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  try {
    const { query } = req;
    const localeFilter = (query.l || "").toLowerCase();
    const format = query.f;
    
    let voices = await voiceList();
    if (localeFilter) {
      voices = voices.filter(item => item.Locale.toLowerCase().includes(localeFilter));
    }
    
    if (format === "0") {
      const formattedVoices = voices.map(item => formatVoiceItem(item));
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.send(formattedVoices.join("\n"));
    } else if (format === "1") {
      const voiceMap = Object.fromEntries(voices.map(item => [item.ShortName, item.LocalName]));
      return res.json(voiceMap);
    } else {
      return res.json(voices);
    }
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch voices" });
  }
}

function formatVoiceItem(item) {
  return `
- !!org.nobody.multitts.tts.speaker.Speaker
  avatar: ''
  code: ${item.ShortName}
  desc: ''
  extendUI: ''
  gender: ${item.Gender === "Female" ? "0" : "1"}
  name: ${item.LocalName}
  note: 'wpm: ${item.WordsPerMinute || ""}'
  param: ''
  sampleRate: ${item.SampleRateHertz || "24000"}
  speed: 1.5
  type: 1
  volume: 1`;
}

// 语音列表缓存：避免每次请求都向上游拉取全量列表
const VOICES_CACHE_TTL = 60 * 60 * 1000; // 1 小时
let voicesCache = null;
let voicesCacheTime = 0;
let voicesCachePromise = null;

async function voiceList() {
  const now = Date.now();
  if (voicesCache && now - voicesCacheTime < VOICES_CACHE_TTL) {
    return voicesCache;
  }
  // 并发去重：同一时刻只发一次上游请求
  if (!voicesCachePromise) {
    voicesCachePromise = (async () => {
      const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "X-Ms-Useragent": "SpeechStudio/2021.05.001",
        "Content-Type": "application/json",
        "Origin": "https://azure.microsoft.com",
        "Referer": "https://azure.microsoft.com"
      };

      const response = await fetch("https://eastus.api.speech.microsoft.com/cognitiveservices/voices/list", {
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`获取语音列表失败，状态码 ${response.status}`);
      }

      voicesCache = await response.json();
      voicesCacheTime = Date.now();
      return voicesCache;
    })().finally(() => {
      voicesCachePromise = null;
    });
  }
  return voicesCachePromise;
}
