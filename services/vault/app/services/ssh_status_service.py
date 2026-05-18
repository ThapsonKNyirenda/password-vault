from dataclasses import dataclass

from app.domain.models import Credential, ServerOS, TargetServer, utcnow
from app.services.tracking_service import decrypt_credential


@dataclass(frozen=True)
class SshStatusResult:
    ok: bool
    status: str
    message: str


def check_ssh_credential(
    *,
    server: TargetServer,
    credential: Credential,
    timeout_seconds: int = 8,
) -> SshStatusResult:
    if server.os_type != ServerOS.UNIX:
        return SshStatusResult(
            ok=False,
            status="unsupported",
            message="SSH status checks are currently available for UNIX servers only.",
        )

    try:
        import paramiko
    except ImportError:
        return SshStatusResult(
            ok=False,
            status="unavailable",
            message="SSH status checks require the paramiko package to be installed.",
        )

    password = decrypt_credential(credential)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(
            hostname=server.host,
            port=server.port,
            username=credential.managed_account,
            password=password,
            timeout=timeout_seconds,
            auth_timeout=timeout_seconds,
            banner_timeout=timeout_seconds,
            look_for_keys=False,
            allow_agent=False,
        )
        return SshStatusResult(
            ok=True,
            status="active",
            message="SSH login succeeded with the stored credential.",
        )
    except paramiko.AuthenticationException:
        return SshStatusResult(
            ok=False,
            status="authentication_failed",
            message="SSH reached the server, but the stored username or password was rejected.",
        )
    except TimeoutError:
        return SshStatusResult(
            ok=False,
            status="timeout",
            message="SSH connection timed out before authentication completed.",
        )
    except OSError as exc:
        return SshStatusResult(
            ok=False,
            status="connection_failed",
            message=f"SSH could not reach the server: {exc}",
        )
    except paramiko.SSHException as exc:
        return SshStatusResult(
            ok=False,
            status="ssh_error",
            message=f"SSH check failed: {exc}",
        )
    finally:
        client.close()


def ssh_status_checked_at():
    return utcnow()
