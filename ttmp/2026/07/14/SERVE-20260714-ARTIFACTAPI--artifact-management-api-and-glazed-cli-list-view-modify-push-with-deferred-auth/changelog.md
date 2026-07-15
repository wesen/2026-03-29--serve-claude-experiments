# Changelog

## 2026-07-14

- Initial workspace created


## 2026-07-14

Server API implemented + tested (commit 438f311): writer.go (path-safety/atomic/manifest), artifactapi.go (handlers+authorize seam), registerRoutes; writer+httptest tests green.

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/artifacts/writer.go — corpus write primitives + SafeArtifactPath
- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/pkg/server/artifactapi.go — API handlers + requireWrite/authorize seam


## 2026-07-14

Glazed CLI verbs implemented + verified live (commit 0f11ba2): artifact list/get/source/set-meta/push over the API; shared apiClient.

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/cmd/serve-artifacts/cmds/artifact.go — the five artifact verbs


## 2026-07-14

Glazed help topic for the artifact group + frontmatter fix for improvements-for-scale.md (removes startup warning); all verbs listed under 'artifact --help'.

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/cmd/serve-artifacts/doc/artifact-api-cli.md — artifact API+CLI help page

