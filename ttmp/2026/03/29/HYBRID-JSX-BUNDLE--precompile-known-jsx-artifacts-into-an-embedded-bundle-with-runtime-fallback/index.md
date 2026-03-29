---
Title: Precompile Known JSX Artifacts Into An Embedded Bundle With Runtime Fallback
Ticket: HYBRID-JSX-BUNDLE
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
Summary: Ticket for embedding a precompiled JavaScript bundle for build-known JSX artifacts while preserving runtime fallback for new or changed files.
LastUpdated: 2026-03-29T10:27:05.243071388-04:00
WhatFor: Plan and implement a hybrid JSX serving path that embeds precompiled JS for build-known artifacts while preserving runtime JSX fallback for dynamically added files.
WhenToUse: When changing the build pipeline, JSX serving behavior, or docs for the hybrid precompiled-plus-runtime artifact workflow.
---

# Precompile Known JSX Artifacts Into An Embedded Bundle With Runtime Fallback

## Overview

This ticket tracks the first-pass hybrid JSX strategy for `serve-artifacts`. The goal is to make binaries faster and less dependent on browser-side Babel for artifacts already known at build time, without giving up the current "drop a new `.jsx` file into the directory and it still works" workflow.

The design guide explains the architecture and tradeoffs:
- [01-hybrid-jsx-precompilation-design-guide.md](./design-doc/01-hybrid-jsx-precompilation-design-guide.md)

The implementation guide is written for an intern who needs the mechanics:
- [01-hybrid-jsx-precompilation-implementation-guide-for-interns.md](./playbook/01-hybrid-jsx-precompilation-implementation-guide-for-interns.md)

The running implementation diary lives here:
- [01-diary.md](./reference/01-diary.md)

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

Design, implementation guide, task breakdown, and diary are being established first. Code work follows after the contract is written down.

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
