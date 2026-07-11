"""
BuddyNet Messenger — FastAPI entry point.
Phase 1: skeleton with CORS, DB init, and placeholder routes.
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
    description="AIM-style trust infrastructure for AI agents",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health / placeholder routes
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {"service": "BuddyNet Messenger", "status": "ok"}


@app.get("/agents")
async def list_agents():
    """Placeholder — will be replaced by registry module in Phase 2."""
    return {"agents": []}


@app.get("/agents/{screen_name}")
async def get_agent(screen_name: str):
    return {"error": "not implemented yet"}
