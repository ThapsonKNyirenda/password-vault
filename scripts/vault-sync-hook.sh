#!/bin/bash -p
# Vault System - PAM Interception Hook
# This script is called by pam_exec to sync password changes to the central vault.

LOG_FILE="/var/log/vault-sync-hook.log"
exec >> "$LOG_FILE" 2>&1
echo "=== Vault Sync Hook Executed at $(date) ==="
echo "User: $PAM_USER, Server: $(hostname), EUID: $EUID"
echo "PAM Environment:"
env | grep PAM_
echo "----------------"
# Config path (to be populated by setup script)
CONFIG_FILE="/etc/vault-system/hook.conf"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Vault sync hook error: Configuration file $CONFIG_FILE not found." >&2
    exit 0 # We exit 0 to avoid blocking the password change if the vault is misconfigured
fi

# Load config
source "$CONFIG_FILE"

# PAM provides PAM_USER environment variable
if [ -z "$PAM_USER" ]; then
    echo "Vault sync hook error: PAM_USER not set." >&2
    exit 0
fi

# Dump open file descriptors
echo "Open File Descriptors:"
ls -l /proc/$$/fd/

# Read the new password from stdin using Python to avoid any bash stream issues
# We also log the exact hex dump of what we received
echo "Reading STDIN..."
RAW_HEX=$(python3 -c "import sys; data = sys.stdin.read(); print(data.encode('utf-8').hex() if data else 'EMPTY')")
echo "Raw STDIN hex: $RAW_HEX"

NEW_PASS=$(python3 -c "import sys; print(sys.stdin.read().strip())" <<< "$(echo -n "$RAW_HEX" | xxd -r -p)")

if [ -z "$NEW_PASS" ] || [ "$RAW_HEX" = "EMPTY" ]; then
    echo "Hook exiting early: STDIN is completely empty!"
    exit 0
fi

echo "Successfully read NEW_PASS. Length: ${#NEW_PASS}"
SERVER_NAME=$(hostname)

# We use Python to securely build JSON without escaping issues,
# as passwords can contain any special character (quotes, backslashes).
if command -v python3 >/dev/null 2>&1; then
    PAYLOAD=$(python3 -c "import sys, json; print(json.dumps({
        'server_name': sys.argv[1],
        'managed_account': sys.argv[2],
        'password': sys.argv[3]
    }))" "$SERVER_NAME" "$PAM_USER" "$NEW_PASS")
else
    # Fallback to jq if python3 is not available
    if command -v jq >/dev/null 2>&1; then
        PAYLOAD=$(jq -n --arg sn "$SERVER_NAME" --arg ma "$PAM_USER" --arg pw "$NEW_PASS" '{"server_name": $sn, "managed_account": $ma, "password": $pw}')
    else
        # Fragile fallback if neither is available
        ESCAPED_PASS=$(echo "$NEW_PASS" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
        PAYLOAD="{\"server_name\":\"${SERVER_NAME}\",\"managed_account\":\"${PAM_USER}\",\"password\":\"${ESCAPED_PASS}\"}"
    fi
fi

# Send to Vault API
# We capture the full response and HTTP status for debugging
echo "Sending POST request to ${VAULT_URL}/api/v1/agent/credentials/sync-by-account"
CURL_OUT=$(curl -s -w "\nHTTP_STATUS:%{http_code}" --connect-timeout 5 -m 10 -X POST "${VAULT_URL}/api/v1/agent/credentials/sync-by-account" \
     -H "Authorization: Bearer ${AGENT_TOKEN}" \
     -H "Content-Type: application/json" \
     -d "$PAYLOAD")

CURL_EXIT=$?
echo "Curl exit code: $CURL_EXIT"
echo "Curl output: $CURL_OUT"

if [ $CURL_EXIT -eq 0 ] && echo "$CURL_OUT" | grep -q "HTTP_STATUS:200"; then
    echo "Vault sync successful for user ${PAM_USER} on ${SERVER_NAME}."
else
    echo "Vault sync failed for user ${PAM_USER} on ${SERVER_NAME}." >&2
fi

exit 0
