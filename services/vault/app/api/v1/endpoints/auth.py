from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.domain.models import User
from app.domain.schemas import LoginRequest, TokenResponse
from app.services.audit_service import record_audit


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.username == payload.username))
    if user is None or not user.active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(subject=str(user.id), role=user.role.value)
    record_audit(
        db,
        actor_type="user",
        actor_id=str(user.id),
        action="login",
        resource_type="user",
        resource_id=str(user.id),
        details={"username": user.username},
    )
    db.commit()

    return TokenResponse(access_token=token, username=user.username, role=user.role)
