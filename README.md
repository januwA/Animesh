# Animesh

Animesh 是一款基于 Tauri v2 + React + TypeScript 构建的高性能桌面动漫播放与下载客户端。支持磁力链接聚合搜索、BT 种子边下边播以及 MKV 内置字幕的在线解析与渲染。

## 核心特性

- **磁力聚合搜索**：内置 RSS 聚合搜索引擎，支持一键搜索与实时切换多个知名动漫资源站点的 RSS 订阅源（包括**动漫花园 DMHY**、**蜜柑计划 Mikan Project** 与 **Nyaa**），并支持代理配置。
- **边下边播（流媒体播放）**：基于 Rust 高性能 BitTorrent 客户端库 `librqbit` 与本地 Axum HTTP 流媒体服务器，视频文件无需完全下载即可开始播放，且支持进度条拖动（Range 请求）。
- **新番日历**：集成 Bangumi API，展示每日最新连载新番信息，点击新番名称即可直接跳转搜索相关磁力资源。
- **内置字幕提取与渲染**：使用 `matroska-demuxer` 实时解析 MKV 格式视频流中的字幕音轨，支持将嵌入的文本格式字幕（如 ASS、SSA、UTF-8）实时提取并自动转换为 WebVTT 格式，直接在内置播放器中无缝渲染。注意：受限于 HTML5 `<video>` 的播放规范，目前仅支持文本格式字幕，暂不支持图形格式字幕（如 PGS 字幕 `S_HDMV/PGS`）的提取与渲染。
- **下载与任务管理**：提供完整的 BT 任务生命周期管理，包括暂停、继续、删除（可选连同文件一起删除），并支持查看实时下载速度、已下载大小和进度百分比。
- **本地设置与目录选择**：集成原生文件对话框 `rfd`，允许用户自定义下载存储路径。

## 技术栈

### 前端 (Frontend)
- **框架**：React 19 + TypeScript
- **构建工具**：Vite 8
- **路由管理**：React Router 7
- **样式与组件**：Tailwind CSS v4 + Radix UI + shadcn/ui 组件库
- **图标**：Lucide React

### 后端 (Backend)
- **内核**：Rust + Tauri v2
- **BT 下载引擎**：`librqbit`
- **流媒体服务器**：Axum + Tower HTTP (提供局域网视频流与 Seeking 寻址支持)
- **字幕解析**：`matroska-demuxer` (包含 ASS/SSA 标签过滤及 WebVTT 格式生成逻辑)
- **RSS 爬虫**：`reqwest` + `quick-xml`
- **文件对话框**：`rfd`

## 系统要求

- **Node.js**：v18.0 或以上版本
- **Rust/Cargo**：v1.75 或以上版本
- **包管理器**：pnpm

## 安装与运行

### 1. 克隆项目并安装依赖

```bash
pnpm install
```

### 2. 启动开发调试模式

```bash
pnpm tauri dev
```

### 3. 构建发布版本

```bash
pnpm tauri build
```

## 测试

项目内包含了前端与后端单元测试：

### 运行前端测试 (Vitest)
```bash
pnpm test
```

### 运行 Rust 后端测试
```bash
pnpm test:rust
```

### 运行 Rust 测试覆盖率检查
```bash
pnpm test:rust:coverage
```

## 版本发布与迭代

更新应用版本号时，为了确保多处版本配置（前端与 Rust 后端）的同步和安全性，可以直接运行：
```bash
pnpm bump-version <新版本号>
```
例如：
```bash
pnpm bump-version 0.3.0
```
该脚本会自动：
1. 校验输入的目标版本是否符合 SemVer 格式。
2. 比较目标版本与当前版本，禁止重复更新或版本降级。
3. 自动同步更新 `./package.json`、`./src-tauri/Cargo.toml` 以及 `./src-tauri/core/Cargo.toml`。

## 代码规范与提交流程

- 本项目使用 **Biome** 作为代码格式化与静态检查工具。提交代码前请运行：
  ```bash
  pnpm check:apply
  ```
- **Git Commit 规则**：在执行 `git commit` 时，**必须**使用中文编写提交信息。

