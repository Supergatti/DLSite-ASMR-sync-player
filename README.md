# DLSite ASMR Player

一个轻量的本地网页播放器。可在浏览器中同时播放所选目录或远程网盘（Alist）中的音频和视频文件。

欢迎加入大家一起来翻译🥰

<img width="1898" height="848" alt="image" src="https://github.com/user-attachments/assets/ca30ada2-1d74-4aa3-a775-5cf701c5edc0" />


## 功能
- 在同一页面播放视频与独立 ASMR 音频，支持各自字幕和音量控制
- 可在播放ASMR音频同时播放视频，音量可调
- 可从局域网设备浏览 PC 上配置好的媒体库
- 通过受限目录 API 流式传输文件，支持浏览器 Range 请求和进度跳转
- 触屏设备单击画面显示或隐藏控制栏，双击画面播放或暂停
- 播放器可循环调整字幕字号，并在当前设备记住选择
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
python launcher.py
```

PowerShell:
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python launcher.py
```

2. 启动器会自动打开 PC 浏览器，并打印类似以下地址：

```text
PC: http://127.0.0.1:5000/
iPad/LAN: http://192.168.1.23:5000/
```

让 iPad 与 PC 连接同一局域网，然后在 Safari 中打开 `iPad/LAN` 地址。首次运行时，需要在 Windows 防火墙中允许该程序访问专用网络。

## 配置 PC 媒体库

首次使用源码时，复制示例配置，然后编辑项目根目录中的 `media_roots.json`。该文件只保存在本机，不会提交到 Git：

```powershell
Copy-Item media_roots.example.json media_roots.json
```

前端只能浏览这里列出的目录，不能读取 PC 上的其他路径：

```json
{
  "roots": [
    { "id": "media", "name": "项目媒体", "path": "./media" },
    { "id": "video", "name": "视频库", "path": "E:\\ASMR\\video" },
    { "id": "audio", "name": "音频库", "path": "E:\\ASMR\\audio" }
  ]
}
```

修改配置后重启程序。`id` 只能包含英文字母、数字、下划线和连字符；`name` 会显示在网页的媒体库下拉框中。

## 打包 Windows 版本

在 PowerShell 中执行：

```powershell
.\build.ps1
```

脚本会创建独立构建环境并生成：

```text
dist\DLSite-ASMR-Player\
dist\DLSite-ASMR-Player-windows-x64.zip
```

解压后运行 `DLSite-ASMR-Player.exe`。`media_roots.json` 和 `media` 目录必须与 EXE 保持在同一目录层级。

## 文件命名与组织
- 本项目会根据文件名（不含扩展名）进行分组。例如：
  - `episode1.mp4`、`episode1.vtt` 或 `episode1.srt` 会被识别为同一组。
- 注意：当前的媒体列表接口只会返回包含视频文件的分组（也可扩展为仅音频场景）。

## 支持格式
- 视频: `.mp4`, `.webm`, `.mkv`, `.ogg`
- 音频: `.mp3`, `.wav`, `.flac`, `.aac`, `.m4a`, `.ogg`, `.mka`
- 字幕: `.vtt`, `.srt`（服务端会把 `.srt` 转为 VTT）

iPad Safari 最稳定的组合是 H.264/AAC 编码的 MP4、MP3/M4A 音频和 WebVTT 字幕。服务器不会自动转码浏览器不支持的 MKV 等格式。

## API 概览
- 前端页面: `/` （静态文件位于 [static/index.html](static/index.html)）
- 媒体列表: `GET /api/media` — 返回媒体分组的 JSON 列表
- 静态媒体: `GET /media/<filename>` — 直接下载/流式媒体
- 字幕: `GET /subtitle/<filename>` — 若为 `.srt` 会转换为 VTT 并返回
- 媒体根目录: `GET /api/library/roots`
- 目录浏览: `GET /api/library/list?root=media&path=...`
- 媒体流: `GET /api/library/file?root=media&path=...`
- 兼容接口: `/api/local/*` — 仅允许访问 `media_roots.json` 中配置的目录
- Alist 代理接口：`/api/alist/*`（见实现以调整请求格式）

实现细节请参阅 [server.py](server.py).

## 目录结构示例
```
- README.md
- launcher.py
- media_roots.example.json
- server.py
- requirements.txt
- media/        # 放媒体文件
- static/       # 前端页面与脚本 (index.html, app.js, style.css)
```
