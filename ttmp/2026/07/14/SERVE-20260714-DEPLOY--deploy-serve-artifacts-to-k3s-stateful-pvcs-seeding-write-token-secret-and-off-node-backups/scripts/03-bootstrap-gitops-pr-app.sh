#!/usr/bin/env bash
# Store the GitHub App credentials serve-artifacts' CI uses to open GitOps PRs.
# The Vault JWT role + policy that READ this path are codified in Terraform
# (terraform/vault/github-actions/envs/k3s/main.tf: serve-artifacts-gitops-pr);
# run `terraform apply` there after this. Only the secret VALUE lives here.
#
# Reuse the shared "gitops-pr-bot" GitHub App that is already installed on
# wesen/2026-03-27--hetzner-k3s (same app_id + private_key the other apps use) —
# or create one (Contents: RW, Pull requests: RW) installed on that repo only.
#
# Requires: vault CLI logged in (VAULT_ADDR + VAULT_TOKEN).
set -euo pipefail

require() { command -v "$1" >/dev/null 2>&1 || { echo "missing command: $1" >&2; exit 1; }; }
require vault

: "${GITOPS_APP_ID:?set GITOPS_APP_ID (the GitHub App's App ID)}"
: "${GITOPS_APP_PRIVATE_KEY_FILE:?set GITOPS_APP_PRIVATE_KEY_FILE (path to the App .pem)}"
[ -f "$GITOPS_APP_PRIVATE_KEY_FILE" ] || { echo "no such key file: $GITOPS_APP_PRIVATE_KEY_FILE" >&2; exit 1; }

KV_MOUNT="${VAULT_KV_MOUNT_PATH:-kv}"
APP_PATH="${APP_PATH:-ci/github/serve-artifacts/gitops-pr-app}"

vault kv put "${KV_MOUNT}/${APP_PATH}" \
  app_id="${GITOPS_APP_ID}" \
  private_key=@"${GITOPS_APP_PRIVATE_KEY_FILE}" \
  || vault kv put "${KV_MOUNT}/${APP_PATH}" \
       app_id="${GITOPS_APP_ID}" \
       private_key="$(cat "${GITOPS_APP_PRIVATE_KEY_FILE}")"

# Verify shape without printing the private key.
vault kv get -format=json "${KV_MOUNT}/${APP_PATH}" \
  | { command -v jq >/dev/null && jq '{keys:(.data.data|keys), app_id:.data.data.app_id, private_key_length:(.data.data.private_key|length)}' || cat; }

echo
echo "next: cd terraform/vault/github-actions/envs/k3s && terraform apply   # creates the role+policy"
