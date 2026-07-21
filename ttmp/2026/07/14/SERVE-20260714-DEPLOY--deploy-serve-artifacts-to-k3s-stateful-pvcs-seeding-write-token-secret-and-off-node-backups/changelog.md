# Changelog

## 2026-07-14

- Initial workspace created


## 2026-07-14

Design guide written + uploaded to reMarkable; GitOps manifests (2 PVCs, Recreate, 1Gi+dshm for Chrome, Vault write-token, backup CronJob) committed on hetzner-k3s branch feat/serve-artifacts-stateful-backup (39e5978), kubectl kustomize clean (12 resources); seed/restore/bootstrap scripts added. Rollout not yet run (needs cluster access).

### Related Files

- /home/manuel/code/wesen/2026-03-27--hetzner-k3s/gitops/kustomize/artifacts/backup-cronjob.yaml — Off-node backup to object storage
- /home/manuel/code/wesen/2026-03-27--hetzner-k3s/gitops/kustomize/artifacts/deployment.yaml — Stateful Deployment (PVCs, write-token, Chrome mem)


## 2026-07-14

Provisioned GitOps-PR GitHub App role as code: terraform serve-artifacts-gitops-pr JWT role+policy (247924f, branch feat/serve-artifacts-gitops-pr-role, terraform validate clean) reading kv/data/ci/github/serve-artifacts/gitops-pr-app; added scripts/03-bootstrap-gitops-pr-app.sh for the KV secret. GitHub App install + vault kv put + terraform apply remain for the operator.

### Related Files

- /home/manuel/code/wesen/terraform/vault/github-actions/envs/k3s/main.tf — serve-artifacts-gitops-pr Vault JWT role+policy


## 2026-07-15

Step 7: Reconciled the stale colleague handoff with the live recovered cluster and Obsidian project note; confirmed infrastructure/corpus seed are complete, no userdata.db snapshot exists, and application PR #1 is the next delivery step.

### Related Files

- /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/ttmp/2026/07/14/SERVE-20260714-DEPLOY--deploy-serve-artifacts-to-k3s-stateful-pvcs-seeding-write-token-secret-and-off-node-backups/reference/01-diary.md — Current-state reconciliation and next-step decision

