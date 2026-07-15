---
Title: "Managing Artifacts over the API with the artifact CLI"
Slug: "artifact-api-cli"
Short: "List, view, modify, and push artifacts against a running server using the artifact command group."
Topics:
- artifacts
- api
- cli
Commands:
- artifact
- serve
Flags:
- api
- token
- name
- file
- overwrite
IsTopLevel: true
IsTemplate: false
ShowPerDefault: true
SectionType: Application
---

The `serve-artifacts` binary is both the server and a client of its own HTTP
API. The `serve` command starts the server; the `artifact` command group talks
to a *running* server to list artifacts, read one's metadata or source, change
an artifact's metadata, and push a new artifact into the corpus. The verbs are
HTTP clients, not in-process calls: a modify or push goes through the same
validation, index rebuild, and (future) authorization that any other API client
would, so the server stays the single source of truth for what is valid and what
exists.

This page explains the connection model, each verb, the read-versus-write
distinction that authorization is built around, and how to troubleshoot common
failures.

## Connecting to a server

Every verb needs to know which server to call. Resolution order for the base URL
is the `--api` flag, then the `SERVE_ARTIFACTS_API` environment variable, then
`http://localhost:8080`. Set the environment variable once and every verb picks
it up:

```bash
serve-artifacts serve --dir ./imports --port 8137 --no-thumbnails &
export SERVE_ARTIFACTS_API=http://localhost:8137
serve-artifacts artifact list
```

Write verbs (`set-meta`, `push`) also accept `--token` (or `SERVE_ARTIFACTS_TOKEN`),
sent as an `Authorization: Bearer` header. If the server was started with a write
token (`--write-token` / `SERVE_ARTIFACTS_WRITE_TOKEN`), writes without a matching
token get `403`; reads stay open regardless. If the server has no write token
configured, writes are open (and the server logs a warning at startup).

## Reading: list, get, source

`artifact list` returns artifacts as structured rows, so the standard Glazed
output flags apply (`--output json|yaml|csv`, `--fields`, sorting). It maps to the
server's search, so the same filters are available:

```bash
serve-artifacts artifact list --type jsx --tag react --limit 50
serve-artifacts artifact list --query "calendar" --output json --fields name,title,tags
```

`artifact get --name <name>` shows one artifact's metadata (also a Glazed row).
The name is an artifact's stable key: its slash path relative to the serve root
without the extension, for example `abc123/artifacts/Calendar`.

```bash
serve-artifacts artifact get --name abc123/artifacts/Calendar --output yaml
```

`artifact source --name <name>` streams the raw artifact source to stdout, which
is convenient for piping or saving:

```bash
serve-artifacts artifact source --name demos/pricing > pricing.html
```

## Modifying metadata: set-meta

`artifact set-meta` changes an artifact's metadata by writing its manifest
sidecar (`<base>.manifest.json`). It never touches the source, so a metadata edit
can never break how an artifact renders. There are two modes:

- **Merge (default, `PATCH`).** Only the fields you pass change; unset fields are
  left as they are. Because an unset flag and an empty flag look the same on the
  command line, merge cannot *clear* a field — it can only set one.
- **Replace (`--replace`, `PUT`).** The whole manifest is replaced, so any field
  you do not pass is cleared.

```bash
# Merge: add a description, keep existing title and tags.
serve-artifacts artifact set-meta --name demos/pricing --description "Tiered pricing table"

# Merge: set tags (repeat --tag).
serve-artifacts artifact set-meta --name demos/pricing --tag pricing --tag saas

# Replace: reset the manifest to exactly these fields.
serve-artifacts artifact set-meta --name demos/pricing --replace --title "Pricing" --tag saas
```

The server validates every manifest before writing it (a non-blank title if
present, non-blank tags, an `original_date` of the form `YYYY-MM-DD`, and
`http`/`https` links). A validation failure returns a `400` and the manifest is
not written.

## Pushing a new artifact: push

`artifact push` uploads a new `.html` or `.jsx` file into the corpus. The type is
inferred from the file extension unless you pass `--type`. You can seed the
manifest in the same call, and you must pass `--overwrite` to replace an existing
artifact of the same name (the default refuses, to protect the corpus).

```bash
serve-artifacts artifact push --file ./Widget.jsx --name demos/widget \
  --title "My Widget" --tag react --tag demo

# Overwrite an existing artifact.
serve-artifacts artifact push --file ./Widget.jsx --name demos/widget --overwrite
```

On success the server writes the source (and manifest) atomically, rebuilds its
in-memory index, and returns the new artifact — so it is immediately visible to a
following `artifact list`. Because the source is new, its thumbnail regenerates
on the next request to the gallery; you do not manage thumbnails by hand.

## How reads and writes differ

The API is designed so that reads are open and writes are guarded. `list`, `get`,
and `source` never change anything. `set-meta` and `push` mutate the corpus on
disk and pass through the server's write-authorization seam. Today that seam
allows every caller; when real authorization is added, only the writes are
gated, and the `--token` flag already carries the credential. This is the same
philosophy the server uses for identity: one function to change, not a rewrite.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `connection refused` | No server is running at the base URL. | Start `serve-artifacts serve ...` and set `--api` / `SERVE_ARTIFACTS_API` to its address. |
| `409 Conflict: artifact already exists` | Pushing a name that already exists. | Choose a different `--name`, or pass `--overwrite` to replace it. |
| `400 Bad Request: bad artifact name` | `--name` was empty, absolute, or contained `..` (path traversal). | Use a relative slash path without an extension, e.g. `demos/widget`. |
| `400 ... original_date must use YYYY-MM-DD` | A manifest date was malformed. | Pass `--date 2024-11-02` in ISO form. |
| `set-meta` did not clear a field | Merge (`PATCH`) cannot clear fields. | Use `--replace` to replace the whole manifest, omitting the field to clear it. |
| Pushed artifact not in `list` | Rare; index rebuild failed server-side. | Check the server log; the push response itself reflects the applied state. |

## See Also

- `adding-artifacts` — the file conventions (`.html`/`.jsx`, the manifest sidecar) that `push` must produce and that the scanner reads.
- Run `serve-artifacts artifact --help` for the full verb and flag list.
