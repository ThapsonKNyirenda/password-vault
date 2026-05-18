from contextvars import ContextVar, Token

from fastapi import Request
from sqlalchemy.orm import Session

from app.domain.models import AuditLog


_request_context: ContextVar[Request | None] = ContextVar("audit_request_context", default=None)


def set_audit_request_context(request: Request | None) -> Token[Request | None]:
    return _request_context.set(request)


def reset_audit_request_context(token: Token[Request | None]) -> None:
    _request_context.reset(token)


def _browser_from_user_agent(user_agent: str) -> str:
    if not user_agent:
        return "Unknown"
    if "Edg/" in user_agent:
        return "Microsoft Edge"
    if "OPR/" in user_agent or "Opera/" in user_agent:
        return "Opera"
    if "Chrome/" in user_agent and "Chromium/" not in user_agent:
        return "Google Chrome"
    if "Firefox/" in user_agent:
        return "Mozilla Firefox"
    if "Safari/" in user_agent and "Chrome/" not in user_agent:
        return "Safari"
    return "Unknown"


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",", maxsplit=1)[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return "unknown"


def _request_details() -> dict[str, object]:
    request = _request_context.get()
    if request is None:
        return {}

    user_agent = request.headers.get("user-agent", "")
    return {
        "request": {
            "ip_address": _client_ip(request),
            "user_agent": user_agent or "Unknown",
            "browser": _browser_from_user_agent(user_agent),
            "method": request.method,
            "path": request.url.path,
            "referer": request.headers.get("referer") or None,
        }
    }


def record_audit(
    db: Session,
    *,
    actor_type: str,
    actor_id: str,
    action: str,
    resource_type: str,
    resource_id: str,
    details: dict[str, object] | None = None,
) -> AuditLog:
    event_details = {**(details or {}), **_request_details()}
    event = AuditLog(
        actor_type=actor_type,
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=event_details,
    )
    db.add(event)
    db.flush()
    return event
