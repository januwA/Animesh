# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app
RUN npm install -g pnpm && pnpm config set registry https://registry.npmmirror.com
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm run build:web

# Stage 2: Build Backend
FROM rust:slim-bookworm AS backend-builder
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/animesh
COPY src-tauri src-tauri
WORKDIR /usr/src/animesh/src-tauri
RUN mkdir -p ~/.cargo && \
    echo '[source.crates-io]' > ~/.cargo/config.toml && \
    echo 'replace-with = "tuna"' >> ~/.cargo/config.toml && \
    echo '[source.tuna]' >> ~/.cargo/config.toml && \
    echo 'registry = "sparse+https://mirrors.tuna.tsinghua.edu.cn/crates.io-index/"' >> ~/.cargo/config.toml
RUN cargo build --package animesh_server --release

# Stage 3: Final Image
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=backend-builder /usr/src/animesh/src-tauri/target/release/animesh_server /app/animesh_server
COPY --from=frontend-builder /app/dist /app/dist

ENV ANIMESH_SERVER_PORT=8080
ENV ANIMESH_STREAM_PORT=3000
ENV ANIMESH_DATA_DIR=/app/data

EXPOSE 8080 3000 6881/tcp 6881/udp

VOLUME ["/app/data"]

CMD ["/app/animesh_server"]
