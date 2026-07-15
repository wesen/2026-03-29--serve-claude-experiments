# Tasks

## TODO

- [x] GitOps manifests: PVCs (corpus+data), volumes/mounts, Recreate strategy, 1Gi mem + /dev/shm for Chrome, write-token env <!-- t:0lwf -->
- [x] Vault wiring: ServiceAccount + VaultConnection + VaultAuth + runtime VaultStaticSecret (write-token) <!-- t:h5de -->
- [x] Backup: backup-storage VaultStaticSecret + daily CronJob (sqlite .backup + tar + aws s3 cp to Hetzner object storage) <!-- t:698n -->
- [x] Scripts: 00-bootstrap-vault.sh, 01-seed-pvcs.sh (tar-stream corpus + DB), 02-restore.sh <!-- t:0bh2 -->
- [x] Application label flips (has-persistent-storage/has-database) + kustomization updates; kubectl kustomize validates <!-- t:epk7 -->
- [ ] Runbook executed: bootstrap Vault, seed PVCs, verify gallery + backup (requires cluster access) <!-- t:a6aj -->
