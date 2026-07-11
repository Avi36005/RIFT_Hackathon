from __future__ import annotations
"""
Buddies — add buddy + list buddies.
POST /buddies/add             — add a buddy (kicks off handshake)
GET  /buddies?screen_name=    — get buddy list with presence/verified/warning
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Agent, BuddyRelation
from app.crypto import public_key_fingerprint

router = APIRouter(prefix="/buddies", tags=["buddies"])


class AddBuddyRequest(BaseModel):
    agent: str       # screen_name of the adder
    buddy: str       # screen_name of the buddy to add


@router.post("/add")
async def add_buddy(req: AddBuddyRequest, db: AsyncSession = Depends(get_session)):
    """Add a buddy (creates unverified relation)."""
    # Find both
    agent_r = await db.execute(select(Agent).where(Agent.screen_name == req.agent))
    agent = agent_r.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, f"Agent '{req.agent}' not found")

    buddy_r = await db.execute(select(Agent).where(Agent.screen_name == req.buddy))
    buddy = buddy_r.scalar_one_or_none()
    if not buddy:
        raise HTTPException(404, f"Agent '{req.buddy}' not found")

    # Check if already exists
    existing = await db.execute(
        select(BuddyRelation).where(
            BuddyRelation.agent_id == agent.id,
            BuddyRelation.buddy_id == buddy.id,
        )
    )
    if existing.scalar_one_or_none():
        return {"status": "already_added", "message": f"{req.buddy} is already in buddy list"}

    # Create unverified relation
    br = BuddyRelation(agent_id=agent.id, buddy_id=buddy.id, verified=False)
    db.add(br)
    await db.commit()

    return {"status": "added", "message": f"{req.buddy} added to buddy list (unverified)"}


@router.get("")
async def get_buddies(screen_name: str, db: AsyncSession = Depends(get_session)):
    """Get buddy list with presence, verified flag, and warning level."""
    agent_r = await db.execute(select(Agent).where(Agent.screen_name == screen_name))
    agent = agent_r.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, f"Agent '{screen_name}' not found")

    # Get buddy relations
    br_result = await db.execute(
        select(BuddyRelation).where(BuddyRelation.agent_id == agent.id)
    )
    relations = br_result.scalars().all()

    buddies = []
    for rel in relations:
        buddy_r = await db.execute(select(Agent).where(Agent.id == rel.buddy_id))
        buddy = buddy_r.scalar_one_or_none()
        if buddy:
            buddies.append({
                "screenName": buddy.screen_name,
                "status": buddy.status.value if buddy.status else "offline",
                "verified": rel.verified,
                "warningLevel": buddy.warning_level,
                "awayMessage": buddy.away_message,
                "publicKeyFingerprint": public_key_fingerprint(buddy.public_key),
            })

    return {"buddies": buddies}
