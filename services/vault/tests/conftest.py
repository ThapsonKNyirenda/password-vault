import os
from pathlib import Path

from sqlalchemy import text


TEST_DB_PATH = Path("/tmp/vault_tracking_test.sqlite3")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["VAULT_MASTER_KEY"] = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
os.environ["JWT_SECRET"] = "test-jwt-secret"
os.environ["AGENT_TOKEN"] = ""

from fastapi.testclient import TestClient
import pytest

from app.bootstrap.seed import ensure_seed_identities, init_schema
from app.db.session import Base, engine
from app.main import app


@pytest.fixture
def client() -> TestClient:
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
    init_schema()
    ensure_seed_identities()
    with TestClient(app) as test_client:
        yield test_client
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
