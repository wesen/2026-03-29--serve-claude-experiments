#!/usr/bin/env bash
# Restore serve-artifacts from an off-node backup archive in object storage.
# Inverse of the backup CronJob + seed: pulls a tar.gz, unpacks the corpus into
# /artifacts and userdata.db into /data via a maintenance pod, app scaled to 0.
#
# Requires: kubectl (Tailscale kubeconfig), aws CLI with the backup creds in the
# environment (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / S3_ENDPOINT / S3_BUCKET
# / S3_PREFIX), tar.
set -euo pipefail

NS="${NS:-artifacts}"
DEPLOY="${DEPLOY:-serve-artifacts}"
POD="serve-artifacts-restore"
: "${S3_ENDPOINT:?}"; : "${S3_BUCKET:?}"; : "${S3_PREFIX:=serve-artifacts/}"
ARCHIVE_KEY="${ARCHIVE_KEY:-}"   # e.g. serve-artifacts/serve-artifacts-20260714T042000Z.tar.gz

if [ -z "$ARCHIVE_KEY" ]; then
  echo "==> resolving latest archive under s3://${S3_BUCKET}/${S3_PREFIX}"
  ARCHIVE_KEY="$(aws --endpoint-url "$S3_ENDPOINT" s3 ls "s3://${S3_BUCKET}/${S3_PREFIX}" \
    | awk '{print $4}' | sort | tail -1)"
  ARCHIVE_KEY="${S3_PREFIX}${ARCHIVE_KEY}"
fi
[ -n "$ARCHIVE_KEY" ] || { echo "no archive found" >&2; exit 1; }
echo "==> restoring from s3://${S3_BUCKET}/${ARCHIVE_KEY}"

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
aws --endpoint-url "$S3_ENDPOINT" s3 cp "s3://${S3_BUCKET}/${ARCHIVE_KEY}" "${work}/restore.tar.gz"
mkdir -p "${work}/x"; tar -C "${work}/x" -xzf "${work}/restore.tar.gz"

echo "==> scaling ${DEPLOY} to 0 and launching maintenance pod"
kubectl -n "$NS" scale "deploy/${DEPLOY}" --replicas=0
kubectl -n "$NS" rollout status "deploy/${DEPLOY}" --timeout=120s || true
kubectl -n "$NS" apply -f - <<'YAML'
apiVersion: v1
kind: Pod
metadata:
  name: serve-artifacts-restore
  labels: { app.kubernetes.io/name: serve-artifacts-restore }
spec:
  restartPolicy: Never
  containers:
    - name: restore
      image: alpine:3.20
      command: ["sh","-c","apk add --no-cache tar >/dev/null; sleep 3600"]
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

echo "==> restoring corpus + userdata.db into the PVCs"
# The archive contains the corpus at its root plus a top-level userdata.db.
tar -C "${work}/x" --exclude='userdata.db' -cf - . \
  | kubectl -n "$NS" exec -i "$POD" -- tar -C /artifacts -xf -
if [ -f "${work}/x/userdata.db" ]; then
  kubectl -n "$NS" cp "${work}/x/userdata.db" "${POD}:/data/userdata.db"
fi

kubectl -n "$NS" delete "pod/${POD}" --wait=true
kubectl -n "$NS" scale "deploy/${DEPLOY}" --replicas=1
kubectl -n "$NS" rollout status "deploy/${DEPLOY}" --timeout=180s
echo "==> restore complete."
