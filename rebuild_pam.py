import pexpect

IP = "192.168.240.134"
USER = "clientvm1"
PASSWORD = "Thapson@1234"

def main():
    # Step 1: Push both updated source files to VM
    print("Pushing updated sources to VM...")
    for fname in ["pam_vault.go", "pam_module.c"]:
        scp = pexpect.spawn(
            f"scp -o StrictHostKeyChecking=no "
            f"services/agent/pam-vault/{fname} {USER}@{IP}:~/pam-vault/{fname}",
            timeout=30, encoding=None,
        )
        idx = scp.expect([b"password:", b"100%", pexpect.EOF, pexpect.TIMEOUT])
        if idx == 0:
            scp.sendline(PASSWORD.encode())
            scp.expect([b"100%", pexpect.EOF], timeout=30)
        scp.wait()
        print(f"  ✓ {fname}")
    print("Files pushed.")

    # Step 2: SSH, rebuild, reinstall
    print("Connecting via SSH...")
    ssh = pexpect.spawn(
        f"ssh -o StrictHostKeyChecking=no {USER}@{IP}",
        timeout=30, encoding=None,
    )
    idx = ssh.expect([b"password:", b"\\$"], timeout=30)
    if idx == 0:
        ssh.sendline(PASSWORD.encode())
        ssh.expect(b"\\$", timeout=30)
    print("Connected.")

    def run(cmd, timeout=300):
        print(f"\n>>> {cmd}")
        ssh.sendline(cmd.encode())
        while True:
            idx = ssh.expect(
                [rb"\$ ", rb"# ", rb"\[sudo\] password", rb"Password:"],
                timeout=timeout,
            )
            out = ssh.before.decode("utf-8", errors="replace")
            if out.strip():
                print(out)
            if idx < 2:
                break
            print("(sudo prompt — sending password)")
            ssh.sendline(PASSWORD.encode())

    # Rebuild — use '.' to include pam_module.c in the build
    run("cd ~/pam-vault && go build -buildmode=c-shared -o pam_vault.so .")

    # Check build succeeded
    run("ls -lh ~/pam-vault/pam_vault.so")

    # Install
    run("sudo cp ~/pam-vault/pam_vault.so /lib/x86_64-linux-gnu/security/pam_vault.so")
    run("sudo chmod 644 /lib/x86_64-linux-gnu/security/pam_vault.so")
    run("ls -lh /lib/x86_64-linux-gnu/security/pam_vault.so")

    print("\n" + "=" * 60)
    print("Build and install complete!")
    print("Run 'passwd' on the VM to test.")
    print("Check logs: sudo journalctl -t pam_vault -f")
    print("=" * 60)

    ssh.sendline(b"exit")
    ssh.expect(pexpect.EOF, timeout=10)

if __name__ == "__main__":
    main()
