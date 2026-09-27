// Mock TTS 服务：用于自定义 API 端到端测试（OpenAI 格式 + Edge 格式 + 模型列表）
// 用法: node tests/mock-tts-server.mjs [port]
import http from "node:http";

const port = Number(process.argv[2]) || 9301;
const requests = []; // 记录收到的请求供测试断言

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    requests.push({ method: req.method, url: req.url, headers: req.headers, body });
    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
      });
      res.end();
      return;
    }

    // 请求记录查询（测试断言用）
    if (url.pathname === "/__requests") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(requests));
      return;
    }

    // 故障注入：前 2 次返回 500，之后成功（重试逻辑测试）
    if (url.pathname === "/flaky/speech") {
      const n = requests.filter(r => r.url.includes("/flaky/speech")).length;
      if (n <= 2) {
        res.writeHead(500, { "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify({ error: "mock temporary failure" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "audio/mpeg", "Access-Control-Allow-Origin": "*" });
      res.end(Buffer.from("MOCK_RETRY_OK"));
      return;
    }

    // OpenAI 格式模型列表
    if (url.pathname === "/v1/models") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ data: [{ id: "tts-1" }, { id: "tts-1-hd" }, { id: "gpt-4" }] }));
      return;
    }

    // OpenAI 格式 TTS
    if (url.pathname === "/v1/audio/speech" && req.method === "POST") {
      if (req.headers.authorization !== "Bearer sk-mock-key") {
        res.writeHead(401).end();
        return;
      }
      res.writeHead(200, { "Content-Type": "audio/mpeg", "Access-Control-Allow-Origin": "*" });
      res.end(Buffer.from("MOCK_MP3_DATA_" + Date.now()));
      return;
    }

    // Edge 格式自定义 API：回显收到的鉴权头，返回假音频
    if (url.pathname === "/edge/tts" && req.method === "POST") {
      res.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "Access-Control-Allow-Origin": "*",
        "X-Auth-Seen": req.headers["x-api-key"] || req.headers["authorization"] || "none",
      });
      res.end(Buffer.from("MOCK_EDGE_AUDIO_" + Date.now()));
      return;
    }

    res.writeHead(404).end();
  });
});

server.listen(port, () => console.log(`mock tts server on :${port}`));

// 测试结束后导出请求记录
process.on("SIGTERM", () => {
  server.close();
  process.exit(0);
});
