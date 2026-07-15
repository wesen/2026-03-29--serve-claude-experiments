#!/usr/bin/env bash
# One-time seed of the serve-artifacts PVCs. Streams the (slimmed) corpus into
# /artifacts and a consistent userdata.db snapshot into /data via a maintenance
# pod, with the app scaled to 0 so nothing holds the RWO volumes.
#
# After this, the PVCs are authoritative; normal operation + `artifact push`
# evolve them. Re-running is safe but OVERWRITES the DB and merges the corpus.
#
# Requires: kubectl (Tailscale kubeconfig), sqlite3, tar. Assumes the stateful
# manifests are already synced (PVCs exist / will be created on first mount).
set -euo pipefail

NS="${NS:-artifacts}"
DEPLOY="${DEPLOY:-serve-artifacts}"
CORPUS_DIR="${CORPUS_DIR:-$HOME/Downloads/claude-downloads}"
LOCAL_DB="${LOCAL_DB:-}"                 # optional path to a userdata.db to seed
POD="serve-artifacts-seed"

command -v kubectl >/dev/null || { echo "kubectl required" >&2; exit 1; }
[ -d "$CORPUS_DIR" ] || { echo "corpus dir not found: $CORPUS_DIR" >&2; exit 1; }

echo "==> scaling ${DEPLOY} to 0 (release RWO volumes)"
kubectl -n "$NS" scale "deploy/${DEPLOY}" --replicas=0
kubectl -n "$NS" rollout status "deploy/${DEPLOY}" --timeout=120s || true

echo "==> launching maintenance pod ${POD}"
kubectl -n "$NS" apply -f - <<'YAML'
apiVersion: v1
kind: Pod
metadata:
  name: serve-artifacts-seed
  labels: { app.kubernetes.io/name: serve-artifacts-seed }
spec:
  restartPolicy: Never
  containers:
    - name: seed
      image: alpine:3.20
      command: ["sh","-c","apk add --no-cache sqlite tar >/dev/null; sleep 3600"]
      volumeMounts:
        - { name: corpus, mountPath: /artifacts }
        - { name: data,   mountPath: /data }
  volumes:
    - name: corpus
      persistentVolumeClaim: { claimName: serve-artifacts-corpus }
    - name: data
      persistentVolumeClaim: { claimName: serve-artifacts-data }
YAML
kubectl -n "$NS" wait --for=condition=Ready "pod/${POD}" --timeout=180s

echo "==> streaming corpus (dropping unused conversation.json) into /artifacts"
tar -C "$CORPUS_DIR" --exclude='conversation.json' -cf - . \
  | kubectl -n "$NS" exec -i "$POD" -- tar -C /artifacts -xf -

if [ -n "$LOCAL_DB" ] && [ -f "$LOCAL_DB" ]; then
  echo "==> seeding userdata.db from ${LOCAL_DB} (consistent snapshot)"
  snap="$(mktemp -u).db"
  sqlite3 "$LOCAL_DB" ".backup '$snap'"
  kubectl -n "$NS" cp "$snap" "${POD}:/data/userdata.db"
  rm -f "$snap"
else
  echo "==> no LOCAL_DB given; leaving /data/userdata.db to be created fresh"
fi

echo "==> tearing down maintenance pod and scaling ${DEPLOY} back to 1"
kubectl -n "$NS" delete "pod/${POD}" --wait=true
kubectl -n "$NS" scale "deploy/${DEPLOY}" --replicas=1
kubectl -n "$NS" rollout status "deploy/${DEPLOY}" --timeout=180s
echo "==> done. verify: curl -fsS https://artifacts.yolo.scapegoat.dev/ | head"
