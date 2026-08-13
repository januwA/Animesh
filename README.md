# Animesh

Animesh is a high-performance desktop anime streaming and downloading client built with Tauri v2 + React + TypeScript. It supports magnet link aggregation search, BitTorrent stream playback (play while downloading), IPTV live streaming, AI-powered smart search, and embedded MKV subtitle extraction and rendering.

## Key Features

- **Magnet Aggregation Search**: Built-in RSS aggregation search engine with one-click search and real-time switching across six anime resource sites: **DMHY (动漫花园)**, **Bangumi.moe (萌番组)**, **Mikan Project (蜜柑计划)**, **Nyaa**, **ACG.RIP**, and **ANiBT**. Proxy configuration is also supported.
- **AI Smart Search & Recommendation**: Configure any OpenAI-compatible large model endpoint (e.g. Ollama, DeepSeek) in Settings. The AI Agent can score, filter, and recommend search results with recommended reasons, pinning high-quality torrents to the top while keeping traditional search as a fallback.
- **Stream Playback (Play While Downloading)**: Powered by the high-performance Rust BitTorrent client library `librqbit` and a local Axum HTTP streaming server, video files can be played before they are fully downloaded, with seek support via HTTP Range requests.
- **IPTV Live Streaming**: Built-in live TV with an HLS proxy that solves cross-origin playback, supports m3u8 manifest rewriting, redirect caching, Cookie/Referer passthrough, UA-based stream fallback, and FLV infinite streams played via `mpegts.js`. Channel lists are organized by country (powered by the iptv-org open dataset).
- **Anime Calendar**: Integrates with the Bangumi API to display daily airing anime information. Clicking an anime title directly searches for related magnet resources, and favorite entries can be collected with one click.
- **Favorites (Collections)**: Save interesting anime entries locally and access them from the dedicated Favorites page.
- **Embedded Subtitle Extraction & Rendering**: Uses `matroska-demuxer` to parse subtitle tracks from MKV video streams in real time. Supports extracting embedded text-based subtitles (e.g., ASS, SSA, UTF-8) and automatically converting them to WebVTT format for seamless rendering in the built-in player, with backend caching to speed up repeated loads. Note: Due to HTML5 `<video>` limitations, only text-based subtitles are currently supported. Bitmap-based subtitles (e.g., PGS `S_HDMV/PGS`) are not yet supported.
- **Download & Task Management**: Full BT task lifecycle management including pause, resume, and delete (with optional file deletion), plus real-time download speed, downloaded size, and progress percentage. Completed tasks can also be paused (stop seeding).
- **Download Speed Limit**: Configure a global background download speed limit to avoid saturating your network bandwidth (0 = unlimited).
- **Tracker Management**: Online sync with `ngosang/trackerslist` (optimal/full/IP-based lists or a custom URL), one-click replace or append modes, and optional auto-update every 24 hours to accelerate magnet resolution and downloads.
- **Theme & Accent Customization**: Light/Dark/System theme switching with 5 selectable accent colors derived from a single brand hue.
- **Local Settings & Directory Selection**: Integrates the native file dialog `rfd`, allowing users to customize the download storage path.
- **Built-in Update Check**: Check for new releases from the GitHub Releases page and open the download page directly.

## Tech Stack

### Frontend

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 8
- **Routing**: React Router 7 (hash router)
- **Styling & Components**: Tailwind CSS v4 + Radix UI + shadcn/ui
- **Video Player**: `@videojs/react` (web player), `mpegts.js` (FLV live streams)
- **Theme**: `next-themes` + custom accent color system
- **Validation**: Zod v4 (external data & route params)
- **Toast**: `sonner`
- **Icons**: Lucide React

### Backend

- **Core**: Rust + Tauri v2 (with a separate `animesh_server` Axum binary for web deployment)
- **BT Download Engine**: `librqbit`
- **Streaming Server**: Axum + Tower HTTP (provides LAN video streaming with seeking support)
- **IPTV HLS Proxy**: `reqwest` + `m3u8-rs` (manifest rewriting, redirect caching, UA fallback)
- **Subtitle Parsing**: `matroska-demuxer` (includes ASS/SSA tag filtering and WebVTT generation)
- **RSS Crawler**: `reqwest` + `quick-xml`
- **File Dialog**: `rfd`

## System Requirements

- **Node.js**: v20.19 or above
- **Rust/Cargo**: v1.75 or above
- **Package Manager**: pnpm

## Installation & Usage

### 1. Clone the Project and Install Dependencies

```bash
pnpm install
```

### 2. Start Development Mode

```bash
pnpm tauri dev
```

### 3. Build for Production

```bash
pnpm tauri build
```

### 4. Android Development Guide

#### Build & Run

- **Initialize the Android project** (first time only):
  ```bash
  pnpm tauri android init
  ```
- **Launch on a device or emulator for development**:
  ```bash
  pnpm tauri android dev
  pnpm tauri android dev --force-ip-prompt
  ```
- **Build Android packages (APK/AAB)**:
  - **Local build without CMake (aarch64 only)**:
    ```bash
    pnpm tauri:android:apk
    # Or manually specify the target
    pnpm tauri android build --apk --target aarch64
    ```
  - **Full-architecture build (includes armv7/x86, requires local CMake setup)**:
    ```bash
    pnpm tauri android build
    ```

#### Auto-Signing Configuration

To avoid generating unsigned packages (`-unsigned.apk`) on every release build (which cannot be installed on devices), the project includes auto-signing logic:

1. **Local build auto-signing**:
   Create a `keystore.properties` file in the `src-tauri/gen/android/` directory (this file is already in `.gitignore`) and fill in your `.jks` keystore information:
   ```properties
   storeFile=Absolute path to your keystore file (use double backslashes, e.g. D:\\work\\my-key.jks)
   storePassword=Your keystore password
   keyAlias=Your key alias
   keyPassword=Your key password
   ```
2. **CI/CD auto-signing**:
   Configure the following secrets in your GitHub Repository Secrets. The CI pipeline will automatically decode and sign the release build:
   - `ANDROID_KEY_BASE64`: Base64-encoded string of your `.jks` file (generate locally in PowerShell with `[Convert]::ToBase64String([IO.File]::ReadAllBytes("my-key.jks"))`)
   - `ANDROID_KEYSTORE_PASSWORD`: Keystore password
   - `ANDROID_KEY_ALIAS`: Key alias
   - `ANDROID_KEY_PASSWORD`: Key password

#### Troubleshooting

1. **Gradle dependency download timeout/failure (China mainland)**
   - **Solution**: Create a global Gradle init script `init.gradle` in your user home directory (Windows: `C:\Users\<username>\.gradle\init.gradle`) to configure Alibaba Cloud mirror repositories:
     ```groovy
     gradle.beforeSettings { settings ->
         settings.pluginManagement {
             repositories {
                 maven { url 'https://maven.aliyun.com/repository/gradle-plugin' }
                 maven { url 'https://maven.aliyun.com/repository/public' }
                 gradlePluginPortal()
             }
         }
         settings.dependencyResolutionManagement {
             repositories {
                 maven { url 'https://maven.aliyun.com/repository/public' }
                 maven { url 'https://maven.aliyun.com/repository/google' }
                 maven { url 'https://maven.aliyun.com/repository/central' }
                 google()
                 mavenCentral()
             }
         }
     }
     allprojects {
         buildscript {
             repositories {
                 maven { url 'https://maven.aliyun.com/repository/gradle-plugin' }
                 maven { url 'https://maven.aliyun.com/repository/public' }
             }
         }
         repositories {
             maven { url 'https://maven.aliyun.com/repository/public' }
             maven { url 'https://maven.aliyun.com/repository/google' }
             maven { url 'https://maven.aliyun.com/repository/central' }
         }
     }
     ```

2. **Gradle error: `Unsupported class file major version 69` (Java 25 conflict)**
   - Install a JDK that matches the Gradle version in `src-tauri/gen/android/gradle/wrapper/gradle-wrapper.properties`. For example, for gradle-8.14.3, install JDK 21

## Web Mode & Server Deployment

Animesh supports a fully decoupled **Web Mode** enabling server-side deployment (e.g., on NAS, VPS, or Docker hosts).

In Web Mode:

- The backend replaces the Tauri layer with a high-performance **Axum HTTP REST API** and **Server-Sent Events (SSE)** for real-time torrent updates.
- The frontend features **compile-time condition compilation**. When building for Web, all Tauri native modules (updater, directory picker, custom menus) are completely Tree-Shaken.
- The server automatically serves the frontend static SPA client (`dist/`) under the root route with SPA route fallback, providing a single-container deployment experience.

### 1. Local Web Development & Debugging

You can develop the Web frontend locally with Hot Module Replacement (HMR) while communicating with a backend running locally or in Docker.

1. Ensure the backend server is running (e.g. via Docker at `http://localhost:8080`).
2. Start the Vite development server in web mode:
   ```bash
   pnpm run dev:web
   ```
   *This automatically loads `.env.web` and proxies API requests to your local backend.*

### 2. Docker & Docker Compose Deployment (Recommended)

The easiest way to deploy Animesh on your server is using `docker-compose.yml`.

1. **Start the Service**:
   ```bash
   docker compose up --build -d
   ```
2. **Accessing the Client**:
   - Web GUI & API: **`http://localhost:8080`**
   - Streaming Server: **`http://localhost:3000`**
   - Persistence Data: Saved in `./data` relative to your compose file.

#### Environment Variables

Configure the following variables in `docker-compose.yml`:

- `ANIMESH_SERVER_PORT`: REST API and Web client static server port (Default: `8080`).
- `ANIMESH_STREAM_PORT`: AXUM streaming server port (Default: `3000`).
- `ANIMESH_DATA_DIR`: Configuration and download storage directory (Default: `/app/data`).
- `ANIMESH_EXTERNAL_URL`: Custom base URL for external video streams (e.g., `http://your-server-ip:3000`).

## Versioning & Release

To update the application version number and keep all version configurations (frontend and Rust backend) in sync, run:

```bash
pnpm bump-version <new-version>
```

For example:

```bash
pnpm bump-version 0.6.0
```

The script will automatically:

1. Validate that the target version conforms to SemVer format.
2. Compare the target version with the current version, preventing duplicate updates or version downgrades.
3. Synchronize the version across `./package.json` and the Rust workspace version in `./src-tauri/Cargo.toml` (sub-crates such as `core`/`server` inherit it via `version.workspace = true`), then refresh `Cargo.lock`.
