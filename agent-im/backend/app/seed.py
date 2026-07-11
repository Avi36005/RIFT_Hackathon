from __future__ import annotations
"""
Seed script + "Run Demo" endpoint.
Sets up demo agents, signs them on, adds buddies, and can trigger the full demo flow.
"""

import asyncio

from fastapi import APIRouter, Depends
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session, async_session, init_db
from app.models import (
    Agent, BuddyRelation, HandshakeChallenge, Deal, WarningReport, AgentStatus,
)
from app.agents.runner import create_agent_keypair, sign_nonce, has_key
from app.crypto import (
    generate_nonce, verify_signature, public_key_fingerprint, issue_credential,
)
from app.presence import broadcast_all

router = APIRouter(tags=["seed"])


async def _seed_agents(db: AsyncSession):
    """Create the demo agents with real Ed25519 keypairs."""
    agents_config = [
        {"screen_name": "AgentBuyer42", "owner": "demo"},
        {"screen_name": "DataSeller_X", "owner": "demo"},
        {"screen_name": "APIBroker99", "owner": "demo"},
    ]

    created = []
    for cfg in agents_config:
        # Check if exists
        existing = await db.execute(
            select(Agent).where(Agent.screen_name == cfg["screen_name"])
        )
        agent = existing.scalar_one_or_none()

        if agent:
            # Re-create keypair in memory if not present
            if not has_key(cfg["screen_name"]):
                pub_pem, priv_pem = create_agent_keypair(cfg["screen_name"])
                agent.public_key = pub_pem
            agent.status = AgentStatus.online
            agent.warning_level = 0
            agent.away_message = None
        else:
            pub_pem, priv_pem = create_agent_keypair(cfg["screen_name"])
            agent = Agent(
                screen_name=cfg["screen_name"],
                public_key=pub_pem,
                owner=cfg["owner"],
                status=AgentStatus.online,
            )
            db.add(agent)

        created.append(cfg["screen_name"])

    await db.commit()
    return created


async def _setup_buddies(db: AsyncSession):
    """Add all agents as buddies of each other (unverified)."""
    result = await db.execute(select(Agent))
    agents = result.scalars().all()

    for a in agents:
        for b in agents:
            if a.id == b.id:
                continue
            existing = await db.execute(
                select(BuddyRelation).where(
                    BuddyRelation.agent_id == a.id,
                    BuddyRelation.buddy_id == b.id,
                )
            )
            if not existing.scalar_one_or_none():
                db.add(BuddyRelation(agent_id=a.id, buddy_id=b.id, verified=False))

    await db.commit()


@router.post("/seed")
async def seed(db: AsyncSession = Depends(get_session)):
    """Seed the demo — create agents, set online, add as buddies."""
    created = await _seed_agents(db)
    await _setup_buddies(db)

    # Broadcast presence
    for name in created:
        await broadcast_all({
            "type": "presence",
            "screen_name": name,
            "status": "online",
        })

    return {
        "status": "seeded",
        "agents": created,
        "message": "Demo agents created and online. Buddy relations set up.",
    }


@router.post("/seed/reset")
async def seed_reset(db: AsyncSession = Depends(get_session)):
    """Reset the entire database — clean slate for a fresh demo."""
    # Delete all data in reverse dependency order
    await db.execute(delete(WarningReport))
    await db.execute(delete(Deal))
    await db.execute(delete(HandshakeChallenge))
    await db.execute(delete(BuddyRelation))
    await db.execute(delete(Agent))
    await db.commit()

    # Re-seed
    created = await _seed_agents(db)
    await _setup_buddies(db)

    for name in created:
        await broadcast_all({
            "type": "presence",
            "screen_name": name,
            "status": "online",
        })

    return {
        "status": "reset_and_seeded",
        "agents": created,
    }


@router.post("/demo/verify")
async def demo_verify(
    from_name: str = "AgentBuyer42",
    to_name: str = "DataSeller_X",
    imposter: bool = False,
    db: AsyncSession = Depends(get_session),
):
    """
    Run a complete handshake verification (for the demo).
    If imposter=True, signs with the wrong key.
    """
    # Get agents
    from_r = await db.execute(select(Agent).where(Agent.screen_name == from_name))
    from_agent = from_r.scalar_one_or_none()
    to_r = await db.execute(select(Agent).where(Agent.screen_name == to_name))
    to_agent = to_r.scalar_one_or_none()

    if not from_agent or not to_agent:
        return {"error": "Agents not found. Run /seed first."}

    # Step 1: Generate nonce
    nonce = generate_nonce()

    await broadcast_all({
        "type": "handshake_step",
        "step": "challenge_issued",
        "from": from_name,
        "to": to_name,
        "nonce": nonce[:16] + "...",
    })

    await asyncio.sleep(0.8)

    # Step 2: Sign the nonce
    if imposter:
        from app.agents.runner import sign_nonce_with_wrong_key
        signature = sign_nonce_with_wrong_key(to_name, nonce)
    else:
        signature = sign_nonce(to_name, nonce)

    await broadcast_all({
        "type": "handshake_step",
        "step": "signature_received",
        "from": from_name,
        "to": to_name,
    })

    await asyncio.sleep(0.5)

    # Step 3: Verify
    valid = verify_signature(to_agent.public_key, nonce.encode(), signature)
    fingerprint = public_key_fingerprint(to_agent.public_key)

    if valid:
        # Update buddy relations
        from app.models import BuddyRelation
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)

        for (aid, bid) in [(from_agent.id, to_agent.id), (to_agent.id, from_agent.id)]:
            br_r = await db.execute(
                select(BuddyRelation).where(
                    BuddyRelation.agent_id == aid,
                    BuddyRelation.buddy_id == bid,
                )
            )
            br = br_r.scalar_one_or_none()
            if br:
                br.verified = True
                br.verified_at = now
            else:
                db.add(BuddyRelation(agent_id=aid, buddy_id=bid, verified=True, verified_at=now))

        await db.commit()

    await broadcast_all({
        "type": "handshake_step",
        "step": "complete",
        "from": from_name,
        "to": to_name,
        "verified": valid,
        "fingerprint": fingerprint,
        "message": (
            f"✓ Identity Verified — {to_name} is cryptographically bound to key {fingerprint}"
            if valid else
            f"✗ Verification failed — signature does not match key {fingerprint}"
        ),
    })

    return {
        "verified": valid,
        "fingerprint": fingerprint,
        "imposter": imposter,
        "message": (
            f"✓ Identity Verified — {to_name} is cryptographically bound to key {fingerprint}"
            if valid else
            f"✗ Verification failed — signature does not match key {fingerprint}"
        ),
    }


@router.post("/demo/run")
async def demo_run_full(db: AsyncSession = Depends(get_session)):
    """
    Run the complete demo flow:
    1. Seed agents
    2. Verify identity
    3. Start negotiation
    Returns the deal_id so the UI can track it.
    """
    # Step 1: Reset and seed
    await seed_reset(db)

    await asyncio.sleep(1)

    # Step 2: Verify AgentBuyer42 ↔ DataSeller_X
    result = await demo_verify("AgentBuyer42", "DataSeller_X", False, db)

    await asyncio.sleep(1)

    # Step 3: Start negotiation
    from app.negotiation import start_deal
    from pydantic import BaseModel

    class FakeReq:
        initiator = "AgentBuyer42"
        counterparty = "DataSeller_X"
        scenario = "buy_api_access"

    deal_result = await start_deal(FakeReq(), db)

    return {
        "status": "demo_running",
        "verification": result,
        "deal": deal_result,
    }
