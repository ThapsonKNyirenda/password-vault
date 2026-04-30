import base64
import os
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


@dataclass(slots=True)
class EncryptedSecret:
    ciphertext: str
    ciphertext_nonce: str
    encrypted_dek: str
    encrypted_dek_nonce: str


class EnvelopeCipher:
    def __init__(self, master_key_b64: str) -> None:
        master_key = base64.b64decode(master_key_b64)
        if len(master_key) != 32:
            raise ValueError("VAULT_MASTER_KEY must decode to 32 bytes")
        self._master_aes = AESGCM(master_key)

    @staticmethod
    def _b64(data: bytes) -> str:
        return base64.b64encode(data).decode("ascii")

    @staticmethod
    def _from_b64(data: str) -> bytes:
        return base64.b64decode(data.encode("ascii"))

    def encrypt_secret(self, plaintext: str) -> EncryptedSecret:
        dek = os.urandom(32)
        dek_nonce = os.urandom(12)
        encrypted_dek = self._master_aes.encrypt(dek_nonce, dek, None)

        data_nonce = os.urandom(12)
        data_aes = AESGCM(dek)
        ciphertext = data_aes.encrypt(data_nonce, plaintext.encode("utf-8"), None)

        return EncryptedSecret(
            ciphertext=self._b64(ciphertext),
            ciphertext_nonce=self._b64(data_nonce),
            encrypted_dek=self._b64(encrypted_dek),
            encrypted_dek_nonce=self._b64(dek_nonce),
        )

    def decrypt_secret(
        self,
        ciphertext: str,
        ciphertext_nonce: str,
        encrypted_dek: str,
        encrypted_dek_nonce: str,
    ) -> str:
        dek = self._master_aes.decrypt(
            self._from_b64(encrypted_dek_nonce),
            self._from_b64(encrypted_dek),
            None,
        )
        data_aes = AESGCM(dek)
        plaintext = data_aes.decrypt(
            self._from_b64(ciphertext_nonce),
            self._from_b64(ciphertext),
            None,
        )
        return plaintext.decode("utf-8")
