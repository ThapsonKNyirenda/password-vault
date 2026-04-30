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

### 2. Agent Module Installation
On the target server:
1. **Transfer Sources**: Copy `pam_vault.go`, `pam_module.c`, and `go.mod` (if any) to the VM.
2. **Build the Module**:
   ```bash
   go build -buildmode=c-shared -o pam_vault.so .
   ```
3. **Install the Binary**:
   ```bash
   sudo cp pam_vault.so /lib/x86_64-linux-gnu/security/
   sudo chmod 644 /lib/x86_64-linux-gnu/security/pam_vault.so
   ```

### 3. Agent Configuration
1. **Create Config Directory**:
   ```bash
   sudo mkdir -p /etc/vault-system
   ```
2. **Create `hook.conf`**:
   ```bash
   sudo nano /etc/vault-system/hook.conf
   ```
   Add the following content:
   ```ini
   VAULT_URL=http://<vault-ip>:8000
   AGENT_TOKEN=<your-agent-api-token>
   ```
3. **Secure the File**:
   ```bash
   sudo chmod 600 /etc/vault-system/hook.conf
   ```

### 4. Activate PAM Integration
1. Edit the common password PAM configuration:
   ```bash
   sudo nano /etc/pam.d/common-password
   ```
2. Add the following line at the very end of the file:
   ```text
   password optional pam_vault.so
   ```

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
