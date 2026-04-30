import secrets
import string


SYMBOLS = "!@#$%^&*()-_=+"


def generate_password(length: int = 24) -> str:
    if length < 16:
        raise ValueError("Password length must be at least 16 characters")

    alphabet = string.ascii_letters + string.digits + SYMBOLS
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(ch.islower() for ch in candidate)
            and any(ch.isupper() for ch in candidate)
            and any(ch.isdigit() for ch in candidate)
            and any(ch in SYMBOLS for ch in candidate)
        ):
            return candidate
