import logging
import time
from collections.abc import Iterable

from .client import VaultClient
from .config import get_settings
from .executors import UnixSSHExecutor, load_password_source
from .models import (
    AgentCredentialAssignment,
    AgentCredentialSyncResponse,
    AgentRevealCredentialResponse,
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [local-agent] %(message)s",
)
logger = logging.getLogger("local-agent")


def sync_assignments(
    client: VaultClient,
    executor: UnixSSHExecutor,
    assignments: Iterable[AgentCredentialAssignment],
    password_source: dict[str, str],
    last_pushed_passwords: dict[str, str],
    applied_versions: dict[str, int],
) -> None:
    for assignment in assignments:
        # --- 1. Push local changes TO Vault ---
        password = password_source.get(assignment.credential_id)
        if password:
            cached_password = last_pushed_passwords.get(assignment.credential_id)
            if cached_password != password:
                try:
                    result = AgentCredentialSyncResponse.model_validate(
                        client.sync_credential(assignment.credential_id, password)
                    )
                    last_pushed_passwords[assignment.credential_id] = password
                    applied_versions[assignment.credential_id] = result.version
                    logger.info(
                        "pushed credential change for %s version=%s",
                        assignment.managed_account,
                        result.version,
                    )
                except Exception as exc:
                    logger.error("Failed to push credential %s: %s", assignment.credential_id, exc)

        # --- 2. Pull Vault changes FROM Admin and apply TO Server ---
        # We only apply if the last sync was from Admin and the version is newer than what we've applied
        last_applied_version = applied_versions.get(assignment.credential_id, 0)

        # Optimization: if we just started, we assume the server has the version reported by the vault
        # unless it was JUST changed by an admin.
        if last_applied_version == 0:
            applied_versions[assignment.credential_id] = assignment.version
            last_applied_version = assignment.version

        if (
            assignment.last_sync_source == "admin"
            and assignment.version > last_applied_version
        ):
            logger.info(
                "Admin update detected for %s@%s. Version %s > %s",
                assignment.managed_account,
                assignment.server_name,
                assignment.version,
                last_applied_version,
            )
            try:
                # Reveal the password
                reveal_data = AgentRevealCredentialResponse.model_validate(
                    client.reveal_credential(assignment.credential_id)
                )

                # Apply to server
                success = executor.apply_password(
                    host=reveal_data.server_host,
                    port=reveal_data.server_port,
                    connection_user=reveal_data.connection_username,
                    managed_account=reveal_data.managed_account,
                    new_password=reveal_data.password,
                )

                if success:
                    applied_versions[assignment.credential_id] = assignment.version
                    # We also update last_pushed_passwords to avoid pushing this back to the vault
                    last_pushed_passwords[assignment.credential_id] = reveal_data.password
            except Exception as exc:
                logger.error("Failed to apply admin update for %s: %s", assignment.credential_id, exc)


def run() -> None:
    settings = get_settings()
    client = VaultClient(settings)
    executor = UnixSSHExecutor(settings.agent_unix_ssh_key_path)
    last_pushed_passwords: dict[str, str] = {}
    applied_versions: dict[str, int] = {}

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
                sync_assignments(
                    client,
                    executor,
                    assignments,
                    password_source,
                    last_pushed_passwords,
                    applied_versions,
                )
            except Exception as exc:
                logger.exception("agent sync loop error: %s", exc)

            time.sleep(settings.poll_interval_seconds)
    finally:
        client.close()


if __name__ == "__main__":
    run()
