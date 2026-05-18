from app.core.config import get_settings
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.models import Credential, SyncSource, ensure_utc, utcnow
from app.services.encryption_service import EnvelopeCipher


settings = get_settings()
cipher = EnvelopeCipher(settings.vault_master_key)


def decrypt_credential(credential: Credential) -> str:
    return cipher.decrypt_secret(
        ciphertext=credential.ciphertext,
        ciphertext_nonce=credential.ciphertext_nonce,
        encrypted_dek=credential.encrypted_dek,
        encrypted_dek_nonce=credential.encrypted_dek_nonce,
    )


def sync_credential_password(
    credential: Credential,
    *,
    plaintext: str,
    source: SyncSource,
) -> bool:
    current_plaintext = decrypt_credential(credential)
    changed = current_plaintext != plaintext
    now = utcnow()

    if changed:
        encrypted = cipher.encrypt_secret(plaintext)
        credential.ciphertext = encrypted.ciphertext
        credential.ciphertext_nonce = encrypted.ciphertext_nonce
        credential.encrypted_dek = encrypted.encrypted_dek
        credential.encrypted_dek_nonce = encrypted.encrypted_dek_nonce
        credential.version += 1

    credential.last_synced_at = now
    credential.last_sync_source = source
    return changed



