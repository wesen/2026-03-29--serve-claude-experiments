---
Title: Diary
Ticket: SERVE-20260714-DEPLOY
Status: active
Topics:
    - deployment
    - kubernetes
    - gitops
    - backup
    - artifacts
    - web-server
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - abs:///home/manuel/code/wesen/2026-03-27--hetzner-k3s/gitops/kustomize/artifacts/deployment.yaml
    - abs:///home/manuel/code/wesen/2026-03-27--hetzner-k3s/gitops/kustomize/artifacts/backup-cronjob.yaml
ExternalSources:
    - https://github.com/wesen/2026-03-27--hetzner-k3s
Summary: "Implementation diary for deploying serve-artifacts as a stateful, backed-up app on the k3s cluster: the intern design guide, the GitOps manifest change (two PVCs, Recreate, Chrome memory/shm, Vault write-token, off-node backup CronJob) on a branch of the hetzner-k3s repo, and the operator scripts (Vault bootstrap, PVC seed, restore). Records what was validated locally vs what requires live cluster access."
WhatFor: "Understand how the k3s deployment of serve-artifacts was designed and built, and what remains to run against the live cluster."
WhenToUse: "Read before changing the serve-artifacts Deployment, PVCs, seeding, or backups, or before running the rollout."
---

# Diary

## Goal

Deploy serve-artifacts to the Hetzner k3s + ArgoCD cluster as a stateful, backed-up service: persistent PVCs for the corpus and the SQLite user data, a one-time seed, the write API's bearer token injected from Vault, and daily off-node backups to object storage. Produce an intern-grade design guide, implement the manifests and scripts, and keep this diary.

## Step 1: Design guide, ticket, reMarkable

Created the ticket and wrote a deep intern guide covering the whole system — the app's two datasets (corpus vs userdata.db), the existing image→GHCR→GitOps-PR→ArgoCD pipeline, the cluster conventions, and the stateless→stateful change with seeding and backups. The guide is the reference the rest of the work implements. Uploaded it to reMarkable.

### Prompt Context

**User prompt (verbatim):** "alright, create a ticket to deploy this new version of serve-artifacts and seed it, and make sure the PVC is persistent and backed up. Create a detailed analysis / design / implementation guide that is for a new intern ... Store in the ticket and the nupload to remarkable. then work on it, commit at appropriate intervals, keeping a detailed diary"

**Assistant interpretation:** Create a deploy ticket + thorough intern design guide (→ reMarkable), then implement the deployment (stateful PVCs, seeding, backups), committing in slices with a diary.

**Inferred user intent:** A production deployment of the new serve-artifacts with durable, recoverable data, fully documented for onboarding.

### What I did
- `docmgr` ticket SERVE-20260714-DEPLOY; added vocab (deployment/kubernetes/gitops/backup).
- Wrote `design/01-deploying-serve-artifacts-to-k3s-...md` (foundational-first, mermaid diagrams, full manifests, runbook, failure modes, file refs into both repos).
- Uploaded to reMarkable at `/ai/2026/07/14/SERVE-20260714-DEPLOY`.

### Why
- The deployment turns on one distinction (corpus vs user state) and one cluster fact (local-path is node-local, so "backed up" means off-node). The guide leads with those so the manifests make sense.

### What worked
- Recon of the GitOps repo showed the delivery pipeline already exists and `gitops/kustomize/artifacts/` is deployed — so the work is a manifest change, not a from-scratch onboarding.

### What I learned
- The gallery's richness comes from the **corpus files** (`meta.json` + `*.manifest.json` + artifacts), not from `userdata.db` (48 KB, nearly empty). Seeding priority is the corpus.
- `conversation.json` (~126 MB) is never read at runtime → a serving corpus is ~70 MB, not 196 MB.

### Code review instructions
- Read the design doc top-to-bottom; it is the spec for Steps 2–3.

### Technical details
- Corpus counts: 2,896 conversations, 509 renderable artifacts + 509 manifests, ~70 MB slimmed.

## Step 2: GitOps manifests — stateless → stateful (hetzner-k3s branch)

Converted `gitops/kustomize/artifacts/` from a stateless Deployment into a stateful, backed-up app on a feature branch of the GitOps repo. Two local-path PVCs, `Recreate` strategy, a memory bump + `/dev/shm` so headless Chrome stops OOMing, the full Vault chain injecting the write token, and a daily backup CronJob to object storage. Validated the whole overlay with `kubectl kustomize`.

### Prompt Context

**User prompt (verbatim):** "... make sure the PVC is persistent and backed up ... then work on it, commit at appropriate intervals"

**Assistant interpretation:** Implement the durable, recoverable deployment manifests.

**Commit (code):** hetzner-k3s `39e5978` on branch `feat/serve-artifacts-stateful-backup` — "feat(artifacts): make serve-artifacts stateful with PVCs, write-token, and backups"

### What I did
- New files: `pvc-corpus.yaml`, `pvc-data.yaml`, `serviceaccount.yaml`, `vault-connection.yaml`, `vault-auth.yaml`, `runtime-vault-static-secret.yaml`, `backup-storage-vault-static-secret.yaml`, `backup-cronjob.yaml`.
- Edited `deployment.yaml` (serviceAccount, `strategy: Recreate`, `SERVE_ARTIFACTS_WRITE_TOKEN` env from Secret, corpus/data/dshm volumes, memory→1Gi), `kustomization.yaml` (`namespace: artifacts` + ordered resources), and `gitops/applications/artifacts.yaml` (labels `has-persistent-storage`/`has-database` → true, `database-type: sqlite`).
- `kubectl kustomize gitops/kustomize/artifacts` → 12 resources, EXIT 0, namespace applied to all 11 namespaced resources.

### Why
- The current Deployment had three concrete gaps: no PVC (data resets), a 256Mi limit under an image that runs Chrome (OOM), and no write token (open writes behind a public ingress). Each addition targets one gap.

### What worked
- The repo's existing backup convention (redis/postgres `backup-cronjob.yaml` + `backup-storage` VaultStaticSecret to object storage) dropped in almost verbatim — only the payload logic (sqlite `.backup` + corpus tar) is app-specific.

### What was tricky to build
- **RWO + a backup pod.** A `ReadWriteOnce` volume can't be mounted by two pods on two nodes. The reason this works anyway: `local-path` PVs carry nodeAffinity to the node they were provisioned on, so the CronJob pod is scheduled onto the app's node, where a second *read-only* mount of an RWO volume is allowed (RWO is per-node). Documented this in the guide because it is the non-obvious load-bearing fact.
- **Consistent SQLite in seed and backup.** A raw copy of a live DB can miss WAL rows; both the backup CronJob and the seed/restore scripts use `sqlite3 ".backup"`.
- **Chrome memory.** Kept the requests low (256Mi) but raised the limit to 1Gi; added a `medium: Memory` `/dev/shm` emptyDir. Left a documented escape hatch (`--no-thumbnails`).

### What warrants a second pair of eyes
- The backup CronJob's read-only-mount + node co-location assumption (single-writer, local-path). If the cluster ever becomes multi-node *and* the PV moves, revisit.
- The Vault role/policy names (`serve-artifacts`) — must match what the bootstrap script creates and what a `serve-artifacts` Vault policy grants.

### What should be done in the future
- Bucket lifecycle rule (or in-job prune) for backup retention — currently unbounded, matching the house pattern.

### Code review instructions
- Start at `gitops/kustomize/artifacts/deployment.yaml` and `backup-cronjob.yaml`; validate with `kubectl kustomize gitops/kustomize/artifacts`.

### Technical details
- Sync waves: SA/Vault `-2`, VaultStaticSecrets `-1`, PVCs `0`, Deployment `1`, Ingress/CronJob `2`, Namespace `-1`.

## Step 3: Operator scripts (bootstrap / seed / restore)

Wrote the three runbook scripts the deployment needs but that live outside the manifests: seeding Vault, seeding the PVCs once, and restoring from a backup. They encode the sharp edges (scale-to-0 for RWO, tar-stream not per-file cp, sqlite `.backup`) so the operator doesn't have to remember them.

### Prompt Context

**User prompt (verbatim):** "... seed it ... then work on it, commit at appropriate intervals, keeping a detailed diary"

**Assistant interpretation:** Provide the executable seeding/restore procedures.

**Commit (code):** serve-artifacts docs commit (this ticket).

### What I did
- `scripts/00-bootstrap-vault.sh` — write-token (generate if absent), `serve-artifacts-prefix` on the shared object-storage secret, and the kubernetes-auth role.
- `scripts/01-seed-pvcs.sh` — scale app to 0, maintenance pod mounting both PVCs, tar-stream the slimmed corpus into `/artifacts`, `sqlite3 .backup` + `kubectl cp` the DB into `/data`, tear down, scale to 1.
- `scripts/02-restore.sh` — pull the latest (or named) archive from object storage and unpack it into the PVCs via a maintenance pod.
- `bash -n` clean on all three; `chmod +x`.

### Why
- Seeding and restore are imperative, one-off, and cluster-side; scripting them makes them repeatable and captures the RWO/consistency constraints.

### What didn't work / not run
- **Not executed against the cluster.** Bootstrap, seed, and the guarded rollout need live Vault + the Tailscale kubeconfig + object-storage creds, and they are outward-facing/hard-to-reverse. They are ready to run per the runbook (design Part VIII); I stopped at "validated and committed" rather than applying to production without explicit go-ahead.

### What warrants a second pair of eyes
- `01-seed-pvcs.sh` scales the live Deployment to 0 — confirm that's acceptable downtime for the seed window.

### Code review instructions
- Read the three scripts; dry-run intent is documented inline. Validate against the runbook in the design doc Part VIII.

## Step 4: Migrate CI to the GitHub-App-via-Vault GitOps-PR mechanism

The user pointed out the gitops push-permission mechanism was updated. Checked `~/code/wesen/go-go-golems/publish-vault` (workflow + `docs/github-app-gitops-pr-automation-guide.md`): the long-lived `GITOPS_PR_TOKEN` PAT is gone. Migrated serve-artifacts' `publish-image.yaml` from the old inline-build + vendored `open_gitops_pr.py` + PAT to *calling the shared reusable workflow* with `gitops_pr_token_source: github_app`, which mints a short-lived GitHub App installation token via Vault OIDC at run time.

### Prompt Context

**User prompt (verbatim):** "I think we updated the way to get gitops push permission, look in the more recent ~/code/wesen/go-go-golems/publish-vault to see how it is done."

**Assistant interpretation:** Adopt the current GitHub-App-via-Vault mechanism for serve-artifacts' GitOps PRs.

**Inferred user intent:** Don't rely on the deprecated PAT; use the standardized token flow.

**Commit (code):** serve-artifacts docs/CI commit (this ticket).

### What I did
- Rewrote `.github/workflows/publish-image.yaml` to `uses: go-go-golems/infra-tooling/.github/workflows/publish-ghcr-image.yml@main` with `secrets: inherit`, `id-token: write`, `gitops_pr_token_source: github_app`, `vault_role: serve-artifacts-gitops-pr`, `gitops_app_secret_path: kv/data/ci/github/serve-artifacts/gitops-pr-app`, `gitops_app_owner: wesen`, `gitops_app_repositories: 2026-03-27--hetzner-k3s`.
- Removed the now-superseded vendored `scripts/open_gitops_pr.py` (its logic lives in the infra-tooling `open-gitops-pr` action).
- Updated the design guide Part II to describe the OIDC→Vault→GitHub-App-token flow and the one-time provisioning.
- Validated the workflow YAML; confirmed `deploy/gitops-targets.json` matches the reusable workflow's expected schema (name/gitops_repo/gitops_branch/manifest_path/container_name).

### Why
- A per-run, auto-expiring, repo-scoped GitHub App token removes the PAT-expiry failure mode and keeps no long-lived cross-repo credential in the repo.

### What I learned
- The friendly app slug used for Vault role/KV paths is not the repo name (publish-vault uses `retro-obsidian-publish`). For serve-artifacts I chose `serve-artifacts`; the Vault role `serve-artifacts-gitops-pr` and KV path `kv/ci/github/serve-artifacts/gitops-pr-app` must be provisioned to match.

### What didn't work / not run
- The provisioning (GitHub App install + Vault role + KV secret) is out-of-band and needs the operator; until it exists, image build/push works but the GitOps-PR step fails at Vault login. Documented in the guide.

### What warrants a second pair of eyes
- The chosen Vault role/path slug (`serve-artifacts`) — confirm it matches whatever gets provisioned in Terraform (`terraform/vault/github-actions/envs/k3s`).

### Code review instructions
- Read `.github/workflows/publish-image.yaml`; compare against `publish-vault/.github/workflows/publish-image.yaml`. The provisioning checklist is in publish-vault's `docs/github-app-gitops-pr-automation-guide.md`.

## Related

- `design/01-deploying-serve-artifacts-to-k3s-...md` — the spec these steps implement (Part II updated for the GitHub-App token flow).
- `~/code/wesen/go-go-golems/publish-vault/docs/github-app-gitops-pr-automation-guide.md` — the canonical provisioning guide for the token mechanism.
- hetzner-k3s branch `feat/serve-artifacts-stateful-backup` (commit `39e5978`) — the manifests (not pushed; ready to PR).
- `SERVE-20260714-ARTIFACTAPI` — the write API whose token this deployment now enforces.
