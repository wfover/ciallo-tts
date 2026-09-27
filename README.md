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
- 🔌 支持添加自定义 TTS API（OpenAI / Edge / 通用请求模板三种格式，内置常见服务预设，可导入导出配置）
- 🔐 可选访问密码保护（设置 `PASSWORD` 环境变量）

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

### 项目结构

```
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── api/              # Route Handlers：tts / voices / check-password / verify-password
│   │   ├── layout.tsx        # SEO metadata、JSON-LD、统计脚本
│   │   └── page.tsx
│   ├── components/           # React 组件（表单、历史记录、API管理弹窗、搜索下拉框等）
│   ├── lib/                  # 核心逻辑（Edge TTS 签名、文本分段、请求构造、自定义API存储）
│   └── hooks/                # React hooks
├── public/                   # 静态资源（speakers.json、图标）
├── Dockerfile                # 多阶段构建（standalone 输出）
└── .github/workflows/        # Docker 镜像自动发布到 GHCR
```

## API 说明

本项目提供以下 API 端点:

### Edge API 路径

- `/api/tts` - 文本转语音 API
  - 支持 GET/POST 方法
  - GET 示例: `/api/tts?t=你好世界&v=zh-CN-XiaoxiaoNeural&r=0&p=0`
  - POST 示例: 请求体为JSON格式 `{"text": "你好世界", "voice": "zh-CN-XiaoxiaoNeural", "rate": 0, "pitch": 0}`
  - `format` 参数可指定音频格式（默认 `audio-24khz-48kbitrate-mono-mp3`）
    - 兼容 UI 简写：`mp3` / `opus` / `wav` / `pcm`，也接受完整的 Microsoft 输出格式字符串
  - `style` / `role` / `volume` 可选参数，映射到 SSML 的 `mstts:express-as` 与 `prosody`
    - 示例: `{"text":"你好","voice":"zh-CN-XiaoxiaoNeural","style":"cheerful","role":"default","volume":80}`

- `/api/voices` - 获取可用语音列表 API
  - 仅支持 GET 方法
  - 示例: `/api/voices?l=zh&f=1` (l参数用于筛选语言，f参数指定返回格式)
  - `f=0`: MultiTTS YAML 格式；`f=1`: `{ShortName: LocalName}` 映射；缺省: 原始 JSON 数组

### 自定义 API

LibreTTS 支持添加自定义 API 端点，目前支持三种格式：

#### OpenAI 格式 API

- 支持与 OpenAI TTS API 兼容的服务，如 OpenAI、Azure OpenAI、硅基流动、One-API 网关等
- 请求格式: POST
  ```json
  {
    "model": "tts-1",
    "input": "您好，这是一段测试文本",
    "voice": "alloy",
    "response_format": "mp3"
  }
  ```
- 可选参数：`instructions` - 语音风格指导；`额外请求参数`（JSON）会合并进请求体，用于 `speed`、`sample_rate` 等扩展字段
- 填写 **模型名 model** 后：`model` 使用该值、所选讲述人作为 `voice`；留空则兼容旧行为（讲述人当 model、voice 固定 `alloy`）

#### Edge 格式 API

- 支持与 Microsoft Edge TTS API 兼容的服务
- 请求格式: POST
  ```json
  {
    "text": "您好，这是一段测试文本",
    "voice": "zh-CN-XiaoxiaoNeural",
    "rate": 0,
    "pitch": 0,
    "format": "mp3",
    "style": "general",
    "role": "default",
    "volume": 50
  }
  ```

#### 自定义请求模板

用于对接任意 HTTP TTS 服务（ElevenLabs、Google、MiniMax、Fish Audio、火山引擎、GPT-SoVITS 等），可配置：

- **请求方法**：POST / GET；**端点**与**请求头**支持占位符
- **请求体模板**：`json`（占位符按 JSON 转义）或 `raw`（原样发送，如 Azure Speech 的 SSML）
- **GET 查询串**：`text={{text}}&voice={{voice}}`
- **响应解析**：直接音频 / 从 JSON 字段取值（支持 `base64` / `hex` / `url` 三种编码）

可用占位符：
`{{text}}` `{{textXml}}`（XML 已转义）`{{voice}}` `{{model}}` `{{rate}}` `{{pitch}}` `{{format}}` `{{instructions}}` `{{apiKey}}` `{{preview}}`

#### 常见服务预设

“管理自定义API”弹窗顶部提供一键预设，已内置 OpenAI、硅基流动、One-API 网关、ElevenLabs、MiniMax、Fish Audio、Google Cloud TTS、Azure 官方 Speech、火山引擎豆包语音、GPT-SoVITS。预设只是预填模板，载入后补全 API 密钥、区域等参数即可。

#### 如何添加自定义 API

1. 点击界面上的"管理API"按钮
2. 可直接选择"常见服务预设"快速填充，或手动填写以下信息：
  - API 名称：自定义名称
  - API 格式：OpenAI / Edge / 自定义请求模板
  - API 端点：语音生成服务地址
  - API 密钥：可选，用于授权
  - 模型名 model：OpenAI / 模板格式可用
  - 额外请求参数：可选 JSON 对象，合并进请求体
  - 模型列表端点：可选，用于获取可用模型
  - 手动输入讲述人列表：逗号分隔的讲述人列表
  - 最大文本长度：可选，限制单次请求的文本长度（前端计数与请求校验共用同一阈值）

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

官方镜像已发布到 GitHub Container Registry，同时支持 amd64 / arm64 架构：

| 镜像 | 说明 |
| --- | --- |
| `ghcr.io/librespark/libretts` | 上游官方镜像 |
| `ghcr.io/bestzwei/libretts` | 本仓库镜像（内容相同） |

可用标签：`latest`（main 分支最新构建）、`v1.0.1`（版本标签）、`1.0`（主次版本）、git 提交哈希。镜像在每次推送到 `main` 分支或发布 `v*` 标签时由 GitHub Actions 自动构建。

#### 方式一：docker run

```bash
docker run -d   -p 3000:3000   -e PASSWORD=你的密码   --restart unless-stopped   --name libretts   ghcr.io/librespark/libretts:latest
```

`PASSWORD` 可省略（不启用访问密码）；修改 `-p` 前面的端口可更换服务端口。

#### 方式二：Docker Compose

新建 `docker-compose.yml`（无需 clone 仓库）：

```yaml
services:
  libretts:
    image: ghcr.io/librespark/libretts:latest
    container_name: libretts
    ports:
      - "3000:3000"
    environment:
      # 设置访问密码；留空则不启用验证
      - PASSWORD=${PASSWORD:-}
    restart: unless-stopped
```

启动：

```bash
docker compose up -d
```

常用命令：

```bash
docker compose logs -f        # 查看日志
docker compose pull && docker compose up -d   # 更新到最新镜像
docker compose down           # 停止并移除容器
```

如果 clone 了本仓库，`docker-compose.yml` 已内置（含 `build: .`），本地修改过代码时可用 `docker compose build` 构建自己的版本。

服务将运行在 `http://服务器IP:3000`。

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

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PASSWORD` | 访问密码，非空时开启验证 | 空（不验证） |
| `PORT` | 服务监听端口 | `3000` |
| `HOSTNAME` | 服务监听地址 | `0.0.0.0` |

设置 `PASSWORD` 后，用户第一次访问页面时会显示密码输入界面，输入正确后在该设备上后续访问将不再需要验证。

### 关于 Cloudflare 部署

旧版本曾支持 Cloudflare Pages，Next.js 重构后暂不直接支持。项目 API 层仅使用 Web 标准 API，如需部署到 Cloudflare Workers 可基于 [OpenNext Cloudflare 适配器](https://opennext.js.org/cloudflare) 自行配置。

## 许可证

[MIT](LICENSE)

[![Powered by DartNode](https://dartnode.com/branding/DN-Open-Source-sm.png)](https://dartnode.com "Powered by DartNode - Free VPS for Open Source")
