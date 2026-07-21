---
Title: 'serve-artifacts ArgoCD sync recovery report'
Ticket: SERVE-20260714-DEPLOY
Status: active
Topics:
    - deployment
    - kubernetes
    - gitops
    - artifacts
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - abs:///home/manuel/code/wesen/2026-03-27--hetzner-k3s/gitops/kustomize/artifacts/deployment.yaml
    - abs:///home/manuel/code/wesen/2026-03-27--hetzner-k3s/gitops/kustomize/artifacts/pvc-corpus.yaml
    - abs:///home/manuel/code/wesen/2026-03-27--hetzner-k3s/gitops/kustomize/artifacts/pvc-data.yaml
    - abs:///home/manuel/code/wesen/2026-03-29--serve-claude-experiments/ttmp/2026/07/14/SERVE-20260714-DEPLOY--deploy-serve-artifacts-to-k3s-stateful-pvcs-seeding-write-token-secret-and-off-node-backups/scripts/01-seed-pvcs.sh
ExternalSources: []
Summary: 'Root cause and recovery record for the serve-artifacts ArgoCD sync failure on 2026-07-15.'
WhatFor: 'Explain the two independent ArgoCD rollout failures, the exact recovery performed, and safeguards for future stateful local-path rollouts.'
WhenToUse: 'Read when operating the artifacts ArgoCD application or changing its PVC sync waves and sync options.'
---

# serve-artifacts ArgoCD sync recovery report

## Executive summary

The `artifacts` ArgoCD application was stuck `OutOfSync/Progressing` while the old stateless pod continued to serve the site. Two independent issues caused this:

1. The initial manifests put `WaitForFirstConsumer` PVCs in an earlier sync wave than their only consumer Deployment. ArgoCD waits for a wave to become healthy, while these PVCs cannot bind until a pod mounts them. That creates a circular wait.
2. A recovery attempt used ArgoCD `force` together with `ServerSideApply=true`. Kubernetes rejects that combination. ArgoCD retained `force: true` in the failed operation state, so later sync requests inherited it and failed before they reached the Deployment.

The Git sync-wave fix had already been merged. Recovery required clearing the stale recorded force flag, running one explicit force-free server-side sync, seeding the bound PVCs, and then restoring automated self-healing. The application now reports `Synced/Healthy`, its pod is ready, both PVCs are `Bound`, and the public endpoint returns HTTP 200.

## User impact

There was no outage: the old stateless pod remained Ready and `https://artifacts.yolo.scapegoat.dev` returned HTTP 200 throughout. The stateful manifest was not taking effect, so the intended durable storage, backup CronJob, and write-token deployment could not complete until recovery.

## Root cause 1: PVC/Deployment sync-wave circular wait

`local-path` uses the `WaitForFirstConsumer` binding mode. A PVC does not bind merely because it exists; Kubernetes waits until a consuming pod is scheduled, allowing it to choose a compatible node and provision the local volume there.

The first version declared the PVCs in ArgoCD wave `0` and the Deployment in wave `1`:

```text
ArgoCD applies wave 0 (PVCs)
  -> waits for wave 0 to be Healthy
  -> PVCs remain Pending: no Pod has mounted them
  -> Deployment in wave 1 is never applied
```

That is a deadlock. PR #159 corrected it by assigning the Deployment to wave `0`, alongside both PVCs. ArgoCD can now create the consumer pod; the scheduler provisions/binds the PVCs; and the pod becomes healthy.

## Root cause 2: stale `force` state with server-side apply

The application has these sync options:

```yaml
syncOptions:
  - CreateNamespace=true
  - ServerSideApply=true
```

A prior manually submitted operation included `syncStrategy.apply.force: true`. The resulting Kubernetes error was:

```text
error validating options: --force cannot be used with --server-side
```

The important detail is that removing `force` from `spec.syncPolicy` was not enough: the bad value was retained in ArgoCD's historical `.status.operationState.operation`. A subsequent sync submitted with `syncStrategy: null` still inherited `force: true` and failed at the first VaultStaticSecret wave. Disabling automated/self-heal stopped repeated retries, but did not by itself remove the stale status value.

## Recovery performed

### 1. Confirmed the starting state

The application was `OutOfSync/Progressing`, had `automated` disabled, and recorded the failed operation with `force=true`. The old Deployment was still `RollingUpdate`; both PVCs were `Pending`.

### 2. Broke the first-consumer deadlock safely

The desired overlay was rendered with `kubectl kustomize`. A direct server-side apply was used as a controlled recovery measure so the cluster had the desired PVCs, CronJob, and other resources. The Deployment required one additional migration step: its live `spec.strategy.rollingUpdate` field had to be removed in the same patch that changed it to `Recreate`, because Kubernetes forbids `rollingUpdate` when `type: Recreate`.

Once the Deployment mounted the claims, both claims bound:

```text
serve-artifacts-corpus  Bound  2Gi  RWO  local-path
serve-artifacts-data    Bound  1Gi  RWO  local-path
```

### 3. Removed the stale force value and recorded a clean sync

With automated sync still disabled, the stale status operation was patched so the force field was absent. A manual sync was then submitted with an explicit false force value and the existing SSA options:

```json
{
  "operation": {
    "initiatedBy": {"username": "pi-recovery"},
    "sync": {
      "revision": "6e252a5b6beac879d374a4ede5ab2b1d416c6f4c",
      "prune": true,
      "syncStrategy": {"apply": {"force": false}},
      "syncOptions": ["CreateNamespace=true", "ServerSideApply=true"]
    }
  }
}
```

This operation completed successfully. Its recorded `force` value is absent, which establishes a safe operation history before self-healing is restored.

### 4. Seeded the new persistent volumes

Ran `scripts/01-seed-pvcs.sh` with the cluster kubeconfig. It scaled the Deployment to zero to release the RWO claims, mounted both claims in a temporary maintenance pod, tar-streamed `/home/manuel/Downloads/claude-downloads` (196 MiB source; excluding `conversation.json`) into `/artifacts`, deleted the maintenance pod, and restored one replica. No `LOCAL_DB` was supplied, so `/data/userdata.db` was intentionally left for the application to create fresh.

### 5. Restored automated reconciliation

Automated prune and self-heal were re-enabled only after the clean sync completed:

```json
{"prune": true, "selfHeal": true}
```

## Final verified state

```text
ArgoCD application: sync=Synced, health=Healthy, operation=Succeeded, force=<absent>
Deployment:          serve-artifacts 1/1 Ready
PVCs:                serve-artifacts-corpus Bound; serve-artifacts-data Bound
CronJob:             serve-artifacts-backup present, not suspended
Public endpoint:     HTTP 200
```

## Important follow-up: application image PR

The currently deployed image (`sha-c2f7237`) logged `Serving artifacts from /app/imports`. The infrastructure rollout now mounts and seeds `/artifacts` and `/data`, but the application-side stateful behavior is delivered by serve-artifacts PR #1 (`support-modern-claude-artifacts`), which remains unmerged by design. Merge that PR only after reviewing the seeded gallery and recovery state. Its image pipeline will create the normal GitOps image-bump PR, which ArgoCD can now reconcile automatically.

## Preventing recurrence

- **Keep a WaitForFirstConsumer PVC and its first consumer in the same ArgoCD sync wave.** Do not wait for such PVCs to be Healthy in an earlier wave.
- **Never combine ArgoCD Force with `ServerSideApply=true`.** Treat the Kubernetes validation error as terminal for that operation.
- **Inspect `.status.operationState.operation`, not only `spec.syncPolicy`, after a failed sync.** Historical operation fields can influence retries.
- **Before turning self-heal back on, prove one clean manual sync succeeds** and verify the recorded operation has no force flag.
- **For a `RollingUpdate` → `Recreate` migration, remove `spec.strategy.rollingUpdate` atomically.** Otherwise the API rejects the strategy change.
- **Seed RWO claims through a scale-to-zero maintenance pod**, as in `01-seed-pvcs.sh`; do not mount them from arbitrary pods on different nodes.

## Operator verification commands

```bash
export KUBECONFIG=/home/manuel/code/wesen/2026-03-27--hetzner-k3s/kubeconfig-k3s-demo-1.tail879302.ts.net.yaml

kubectl -n argocd get application artifacts -o json | jq '{
  sync: .status.sync.status,
  health: .status.health.status,
  phase: .status.operationState.phase,
  force: (.status.operationState.operation.sync.syncStrategy.apply.force // "absent"),
  automated: .spec.syncPolicy.automated
}'
kubectl -n artifacts get deploy,pvc,pods,cronjob
curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' https://artifacts.yolo.scapegoat.dev/
```
