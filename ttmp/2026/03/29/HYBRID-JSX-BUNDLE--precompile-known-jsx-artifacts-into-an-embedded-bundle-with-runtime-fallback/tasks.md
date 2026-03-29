# Tasks

## TODO

- [x] Write the hybrid JSX design doc, intern implementation guide, and initial diary context for the ticket
- [ ] Add a generator that precompiles build-known JSX artifacts into an embedded bundle with source hashes
- [ ] Load the embedded bundle in the server and prefer precompiled scripts for unchanged known artifacts
- [ ] Keep the existing `/jsx/{name}` runtime Babel path as the fallback for changed or newly added JSX artifacts
- [ ] Update the JSX host template and server routes to switch cleanly between precompiled module mode and Babel mode
- [ ] Add tests that cover bundle generation or lookup and runtime fallback behavior
- [ ] Update operator docs and artifact authoring docs for the hybrid workflow
- [ ] Validate the feature end to end, update the diary and changelog, and commit each completed step intentionally
