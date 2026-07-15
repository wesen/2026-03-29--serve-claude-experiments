---
Title: Diary
Ticket: SERVE-20260714-ARTIFACTAPI
Status: active
Topics:
    - api
    - cli
    - auth
    - artifacts
    - web-server
    - golang
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - pkg/artifacts/writer.go
    - pkg/server/artifactapi.go
    - pkg/server/server.go
    - cmd/serve-artifacts/cmds/artifact.go
    - cmd/serve-artifacts/cmds/apiclient.go
ExternalSources: []
Summary: "Implementation diary for the artifact-management API (list/source/modify/push) and the Glazed CLI verbs that drive it. Records the vertical-slice build, the two bugs the tests caught (ServeMux wildcard-must-be-last, and a path-traversal guard that clamped instead of rejecting), and the end-to-end verification against a live server."
LastUpdated: 2026-07-14T21:40:53-04:00
WhatFor: "Understand how the artifact API + CLI were built and validated, and what to watch when extending them."
WhenToUse: "Read before changing the artifact write path, the auth seam, or the artifact CLI verbs."
---

# Diary

## Goal

Capture the implementation of the artifact-management HTTP API (list / view source / modify / push) and its Glazed CLI verbs for serve-artifacts, per the design in `design/01-...`. Record what was built, the bugs the tests surfaced, and how the whole thing was validated end to end.

## Step 1: Server-side API — writer, handlers, auth seam

Implemented the first write path to the artifact *corpus* itself. The design's build order (rebuild-on-write plumbing → read API → modify → push → auth seam) collapsed into one server-side commit because the pieces share a file and a mutex and are cheap to review together. The corpus-write primitives live in `pkg/artifacts/writer.go` (path-safety, atomic file writes, manifest read/write/validate), the HTTP surface and the authorization seam live in a new `pkg/server/artifactapi.go`, and `Run`'s route registration was extracted into `registerRoutes()` so tests can exercise the full router without opening a listener.

The central invariant is **validate → write atomically → rebuild index → respond**, all under a per-server `writeMu`, so a mutation is queryable the instant its HTTP response returns and two writers never interleave. Metadata edits go through the manifest sidecar (no source change → same `contentHash` → thumbnail stays valid); pushes write a new source file (new hash → thumbnail regenerates lazily).

### Prompt Context

**User prompt (verbatim):** "Alright, implement and test it. Keep a detailed diary as you work (see skills), and commit at appropriate intervals"

**Assistant interpretation:** Build the API + CLI described in the ticket's design doc, write tests, validate, and keep a strict-format diary, committing in logical slices.

**Inferred user intent:** Turn the design into working, tested code with a reviewable trail.

**Commit (code):** 438f311 — "feat: artifact-management API (list/source/modify/push) with write-auth seam"

### What I did
- `pkg/artifacts/writer.go`: `ManifestPathFor`, `WriteManifest` (validate + atomic), `LoadManifest`/`ValidateManifest` (exported the loader's rules), `ExtensionForType`, `SafeArtifactPath` (traversal guard), `WriteFileAtomic` (temp + rename), and sentinels `ErrBadArtifactName`/`ErrUnsupportedType`/`ErrArtifactExists`.
- `pkg/server/artifactapi.go`: `action`/`authorize`/`requireWrite` (allow-all seam), `writeError`, `corpusStatus`, and handlers `handleArtifactSource`, `handleManifestPut`, `handleManifestPatch` (pointer-field `manifestPatch` for present-vs-absent), `handleArtifactPush` (JSON + multipart).
- `pkg/server/server.go`: added `writeMu sync.Mutex`; refactored `handleArtifactJSON` to reuse a new `writeArtifactView`; extracted `registerRoutes()`; registered the new routes (writes behind `requireWrite`).
- Tests: `pkg/artifacts/writer_test.go` (unit) and `pkg/server/artifactapi_test.go` (httptest integration).

### Why
- The corpus had no runtime write path; modify/push are that path. Keeping it in one write-locked sequence with an explicit index rebuild is what makes reads see writes immediately.
- The auth seam mirrors the existing `currentUser()` seam so "protect for authorized users later" is a one-function change, not a rewrite.

### What worked
- `go build ./...` clean; `go vet ./...` clean; full `go test ./...` green after the two fixes below.
- The manifest PATCH-merge (load current, overlay present pointer fields, write) preserves untouched fields — proven by `TestManifestPatchMergesAndPreserves`.

### What didn't work
- **ServeMux wildcard placement.** Initial routes used `GET /api/artifact/{name...}/source` and `.../manifest`. `httptest.NewServer(s.registerRoutes())` panicked at registration: `parsing "GET /api/artifact/{name...}/source": at offset 18: {...} wildcard not at end`. Go's `net/http.ServeMux` only allows the `{name...}` multi-segment wildcard as the final segment. Fix: made the action a path **prefix** — `GET /api/source/{name...}`, `PUT|PATCH /api/manifest/{name...}`.
- **Traversal guard clamped instead of rejecting.** `SafeArtifactPath` first did `path.Clean("/" + name)`, which force-roots and *collapses* `..` so `../escape` became `/escape` (under root) and passed. `TestSafeArtifactPath` failed on `../escape`, `a/../../escape`, `/etc/passwd`, `foo/../../bar`. Fix: clean the *relative* name (no leading `/`); a net-upward path then cleans to `.` or a leading `..`, which is rejected; absolute names are rejected up front.

### What I learned
- `path.Clean("/"+p)` is the wrong primitive for a traversal check — it hides the escape by clamping. Cleaning the relative path preserves the escape as a leading `..`, which is exactly the signal to reject on.
- The wildcard-last rule quietly reshapes any REST design that wants `/{id}/subresource` with a multi-segment id. Prefix the action instead.

### What was tricky to build
- **PATCH vs PUT semantics.** PATCH must distinguish "field absent" from "field set to empty". A plain `ArtifactManifest` can't (empty string == absent). Solved with a pointer-field `manifestPatch` struct: non-nil == present. PUT decodes straight into `ArtifactManifest`, so omissions zero out.
- **Ordering under the lock.** `writeManifestAndRespond` re-resolves the artifact *inside* `writeMu` (not just in the caller) so a concurrent push/rename can't invalidate the path between check and write.

### What warrants a second pair of eyes
- `SafeArtifactPath`: the traversal rejection logic (the `path.Clean` relative-name reasoning and the defense-in-depth `filepath.Rel` check). Security-critical.
- The push handler's manifest path derivation (`abs[:len(abs)-len(ext)] + ".manifest.json"`) — correct because `ext` is exactly the suffix just appended.

### What should be done in the future
- `handleArtifactJSON`'s 404 still uses `http.NotFound` (plain-text body) rather than the `{"error":...}` shape; harmless but inconsistent.
- Optional: a `DELETE` path (deliberately omitted; destructive, needs real auth first).

### Code review instructions
- Start at `pkg/artifacts/writer.go` (`SafeArtifactPath`, `WriteManifest`), then `pkg/server/artifactapi.go` (handlers + `writeManifestAndRespond` ordering), then the route block in `pkg/server/server.go:registerRoutes`.
- Validate: `go test ./pkg/artifacts/... ./pkg/server/... -count=1`.

### Technical details
- Invariant: `s.writeMu.Lock()` → `scanner.FindByName` → `WriteManifest`/`WriteFileAtomic` → `index.rebuild()` → `writeArtifactView`.
- Status mapping (`corpusStatus`): `ErrBadArtifactName`/`ErrUnsupportedType` → 400, `ErrArtifactExists` → 409, else 500.

## Step 2: Glazed CLI verbs over the API

Added the `artifact` command group so the API is drivable from a terminal. The verbs are HTTP clients (not in-process calls) so modify/push flow through the same validation, index rebuild, and (future) authorization as any other client. A shared `apiClient` centralizes the base URL and the future bearer token; each verb decodes settings via the repo's Glazed idiom (`fields`/`values`/`schema`, `DecodeSectionInto`) and either emits Glaze rows (`list`, `get`) or writes text (`source`, `set-meta`, `push`).

### Prompt Context

**User prompt (verbatim):** "Alright, implement and test it. Keep a detailed diary as you work (see skills), and commit at appropriate intervals"

**Assistant interpretation:** Implement the CLI half of the design and verify it against a live server.

**Inferred user intent:** A usable command-line surface for the new API, proven to work.

**Commit (code):** 0f11ba2 — "feat: `artifact` CLI verbs (list/get/source/set-meta/push) over the API"

### What I did
- `cmd/serve-artifacts/cmds/apiclient.go`: `apiClient` with `getJSON`/`sendJSON`/`do`, `--api`/`$SERVE_ARTIFACTS_API` (default `http://localhost:8080`), future `--token`/`$SERVE_ARTIFACTS_TOKEN`, and `serverErrorMessage` to surface `{"error":...}` on non-2xx.
- `cmd/serve-artifacts/cmds/artifact.go`: `NewArtifactCobraCommand` (parent) + five verbs — `list`/`get` (`GlazeCommand`), `source`/`set-meta`/`push` (`WriterCommand`) — with compile-time interface asserts.
- `cmd/serve-artifacts/main.go`: registered the group.
- Built the binary and ran a live end-to-end session.

### Why
- CLI-over-HTTP keeps one source of truth (the server) for validation and search; an in-process CLI path would drift.

### What worked
- End-to-end against a live `--no-thumbnails` server on :8137:
  - `artifact list --output json` → the seed artifact.
  - `artifact push --file widget.jsx --name demos/widget --title ... --tag react --tag demo` → `created demos/widget (jsx)`, `widget.jsx` + `widget.manifest.json` on disk, immediately listable.
  - `artifact get` → seeded title/tags; `artifact source` → raw source.
  - `artifact set-meta --description ...` (PATCH) → only description changed, tags/title preserved.
  - Error paths: conflict `409 ... artifact already exists`; `--overwrite` succeeds; traversal `400 ... bad artifact name`; bad date `400 ... original_date must use YYYY-MM-DD`.

### What didn't work
- **`fields.Field` does not exist.** `apiFlags()` was typed `[]fields.Field`; the compiler rejected it. `fields.New` returns `*fields.Definition` and `cmds.WithFlags` takes `...*fields.Definition`. Fixed the helper's type to `[]*fields.Definition`.

### What I learned
- The repo is on Glazed v1.0.5's rewritten API: `fields.New(...) *fields.Definition`, `settings.NewGlazedSchema()`, `RunIntoGlazeProcessor(ctx, *values.Values, middlewares.Processor)`, `RunIntoWriter(ctx, *values.Values, io.Writer)`, wired with `cli.BuildCobraCommand`. Not the older `parameters`/`layers`/`InitializeStruct` API.

### What was tricky to build
- **Merge-vs-replace on the client.** `set-meta` can't tell "flag unset" from "flag empty", so PATCH sends only non-empty fields (can't clear via merge) and `--replace` (PUT) sends all fields (omissions clear). Documented in the command's long help.
- **Nested names in URLs.** `artifactPath` escapes each `/`-separated segment with `url.PathEscape` while preserving the separators, so a name like `abc/artifacts/Calendar` round-trips.

### What warrants a second pair of eyes
- `set-meta` merge semantics (the "can't clear a field via PATCH" tradeoff) — confirm that's the desired UX.

### What should be done in the future
- A Glazed help topic (`doc/*.md`) for the `artifact` group (the help system is already wired in `main.go`).
- Optional `--with-glaze-output` dual mode on `set-meta`/`push` for scripting.
- `list --offset` for paging beyond `--limit`.

### Code review instructions
- Start at `cmd/serve-artifacts/cmds/artifact.go` (`NewArtifactCobraCommand`, then each `NewArtifact*Command` + its Run method); `apiclient.go` for transport/error handling.
- Validate: `go build ./...`, then run a server (`serve --dir <dir> --no-thumbnails --port N`) and exercise `SERVE_ARTIFACTS_API=http://localhost:N serve-artifacts artifact list|get|source|set-meta|push`.

### Technical details
- `list` → `GET /api/artifacts?q=&type=&tag=&limit=`; `get` → `GET /api/artifact/{name}`; `source` → `GET /api/source/{name}`; `set-meta` → `PATCH|PUT /api/manifest/{name}`; `push` → `POST /api/artifacts`.
- Non-2xx → `fmt.Errorf("%s: %s", resp.Status, serverErrorMessage(body))`.

## Related

- `design/01-artifact-management-api-and-glazed-cli-analysis-design-and-implementation-guide.md` — the design this implements (route table updated post-implementation for the wildcard-last constraint).
