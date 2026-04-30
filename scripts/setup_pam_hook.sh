#!/bin/bash
# setup_pam_hook.sh - Deploy the vault sync hook to a target server
# Usage: sudo ./setup_pam_hook.sh <VAULT_URL> <AGENT_TOKEN>

set -e

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <VAULT_URL> <AGENT_TOKEN>"
    exit 1
fi

VAULT_URL=$1
AGENT_TOKEN=$2

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

echo "Installing Vault System PAM hook..."

# 1. Create config directory
mkdir -p /etc/vault-system
cat > /etc/vault-system/hook.conf <<EOF
VAULT_URL="${VAULT_URL}"
AGENT_TOKEN="${AGENT_TOKEN}"
EOF
chmod 600 /etc/vault-system/hook.conf

# 2. Install the hook script
HOOK_SRC="$(dirname "$0")/vault-sync-hook.sh"
if [ ! -f "$HOOK_SRC" ]; then
    # If not local, assume it's in the same dir as the current script
    HOOK_SRC="./vault-sync-hook.sh"
fi

cp "$HOOK_SRC" /usr/local/bin/vault-sync-hook.sh
chmod +x /usr/local/bin/vault-sync-hook.sh

# 3. Configure PAM
# We add it to common-password. We use 'optional' so it doesn't break passwd if vault is down.
# 'expose_authtok' passes the password to stdin.
PAM_FILE="/etc/pam.d/common-password"
HOOK_LINE="password optional pam_exec.so expose_authtok quiet /usr/local/bin/vault-sync-hook.sh"

# Always remove any existing hook lines to ensure proper placement
sed -i '/vault-sync-hook.sh/d' "$PAM_FILE"

if grep -q "pam_unix.so" "$PAM_FILE"; then
    # Insert the hook before pam_unix.so
    sed -i "/pam_unix.so/i $HOOK_LINE" "$PAM_FILE"
    echo "Inserted hook before pam_unix.so in $PAM_FILE"
else
    # Fallback if pam_unix.so is not found
    echo "$HOOK_LINE" >> "$PAM_FILE"
    echo "Added hook to $PAM_FILE"
fi

echo "Vault System PAM hook setup complete."
echo "Note: Ensure this server can reach ${VAULT_URL}"
