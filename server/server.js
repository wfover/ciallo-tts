/**
 * LibreTTS 自托管服务器（零依赖，Node.js >= 20）
 *
 * - 复用 Vercel 版 API 处理函数（api/*.js），行为与 Vercel / Cloudflare Pages 部署一致
 * - 托管根目录下的静态文件（index.html、script.js、style.css、image/ 等）
 * - 通过环境变量 PASSWORD 启用访问密码验证，与 Serverless 部署保持一致
 *
 * 启动：node server/server.js
 * 环境变量：PORT（默认 3000）、HOST（默认 0.0.0.0）、PASSWORD（可选）
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ttsHandler from "../api/tts.js";
import voicesHandler from "../api/voices.js";
import checkPasswordHandler from "../api/check-password.js";
import verifyPasswordHandler from "../api/verify-password.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".mp3": "audio/mpeg",
};

const API_ROUTES = {
  "/api/tts": ttsHandler,
  "/api/voices": voicesHandler,
  "/api/check-password": checkPasswordHandler,
  "/api/verify-password": verifyPasswordHandler,
};

// 把 Node 原生 req/res 适配成 Vercel Serverless 函数所依赖的接口
// （req.query / req.body / res.status() / res.json() / res.send()）
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", () => resolve(Buffer.alloc(0)));
  });
}

async function adaptRequest(req, url) {
  req.query = Object.fromEntries(url.searchParams);

  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    const raw = await readBody(req);
    const contentType = (req.headers["content-type"] || "").toLowerCase();
    if (contentType.includes("application/json")) {
      try {
        req.body = JSON.parse(raw.toString("utf8") || "{}");
      } catch {
        req.body = {};
      }
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      req.body = Object.fromEntries(new URLSearchParams(raw.toString("utf8")));
    } else {
      req.body = raw.toString("utf8");
    }
  } else {
    req.body = {};
  }
}

function adaptResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
    return res;
  };
  res.send = (data) => {
    if (data instanceof Uint8Array) {
      res.end(Buffer.from(data));
    } else if (typeof data === "string") {
      res.end(data);
    } else {
      res.end(JSON.stringify(data));
    }
    return res;
  };
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  const filePath = path.normalize(path.join(ROOT_DIR, pathname));
  // 防目录穿越：解析后的路径必须仍在项目根目录内
  if (!filePath.startsWith(ROOT_DIR + path.sep) && filePath !== ROOT_DIR) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "public, max-age=3600",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const handler = API_ROUTES[url.pathname];

  try {
    if (handler) {
      await adaptRequest(req, url);
      adaptResponse(res);
      await handler(req, res);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end("Method Not Allowed");
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    console.error("Server Error:", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    }
    res.end(JSON.stringify({ error: error.message || "Internal Server Error" }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`LibreTTS 服务器已启动: http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  console.log(`访问密码验证: ${process.env.PASSWORD ? "已启用" : "未启用"}`);
});
