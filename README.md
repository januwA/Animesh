# Animesh

Animesh is a high-performance desktop anime streaming and downloading client built with Tauri v2 + React + TypeScript. It supports magnet link aggregation search, BitTorrent stream playback (play while downloading), and embedded MKV subtitle extraction and rendering.

## Key Features

- **Magnet Aggregation Search**: Built-in RSS aggregation search engine with one-click search and real-time switching across multiple well-known anime resource sites, including **DMHY (dongmanhuayuan)**, **Mikan Project**, and **Nyaa**. Proxy configuration is also supported.
- **Stream Playback (Play While Downloading)**: Powered by the high-performance Rust BitTorrent client library `librqbit` and a local Axum HTTP streaming server, video files can be played before they are fully downloaded, with seek support via HTTP Range requests.
- **Anime Calendar**: Integrates with the Bangumi API to display daily airing anime information. Clicking an anime title directly searches for related magnet resources.
- **Embedded Subtitle Extraction & Rendering**: Uses `matroska-demuxer` to parse subtitle tracks from MKV video streams in real time. Supports extracting embedded text-based subtitles (e.g., ASS, SSA, UTF-8) and automatically converting them to WebVTT format for seamless rendering in the built-in player. Note: Due to HTML5 `<video>` limitations, only text-based subtitles are currently supported. Bitmap-based subtitles (e.g., PGS `S_HDMV/PGS`) are not yet supported.
- **Download & Task Management**: Full BT task lifecycle management including pause, resume, and delete (with optional file deletion), along with real-time download speed, downloaded size, and progress percentage.
- **Local Settings & Directory Selection**: Integrates the native file dialog `rfd`, allowing users to customize the download storage path.

## Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 8
- **Routing**: React Router 7
- **Styling & Components**: Tailwind CSS v4 + Radix UI + shadcn/ui
- **Icons**: Lucide React

### Backend
- **Core**: Rust + Tauri v2
- **BT Download Engine**: `librqbit`
- **Streaming Server**: Axum + Tower HTTP (provides LAN video streaming with seeking support)
- **Subtitle Parsing**: `matroska-demuxer` (includes ASS/SSA tag filtering and WebVTT generation)
- **RSS Crawler**: `reqwest` + `quick-xml`
- **File Dialog**: `rfd`

## System Requirements

- **Node.js**: v18.0 or above
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
   - **Cause**: Your system's default JDK version is too high (e.g., JDK 25), and the current Gradle 8.14.3 cannot recognize bytecode from that Java version.
   - **Solution**: Configure a compatible Java version (e.g., JDK 21) for local Gradle. Do not modify property files inside the project directory to avoid affecting CI builds. Instead, create or edit the **global** Gradle configuration file in your user home directory:
     - Windows: `C:\Users\<username>\.gradle\gradle.properties`
     - macOS/Linux: `~/.gradle/gradle.properties`
     And set it to the JDK (JBR) bundled with Android Studio (Windows example):
     ```properties
     org.gradle.java.home=C:\\Program Files\\Android\\Android Studio\\jbr
     ```

## Versioning & Release

To update the application version number and keep all version configurations (frontend and Rust backend) in sync, run:
```bash
pnpm bump-version <new-version>
```
For example:
```bash
pnpm bump-version 0.3.0
```
The script will automatically:
1. Validate that the target version conforms to SemVer format.
2. Compare the target version with the current version, preventing duplicate updates or version downgrades.
3. Synchronize the version across `./package.json`, `./src-tauri/Cargo.toml`, and `./src-tauri/core/Cargo.toml`.
