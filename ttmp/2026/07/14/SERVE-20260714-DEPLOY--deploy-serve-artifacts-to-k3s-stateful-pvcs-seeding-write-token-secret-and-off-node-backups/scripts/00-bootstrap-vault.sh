#!/usr/bin/env bash
# Seed Vault for serve-artifacts: the write-API bearer token, the Vault
# kubernetes-auth role, and the shared object-storage prefix the backup CronJob
# uses. Idempotent. Run once before the first ArgoCD sync of the stateful app.
#
# Requires: vault CLI logged in (VAULT_ADDR + VAULT_TOKEN), openssl.
set -euo pipefail

require() { command -v "$1" >/dev/null 2>&1 || { echo "missing command: $1" >&2; exit 1; }; }
require vault; require openssl
: "${VAULT_ADDR:?set VAULT_ADDR}"; : "${VAULT_TOKEN:?set VAULT_TOKEN}"

KV_MOUNT="${VAULT_KV_MOUNT_PATH:-kv}"
RUNTIME_PATH="${RUNTIME_PATH:-apps/serve-artifacts/prod/runtime}"
OBJECT_STORAGE_PATH="${OBJECT_STORAGE_PATH:-infra/backups/object-storage}"
NAMESPACE="${NAMESPACE:-artifacts}"
SA="${SA:-serve-artifacts}"
ROLE="${ROLE:-serve-artifacts}"

# 1) Write token — generate one if not already present (don't rotate silently).
if vault kv get "${KV_MOUNT}/${RUNTIME_PATH}" >/dev/null 2>&1 && \
   [ -n "$(vault kv get -field=write-token "${KV_MOUNT}/${RUNTIME_PATH}" 2>/dev/null || true)" ]; then
  echo "write-token already set at ${KV_MOUNT}/${RUNTIME_PATH} (leaving as-is)"
else
  TOKEN="$(openssl rand -hex 32)"
  vault kv patch "${KV_MOUNT}/${RUNTIME_PATH}" write-token="${TOKEN}" \
    || vault kv put "${KV_MOUNT}/${RUNTIME_PATH}" write-token="${TOKEN}"
  echo "wrote write-token to ${KV_MOUNT}/${RUNTIME_PATH}"
  echo ">>> give clients this token (also usable as SERVE_ARTIFACTS_TOKEN): ${TOKEN}"
fi

# 2) Object-storage prefix key on the shared backup secret (creds themselves are
#    already provisioned cluster-wide for the other backup jobs).
vault kv patch "${KV_MOUNT}/${OBJECT_STORAGE_PATH}" serve-artifacts-prefix="serve-artifacts/" \
  && echo "set serve-artifacts-prefix on ${KV_MOUNT}/${OBJECT_STORAGE_PATH}"

# 3) Runtime policy: read the two KV paths the app's VaultStaticSecrets sync.
vault policy write serve-artifacts - <<EOF
path "${KV_MOUNT}/data/${RUNTIME_PATH}" {
  capabilities = ["read"]
}
path "${KV_MOUNT}/data/${OBJECT_STORAGE_PATH}" {
  capabilities = ["read"]
}
EOF
echo "wrote Vault policy 'serve-artifacts' (read runtime + object-storage)"

# 4) kubernetes-auth role binding the app's ServiceAccount to that policy.
vault write "auth/kubernetes/role/${ROLE}" \
  bound_service_account_names="${SA}" \
  bound_service_account_namespaces="${NAMESPACE}" \
  policies="serve-artifacts" \
  ttl="1h" \
  && echo "bound Vault role ${ROLE} -> sa ${NAMESPACE}/${SA}"
