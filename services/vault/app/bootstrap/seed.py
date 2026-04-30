from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_agent_token, hash_password
from app.db.migrations import upgrade_database
from app.db.session import SessionLocal
from app.domain.models import Agent, User, UserRole


def init_schema() -> None:
    upgrade_database()


def ensure_seed_identities() -> None:
    print("Starting ensure_seed_identities...")
    settings = get_settings()

    with SessionLocal() as db:
        print("Checking admin...")
        admin = db.scalar(select(User).where(User.username == settings.default_admin_username))
        if admin is None:
            print("Adding admin...")
            db.add(
                User(
                    username=settings.default_admin_username,
                    password_hash=hash_password(settings.default_admin_password),
                    role=UserRole.ADMIN,
                    active=True,
                )
            )

        print("Checking engineer...")
        engineer = db.scalar(select(User).where(User.username == "engineer"))
        if engineer is None:
            print("Adding engineer...")
            db.add(
                User(
                    username="engineer",
                    password_hash=hash_password("EngineerChangeMe!123"),
                    role=UserRole.ENGINEER,
                    active=True,
                )
            )

        print("Checking auditor...")
        auditor = db.scalar(select(User).where(User.username == "auditor"))
        if auditor is None:
            print("Adding auditor...")
            db.add(
                User(
                    username="auditor",
                    password_hash=hash_password("AuditorChangeMe!123"),
                    role=UserRole.AUDITOR,
                    active=True,
                )
            )

        if settings.bootstrap_agent_token:
            print("Checking agent...")
            existing_agent = db.scalar(select(Agent).where(Agent.name == settings.bootstrap_agent_name))
            if existing_agent is None:
                print("Adding agent...")
                db.add(
                    Agent(
                        name=settings.bootstrap_agent_name,
                        site=settings.bootstrap_agent_site,
                        token_hash=hash_agent_token(settings.bootstrap_agent_token),
                        active=True,
                    )
                )

        print("Committing db...")
        db.commit()
        print("Finished ensure_seed_identities!")


def main() -> None:
    init_schema()
    ensure_seed_identities()


if __name__ == "__main__":
    main()
