#!/bin/bash

# setup.sh - Unified setup script for the Vault System PAM Agent
# This script automates the installation of dependencies, building the module,
# and configuring the system for password synchronization.

set -e

# --- Configuration ---
CONFIG_DIR="/etc/vault-system"
CONFIG_FILE="$CONFIG_DIR/hook.conf"
PAM_CONFIG_FILE="/etc/pam.d/common-password"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 1. Root check
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root. Try: sudo $0"
fi

# 2. Dependency Check & Installation
log "Checking and installing dependencies (Go, PAM headers, GCC)..."
if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq
    apt-get install -y golang-go libpam0g-dev gcc -qq
elif command -v yum >/dev/null 2>&1; then
    yum install -y golang pam-devel gcc
else
    log "Warning: Unknown package manager. Please ensure Go and PAM headers are installed manually."
fi

# 3. Locate PAM security directory
log "Locating PAM security directory..."
SEC_DIR=""
for dir in "/usr/lib/x86_64-linux-gnu/security" "/lib/x86_64-linux-gnu/security" "/lib64/security" "/lib/security"; do
    if [ -d "$dir" ]; then
        SEC_DIR="$dir"
        break
    fi
done

if [ -z "$SEC_DIR" ]; then
    error "Could not locate PAM security directory. Please install libpam-modules or equivalent."
fi
log "Using security directory: $SEC_DIR"

# 4. Get Configuration (Environment variables or Interactive)
if [ -z "$VAULT_URL" ]; then
    read -p "Enter Vault URL (e.g., http://192.168.1.100:8000): " VAULT_URL
fi

if [ -z "$AGENT_TOKEN" ]; then
    read -p "Enter Agent API Token: " AGENT_TOKEN
fi

if [ -z "$VAULT_URL" ] || [ -z "$AGENT_TOKEN" ]; then
    error "VAULT_URL and AGENT_TOKEN are required for configuration."
fi

# 5. Build the module
log "Building PAM module (pam_vault.so)..."
# Ensure we are in the directory containing the source files
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "pam_vault.go" ] || [ ! -f "pam_module.c" ]; then
    error "Source files (pam_vault.go, pam_module.c) not found in $SCRIPT_DIR"
fi

go build -buildmode=c-shared -o pam_vault.so .
success "Build complete."

# 6. Install the binary
log "Installing binary to $SEC_DIR/pam_vault.so"
cp pam_vault.so "$SEC_DIR/pam_vault.so"
chmod 644 "$SEC_DIR/pam_vault.so"

# 7. Configure hook.conf
log "Creating configuration in $CONFIG_FILE..."
mkdir -p "$CONFIG_DIR"
cat <<EOF > "$CONFIG_FILE"
# Vault System Agent Configuration
VAULT_URL=$VAULT_URL
AGENT_TOKEN=$AGENT_TOKEN
EOF
chmod 600 "$CONFIG_FILE"
success "Configuration secured."

# 8. Activate PAM Integration
log "Activating module in $PAM_CONFIG_FILE..."
if [ -f "$PAM_CONFIG_FILE" ]; then
    if ! grep -q "pam_vault.so" "$PAM_CONFIG_FILE"; then
        # Add to the end of the file as an optional module
        echo "password optional pam_vault.so" >> "$PAM_CONFIG_FILE"
        success "Added pam_vault.so to $PAM_CONFIG_FILE"
    else
        log "pam_vault.so already present in $PAM_CONFIG_FILE"
    fi
else
    log "Warning: $PAM_CONFIG_FILE not found. Please manually add 'password optional pam_vault.so' to your PAM configuration."
fi

# 9. Summary and Verification
echo -e "\n${GREEN}==============================================${NC}"
echo -e "${GREEN}    Vault System Agent Setup Complete!        ${NC}"
echo -e "${GREEN}==============================================${NC}"
log "To verify the installation:"
log "1. Monitor logs:  sudo journalctl -t pam_vault -f"
log "2. Test sync:     Run 'passwd' and check if the password updates in the Vault UI."
log "3. Verify config: cat $CONFIG_FILE"
echo -e "${GREEN}==============================================${NC}\n"
