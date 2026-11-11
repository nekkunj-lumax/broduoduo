"""Authentication and user registration service."""

from datetime import datetime, timezone
import secrets
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import AppError, ConflictError, NotFoundError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    safe_decode_token,
    verify_password,
)
from app.models.referral import Referral
from app.models.user import Role, User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse


def _generate_referral_code() -> str:
    return secrets.token_urlsafe(8)[:12].upper()


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: RegisterRequest) -> tuple[User, TokenResponse]:
        existing = await self.db.execute(select(User).where(User.email == data.email.lower()))
        if existing.scalar_one_or_none():
            raise ConflictError("Email already registered")

        referred_by_id: Optional[UUID] = None
        if data.referral_code:
            ref_user = await self.db.execute(
                select(User).where(User.referral_code == data.referral_code.upper())
            )
            referrer = ref_user.scalar_one_or_none()
            if referrer:
                referred_by_id = referrer.id

        customer_role = await self.db.execute(select(Role).where(Role.name == "customer"))
        role = customer_role.scalar_one_or_none()
        if role is None:
            role = Role(name="customer", description="Customer account")
            self.db.add(role)
            await self.db.flush()

        user = User(
            email=data.email.lower(),
            password_hash=hash_password(data.password),
            first_name=data.first_name,
            last_name=data.last_name,
            phone=data.phone,
            referral_code=_generate_referral_code(),
            referred_by_id=referred_by_id,
            is_email_verified=True,
        )
        user.roles.append(role)
        self.db.add(user)
        await self.db.flush()

        if referred_by_id:
            self.db.add(
                Referral(
                    referrer_id=referred_by_id,
                    referred_user_id=user.id,
                    referral_code=data.referral_code.upper(),
                    status="registered",
                )
            )

        tokens = self._issue_tokens(user)
        return user, tokens

    async def login(self, data: LoginRequest) -> tuple[User, TokenResponse]:
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.roles))
            .where(User.email == data.email.lower())
        )
        user = result.scalar_one_or_none()
        if user is None or not verify_password(data.password, user.password_hash):
            raise AppError("Invalid email or password", status_code=401, code="invalid_credentials")
        if not user.is_active:
            raise AppError("Account is inactive", status_code=403, code="inactive")

        user.last_login_at = datetime.now(timezone.utc)
        tokens = self._issue_tokens(user)
        return user, tokens

    async def refresh(self, refresh_token: str) -> TokenResponse:
        payload = safe_decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise AppError("Invalid refresh token", status_code=401, code="invalid_token")
        user_id = UUID(payload["sub"])
        result = await self.db.execute(
            select(User).options(selectinload(User.roles)).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if user is None or not user.is_active:
            raise NotFoundError("User not found")
        return self._issue_tokens(user)

    def _issue_tokens(self, user: User) -> TokenResponse:
        roles = [r.name for r in user.roles]
        access = create_access_token(user.id, extra_claims={"roles": roles, "email": user.email})
        refresh = create_refresh_token(user.id)
        return TokenResponse(access_token=access, refresh_token=refresh)
