---
Title: Add Per-App Manifest JSON Metadata Support
Ticket: APP-MANIFESTS
Status: active
Topics:
    - artifacts
    - golang
    - web-server
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: Ticket for adding companion manifest JSON files that provide richer metadata for each artifact.
LastUpdated: 2026-03-29T09:55:36.931497119-04:00
WhatFor: Planning support for per-app manifest metadata including tags, descriptions, dates, and links.
WhenToUse: When implementing or reviewing manifest support for artifact discovery and presentation.
---

# Add Per-App Manifest JSON Metadata Support

## Overview

This ticket tracks support for companion manifest JSON files that sit next to each artifact and provide richer metadata than can be extracted from HTML titles or JSX exports alone.

The primary design document is:
- [01-per-app-manifest-json-design-and-implementation-guide.md](./design-doc/01-per-app-manifest-json-design-and-implementation-guide.md)

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

The implementation guide is drafted. Tasks remain open.

## Topics

- artifacts
- golang
- web-server

## Tasks

See [tasks.md](./tasks.md) for the current task list.

## Changelog

See [changelog.md](./changelog.md) for recent changes and decisions.

## Structure

- design/ - Architecture and design documents
- reference/ - Prompt packs, API contracts, context summaries
- playbooks/ - Command sequences and test procedures
- scripts/ - Temporary code and tooling
- various/ - Working notes and research
- archive/ - Deprecated or reference-only artifacts
