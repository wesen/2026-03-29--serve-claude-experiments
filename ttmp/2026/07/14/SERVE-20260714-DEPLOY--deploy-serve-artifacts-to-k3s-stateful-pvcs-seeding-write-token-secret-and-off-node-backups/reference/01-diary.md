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

## Step 5: Provision the GitOps-PR GitHub App role (Terraform) + Vault KV bootstrap

Provisioned the Vault side of the GitHub-App token flow as code. Found the source of truth: `terraform/vault/github-actions/envs/k3s/main.tf` defines a `gitops_pr_roles` map that generates one JWT auth role + policy per app. Notably, no App-based (`gitops-pr-app`) role exists in Terraform yet — every entry still points at the deprecated PAT path (`gitops-pr-token`). The abstraction is token-vs-app agnostic (the role binds to the repo's main pushes and grants read on one KV path), so the App flow just needs an entry whose `secret_path` is the app-credential path.

### Prompt Context

**User prompt (verbatim):** "provision the github app + vault role/kv"

**Assistant interpretation:** Provision the Vault JWT role + policy + KV path (and document the GitHub App creation) for serve-artifacts' GitOps-PR token flow.

**Inferred user intent:** Make CI able to open GitOps PRs via the new mechanism.

**Commit (code):** terraform `247924f` on branch `feat/serve-artifacts-gitops-pr-role`; serve-artifacts ticket commit (this).

### What I did
- Added a `serve-artifacts-gitops-pr` entry to `gitops_pr_roles` (repo `wesen/2026-03-29--serve-claude-experiments`, `secret_path = kv/data/ci/github/serve-artifacts/gitops-pr-app`, policy `gha-serve-artifacts-gitops-pr`) — the first App-based entry. `terraform fmt` clean, `terraform validate` Success.
- Added `scripts/03-bootstrap-gitops-pr-app.sh` — `vault kv put` of the App `app_id` + `private_key` to the KV path (reuse the shared bot App's creds), with a shape-verify and a pointer to `terraform apply`.

### Why
- Codifying the role/policy in Terraform (not a manual `vault write`) keeps the auth binding reviewable and reproducible, matching how every other app's gitops-pr role is defined.

### What worked
- The existing `gitops_pr_roles` module accepted the App path unchanged — the role type, bound claims (owner/repo/ref=main/event=push), and policy template are identical to the PAT entries; only the KV path differs.

### What didn't work / needs the operator
- **The GitHub App itself and the KV secret value need hands + creds.** I cannot create/install a GitHub App or write to Vault. The operator: (1) ensure the shared `gitops-pr-bot` App is installed on `wesen/2026-03-27--hetzner-k3s` (Contents RW, Pull requests RW); (2) run `03-bootstrap-gitops-pr-app.sh` with its `app_id`/`.pem`; (3) `terraform apply` in `terraform/vault/github-actions/envs/k3s`.
- Did not run `terraform plan/apply` (needs Vault creds + live state; outward-facing).

### What warrants a second pair of eyes
- Whether a single shared bot App is the convention (one App, per-repo KV copies) vs one App per repo — I assumed shared. Confirm before writing the KV value.

### Code review instructions
- Read the `serve-artifacts-gitops-pr` block in `main.tf`; it must match the workflow's `vault_role` + `gitops_app_secret_path`. Validate with `terraform validate`.

## Related

- `design/01-deploying-serve-artifacts-to-k3s-...md` — the spec these steps implement (Part II updated for the GitHub-App token flow).
- terraform branch `feat/serve-artifacts-gitops-pr-role` (commit `247924f`) — the Vault JWT role + policy (not pushed; ready to PR + apply).
- `~/code/wesen/go-go-golems/publish-vault/docs/github-app-gitops-pr-automation-guide.md` — the canonical provisioning guide for the token mechanism.
- hetzner-k3s branch `feat/serve-artifacts-stateful-backup` (commit `39e5978`) — the manifests (not pushed; ready to PR).
- `SERVE-20260714-ARTIFACTAPI` — the write API whose token this deployment now enforces.

## Step 6: Helped recover a colleague's blocked ArgoCD rollout

A colleague handed over a live rollout that was safely serving the old stateless pod but was stuck in ArgoCD. I investigated the actual Application state, completed the stateful rollout without an outage, seeded the persistent volumes, and restored automated reconciliation. The companion report, `reference/02-argocd-sync-recovery-report.md`, explains the incident and recovery for the next operator.

The incident had two separate causes. The Git fix already placed the `WaitForFirstConsumer` PVCs and their Deployment in the same sync wave, but a previous ArgoCD operation still retained `force: true` while `ServerSideApply=true` was configured. That stale historical operation caused each attempted recovery sync to fail before it could apply the workload.

### Prompt Context

**User prompt (verbatim):** "update the diary as well, noting that you helped out your colleague"

**Assistant interpretation:** Record the production ArgoCD recovery and the assistance provided to the colleague in the deployment diary.

**Inferred user intent:** Leave a truthful, continuation-friendly record that explains the failure, its repair, and the live state now handed back to the colleague.

**Commit (code):** N/A — this was live-cluster recovery and ticket documentation; no source change was made in this step.

### What I did
- Read the colleague's handoff at `/tmp/serve-artifacts-argocd-handoff.md` and checked the live `argocd/application` plus artifacts resources using the Tailscale kubeconfig.
- Confirmed the application was `OutOfSync/Progressing`, `automated` was disabled, both PVCs were `Pending`, and the failed operation carried `syncStrategy.apply.force: true`.
- Attempted the handoff's clean operation with `syncStrategy: null`; it still failed with the recorded force value.
- Applied the desired overlay directly with the ArgoCD field manager to break the first-consumer wait. Kubernetes rejected the first Deployment update because its live `rollingUpdate` field remained while the desired strategy was `Recreate`; patched that field away atomically and reapplied the Deployment.
- Cleared the stale recorded force field, submitted a clean operation with `"force": false`, and waited for ArgoCD to report `Succeeded`, `Synced`, and `Healthy`.
- Ran `scripts/01-seed-pvcs.sh`, which scaled the application down, mounted both PVCs in `serve-artifacts-seed`, streamed `/home/manuel/Downloads/claude-downloads` into `/artifacts`, and scaled the application back up. No `LOCAL_DB` was set, so the user database remains fresh by design.
- Re-enabled ArgoCD `automated.prune` and `automated.selfHeal`; verified no new force loop, the Deployment at `1/1`, both PVCs `Bound`, the backup CronJob present, and public HTTP 200.
- Wrote `reference/02-argocd-sync-recovery-report.md` for the colleague.

### Why
- The colleague needed the existing deployment recovered, not a new design. The recovery preserves the site while turning the already-merged GitOps state into the actual cluster state and leaves a reproducible explanation of the subtle ArgoCD behavior.

### What worked
- The merged same-wave fix allowed the Deployment to become the first consumer: `serve-artifacts-corpus` bound at 2Gi and `serve-artifacts-data` bound at 1Gi.
- After removing the stale force state, the force-free SSA operation completed with `successfully synced (all tasks run)`.
- The seed script completed successfully from the local 196MiB corpus directory and the restored pod became Ready.
- Final verification: ArgoCD `sync=Synced`, `health=Healthy`, `phase=Succeeded`, `force=<absent>`; `curl` returned HTTP 200.

### What didn't work
- `kustomize build gitops/kustomize/artifacts` failed because the standalone executable is not installed:
  ```text
  /bin/bash: line 35: kustomize: command not found
  ```
  Used `kubectl kustomize gitops/kustomize/artifacts` instead.
- The handoff's clean operation with `syncStrategy: null` did not clear the historical force behavior. ArgoCD again failed with:
  ```text
  error validating options: --force cannot be used with --server-side
  ```
- The direct full apply initially failed for the Deployment:
  ```text
  The Deployment "serve-artifacts" is invalid: spec.strategy.rollingUpdate: Forbidden: may not be specified when strategy `type` is 'Recreate'
  ```
  Resolved by merge-patching `spec.strategy` to set `type: Recreate` and `rollingUpdate: null`, then server-side applying the rendered Deployment.

### What I learned
- Disabling automated/self-heal stops retry churn but does not necessarily erase the `force` value retained in `.status.operationState.operation`; inspect and clear that state before recording a clean operation.
- A same-wave PVC/Deployment pairing is essential with `local-path` `WaitForFirstConsumer` provisioning.
- An omitted `rollingUpdate` field can remain live during a Deployment strategy migration; Kubernetes requires it to be explicitly removed when changing to `Recreate`.

### What was tricky to build
- The problematic state lived in ArgoCD operation history rather than the Application's desired `spec.syncPolicy`. The symptom was that a manually submitted operation appeared force-free but the controller immediately reapplied `--force` with SSA and failed at the VaultStaticSecret wave. I disabled automated sync, patched the stale status operation so `force` was absent, then submitted an operation explicitly setting `force: false`; that succeeded and became the new safe operation record.
- The PVC binding dependency is inverted from a normal readiness sequence: the PVC cannot become ready until the Deployment exists, so putting the Deployment in a later wave prevents its prerequisite from ever occurring. Applying the consumer alongside the claims resolves the cycle.

### What warrants a second pair of eyes
- The application image currently logs `Serving artifacts from /app/imports`, even though the infrastructure now mounts and seeds `/artifacts` and `/data`. Confirm serve-artifacts PR #1 changes runtime behavior to use the seeded PVC paths before treating the stateful application migration as feature-complete.
- Review the decision to patch ArgoCD operation status during recovery. It was necessary to stop historical `force` inheritance in this incident, but should remain an exceptional, documented operator action.

### What should be done in the future
- Merge serve-artifacts PR #1 (`support-modern-claude-artifacts`) only after reviewing the seeded gallery. Its image build and GitOps image-bump PR should now reconcile through the repaired application.
- Add an operator runbook warning: never combine Force with ServerSideApply, and check historical operation state before re-enabling self-heal after a failed sync.

### Code review instructions
- Start with `reference/02-argocd-sync-recovery-report.md` for the narrative and exact incident sequence.
- Review `/home/manuel/code/wesen/2026-03-27--hetzner-k3s/gitops/kustomize/artifacts/deployment.yaml`, especially its wave `0` annotation and `Recreate` strategy, and `scripts/01-seed-pvcs.sh` for the RWO-safe seeding sequence.
- Validate live state with:
  ```bash
  export KUBECONFIG=/home/manuel/code/wesen/2026-03-27--hetzner-k3s/kubeconfig-k3s-demo-1.tail879302.ts.net.yaml
  kubectl -n argocd get application artifacts
  kubectl -n artifacts get deploy,pvc,pods,cronjob
  curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' https://artifacts.yolo.scapegoat.dev/
  ```

### Technical details
- Final ArgoCD status: `Synced/Healthy`, latest operation `Succeeded`, no recorded `syncStrategy.apply.force`, and `automated={prune:true,selfHeal:true}`.
- PVCs: `serve-artifacts-corpus` is Bound (2Gi RWO local-path); `serve-artifacts-data` is Bound (1Gi RWO local-path).
- Related report: `reference/02-argocd-sync-recovery-report.md`.

## Step 7: Reconciled the stale colleague handoff with the project status note

The colleague's `/tmp/serve-artifacts-argocd-handoff.md` was imported into the ticket as `reference/03-colleague-argocd-handoff-2026-07-15.md`; its SHA-256 matches the source file. I compared that handoff with the current Obsidian project note and the live cluster. The handoff describes the pre-recovery state and is now stale: the recovery and corpus seed it calls “remaining” have already completed.

The project note is the clearer current source of truth. The infrastructure is healthy and seeded, but the cluster is still deliberately running the old image. The remaining deployment action is the application PR, not another ArgoCD recovery. There is no local `userdata.db` snapshot in the application repository or Downloads directory to seed, and the seed command was correctly run without `LOCAL_DB`; the new application image should create a fresh database at `/data/userdata.db` on first startup.

### Prompt Context

**User prompt (verbatim):** "Ok, our colleague has kind of lost the plot I think. They gave us /tmp/serve-artifacts-argocd-handoff.md which you should also import into the ticket, and look at ~/code/wesen/go-go-golems/go-go-parc/Projects/2026/07/15/PROJ - Serve Artifacts Stateful Migration - PVCs, Vault Write-Token, and an ArgoCD Sync-Wave Deadlock.md to see where they are stuck and what should be done next (seeding the PVC db and then merging the PR, I think)?"

**Assistant interpretation:** Compare the original handoff with the current project note and live state, preserve the handoff in the ticket, and determine whether database seeding or application PR merge is the next safe operation.

**Inferred user intent:** Recover a coherent operator plan from conflicting/stale notes without repeating already-completed cluster work or accidentally merging too early.

**Commit (code):** N/A — this step updated ticket documentation and inspected live/GitHub state; no application or infrastructure source changed.

### What I did
- Re-read `/tmp/serve-artifacts-argocd-handoff.md` and confirmed the ticket copy is byte-for-byte identical.
- Read the Obsidian project note `PROJ - Serve Artifacts Stateful Migration - PVCs, Vault Write-Token, and an ArgoCD Sync-Wave Deadlock.md`.
- Checked the live Application and workload state: ArgoCD is `Synced/Healthy`, the operation is `Succeeded` with no force flag, automated prune/self-heal are enabled, both PVCs are `Bound`, and the Deployment is `1/1`.
- Verified the corpus endpoint returns HTTP 200 and `search-index.json` is populated; verified `/api/artifacts` still returns 404, proving the old image is still deployed.
- Checked PR #1: it is open, mergeable, not a draft, and its publish check succeeded. The “Open GitOps PR” check was skipped because the workflow runs that step only after merge.
- Searched for a local `userdata.db` snapshot and found none.
- Confirmed the PR branch's Dockerfile explicitly defaults to `--dir /artifacts` and `--db /data/userdata.db`.

### Why
- The original handoff is a historical recovery runbook, not a current status report. Comparing it with the project note prevents repeating the sync repair or treating the empty/fresh database as a blocked migration.

### What worked
- The project note and live cluster agree: the stateful infrastructure is deployed and the corpus PVC is seeded.
- The PR is ready for the next delivery transition: it is mergeable and CI's image publish check passed.
- The application image itself provides the correct `/artifacts` and `/data/userdata.db` paths, so merging it is what activates the stateful runtime behavior.

### What didn't work
- The colleague handoff still says the site is serving the old stateless pod and that the PVCs are Pending; those statements describe the state before Step 6 recovery and must not be followed literally now.
- There is no database snapshot available for `LOCAL_DB`, so a database restore cannot be performed from the current workstation.

### What I learned
- “Seed the PVC DB” is not an independent required step unless there is an existing `userdata.db` snapshot containing user state. With no snapshot, the correct action is to let the merged application initialize the SQLite schema on the persistent `/data` volume.
- The old image can return a healthy gallery response while ignoring the mounted PVCs (`Serving artifacts from /app/imports`). The decisive post-merge checks are `/api/artifacts` and the deployed image command/path, not HTTP 200 alone.

### What was tricky to build
- The handoff, recovery report, and project note describe different points in time. I treated the live cluster and the dated project note as current evidence, while retaining the handoff unchanged for historical traceability.
- Merging PR #1 is expected to trigger a second GitOps image-bump PR; it is not the same as the application PR. The image-bump PR must also be merged before ArgoCD can deploy the new binary.

### What warrants a second pair of eyes
- Review PR #1's final application changes before merging, especially that the runtime uses `/artifacts` and `/data/userdata.db` and that the Vault write-token is honored.
- After the image-bump PR rolls out, verify the new pod's log says it is serving `/artifacts`, `/api/artifacts` returns 200, and the database file is created on the data PVC.

### What should be done in the future
- Merge application PR #1 now that infrastructure, corpus seed, and CI checks are ready; then merge its generated GitOps image-bump PR.
- Run one controlled backup verification after the new image is live; the scheduled CronJob has not yet had a successful scheduled run recorded.
- Only restore/seed `userdata.db` from a named snapshot if user-state data actually exists; otherwise preserve the fresh database created by the application.

### Code review instructions
- Read the current-state section of the Obsidian project note first, then `reference/03-colleague-argocd-handoff-2026-07-15.md` as the historical pre-recovery record.
- Before merging: `gh pr view 1 --repo wesen/2026-03-29--serve-claude-experiments` and review the successful publish check.
- After merging, follow the generated GitOps PR and validate:
  ```bash
  export KUBECONFIG=/home/manuel/code/wesen/2026-03-27--hetzner-k3s/kubeconfig-k3s-demo-1.tail879302.ts.net.yaml
  kubectl -n argocd get application artifacts
  kubectl -n artifacts get deploy,pvc,pods,cronjob
  kubectl -n artifacts logs deploy/serve-artifacts
  curl -fsS https://artifacts.yolo.scapegoat.dev/api/artifacts
  ```

### Technical details
- Current ArgoCD revision: `6e252a5b6beac879d374a4ede5ab2b1d416c6f4c`.
- Current application image: `ghcr.io/wesen/2026-03-29--serve-claude-experiments:sha-c2f7237`; its log says `Serving artifacts from /app/imports`.
- Current endpoint checks: `/` HTTP 200, `/search-index.json` HTTP 200, `/api/artifacts` HTTP 404.
- PR #1: `https://github.com/wesen/2026-03-29--serve-claude-experiments/pull/1`, state `OPEN`, `MERGEABLE`, publish check `SUCCESS`, GitOps PR step `SKIPPED` until merge.
