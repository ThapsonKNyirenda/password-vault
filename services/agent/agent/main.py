import logging
import time
from collections.abc import Iterable

from .client import VaultClient
from .config import get_settings
from .executors import load_password_source
from .models import AgentCredentialAssignment, AgentCredentialSyncResponse


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [local-agent] %(message)s",
)
logger = logging.getLogger("local-agent")


def sync_assignments(
    client: VaultClient,
    assignments: Iterable[AgentCredentialAssignment],
    password_source: dict[str, str],
    last_pushed_passwords: dict[str, str],
) -> None:
    for assignment in assignments:
        password = password_source.get(assignment.credential_id)
        if password is None:
            logger.warning(
                "password missing for credential_id=%s server=%s account=%s",
                assignment.credential_id,
                assignment.server_name,
                assignment.managed_account,
            )
            continue

        cached_password = last_pushed_passwords.get(assignment.credential_id)
        if cached_password == password:
            continue

        result = AgentCredentialSyncResponse.model_validate(
            client.sync_credential(assignment.credential_id, password)
        )
        last_pushed_passwords[assignment.credential_id] = password
        logger.info(
            "synced credential_id=%s changed=%s version=%s",
            result.credential_id,
            result.changed,
            result.version,
        )


def run() -> None:
    settings = get_settings()
    client = VaultClient(settings)
    last_pushed_passwords: dict[str, str] = {}

    # Validate the local password source at startup so misconfiguration fails fast.
    load_password_source(settings.password_source_file)

    logger.info(
        "agent started name=%s site=%s sync_interval=%ss source=%s",
        settings.agent_name,
        settings.agent_site,
        settings.poll_interval_seconds,
        settings.password_source_file,
    )

    try:
        while True:
            try:
                assignments = [
                    AgentCredentialAssignment.model_validate(item)
                    for item in client.list_assigned_credentials()
                ]
                password_source = load_password_source(settings.password_source_file)
                sync_assignments(client, assignments, password_source, last_pushed_passwords)
            except Exception as exc:
                logger.exception("agent sync loop error: %s", exc)

            time.sleep(settings.poll_interval_seconds)
    finally:
        client.close()


if __name__ == "__main__":
    run()
