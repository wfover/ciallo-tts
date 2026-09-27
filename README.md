# LibreTTS - 在线文本转语音工具

LibreTTS 是一款免费的在线文本转语音工具，支持多种声音选择，可调节语速和语调，提供即时试听和下载功能。

> 本项目曾用名 Ciallo TTS。基于 [Next.js](https://nextjs.org)（App Router）+ TypeScript + Tailwind CSS 构建。

## 功能特点

- 🎯 支持超过300种不同语言和口音的声音
- 🔊 实时预览和试听功能
- ⚡ 支持长文本自动分段处理
- 🎛️ 可调节语速和语调
- 🔍 语音搜索下拉框（按名称或 ID 过滤）
- 📱 响应式设计，支持移动端
- 💾 支持音频下载
- 📝 历史记录功能（最多保存50条）
- 🔌 支持添加自定义OpenAI格式的TTS API

## 本地开发

要求 Node.js 20 或更高版本。

```bash
npm install
npm run dev        # 开发模式，默认 http://localhost:3000
```

```bash
npm run build      # 生产构建
npm start          # 运行生产版本
```

## API 说明

本项目提供以下 API 端点:

### Edge API 路径

- `/api/tts` - 文本转语音 API
  - 支持 GET/POST 方法
  - GET 示例: `/api/tts?t=你好世界&v=zh-CN-XiaoxiaoNeural&r=0&p=0`
  - POST 示例: 请求体为JSON格式 `{"text": "你好世界", "voice": "zh-CN-XiaoxiaoNeural", "rate": 0, "pitch": 0}`
  - `format` 参数可指定音频格式（默认 `audio-24khz-48kbitrate-mono-mp3`）

- `/api/voices` - 获取可用语音列表 API
  - 仅支持 GET 方法
  - 示例: `/api/voices?l=zh&f=1` (l参数用于筛选语言，f参数指定返回格式)
  - `f=0`: MultiTTS YAML 格式；`f=1`: `{ShortName: LocalName}` 映射；缺省: 原始 JSON 数组

### 自定义 API

LibreTTS 支持添加自定义 API 端点，目前支持两种格式：

#### OpenAI 格式 API

- 支持与 OpenAI TTS API 兼容的服务，如 OpenAI、LMStudio、LocalAI 等
- 请求格式: POST
  ```json
  {
    "model": "tts-1",
    "input": "您好，这是一段测试文本",
    "voice": "alloy",
    "response_format": "mp3"
  }
  ```
- 可选参数：`instructions` - 语音风格指导

#### Edge 格式 API

- 支持与 Microsoft Edge TTS API 兼容的服务
- 请求格式: POST
  ```json
  {
    "text": "您好，这是一段测试文本",
    "voice": "zh-CN-XiaoxiaoNeural",
    "rate": 0,
    "pitch": 0
  }
  ```

#### 如何添加自定义 API

1. 点击界面上的"管理API"按钮
2. 填写以下信息：
   - API 名称：自定义名称
   - API 端点：语音生成服务地址
   - API 密钥：可选，用于授权
   - 模型列表端点：可选，用于获取可用模型
   - API 格式：选择 OpenAI 或 Edge 格式
   - 手动输入讲述人列表：逗号分隔的讲述人列表
   - 最大文本长度：可选，限制单次请求的文本长度

3. 点击"获取模型"按钮可自动填充可用讲述人列表
4. 点击"保存"完成添加

#### 导入/导出 API 配置

- 导出：将所有自定义 API 配置导出为 JSON 文件
- 导入：从 JSON 文件导入 API 配置

## 部署指南

### Vercel 部署

1. Fork 本仓库到你的 GitHub 账号

2. 登录 [Vercel](https://vercel.com/)，点击 "New Project"

3. 导入你 fork 的仓库，Vercel 会自动识别 Next.js 项目并选择默认设置部署

4. 部署完成后，你会获得一个 `your-project.vercel.app` 的域名

### 服务器部署（Docker）

镜像已发布到 GitHub Container Registry，支持 amd64 / arm64：

```bash
# 可选：启用访问密码
echo "PASSWORD=你的密码" > .env

# 直接使用现成镜像
docker run -d -p 3000:3000 -e PASSWORD=你的密码 --restart unless-stopped --name libretts ghcr.io/bestzwei/libretts:latest
```

或使用 Docker Compose（自动拉取镜像；本地修改过代码时 `docker compose build` 可构建本地版本）：

```bash
git clone https://github.com/LibreSpark/LibreTTS.git
cd LibreTTS
docker compose up -d
```

镜像在每次推送到 `main` 分支或发布 `v*` 标签时由 GitHub Actions 自动构建更新。

服务将运行在 `http://服务器IP:3000`，可用 `-p` 修改映射端口（在 `docker-compose.yml` 中）。

### 服务器部署（Node.js）

要求 Node.js 20 或更高版本：

```bash
git clone https://github.com/LibreSpark/LibreTTS.git
cd LibreTTS
npm install
npm run build

# 可选：启用访问密码
export PASSWORD=你的密码

npm start
```

可用环境变量：`PORT`（默认 3000）、`HOSTNAME`（默认 0.0.0.0）、`PASSWORD`（可选）。

如需开机自启，可配置 systemd 服务（`/etc/systemd/system/libretts.service`）：

```ini
[Unit]
Description=LibreTTS
After=network.target

[Service]
WorkingDirectory=/opt/LibreTTS
Environment=PASSWORD=你的密码
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=unless-stopped

[Install]
WantedBy=multi-user.target
```

然后执行 `systemctl enable --now libretts`。

### 反向代理（可选）

自托管时建议用 Nginx 反向代理并配置 HTTPS：

```nginx
server {
    listen 443 ssl;
    server_name tts.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

> 注意：TTS 接口会返回音频流，若 Nginx 开启了缓冲导致长文本合成变慢或中断，可在 `location` 中加入 `proxy_buffering off;`。

## 环境变量

设置环境变量 `PASSWORD` 可开启访问密码验证。如果 `PASSWORD` 非空，则用户第一次访问页面时会显示密码输入界面，输入正确后在该设备上后续访问将不再需要验证。

[![Powered by DartNode](https://dartnode.com/branding/DN-Open-Source-sm.png)](https://dartnode.com "Powered by DartNode - Free VPS for Open Source")
