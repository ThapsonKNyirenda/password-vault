#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from pathlib import Path


OPSADMIN_HOME = Path("/home/opsadmin")
OPSADMIN_SSH_DIR = OPSADMIN_HOME / ".ssh"
AUTHORIZED_KEYS = OPSADMIN_SSH_DIR / "authorized_keys"
SUDOERS_FILE = Path("/etc/sudoers.d/opsadmin-chpasswd")


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def user_exists(username: str) -> bool:
    return subprocess.run(["id", "-u", username], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


def ensure_user(username: str) -> None:
    if user_exists(username):
        return
    run(["useradd", "-m", "-s", "/bin/bash", username])


def configure_ssh(public_key_path: Path) -> None:
    OPSADMIN_SSH_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    shutil.copyfile(public_key_path, AUTHORIZED_KEYS)
    AUTHORIZED_KEYS.chmod(0o600)
    run(["chown", "-R", "opsadmin:opsadmin", str(OPSADMIN_SSH_DIR)])


def configure_sudoers() -> None:
    SUDOERS_FILE.write_text("opsadmin ALL=(ALL) NOPASSWD: /usr/sbin/chpasswd\n", encoding="utf-8")
    SUDOERS_FILE.chmod(0o440)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bootstrap a Unix target host for local-agent password rotation.",
    )
    parser.add_argument(
        "public_key",
        type=Path,
        help="Path to the SSH public key used by the local agent connection account",
    )
    return parser.parse_args()


def main() -> None:
    if os.geteuid() != 0:
        raise SystemExit("This script must be run as root (use sudo).")

    args = parse_args()
    public_key = args.public_key.resolve()
    if not public_key.is_file():
        raise SystemExit(f"Public key not found: {public_key}")

    ensure_user("opsadmin")
    ensure_user("svc_app")
    configure_ssh(public_key)
    configure_sudoers()

    print("Target host bootstrap complete.")


if __name__ == "__main__":
    main()
