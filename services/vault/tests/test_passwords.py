from app.services.password_service import SYMBOLS, generate_password


def test_generated_password_matches_complexity() -> None:
    pwd = generate_password(24)

    assert len(pwd) == 24
    assert any(ch.islower() for ch in pwd)
    assert any(ch.isupper() for ch in pwd)
    assert any(ch.isdigit() for ch in pwd)
    assert any(ch in SYMBOLS for ch in pwd)
