# Tasks

## TODO

- [x] Write the hybrid JSX design doc, intern implementation guide, and initial diary context for the ticket
- [x] Add a generator that precompiles build-known JSX artifacts into an embedded bundle with source hashes
- [x] Load the embedded bundle in the server and prefer precompiled scripts for unchanged known artifacts
- [x] Keep the existing `/jsx/{name}` runtime Babel path as the fallback for changed or newly added JSX artifacts
- [x] Update the JSX host template and server routes to switch cleanly between precompiled module mode and Babel mode
- [x] Add tests that cover bundle generation or lookup and runtime fallback behavior
- [x] Update operator docs and artifact authoring docs for the hybrid workflow
- [x] Validate the feature end to end, update the diary and changelog, and commit each completed step intentionally
