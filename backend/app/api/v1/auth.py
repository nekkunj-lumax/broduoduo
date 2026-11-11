"""Authentication endpoints."""

from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)
from app.schemas.common import MessageResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=dict)
async def register(data: RegisterRequest, db: DbSession):
    service = AuthService(db)
    user, tokens = await service.register(data)
    return {"user": UserOut.model_validate(user), "tokens": tokens}


@router.post("/login", response_model=dict)
async def login(data: LoginRequest, db: DbSession):
    service = AuthService(db)
    user, tokens = await service.login(data)
    return {"user": UserOut.model_validate(user), "tokens": tokens}


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: DbSession):
    service = AuthService(db)
    return await service.refresh(data.refresh_token)


@router.post("/logout", response_model=MessageResponse)
async def logout(_: CurrentUser):
    return MessageResponse(message="Logged out")


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return UserOut.model_validate(user)
