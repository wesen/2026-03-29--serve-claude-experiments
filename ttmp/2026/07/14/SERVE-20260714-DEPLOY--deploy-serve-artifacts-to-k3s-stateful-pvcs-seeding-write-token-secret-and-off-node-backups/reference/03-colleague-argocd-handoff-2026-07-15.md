# Handoff — serve-artifacts stateful deploy: ArgoCD sync stuck

**Date:** 2026-07-15
**Author:** (previous operator + Claude)
**Severity:** Low — **the live site is UP** (`https://artifacts.yolo.scapegoat.dev` → HTTP 200) serving the *old stateless* pod. No outage. The *new stateful* version is not yet running.
**One-line:** Two intertwined issues — (1) a PVC/Deployment sync-wave deadlock (fixed in git), and (2) a stuck ArgoCD `--force` operation loop I accidentally introduced (needs one clean sync to clear). **Automated sync is currently DISABLED on the `artifacts` app** as the intended recovery step — it must be re-enabled at the end.

---

## 1. What we're deploying

Convert the `artifacts` app (Claude artifact gallery, repo `2026-03-29--serve-claude-experiments`, live at `artifacts.yolo.scapegoat.dev`) from a **stateless** deployment to a **stateful** one:
- Two `local-path` RWO PVCs: `serve-artifacts-corpus` (`/artifacts`, ~70MB gallery corpus) + `serve-artifacts-data` (`/data`, SQLite `userdata.db`).
- A write API guarded by `SERVE_ARTIFACTS_WRITE_TOKEN` (Vault-synced).
- Off-node backup CronJob.
- `strategy: Recreate` (RWO single-writer).

GitOps repo: `wesen/2026-03-27--hetzner-k3s`, path `gitops/kustomize/artifacts`, ArgoCD app `artifacts` (namespace `argocd`), auto-sync + SSA.

---

## 2. Completed (do NOT redo)

| Item | Status |
|------|--------|
| Terraform Vault JWT role `serve-artifacts-gitops-pr` (GitHub App token flow) | ✅ merged (terraform PR #9) + `terraform apply`'d |
| GitHub App creds copied to Vault `kv/ci/github/serve-artifacts/gitops-pr-app` (App 3926776) | ✅ |
| Vault bootstrap: `write-token` @ `kv/apps/serve-artifacts/prod/runtime`, `serve-artifacts-prefix` on `kv/infra/backups/object-storage`, k8s-auth role `serve-artifacts`, policy `serve-artifacts` | ✅ (ran `00-bootstrap-vault.sh`) |
| Declarative Vault role/policy in-repo (`vault/roles/kubernetes/serve-artifacts.json` + `vault/policies/kubernetes/serve-artifacts.hcl`) | ✅ (in main, addressed PR bot P1) |
| hetzner-k3s PR **#158** (stateful manifests) | ✅ merged |
| hetzner-k3s PR **#159** (sync-wave fix, see below) | ✅ merged |
| VaultStaticSecret `serve-artifacts-runtime` synced (k8s secret has `write-token`) | ✅ verified |
| PVCs created | ✅ (Pending — expected, see below) |

**Verified end-to-end:** the Vault chain works — `kubectl -n artifacts get secret serve-artifacts-runtime` has key `write-token`.

---

## 3. Issue A — PVC/Deployment sync-wave deadlock (FIXED IN GIT)

`local-path` StorageClass is **`WaitForFirstConsumer`**: a PVC only binds once a pod mounts it. Original PR #158 had PVCs at `sync-wave: "0"` and the Deployment at `sync-wave: "1"`. ArgoCD applies a wave, then waits for it to be **Healthy** before the next wave — so it waited for the PVCs to bind before creating their only consumer (the Deployment) → **deadlock** (`waiting for healthy state of PersistentVolumeClaim/serve-artifacts-corpus`).

**Fix (PR #159, already merged):** put the Deployment in the **same wave as the PVCs** (`sync-wave: "0"`), matching the proven working pattern in `gitops/kustomize/coinvault/` (its PVC + Deployment are both `sync-wave: "1"`). This is correct and needs no further change.

---

## 4. Issue B — stuck `--force` operation loop (I INTRODUCED THIS)

When trying to force a sync via `kubectl patch application ... {"operation":...}`, I set `syncStrategy.apply.force: true`. But the app's `syncOptions` include `ServerSideApply=true`, and ArgoCD rejects the combination:

```
one or more objects failed to apply, reason: error validating options: --force cannot be used with --server-side
```

Worse: **ArgoCD's `selfHeal` reuses the previous failed operation's `syncStrategy` when retrying.** So every subsequent operation — even a manual one I submitted with `syncStrategy: null` — came back with `force: true` re-injected (confirmed: `.status.operationState.operation` shows `initiatedBy.username: clear-force` **and** `syncStrategy.apply.force: true`). As long as `automated`/`selfHeal` is on, no operation can be force-free.

`spec.syncPolicy` itself is **clean** (no force). The force lives only in the historical `status.operationState` and gets copied forward by selfHeal.

**The fix:** disable `automated` (breaks the selfHeal reuse), run **one clean sync** (no force — this becomes the new "last operation" with no force), then re-enable `automated`. **I have already disabled `automated`** — that is the current state.

---

## 5. CURRENT CLUSTER STATE (as of handoff)

```
kubeconfig: /home/manuel/code/wesen/2026-03-27--hetzner-k3s/kubeconfig-k3s-demo-1.tail879302.ts.net.yaml
```
- App `artifacts`: `sync=OutOfSync health=Progressing rev=6e252a5` (correct target rev).
- **`spec.syncPolicy.automated` = DISABLED (empty)** ← I set this; **must re-enable at the end**.
- `status.operationState.phase = Failed`, force=true (historical; harmless once a clean op runs).
- No pending `.operation`.
- OutOfSync resources: **Deployment/serve-artifacts**, **CronJob/serve-artifacts-backup**.
- Deployment live spec still **old/stateless** (`strategy: RollingUpdate`, no PVC volumes); old pod `serve-artifacts-799dbf69fd-w644c` (107d) **Running 1/1**.
- PVCs `serve-artifacts-corpus` + `serve-artifacts-data`: **Pending** (WaitForFirstConsumer — normal until a pod mounts them).
- Site: **HTTP 200** (old stateless version still serving).

---

## 6. REMAINING STEPS

> All `kubectl` below assume `export KUBECONFIG=/home/manuel/code/wesen/2026-03-27--hetzner-k3s/kubeconfig-k3s-demo-1.tail879302.ts.net.yaml`

### Step 1 — one clean sync (automated already OFF)

Easiest: use the **ArgoCD UI** "SYNC" button on the `artifacts` app (leave options default — do NOT tick "Force"). Or via kubectl (automated is off, so no force re-injection):

```bash
kubectl -n argocd patch application artifacts --type=merge -p '{
  "operation": { "initiatedBy": {"username":"colleague"},
    "sync": { "revision":"6e252a5b6beac879d374a4ede5ab2b1d416c6f4c", "prune":true,
      "syncStrategy": null,
      "syncOptions":["CreateNamespace=true","ServerSideApply=true"] } } }'
```

**Expected:** Deployment applies (`strategy` → `Recreate`, gets PVC volumes). Its pod schedules → **PVCs bind** (Pending → Bound) → old pod replaced. Watch:

```bash
watch -n5 'kubectl -n artifacts get deploy serve-artifacts -o jsonpath="{.spec.strategy.type}"; echo; \
  kubectl -n artifacts get pvc; kubectl -n artifacts get pods'
```

Confirm no force in the op that ran:
```bash
kubectl -n argocd get application artifacts -o jsonpath='{.status.operationState.phase} force={.status.operationState.operation.sync.syncStrategy.apply.force}{"\n"}'
# want: Succeeded force=<empty>
```

> ⚠️ After this the new stateful pod is up on **EMPTY** PVCs → the gallery is **empty** until Step 2. Do Step 2 promptly.

### Step 2 — seed the PVCs

Script: `.../ttmp/2026/07/14/SERVE-20260714-DEPLOY--.../scripts/01-seed-pvcs.sh` in repo `2026-03-29--serve-claude-experiments`.
It scales the deployment to 0, runs a maintenance pod, streams the corpus into `/artifacts` and (optionally) a `userdata.db` snapshot into `/data`, then scales back to 1.

```bash
cd /home/manuel/code/wesen/2026-03-29--serve-claude-experiments/ttmp/2026/07/14/SERVE-20260714-DEPLOY--deploy-serve-artifacts-to-k3s-stateful-pvcs-seeding-write-token-secret-and-off-node-backups/scripts
export KUBECONFIG=/home/manuel/code/wesen/2026-03-27--hetzner-k3s/kubeconfig-k3s-demo-1.tail879302.ts.net.yaml
# CORPUS_DIR defaults to ~/Downloads/claude-downloads (present, 196MB). Optional: LOCAL_DB=/path/to/userdata.db
./01-seed-pvcs.sh
```

Verify: `curl -fsS https://artifacts.yolo.scapegoat.dev/ | head` shows a populated gallery.

### Step 3 — RE-ENABLE automated sync (REQUIRED)

```bash
kubectl -n argocd patch application artifacts --type=merge \
  -p '{"spec":{"syncPolicy":{"automated":{"prune":true,"selfHeal":true}}}}'
kubectl -n argocd get application artifacts -o jsonpath='automated={.spec.syncPolicy.automated}{"\n"}'
```
Confirm the app settles to `Synced/Healthy` and does NOT re-enter a force loop (it won't — the last operation is now force-free).

### Step 4 — merge serve-artifacts app PR (LAST)

Only after the gallery is verified populated and healthy: merge **serve-artifacts PR #1** (`wesen/2026-03-29--serve-claude-experiments`, branch `support-modern-claude-artifacts`). That triggers image build → GitHub-App token via Vault → auto GitOps PR bumping `gitops/kustomize/artifacts/deployment.yaml` image → Argo picks it up.

---

## 7. Alternative if Step 1 still misbehaves

If a clean sync still won't apply the Deployment (should not happen with automated off), directly create it to break the WaitForFirstConsumer deadlock, then reconcile:
```bash
kubectl -n artifacts apply --server-side --field-manager=argocd-controller --force-conflicts \
  -k /home/manuel/code/wesen/2026-03-27--hetzner-k3s/gitops/kustomize/artifacts
```
Then re-enable automated (Step 3); Argo will adopt the resources (they match git) and go Synced, which itself stops any selfHeal loop.

---

## 8. Key references

- ArgoCD app: `argocd` ns, `application/artifacts`, path `gitops/kustomize/artifacts`, targetRevision `main`.
- Working local-path+Argo example to mirror: `gitops/kustomize/coinvault/` (PVC + Deployment same sync-wave).
- Vault playbook: go-go-parc `Projects/2026/06/01/ARTICLE - GitHub App Tokens for GitOps PR Automation.md`.
- PRs: hetzner-k3s #158 (stateful), #159 (sync-wave fix); terraform #9 (Vault role); serve-artifacts #1 (app — NOT yet merged).
- Deploy ticket + scripts: `2026-03-29--serve-claude-experiments/ttmp/2026/07/14/SERVE-20260714-DEPLOY--.../` (`00-bootstrap-vault.sh` ✅ done, `01-seed-pvcs.sh` ⬜ pending, `02-restore.sh`, `03-bootstrap-gitops-pr-app.sh` ✅ done).
- kubeconfig (Tailscale, works from this host): `/home/manuel/code/wesen/2026-03-27--hetzner-k3s/kubeconfig-k3s-demo-1.tail879302.ts.net.yaml`.
- `argocd` CLI is installed but **not logged in** on this host (no server/context configured) — use kubectl against the Application CRD, or the ArgoCD web UI.
