# Vault Agent Synchronization System

This document outlines the implementation of the native Go PAM module and the workflow for onboarding new target servers into the Vault System.

## Architecture

The system uses a custom-built **Linux PAM (Pluggable Authentication Module)** written in Go to reliably intercept plaintext passwords during the `passwd` process.

### Components
1. **`pam_module.c`**: A C bridge that implements the standard PAM entry points (`pam_sm_chauthtok`). It ensures compatibility with the Linux PAM API.
2. **`pam_vault.go`**: The core logic. When a password change is detected, it captures the `PAM_USER` and `PAM_AUTHTOK` (plaintext password) and sends them to the Vault API via an authenticated background HTTP request.
3. **Vault API (`/agent/sync-by-account`)**: Receives the sync request, validates the Agent Token, and updates the encrypted credential record for the matching server and account.

---

## Onboarding a New Target Server

Follow these steps to synchronize a new Linux server with the Vault.

### 1. Vault System Registration (Admin UI)
1. **Register/Identify Agent**: Ensure an Agent is registered for the server's network/site.
2. **Create Target Server**: 
   - Add the server in the Admin Dashboard.
   - **Important**: The "Name" field must exactly match the output of the `hostname` command on the target VM.
3. **Create Credential**: Register the managed account (e.g., `root`, `admin`) and provide the current password.

### 2. Agent Module Installation & Configuration
On the target server:

1. **Transfer Sources**: Copy `pam_vault.go`, `pam_module.c`, `go.mod`, and `setup.sh` to a directory (e.g., `~/pam-vault`) on the VM.
2. **Run the Setup Script**:
   ```bash
   cd ~/pam-vault
   chmod +x setup.sh
   sudo ./setup.sh
   ```
   The script will:
   - Install system dependencies (`golang-go`, `libpam0g-dev`, `gcc`).
   - Build the `pam_vault.so` module.
   - Install it to the system security directory.
   - Prompt for your **Vault URL** and **Agent Token**.
   - Create and secure `/etc/vault-system/hook.conf`.
   - Automatically activate the module in `/etc/pam.d/common-password`.

---

## Verification and Monitoring

### Logs
The module logs directly to the system syslog with the tag `pam_vault`. You can monitor interception and sync status with:
```bash
sudo journalctl -t pam_vault -f
```

### Testing the Sync
1. Run `passwd` on the target machine.
2. Complete the password change.
3. Check the logs for `pam_vault: intercepted password change for user ...`.
4. Refresh the Vault Admin Dashboard and use the **Reveal** button to verify the password matches.
