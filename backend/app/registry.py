from __future__ import annotations
"""
Agent Registry — identity registration and lookup.
POST /agents/register — register a new agent with screen_name + Ed25519 public key
GET  /agents          — directory listing
GET  /agents/{screen_name} — public profile
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Agent, BuddyRelation
from app.crypto import issue_credential, public_key_fingerprint

router = APIRouter(prefix="/agents", tags=["registry"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    screen_name: str
    public_key: str   # PEM-encoded Ed25519 public key
    owner: str = "system"


class AgentResponse(BaseModel):
    agent_id: str
    screen_name: str
    public_key_fingerprint: str
    status: str
    warning_level: int
    away_message: str | None = None
    created_at: str
    credential: str | None = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/register")
async def register_agent(req: RegisterRequest, db: AsyncSession = Depends(get_session)):
    """Register a new agent — binds screen_name to Ed25519 public key."""
    # Check for duplicate
    existing = await db.execute(
        select(Agent).where(Agent.screen_name == req.screen_name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, f"Screen name '{req.screen_name}' is already taken")

    # Validate public key format
    try:
        fingerprint = public_key_fingerprint(req.public_key)
    except Exception:
        raise HTTPException(400, "Invalid Ed25519 public key PEM")

    agent = Agent(
        screen_name=req.screen_name,
        public_key=req.public_key,
        owner=req.owner,
        status="offline",
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)

    # Issue server-signed credential
    credential = issue_credential(agent.id, agent.screen_name, agent.public_key)

    return {
        "agent_id": agent.id,
        "screen_name": agent.screen_name,
        "public_key_fingerprint": fingerprint,
        "credential": credential,
    }


@router.get("")
async def list_agents(db: AsyncSession = Depends(get_session)):
    """Directory listing of all registered agents."""
    result = await db.execute(select(Agent))
    agents = result.scalars().all()
    return {
        "agents": [
            {
                "agent_id": a.id,
                "screen_name": a.screen_name,
                "status": a.status.value if a.status else "offline",
                "warning_level": a.warning_level,
                "away_message": a.away_message,
                "public_key_fingerprint": public_key_fingerprint(a.public_key),
            }
            for a in agents
        ]
    }


@router.get("/{screen_name}")
async def get_agent(screen_name: str, db: AsyncSession = Depends(get_session)):
    """Public profile for a single agent."""
    result = await db.execute(
        select(Agent).where(Agent.screen_name == screen_name)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, f"Agent '{screen_name}' not found")

    # Count verified buddies
    buddy_result = await db.execute(
        select(BuddyRelation).where(
            BuddyRelation.agent_id == agent.id,
            BuddyRelation.verified == True,
        )
    )
    verified_count = len(buddy_result.scalars().all())

    return {
        "agent_id": agent.id,
        "screen_name": agent.screen_name,
        "status": agent.status.value if agent.status else "offline",
        "warning_level": agent.warning_level,
        "away_message": agent.away_message,
        "public_key_fingerprint": public_key_fingerprint(agent.public_key),
        "verified_buddy_count": verified_count,
    }
