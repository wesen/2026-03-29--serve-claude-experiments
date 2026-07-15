# Deploy serve-artifacts to k3s: stateful PVCs, seeding, write-token secret, and off-node backups

This is the document workspace for ticket SERVE-20260714-DEPLOY.

## Structure

- **design/**: Design documents and architecture notes
- **reference/**: Reference documentation and API contracts
- **playbooks/**: Operational playbooks and procedures
- **scripts/**: Utility scripts and automation
- **sources/**: External sources and imported documents
- **various/**: Scratch or meeting notes, working notes
- **archive/**: Optional space for deprecated or reference-only artifacts

## Getting Started

Use docmgr commands to manage this workspace:

- Add documents: `docmgr doc add --ticket SERVE-20260714-DEPLOY --doc-type design-doc --title "My Design"`
- Import sources: `docmgr import file --ticket SERVE-20260714-DEPLOY --file /path/to/doc.md`
- Update metadata: `docmgr meta update --ticket SERVE-20260714-DEPLOY --field Status --value review`
