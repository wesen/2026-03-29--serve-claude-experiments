# Changelog

## 2026-07-14

- Initial workspace created


## 2026-07-14

Design guide written + uploaded to reMarkable; GitOps manifests (2 PVCs, Recreate, 1Gi+dshm for Chrome, Vault write-token, backup CronJob) committed on hetzner-k3s branch feat/serve-artifacts-stateful-backup (39e5978), kubectl kustomize clean (12 resources); seed/restore/bootstrap scripts added. Rollout not yet run (needs cluster access).

### Related Files

- /home/manuel/code/wesen/2026-03-27--hetzner-k3s/gitops/kustomize/artifacts/backup-cronjob.yaml — Off-node backup to object storage
- /home/manuel/code/wesen/2026-03-27--hetzner-k3s/gitops/kustomize/artifacts/deployment.yaml — Stateful Deployment (PVCs, write-token, Chrome mem)

