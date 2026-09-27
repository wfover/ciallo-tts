// API 端点契约测试：node tests/api.test.mjs [baseURL]
// 默认 http://localhost:3300（Next.js 生产服务器）
const BASE = process.argv[2] || "http://localhost:3300";

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(`${name} ${detail}`);
    console.log(`  ✗ ${name} ${detail}`);
  }
}

async function main() {
  console.log(`测试目标: ${BASE}\n`);

  console.log("[/api/tts]");
  {
    // POST 正常生成
    const r1 = await fetch(`${BASE}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "测试文本", voice: "zh-CN-XiaoxiaoNeural" }),
    });
    check("POST 正常返回 audio/mpeg", r1.status === 200 && r1.headers.get("content-type") === "audio/mpeg");
    check("POST 响应带 CORS 头", r1.headers.get("access-control-allow-origin") === "*");
    const buf1 = await r1.arrayBuffer();
    check("POST 返回非空音频", buf1.byteLength > 1000);

    // GET 下载
    const r2 = await fetch(`${BASE}/api/tts?t=下载测试&d=true`);
    check("GET 下载带 Content-Disposition", (r2.headers.get("content-disposition") || "").includes("attachment"));
    check("GET 下载文件名按格式映射 .mp3", (r2.headers.get("content-disposition") || "").includes(".mp3"));
    await r2.arrayBuffer();

    // 缺少文本 → 上游报错应返回 500 JSON 而非崩溃
    const r3 = await fetch(`${BASE}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "" }),
    });
    check("空文本返回 5xx JSON 错误", r3.status >= 400 && (r3.headers.get("content-type") || "").includes("json"));
    const e3 = await r3.json();
    check("错误响应含 error 字段", typeof e3.error === "string");

    // 非法方法
    const r4 = await fetch(`${BASE}/api/tts`, { method: "PUT" });
    check("PUT 返回 405", r4.status === 405);
    await r4.arrayBuffer();

    // OPTIONS 预检
    const r5 = await fetch(`${BASE}/api/tts`, { method: "OPTIONS" });
    check("OPTIONS 返回 204 且带 CORS 头", r5.status === 204 && r5.headers.get("access-control-allow-origin") === "*");
    await r5.arrayBuffer();
  }

  console.log("\n[/api/voices]");
  {
    const r1 = await fetch(`${BASE}/api/voices`);
    const voices = await r1.json();
    check("默认返回 JSON 数组", Array.isArray(voices) && voices.length > 200);
    check("数组项含 ShortName/Locale", voices[0].ShortName && voices[0].Locale);

    const r2 = await fetch(`${BASE}/api/voices?f=1&l=zh-CN`);
    const map = await r2.json();
    check("f=1 返回 ShortName→LocalName 映射", map["zh-CN-XiaoxiaoNeural"] === "晓晓");

    const r3 = await fetch(`${BASE}/api/voices?f=0&l=zh-CN`);
    const yaml = await r3.text();
    check("f=0 返回 MultiTTS YAML 格式", yaml.includes("org.nobody.multitts.tts.speaker.Speaker"));

    const r4 = await fetch(`${BASE}/api/voices`, { method: "POST" });
    check("POST 返回 405", r4.status === 405);
    await r4.arrayBuffer();
  }

  console.log("\n[/api/check-password]");
  {
    const r1 = await fetch(`${BASE}/api/check-password`);
    const d1 = await r1.json();
    check("返回 requirePassword 布尔值", typeof d1.requirePassword === "boolean");
  }

  console.log("\n[/api/verify-password]");
  {
    const r1 = await fetch(`${BASE}/api/verify-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    const d1 = await r1.json();
    check("未设密码时任意密码返回 200 valid", r1.status === 200 && d1.valid === true);

    const r2 = await fetch(`${BASE}/api/verify-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    check("未设密码时非法 JSON 也放行（优先判断密码未设置）", r2.status === 200);
    await r2.json();
  }

  console.log("\n[静态资源]");
  {
    const r1 = await fetch(`${BASE}/speakers.json`);
    const speakers = await r1.json();
    check("speakers.json 可访问且含 edge-api", r1.status === 200 && speakers["edge-api"].speakers);
    const r2 = await fetch(`${BASE}/image/TTS.png`);
    check("favicon 可访问", r2.status === 200);
    await r2.arrayBuffer();
    const r3 = await fetch(`${BASE}/`);
    const html = await r3.text();
    check("首页包含标题", html.includes("文本转语音"));
  }

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
  if (failures.length) {
    console.log("失败项:", failures.join(" | "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("测试执行失败:", e.message);
  process.exit(1);
});
