# DLSite ASMR LAN Player

在 Windows PC 上运行、通过局域网在 iPad / 手机 / 其他电脑浏览器中访问的本地媒体播放器。

它适合播放 DLSite ASMR、环境音、视频和图片集：画面层可以选择视频或图片轮播，音频层独立播放，并支持字幕、触屏操作、AList 和 PC 媒体库。

**关键词：** ASMR 播放器、局域网播放器、iPad Safari、本地媒体服务器、视频与音频独立播放、图片轮播、字幕、AList、Windows EXE。

<img width="1898" height="848" alt="DLSite ASMR Player 界面" src="https://github.com/user-attachments/assets/ca30ada2-1d74-4aa3-a775-5cf701c5edc0" />

> 第一次使用只需要完成三件事：配置 `media_roots.json`、启动 EXE 或 `launcher.py`、在 iPad 打开程序打印的 `iPad/LAN` 地址。

## 目录

- [它能做什么](#它能做什么)
- [快速开始](#快速开始)
- [配置 PC 媒体库](#配置-pc-媒体库)
- [基本使用](#基本使用)
- [使用 AList](#使用-alist)
- [支持格式与兼容性](#支持格式与兼容性)
- [局域网和安全说明](#局域网和安全说明)
- [常见问题](#常见问题)
- [打包 Windows 版本](#打包-windows-版本)
- [API 概览](#api-概览)

## 它能做什么

- 在 PC 上启动服务，通过 `http://PC局域网IP:端口/` 从 iPad 等设备访问。
- 浏览 `media_roots.json` 中允许访问的 PC 文件夹，无需把媒体复制到项目目录。
- 独立控制视频/图片层和音频层的播放、暂停与音量。
- 在“视频”和“图片轮播”两种画面模式之间切换。
- 图片支持顺序/随机循环、切换间隔、左右透明切换区、滑动切图和 100%–400% 缩放。
- 视频、音频分别支持字幕；字幕字号可调，并在当前浏览器中记住设置。
- 支持前进/后退 10 秒、顺序下一项，以及循环、自动下一项、播放后停止。
- 支持浏览器选择的本机文件夹和 AList 远程媒体。
- 媒体接口支持 HTTP Range 请求，可进行音视频进度跳转。

## 适用场景

- PC 存放大量 ASMR 音频，躺在床上用 iPad Safari 选择和播放。
- 一边循环图片集，一边独立播放 ASMR、白噪音或音乐。
- 同时播放静音视频和另一条独立音频，并分别调整音量。
- 在可信局域网内临时共享一个受限制的媒体目录。
- 从 AList 选择视频、图片、音频和字幕。

## 快速开始

### 方式一：使用 Windows 打包版

如果 GitHub Release 中提供了 `DLSite-ASMR-Player-windows-x64.zip`：

1. 下载并完整解压 ZIP。
2. 编辑解压目录中的 `media_roots.json`，填写媒体文件夹。
3. 运行 `DLSite-ASMR-Player.exe`。
4. Windows 防火墙首次询问时，允许它访问**专用网络**。
5. 在 iPad Safari 中打开程序窗口打印的 `iPad/LAN` 地址。

打包版是便携式目录程序，不是单文件 EXE。请保留 EXE 旁边的依赖文件、`media_roots.json` 和 `media` 文件夹，不要只复制 EXE。

### 方式二：从源码运行

要求：

- Windows
- Python 3.8 或更高版本

在项目目录打开 PowerShell：

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item media_roots.example.json media_roots.json
notepad media_roots.json
.\.venv\Scripts\python.exe launcher.py
```

启动器会自动打开 PC 浏览器，并输出类似地址：

```text
PC: http://127.0.0.1:5000/
iPad/LAN: http://192.168.1.23:5000/
```

让 iPad 和 PC 连接同一个局域网，然后在 Safari 中打开完整的 `iPad/LAN` 地址。端口 `5000` 被占用时，启动器会自动选择其他可用端口，因此请以实际打印的地址为准。

在启动窗口按 Enter 可停止播放器。

## 配置 PC 媒体库

`media_roots.json` 决定网页允许浏览哪些 PC 文件夹。修改配置后需要重启程序。

示例：

```json
{
  "roots": [
    {
      "id": "media",
      "name": "综合媒体库",
      "path": "E:\\Media"
    },
    {
      "id": "asmr",
      "name": "ASMR 收藏",
      "path": "D:\\DLSite\\ASMR"
    },
    {
      "id": "project",
      "name": "程序目录媒体",
      "path": "./media"
    }
  ]
}
```

字段说明：

| 字段 | 作用 | 限制 |
| --- | --- | --- |
| `id` | API 和浏览器设置使用的唯一标识 | 只能包含英文字母、数字、下划线和连字符 |
| `name` | 网页下拉框中显示的名称 | 不能为空 |
| `path` | PC 文件夹路径 | 支持绝对路径和相对路径 |

相对路径以项目目录或打包版 EXE 所在目录为基准。网页只能浏览这里列出的目录，不能通过 `..` 跳出媒体根目录。

同一个根目录会显示在 Video、Images 和 Audio 三个标签中，每个标签只列出自己支持的文件类型。

## 基本使用

1. 启动程序，并在 PC 或局域网设备中打开网页。
2. 在左侧选择 `Video`、`Images` 或 `Audio`。
3. 从 `PC Media Library` 下拉框选择媒体根目录，再进入子文件夹。
4. 点击文件开始播放。视频/图片和音频互相独立，选择或暂停其中一层不会启动或暂停另一层。
5. 使用播放器顶部的 `Video / Slideshow` 切换画面模式。

`Files on this device` 使用的是当前浏览器设备上的文件。iPad 访问 PC 文件时，建议使用 `PC Media Library`。

### 播放控制

| 控件 | 作用 |
| --- | --- |
| 带视频/图片角标的播放按钮 | 单独播放或暂停视频/图片层 |
| 带麦克风角标的播放按钮 | 单独播放或暂停音频层 |
| Stop | 停止并把当前音视频进度归零 |
| `-10s` / `+10s` | 视频模式下同时移动视频和音频；图片模式下只移动音频 |
| Next | 视频模式下按顺序切换当前视频/音频；图片模式下切换下一条音频 |
| Loop / Auto next / Stop | 切换媒体播放结束后的行为 |
| CC: OFF / VID / AUD | 关闭字幕、显示视频字幕或显示音频字幕 |
| A 100% | 循环切换字幕字号：80%、100%、125%、150% |

鼠标停在底部控制栏上时，控制栏不会自动隐藏。点击播放画面不会改变播放状态。

触屏设备单击画面只负责显示或隐藏控制栏。

### 图片轮播和手势

图片轮播始终使用独立计时器，不受音频播放、暂停、跳转或结束影响。

| 操作 | 效果 |
| --- | --- |
| 点击图片左侧透明区域 | 上一张 |
| 点击图片右侧透明区域 | 下一张 |
| 100% 状态下左右滑动 | 上一张 / 下一张 |
| 双指捏合 | 100%–400% 缩放 |
| 放大后单指拖动 | 平移图片 |
| 鼠标滚轮 | 放大 / 缩小 |
| 鼠标双击 | 在 100% 和 200% 之间切换 |
| 点击缩放百分比按钮 | 在 100%、150%、200%、300%、400% 之间循环 |

切换到另一张图片时，缩放比例会自动恢复为 100%。放大状态下左右透明切换区会暂时禁用，避免与拖动冲突。

### 字幕文件

字幕文件应与媒体文件使用相同的主文件名：

```text
scene01.mp4
scene01.vtt

track01.mp3
track01.srt
```

支持 `.vtt` 和 `.srt`。服务端会把 SRT 时间格式转换为 WebVTT。建议字幕使用 UTF-8 编码。

视频模式下，字幕按钮按照 `OFF → VID → AUD` 循环；图片模式下只提供关闭和音频字幕。

## 使用 AList

1. 点击左上角云朵按钮。
2. 输入 AList 地址、用户名和密码，然后保存或登录。
3. 在 Video、Images 或 Audio 标签中填写 AList 路径。
4. 点击路径右侧的云朵按钮加载文件。

从 iPad 访问时，AList 地址必须是 iPad 能访问的地址，例如：

```text
http://192.168.1.23:5244
```

不要在 iPad 上使用 `http://127.0.0.1:5244`，因为它代表 iPad 自己，而不是运行 AList 的 PC。

勾选 `Remember Login & Paths` 后，AList 地址、令牌和路径会保存在当前浏览器的本地存储中。不要在不受信任的共享设备上启用记住登录。

## 支持格式与兼容性

服务端允许传输以下扩展名，但最终能否播放取决于浏览器和文件内部编码。

| 类型 | 允许的扩展名 | iPad Safari 推荐 |
| --- | --- | --- |
| 视频 | `.mp4`, `.webm`, `.mkv`, `.ogg` | H.264/AAC 编码的 `.mp4` |
| 音频 | `.mp3`, `.wav`, `.flac`, `.aac`, `.m4a`, `.ogg`, `.mka` | `.mp3` 或 AAC 编码的 `.m4a` |
| 图片 | `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.avif`, `.bmp` | `.jpg`, `.png`, `.webp` |
| 字幕 | `.vtt`, `.srt` | UTF-8 编码的 `.vtt` |

服务器不会转码。文件能出现在列表中但无法播放时，通常是浏览器不支持容器或内部编码；建议先转换为 H.264/AAC MP4、MP3/M4A 和 WebVTT。

## 局域网和安全说明

- 服务默认监听 `0.0.0.0`，同一网络中的其他设备可以访问。
- 应用本身没有用户登录或访问密码，只适合可信的家庭/个人局域网。
- 不要把播放器端口直接映射到公网。
- Windows 防火墙建议只允许**专用网络**。
- 媒体 API 只接受 `media_roots.json` 中配置的目录，并阻止路径跳出根目录。
- 如果在公共 Wi-Fi、公司网络或校园网络使用，请确认网络策略和媒体隐私要求。

## 常见问题

### iPad 无法打开网页

依次检查：

1. iPad 与 PC 是否连接同一个 Wi-Fi / 局域网。
2. 是否使用启动窗口打印的 `iPad/LAN` 地址，而不是 `127.0.0.1`。
3. Windows 防火墙是否允许程序访问专用网络。
4. 路由器是否开启了 AP 隔离、访客网络隔离或设备隔离。
5. VPN 是否改变了 PC 或 iPad 的网络路由。
6. 端口 `5000` 被占用时，是否使用了启动器新打印的端口。

如果启动器没有识别到 LAN 地址，可运行：

```powershell
ipconfig
```

找到 PC 当前网络适配器的 IPv4 地址，再访问 `http://IPv4地址:端口/`。

### 网页提示媒体根目录不可用

- 检查 `media_roots.json` 是否为有效 JSON。
- 检查 Windows 路径中的反斜杠是否写成 `\\`。
- 检查文件夹是否存在，以及当前用户是否有读取权限。
- 修改配置后重启程序。

### 文件已显示但不能播放

扩展名受支持不代表浏览器支持文件内部编码。iPad 上优先使用 H.264/AAC MP4 和 MP3/M4A。

### 没有字幕

- 确认媒体和字幕主文件名完全相同。
- 确认字幕扩展名为 `.vtt` 或 `.srt`。
- 建议转换为 UTF-8 编码。
- 使用 CC 按钮选择正确的 `VID` 或 `AUD` 字幕层。

### 图片无法滑动

- 只有在 100% 缩放状态下，水平滑动才用于切换图片。
- 放大后拖动用于平移；请先点击缩放按钮回到 100%。
- 也可以直接点击画面左右两侧的透明区域。

### AList 列表能加载，但媒体不能播放

确认 AList 地址可以从当前浏览器设备直接访问。iPad 不能使用 PC 上的 `127.0.0.1` 地址。

## 自定义端口和启动行为

默认优先使用端口 `5000`。可以在 PowerShell 中指定首选端口：

```powershell
$env:DLSITE_PORT = "8080"
.\.venv\Scripts\python.exe launcher.py
```

不希望自动打开 PC 浏览器：

```powershell
$env:DLSITE_NO_BROWSER = "1"
.\.venv\Scripts\python.exe launcher.py
```

如果指定端口已被占用，启动器仍会选择其他可用端口。

## 打包 Windows 版本

在 PowerShell 中执行：

```powershell
.\build.ps1
```

脚本会使用独立构建环境安装 PyInstaller，并生成：

```text
dist\DLSite-ASMR-Player\
dist\DLSite-ASMR-Player-windows-x64.zip
```

推荐把完整 ZIP 上传到 GitHub Release。当前构建采用 PyInstaller `onedir` 模式，EXE 需要同目录中的依赖文件，因此不应只发布一个裸 EXE。

生成目录的主要结构：

```text
DLSite-ASMR-Player/
├─ DLSite-ASMR-Player.exe
├─ media_roots.json
├─ media/
├─ README.md
└─ 运行依赖文件
```

## API 概览

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/` | 播放器前端 |
| GET | `/api/library/roots` | 返回已配置的媒体根目录 |
| GET | `/api/library/list?root=media&path=...` | 浏览根目录内的文件夹和媒体 |
| GET | `/api/library/file?root=media&path=...` | 流式返回受允许的媒体文件 |
| POST | `/api/alist/login` | AList 登录代理 |
| POST | `/api/alist/list` | AList 文件列表代理 |
| POST | `/api/alist/subtitle` | AList 字幕读取与转换 |

以下接口为向后兼容保留：

- `GET /api/media`
- `GET /media/<filename>`
- `GET /subtitle/<filename>`
- `/api/local/*`

实现细节参阅 [server.py](server.py)。

## 项目结构

```text
.
├─ launcher.py                 # 启动服务、检测局域网地址、打开浏览器
├─ server.py                   # Flask API、目录限制、媒体流和 AList 代理
├─ media_roots.example.json   # 媒体根目录配置示例
├─ requirements.txt           # 运行依赖
├─ requirements-build.txt     # 打包依赖
├─ build.ps1                  # Windows 打包脚本
├─ media/                     # 默认媒体目录
└─ static/
   ├─ index.html              # 播放器页面
   ├─ app.js                  # 媒体库与播放交互
   └─ style.css               # 桌面端和触屏布局
```

## 参与改进

欢迎通过 Issue 或 Pull Request 提交问题、翻译、浏览器兼容性结果和功能改进。
