import json
from pathlib import Path


def load_password_source(path: str) -> dict[str, str]:
    source_path = Path(path)
    if not source_path.is_file():
        raise FileNotFoundError(f"Password source file not found: {source_path}")

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
