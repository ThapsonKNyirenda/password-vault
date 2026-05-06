import json
import logging
import subprocess
from pathlib import Path


logger = logging.getLogger("local-agent")


def load_password_source(path: str) -> dict[str, str]:
    source_path = Path(path)
    if not source_path.is_file():
        # During development, we might not have the source file yet
        logger.warning(f"Password source file not found: {source_path}")
        return {}

    raw = json.loads(source_path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("Password source file must be a JSON object keyed by credential_id")

    passwords: dict[str, str] = {}
    for credential_id, password in raw.items():
        if not isinstance(credential_id, str) or not credential_id.strip():
            raise ValueError("Password source file contains an invalid credential_id key")
        if not isinstance(password, str):
            raise ValueError(f"Password source for {credential_id} must be a string")
        passwords[credential_id] = password

    return passwords


class UnixSSHExecutor:
    def __init__(self, ssh_key_path: str):
        self.ssh_key_path = ssh_key_path

    def apply_password(
        self,
        host: str,
        port: int,
        connection_user: str,
        managed_account: str,
        new_password: str,
    ) -> bool:
        # Command to update password on the remote server
        # We use chpasswd which reads from stdin
        remote_cmd = "sudo chpasswd"
        stdin_content = f"{managed_account}:{new_password}\n"

        ssh_cmd = [
            "ssh",
            "-i",
            self.ssh_key_path,
            "-p",
            str(port),
            "-o",
            "BatchMode=yes",
            "-o",
            "StrictHostKeyChecking=no",
            f"{connection_user}@{host}",
            remote_cmd,
        ]

        logger.info("Attempting to apply password for %s@%s via SSH", managed_account, host)
        try:
            subprocess.run(ssh_cmd, input=stdin_content, capture_output=True, text=True, check=True)
            logger.info("Successfully updated password for %s on %s", managed_account, host)
            return True
        except subprocess.CalledProcessError as e:
            logger.error("Failed to update password for %s on %s: %s", managed_account, host, e.stderr)
            return False
        except Exception as e:
            logger.error("Unexpected error updating password for %s on %s: %s", managed_account, host, str(e))
            return False
