from app.services.encryption_service import EnvelopeCipher


def test_encrypt_decrypt_roundtrip() -> None:
    cipher = EnvelopeCipher("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    plaintext = "VerySecretPassword!23"

    encrypted = cipher.encrypt_secret(plaintext)
    decrypted = cipher.decrypt_secret(
        ciphertext=encrypted.ciphertext,
        ciphertext_nonce=encrypted.ciphertext_nonce,
        encrypted_dek=encrypted.encrypted_dek,
        encrypted_dek_nonce=encrypted.encrypted_dek_nonce,
    )

    assert decrypted == plaintext


def test_encrypt_is_non_deterministic() -> None:
    cipher = EnvelopeCipher("MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")

    a = cipher.encrypt_secret("same-value")
    b = cipher.encrypt_secret("same-value")

    assert a.ciphertext != b.ciphertext
