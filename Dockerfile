# syntax=docker/dockerfile:1

# ---- build stage ---------------------------------------------------------
# Bookworm-based so its glibc matches the runtime image (cgo/sqlite links glibc).
# Go 1.26 is required (chromedp pulls the minimum up; see go.mod).
FROM golang:1.26-bookworm AS build

WORKDIR /src

# Cache modules first for faster rebuilds.
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY cmd ./cmd
COPY pkg ./pkg
COPY imports ./imports

# Precompile JSX bundles (uses esbuild via Go, no Node.js needed).
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go generate ./pkg/server

# CGO is required by mattn/go-sqlite3 (the user-data store).
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 GOOS=linux go build -trimpath -ldflags "-s -w" \
      -o /out/serve-artifacts ./cmd/serve-artifacts

# ---- runtime stage -------------------------------------------------------
FROM debian:bookworm-slim

LABEL org.opencontainers.image.title="serve-claude-experiments" \
      org.opencontainers.image.description="Claude.ai artifact gallery server (with thumbnail rendering)" \
      org.opencontainers.image.source="https://github.com/wesen/2026-03-29--serve-claude-experiments"

# chromium: renders thumbnails. ca-certificates: HTTPS for the JSX import map
# (React from esm.sh / Babel from unpkg at render time). fonts: legible text in
# thumbnails, incl. emoji. tini: PID 1 that reaps the Chrome child processes.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ca-certificates \
      fonts-liberation \
      fonts-noto-core \
      fonts-noto-color-emoji \
      tini \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /out/serve-artifacts /usr/local/bin/serve-artifacts
# Ship the sample artifacts as the default library; mount your own over
# /artifacts to replace them.
COPY --from=build /src/imports /artifacts
RUN mkdir -p /data

# /data holds the generated thumbnails and the favorites/tags/collections DB.
VOLUME ["/data"]

# Chrome must run with --no-sandbox as root inside a container; the serve command
# reads this env so no extra flag is needed.
ENV SERVE_ARTIFACTS_CHROME_NO_SANDBOX=1

EXPOSE 8080

ENTRYPOINT ["tini", "--", "/usr/local/bin/serve-artifacts"]
CMD ["serve", "--dir", "/artifacts", "--port", "8080", \
     "--thumbs", "/data/thumbs", "--db", "/data/userdata.db"]
