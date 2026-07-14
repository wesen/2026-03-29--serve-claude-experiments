# Running serve-artifacts in Docker

The image is self-contained: it bundles the Go server **and** the headless
Chromium used to render artifact thumbnails, plus the CA certificates and fonts
those renders need. Nothing else has to be installed on the host.

## Quick start (compose)

```bash
# Put your artifacts in ./imports (or edit the volume in docker-compose.yml),
# then:
docker compose up --build
# open http://localhost:8080
```

## Quick start (plain docker)

```bash
docker build -t serve-artifacts .

docker run --rm -p 8080:8080 \
  -v /path/to/your/artifacts:/artifacts:ro \
  -v serve-artifacts-data:/data \
  serve-artifacts
```

If you omit the `/artifacts` mount, the image serves the sample library baked in
at build time.

## What the image contains

| Layer | Purpose |
|---|---|
| `serve-artifacts` binary | the server (built with cgo for the SQLite user-data store) |
| `chromium` | renders each artifact to a PNG thumbnail |
| `ca-certificates` | HTTPS for the JSX import map (React from esm.sh, Babel from unpkg) |
| `fonts-liberation`, `fonts-noto-*` | legible text and emoji in thumbnails |
| `tini` | PID 1, reaps the Chrome child processes |

## Volumes

- **`/artifacts`** — the directory of artifacts to serve. Mount read-only.
- **`/data`** — persisted state: generated thumbnails (`/data/thumbs`) and the
  favorites/tags/collections database (`/data/userdata.db`). Use a named volume
  so both survive restarts; thumbnails are keyed by content hash, so they are
  only ever regenerated when an artifact actually changes.

## Configuration

The default command is:

```
serve --dir /artifacts --port 8080 --thumbs /data/thumbs --db /data/userdata.db
```

Override it to change flags, e.g. enable watch mode:

```bash
docker run --rm -p 8080:8080 -v $PWD/imports:/artifacts:ro -v serve-artifacts-data:/data \
  serve-artifacts serve --dir /artifacts --port 8080 \
    --thumbs /data/thumbs --db /data/userdata.db --watch
```

Relevant flags / env:

- `--no-thumbnails` — disable thumbnail rendering entirely (no Chrome is
  launched; the gallery shows placeholders).
- `--chrome-no-sandbox` / `SERVE_ARTIFACTS_CHROME_NO_SANDBOX=1` — run Chrome with
  `--no-sandbox`. **The image sets the env by default** because Chrome cannot use
  its sandbox as root inside a container. On a normal host you would leave this
  off.

## Notes and caveats

- **Thumbnails render lazily** on first view plus a background backfill at
  startup, so the first load of a large library warms up over a minute or two;
  after that thumbnails are served from `/data/thumbs` with no Chrome activity.
- **JSX thumbnails need outbound HTTPS** at render time (esm.sh + unpkg). In an
  air-gapped deployment, either run with `--no-thumbnails` or vendor React/Babel
  and localize the import map. HTML artifacts render offline.
- **Memory**: each render is a headless page; the server bounds concurrent
  renders to `min(4, GOMAXPROCS)`. `--disable-dev-shm-usage` is set so the small
  default `/dev/shm` in containers does not crash Chrome — no `--shm-size` tuning
  is required.
