#!/usr/bin/env bash
# Store the GitHub App credentials serve-artifacts' CI uses to open GitOps PRs.
# The Vault JWT role + policy that READ this path are codified in Terraform
# (terraform/vault/github-actions/envs/k3s/main.tf: serve-artifacts-gitops-pr);
# run `terraform apply` there after this. Only the secret VALUE lives here.
#
# We REUSE the shared "wesen-gitops-pr-bot" GitHub App (App ID 3926776) that is
# already installed on wesen/2026-03-27--hetzner-k3s with Contents: RW +
# Pull requests: RW. Every deployment family stores its own COPY of that same
# app_id + private_key at its own KV path and pairs it with its own Vault role
# (see go-go-parc: "GitHub App Tokens for GitOps PR Automation"). No new App and
# no GitHub-UI install step is needed — the App is already installed.
#
# Two ways to supply the credentials:
#   A. FROM_EXISTING (recommended) — copy from another repo's App KV path, so you
#      never have to fish out the .pem:
#        FROM_EXISTING_PATH=kv/ci/github/retro-obsidian-publish/gitops-pr-app \
#          ./03-bootstrap-gitops-pr-app.sh
#   B. Explicit — provide App ID + a .pem file:
#        GITOPS_APP_ID=3926776 GITOPS_APP_PRIVATE_KEY_FILE=/path/app.pem \
#          ./03-bootstrap-gitops-pr-app.sh
#
# Requires: vault CLI logged in (VAULT_ADDR + VAULT_TOKEN); jq for FROM_EXISTING.
set -euo pipefail

require() { command -v "$1" >/dev/null 2>&1 || { echo "missing command: $1" >&2; exit 1; }; }
require vault

KV_MOUNT="${VAULT_KV_MOUNT_PATH:-kv}"
APP_PATH="${APP_PATH:-ci/github/serve-artifacts/gitops-pr-app}"
FROM_EXISTING_PATH="${FROM_EXISTING_PATH:-}"

if [ -n "${FROM_EXISTING_PATH}" ]; then
  # Copy app_id + private_key verbatim from an existing App KV path (KV v2).
  require jq
  echo "copying App credentials from ${FROM_EXISTING_PATH} -> ${KV_MOUNT}/${APP_PATH}"
  src_json="$(vault kv get -format=json "${FROM_EXISTING_PATH}")"
  app_id="$(printf '%s' "${src_json}" | jq -r '.data.data.app_id')"
  private_key="$(printf '%s' "${src_json}" | jq -r '.data.data.private_key')"
  [ -n "${app_id}" ] && [ "${app_id}" != "null" ] || { echo "source has no app_id" >&2; exit 1; }
  [ -n "${private_key}" ] && [ "${private_key}" != "null" ] || { echo "source has no private_key" >&2; exit 1; }
  vault kv put "${KV_MOUNT}/${APP_PATH}" app_id="${app_id}" private_key="${private_key}"
else
  # Explicit App ID + PEM file.
  : "${GITOPS_APP_ID:?set GITOPS_APP_ID (App ID 3926776 for the shared bot) or FROM_EXISTING_PATH}"
  : "${GITOPS_APP_PRIVATE_KEY_FILE:?set GITOPS_APP_PRIVATE_KEY_FILE (path to the App .pem) or FROM_EXISTING_PATH}"
  [ -f "$GITOPS_APP_PRIVATE_KEY_FILE" ] || { echo "no such key file: $GITOPS_APP_PRIVATE_KEY_FILE" >&2; exit 1; }
  vault kv put "${KV_MOUNT}/${APP_PATH}" \
    app_id="${GITOPS_APP_ID}" \
    private_key=@"${GITOPS_APP_PRIVATE_KEY_FILE}" \
    || vault kv put "${KV_MOUNT}/${APP_PATH}" \
         app_id="${GITOPS_APP_ID}" \
         private_key="$(cat "${GITOPS_APP_PRIVATE_KEY_FILE}")"
fi

# Verify shape without printing the private key.
vault kv get -format=json "${KV_MOUNT}/${APP_PATH}" \
  | { command -v jq >/dev/null && jq '{keys:(.data.data|keys), app_id:.data.data.app_id, private_key_length:(.data.data.private_key|length)}' || cat; }

echo
echo "next: cd terraform/vault/github-actions/envs/k3s && terraform apply   # creates the role+policy"
