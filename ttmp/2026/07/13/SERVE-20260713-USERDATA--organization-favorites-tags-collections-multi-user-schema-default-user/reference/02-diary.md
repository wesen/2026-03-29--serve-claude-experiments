# Diary

## Goal

Capture the implementation of ticket SERVE-20260713-USERDATA: per-user
organization for serve-artifacts — favorites, user tags, and collections — on a
SQLite store whose schema is multi-user from the start while the acting user is
hardcoded to a single `default` account behind a `currentUser()` seam. Records
what changed, why, what worked, what broke, and how to review each step.

## Step 1: Ticket, intern design guide, and reMarkable upload

Created the ticket and wrote the intern design guide before any code, so the
multi-user-schema/hardcoded-user decision and the file-derived-vs-user-state
split were settled in writing first. Inspected the codebase (scanner, search
index, server, go.mod) and confirmed `mattn/go-sqlite3` is already available and
cgo builds work here.

### Prompt Context

**User prompt (verbatim):** "do a new ticket for 3. where we are planning for multi users in the schema and all that, but hardcode the user to be default until we can code proper idp integration later on.

Create  a detailed analysis / design / implementation guide that is for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file references. It should be very clear and technical. Store in the ticket and the nupload to remarkable.


And then work on the ticket task by task, commit at appropriate intervals, keep a detailed diary as you work."

**Assistant interpretation:** Create a ticket for improvements-doc feature 3 (organization: favorites/tags/collections), design the schema for multiple users but hardcode the current user to `default` until real IdP integration; write a thorough intern design guide, store it in the ticket and upload to reMarkable; then implement task by task with commits and a diary.

**Inferred user intent:** Ship the organization layer now, on a foundation that becomes multi-user later without a rewrite.

**Commit (code):** (guide + diary land with Task 1's commit)

### What I did
- Created ticket `SERVE-20260713-USERDATA`; wrote `design/01-favorites-tags-and-collections-analysis-design-and-implementation-guide.md`; uploaded the bundle to reMarkable.
- Verified `mattn/go-sqlite3` is in the module graph and a cgo build works (`CGO_ENABLED=1`, gcc present, sqlite 3.50.4).

### Why
- Settling the `currentUser()` seam and the "user data in SQLite keyed by artifact Name, artifacts stay file-derived" split up front avoids re-architecting search.

### What worked
- Design maps cleanly onto four vertical-slice tasks (store, favorites, tags, collections).

### What didn't work
- N/A (design step).

### What I learned
- `mattn/go-sqlite3` is already a transitive dep, so no new module is needed; cgo is available.

### What was tricky to build
- Choosing to keep user data OUT of the shared in-memory index and load it per request instead, so the cached index stays user-agnostic and multi-user stays correct later.

### What warrants a second pair of eyes
- Whether cgo (`mattn`) is acceptable for the shipped binary vs. a pure-Go `modernc.org/sqlite`.

### What should be done in the future
- Real IdP integration replaces `currentUser()`.

### Code review instructions
- Read the design guide; it is the spec for Tasks 1–4.

### Technical details
- Artifact identity/key is the scanner's `Name` (slash path relative to serve root, no extension), the same key `/view/{name...}` uses.

## Step 2: SQLite user-data store + schema (task 1)

Built the `pkg/userdata` store — the persistent foundation for the whole feature.
The schema carries a `user_id` on every user-owned table; the server opens the
store at startup, seeds the `default` user, and exposes a `--db` flag. This is the
multi-user-ready base that favorites/tags/collections build on.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Implement the store and schema (task 1): tables for users/favorites/artifact_tags/collections/collection_items, a store API, wiring into the server with a configurable DB path, and tests.

**Inferred user intent:** A durable, per-user, multi-user-ready data layer.

**Commit (code):** a5c6063 — "feat: SQLite user-data store + multi-user schema (SERVE-20260713-USERDATA task 1)"

### What I did
- New `pkg/userdata/store.go`: schema (`CREATE TABLE IF NOT EXISTS`), `Open` (DSN `_foreign_keys=on&_busy_timeout=5000`), `EnsureUser`, and favorites/tags/collections methods (set/list, add/remove/list, create/list/delete/add/remove/reorder/items) with per-user ownership checks.
- Tests `pkg/userdata/store_test.go`: favorites toggle+idempotent, tags add/remove/list, collection order+reorder+cascade-delete, and cross-user ownership isolation.
- Added `Config.DBPath` + `--db` flag; `server.New` opens the store, `EnsureUser("default")`, defaults the path under `os.UserConfigDir()/serve-artifacts/userdata.db`.
- Added the `currentUser(r) == DefaultUserID` seam in `pkg/server/server.go`.
- `go mod tidy` promoted `mattn/go-sqlite3` to a direct dependency.

### Why
- User edits must survive restarts and not be served as files, so they go to SQLite keyed by the artifact `Name`.

### What worked
- `go test ./pkg/userdata/` passes (incl. cascade + ownership isolation).
- Live: `serve --db <path>` logs the DB path and creates the file with all five tables; default user seeded.

### What didn't work
- N/A on the first build; editor gopls diagnostics (`imported and not used`, `undefined: searchIndex`) were stale (module outside the workspace) — `go build`/`go test` were clean.

### What was tricky to build
- Cascade delete. Symptom: deleting a collection could leave orphan `collection_items`. Cause: SQLite disables foreign keys per connection by default. Solution: open with DSN `_foreign_keys=on`; a test asserts zero orphan items after `DeleteCollection`.
- Ownership isolation. To make multi-user correct before auth exists, every collection mutation/read verifies `WHERE user_id = ?` (helper `owns`); a test confirms a second user cannot add to or read another's collection.

### What warrants a second pair of eyes
- The `owns()` gate on every collection method (correctness of the multi-user isolation guarantee).
- Default DB path choice (`os.UserConfigDir()`), so a read-only artifact dir is never written to.

### What should be done in the future
- A GC to prune user data whose `artifact_key` is no longer present in the index.
- Normalized tags table if global tag rename is ever needed.

### Code review instructions
- Start at `pkg/userdata/store.go` (schema, `owns`, `AddToCollection`, `ReorderCollection`) and `store_test.go`.
- Validate: `go test ./pkg/userdata/`; then `serve --db /tmp/u.db` and `sqlite3 /tmp/u.db .tables`.

### Technical details
- Schema: `users`, `favorites(user_id,artifact_key)`, `artifact_tags(user_id,artifact_key,tag)`, `collections(id,user_id,name UNIQUE(user_id,name))`, `collection_items(collection_id,artifact_key,position, FK ON DELETE CASCADE)`.
- New collection item position = `MAX(position)+1`; reorder rewrites positions in a transaction.

## Step 3: Favorites (task 2)

Added per-user favorites end to end: a per-request `userView` threaded into the
search index, a `favorite` flag/filter/facet, a toggle endpoint, and a star on
each card. The key design move is that user data stays out of the shared cached
index; `handleSearch` loads the acting user's small state per request and passes
it in, which is what keeps multi-user correct later.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Implement favorites (task 2): toggle API, enrich/filter/facet in /search, and a star UI.

**Inferred user intent:** Mark and quickly find favored artifacts.

**Commit (code):** 2e0f464 — "feat: favorites (SERVE-20260713-USERDATA task 2)"

### What I did
- `pkg/server/index.go`: `search(q, userView)`; `matches` gained skippable `favorite`/`collection` dimensions; results enriched with `favorite` + merged (manifest ∪ user) tags; `favorite` facet count added.
- `pkg/server/search.go`: `SearchDocument.Favorite`; extracted `buildSearchDocument`.
- `pkg/server/server.go`: `userView(user, collection)` loads favorites/tags (+collection items); `handleSearch` parses `favorite`/`collection`; `POST /api/favorite` toggles/sets.
- `templates/index.html`: ☆/★ star per card (persists via the API), "★ favorites" toggle in the Flags group.
- Tests: favorite filter/facet/enrichment; user-tag merge.

### Why
- Loading per-user state per request (cheap) keeps the shared index user-agnostic and correct for future multi-user.

### What worked
- API: toggle on → `/search?favorite=true` returns 1 with facet `{true:1}`; toggle off → 0.
- UI: star ☆→★ persists; the favorites toggle filters to the starred card.
- `go test ./...` green.

### What didn't work
- Changing `search`'s signature broke the existing `index_test.go` calls (missing `userView{}` arg); patched all six call sites.

### What was tricky to build
- Faceting the favorite dimension correctly: it must be skippable like the others so its own count reflects the result set filtered by *other* dimensions. Implemented as `matches(q, uv, "favorite")` and counting `uv.favorites[key]`.

### What warrants a second pair of eyes
- The per-request cost of `Favorites`/`TagsByArtifact` on large accounts (currently full-table reads per user). Fine at expected sizes; revisit if a user amasses very many.

### What should be done in the future
- Batch/caching of the user view if profiling shows the per-request store reads matter.

### Code review instructions
- Start at `index.go` (`search`, `matches`, `mergedTags`) and `server.go` (`userView`, `handleFavorite`).
- Validate: `go test ./pkg/server/`; `curl -X POST /api/favorite -d key=...`; `curl '/search?favorite=true'`.

### Technical details
- `POST /api/favorite?key=&on=true|false` (omit `on` to toggle) → `{key, favorite}`.
- `/search` gains `favorite=true` and `collection=<id>`; response `facets.favorite.true` is the favorites count.

## Step 4: User tags (task 3)

Added per-user tags on top of the tag-merging already wired for search in task 2.
The new surface is the add/remove API and a card tag editor. User tags are
returned separately (`user_tags`) from the merged `tags` (manifest ∪ user) so the
UI can offer removable chips for the user's own tags while the merged set still
drives the tag facet and filter.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Implement user tags (task 3): add/remove endpoints and a per-card tag editor; ensure user tags are searchable/facetable (already merged in task 2).

**Inferred user intent:** Let the user annotate artifacts with their own tags and filter by them.

**Commit (code):** 89e9620 — "feat: user tags (SERVE-20260713-USERDATA task 3)"

### What I did
- `pkg/server/search.go`: `SearchDocument.UserTags`.
- `pkg/server/index.go`: `search` sets `d.UserTags` from the user view (merged `Tags` already set in task 2).
- `pkg/server/server.go`: `POST /api/tags/add` and `/api/tags/remove` (`tagOp`) returning the artifact's user tags.
- `templates/index.html`: card tag editor — user tags as removable `× chip`s, a `+tag` input (Enter to add), `tagOp()` helper, CSS.

### Why
- Manifest tags are read-only (from files); users need their own mutable tags, and those should participate in the same search/facets.

### What worked
- API: add `starred`,`demo` → `/search?tag=starred` returns 1 with facet count and `user_tags`; remove `demo` leaves `starred`.
- UI: `+tag` input adds a chip; `×` removes it (verified in-browser).
- `go test ./...` green.

### What didn't work
- N/A.

### What was tricky to build
- Distinguishing user tags from manifest tags in the UI. The merged `tags` list can't tell them apart, so removal would wrongly offer to delete manifest tags. Solution: return `user_tags` separately and render only those as removable, while `tags` (merged) remains the filter/facet surface.

### What warrants a second pair of eyes
- Whether add/remove should update the card in place rather than `reload()` (current choice reloads to keep tag-facet counts correct).

### What should be done in the future
- Tag autocomplete from the user's existing tags (`AllTags`).

### Code review instructions
- `server.go` (`tagOp`), `index.go` (`UserTags` set), template card tag editor.
- Validate: `curl -X POST /api/tags/add -d key=... -d tag=x`; `curl '/search?tag=x'`.

### Technical details
- `POST /api/tags/add|remove?key=&tag=` → `{key, tags:[user tags]}`.
- Results: `user_tags` (the user's) and `tags` (manifest ∪ user, deduped).
