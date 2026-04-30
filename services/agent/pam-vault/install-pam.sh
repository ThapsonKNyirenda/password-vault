#!/bin/bash
set -e

# Ensure dependencies are installed
if ! command -v go >/dev/null 2>&1; then
    echo "Error: 'go' is not installed."
    echo "Please run: sudo apt-get update && sudo apt-get install -y golang-go libpam0g-dev"
    exit 1
fi

if [ ! -f /usr/include/security/pam_appl.h ]; then
    echo "Error: PAM development headers are missing."
    echo "Please run: sudo apt-get update && sudo apt-get install -y libpam0g-dev"
    exit 1
fi

echo "Building pam_vault.so..."
go build -buildmode=c-shared -o pam_vault.so .

echo "Build successful. Installing to /lib/x86_64-linux-gnu/security/..."
sudo cp pam_vault.so /lib/x86_64-linux-gnu/security/
sudo chmod 644 /lib/x86_64-linux-gnu/security/pam_vault.so

echo "Module installed."
echo ""
echo "To enable this module, you need to edit your PAM configuration."
echo "For example, in Ubuntu/Debian, edit /etc/pam.d/common-password"
echo "Add the following line BEFORE the pam_unix.so line, or at the end:"
echo "password optional pam_vault.so"
echo ""
echo "Make sure /etc/vault-system/hook.conf is correctly configured and readable."
echo "Installation complete."
