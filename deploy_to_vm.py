import pexpect
import sys
import os

IP = "192.168.240.134"
USER = "clientvm1"
PASSWORD = "Thapson@1234"

# Host machine (vault server) IP and token from .env
VAULT_URL = "http://192.168.240.133:8000"
AGENT_TOKEN = "bootstrap-agent-token-change-me"

PROMPTS = [r"\$ ", r"# "]
SUDO_PROMPTS = PROMPTS + [r"\[sudo\] password", r"Password:"]

def run(child, cmd, timeout=300):
    """Send a command and wait for a shell prompt, handling sudo password prompts."""
    print(f"\n>>> {cmd}")
    child.sendline(cmd)
    while True:
        index = child.expect(SUDO_PROMPTS, timeout=timeout)
        output = child.before.decode("utf-8", errors="replace")
        if output.strip():
            print(output)
        if index < len(PROMPTS):
            # Got shell prompt — command finished
            break
        else:
            # Got sudo password prompt
            print("(sudo password prompt — sending password)")
            child.sendline(PASSWORD)


def main():
    # ── 1. Transfer source files via SCP ─────────────────────────────────────
    print("=" * 60)
    print("Step 1: Transferring pam-vault source files to VM...")
    print("=" * 60)
    scp = pexpect.spawn(
        f"scp -r -o StrictHostKeyChecking=no "
        f"services/agent/pam-vault {USER}@{IP}:~/pam-vault",
        timeout=60,
        encoding=None,
    )
    idx = scp.expect([b"password:", b"100%", pexpect.EOF, pexpect.TIMEOUT])
    if idx == 0:
        scp.sendline(PASSWORD.encode())
        scp.expect([b"100%", pexpect.EOF], timeout=60)
    scp.wait()
    print("Transfer complete.")

    # ── 2. SSH into the VM ───────────────────────────────────────────────────
    print("\nStep 2: Connecting via SSH...")
    ssh = pexpect.spawn(
        f"ssh -o StrictHostKeyChecking=no {USER}@{IP}",
        timeout=30,
        encoding=None,
    )
    idx = ssh.expect([b"password:", b"\\$"], timeout=30)
    if idx == 0:
        ssh.sendline(PASSWORD.encode())
        ssh.expect(b"\\$", timeout=30)
    print("Connected.")

    # From here on, use the text-mode helper
    child = ssh

    # ── 3. Install system dependencies ──────────────────────────────────────
    print("\nStep 3: Installing Go and PAM dev headers...")
    run(child, "sudo apt-get update -y")
    run(child, "sudo apt-get install -y golang-go libpam0g-dev", timeout=600)

    # ── 4. Build pam_vault.so ────────────────────────────────────────────────
    print("\nStep 4: Building pam_vault.so...")
    run(child, "cd ~/pam-vault && go build -buildmode=c-shared -o pam_vault.so pam_vault.go")

    # ── 5. Install the compiled module ───────────────────────────────────────
    print("\nStep 5: Installing pam_vault.so into PAM module directory...")
    run(child, "sudo cp ~/pam-vault/pam_vault.so /lib/x86_64-linux-gnu/security/pam_vault.so")
    run(child, "sudo chmod 644 /lib/x86_64-linux-gnu/security/pam_vault.so")

    # ── 6. Configure PAM stack ───────────────────────────────────────────────
    print("\nStep 6: Configuring /etc/pam.d/common-password...")
    run(child,
        "grep -q pam_vault.so /etc/pam.d/common-password || "
        "sudo sed -i '/pam_unix.so/i password optional pam_vault.so' "
        "/etc/pam.d/common-password")
    run(child, "grep pam_vault /etc/pam.d/common-password")

    # ── 7. Write /etc/vault-system/hook.conf ────────────────────────────────
    print("\nStep 7: Writing vault hook config...")
    run(child, "sudo mkdir -p /etc/vault-system")
    run(child,
        f"printf 'VAULT_URL={VAULT_URL}\\nAGENT_TOKEN={AGENT_TOKEN}\\n' "
        f"| sudo tee /etc/vault-system/hook.conf")
    run(child, "sudo chmod 600 /etc/vault-system/hook.conf")
    run(child, "sudo cat /etc/vault-system/hook.conf")

    # ── Done ─────────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("Deployment complete!")
    print("Run 'passwd' on the VM to test password sync.")
    print("Check /var/log/syslog or 'journalctl -t pam_vault' for logs.")
    print("=" * 60)
    child.sendline(b"exit")
    child.expect(pexpect.EOF, timeout=10)


if __name__ == "__main__":
    main()
