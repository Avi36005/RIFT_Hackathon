"""
BuddyNet Messenger — FastAPI entry point.
Wires all routers: registry, handshake, buddies, presence, reputation, negotiation, seed.
"""

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# Import DB init + models so tables are registered
from app.db import init_db
import app.models  # noqa: F401

# Import routers
from app.registry import router as registry_router
from app.handshake import router as handshake_router
from app.buddies import router as buddies_router
from app.presence import router as presence_router
from app.reputation import router as reputation_router
from app.negotiation import router as negotiation_router
from app.seed import router as seed_router


# ---------------------------------------------------------------------------
# Lifespan — create tables on startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="BuddyNet Messenger",
    description="AIM-style trust infrastructure for AI agents — identity, trust, and moderation",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Wire routers
# ---------------------------------------------------------------------------

app.include_router(registry_router)
app.include_router(handshake_router)
app.include_router(buddies_router)
app.include_router(presence_router)
app.include_router(reputation_router)
app.include_router(negotiation_router)
app.include_router(seed_router)


# ---------------------------------------------------------------------------
# Root health check
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {
        "service": "BuddyNet Messenger",
        "status": "ok",
        "endpoints": [
            "/agents", "/handshake", "/buddies",
            "/presence", "/moderation", "/deals",
            "/seed", "/demo/verify", "/demo/run",
        ],
    }
