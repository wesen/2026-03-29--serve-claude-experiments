# Tasks

## TODO

- [x] Extract writeArtifactView from handleArtifactJSON; confirm index.rebuild() is handler-safe (rebuild-on-write plumbing) <!-- t:gheu -->
- [x] Read API: GET /api/artifacts (delegate to handleSearch) + GET /api/artifact/{name...}/source <!-- t:96zj -->
- [x] Modify: export ValidateManifest; add ManifestPathFor + WriteManifest (atomic); PUT/PATCH .../manifest behind requireWrite <!-- t:mfbs -->
- [x] Push: safeArtifactPath + POST /api/artifacts + sentinels (ErrArtifactExists/ErrBadArtifactName/ErrUnsupportedType) with status mapping <!-- t:vs7g -->
- [x] Auth seam: authorize(r, action) + requireWrite middleware (allow-all today); wire every mutating route through it <!-- t:a230 -->
- [x] CLI: shared apiClient + artifact list/get (Glazed) + set-meta/push (dual-mode) verbs; root wiring via cli.BuildCobraCommand <!-- t:6ojp -->
- [ ] Docs: Glazed help topic for the artifact group; update ticket diary <!-- t:04q5 -->
