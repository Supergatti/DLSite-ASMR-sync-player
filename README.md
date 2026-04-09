# DLSite ASMR Player

一个轻量的本地网页播放器后端，专注于“同步播放”（在播放时保持音视频与字幕的时序同步）。可在浏览器中播放放置于本地 `media/` 目录或远程网盘（Alist）中的媒体文件，提供简单前端界面与字幕转换支持。

## 功能
- 同步播放：在播放时保持音视频与字幕同步，支持本地与 Alist 源
- 在 `media/` 目录下提供媒体文件静态托管（视频/音频/字幕）
- 提供本地目录和文件的 API（/api/local/*）用于选择本地文件
- 支持 Alist 代理请求（列表、登录、抓取字幕）

## 依赖
- Python 3.8+
- 依赖包见 [requirements.txt](requirements.txt)

## 快速开始
1. 创建虚拟环境并安装依赖：

Windows (cmd):
```bat
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python server.py
```

PowerShell:
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python server.py
```

2. 打开浏览器访问: http://127.0.0.1:5000

当服务启动后，程序会在启动信息中打印 `media` 目录路径。将你的媒体文件放入该目录即可。

## 文件命名与组织
- 本项目会根据文件名（不含扩展名）进行分组。例如：
  - `episode1.mp4`、`episode1.vtt` 或 `episode1.srt` 会被识别为同一组。
- 注意：当前的媒体列表接口只会返回包含视频文件的分组（也可扩展为仅音频场景）。

## 支持格式
- 视频: `.mp4`, `.webm`, `.mkv`, `.ogg`
- 音频: `.mp3`, `.wav`, `.flac`, `.aac`, `.m4a`, `.ogg`
- 字幕: `.vtt`, `.srt`（服务端会把 `.srt` 转为 VTT）

## API 概览
- 前端页面: `/` （静态文件位于 [static/index.html](static/index.html)）
- 媒体列表: `GET /api/media` — 返回媒体分组的 JSON 列表
- 静态媒体: `GET /media/<filename>` — 直接下载/流式媒体
- 字幕: `GET /subtitle/<filename>` — 若为 `.srt` 会转换为 VTT 并返回
- 本地目录列表: `POST /api/local/list` — JSON 请求体 `{ "path": "C:\\path\\to\\dir" }`
- 本地文件访问: `GET /api/local/file?path=...` — 直接从指定本地路径读取文件（谨慎使用）
- Alist 代理接口：`/api/alist/*`（见实现以调整请求格式）

实现细节请参阅 [server.py](server.py).

## 目录结构示例
```
- README.md
- server.py
- requirements.txt
- media/        # 放媒体文件
- static/       # 前端页面与脚本 (index.html, app.js, style.css)
```

## 开发与贡献
- 欢迎提交 issue 或 PR。建议在 PR 中说明测试步骤与可复现样例。

## 许可
此仓库默认未指定许可。若需开源，请补充 `LICENSE`（例如 MIT）。
