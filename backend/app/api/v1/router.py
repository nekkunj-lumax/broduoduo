"""Aggregate v1 API router."""

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    auth,
    customers,
    groups,
    orders,
    payments,
    products,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(products.router)
api_router.include_router(groups.router)
api_router.include_router(orders.router)
api_router.include_router(payments.router)
api_router.include_router(customers.router)
api_router.include_router(admin.router)
