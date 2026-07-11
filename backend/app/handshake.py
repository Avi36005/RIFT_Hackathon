from __future__ import annotations
"""
Handshake — cryptographic identity verification (the core mechanic).
POST /handshake/initiate  — generate nonce challenge
POST /handshake/respond   — verify signature over nonce
GET  /handshake/{id}      — check challenge status
"""

from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Agent, BuddyRelation, HandshakeChallenge, HandshakeStatus
from app.crypto import generate_nonce, verify_signature, public_key_fingerprint
from app.presence import broadcast_to

router = APIRouter(prefix="/handshake", tags=["handshake"])

CHALLENGE_EXPIRY_SECONDS = 60


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class InitiateRequest(BaseModel):
    from_screen_name: str
    to_screen_name: str


class RespondRequest(BaseModel):
    challenge_id: str
    signature: str   # base64-encoded Ed25519 signature over the nonce


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/initiate")
async def initiate_handshake(req: InitiateRequest, db: AsyncSession = Depends(get_session)):
    """Start a handshake: server generates a nonce challenge for the target agent."""
    # Look up both agents
    from_result = await db.execute(
        select(Agent).where(Agent.screen_name == req.from_screen_name)
    )
    from_agent = from_result.scalar_one_or_none()
    if not from_agent:
        raise HTTPException(404, f"Agent '{req.from_screen_name}' not found")

    to_result = await db.execute(
        select(Agent).where(Agent.screen_name == req.to_screen_name)
    )
    to_agent = to_result.scalar_one_or_none()
    if not to_agent:
        raise HTTPException(404, f"Agent '{req.to_screen_name}' not found")

    # Generate nonce
    nonce = generate_nonce()

    challenge = HandshakeChallenge(
        from_agent=from_agent.id,
        to_agent=to_agent.id,
        nonce=nonce,
        status=HandshakeStatus.pending,
    )
    db.add(challenge)
    await db.commit()
    await db.refresh(challenge)

    return {
        "challenge_id": challenge.id,
        "nonce": nonce,
        "from_screen_name": req.from_screen_name,
        "to_screen_name": req.to_screen_name,
        "status": "pending",
    }


@router.post("/respond")
async def respond_handshake(req: RespondRequest, db: AsyncSession = Depends(get_session)):
    """Respond to a handshake challenge with a signature over the nonce."""
    # Load challenge
    result = await db.execute(
        select(HandshakeChallenge).where(HandshakeChallenge.id == req.challenge_id)
    )
    challenge = result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(404, "Challenge not found")

    if challenge.status != HandshakeStatus.pending:
        raise HTTPException(400, f"Challenge already {challenge.status.value}")

    # Check expiry
    now = datetime.now(timezone.utc)
    if challenge.issued_at:
        issued = challenge.issued_at
        if issued.tzinfo is None:
            issued = issued.replace(tzinfo=timezone.utc)
        if (now - issued).total_seconds() > CHALLENGE_EXPIRY_SECONDS:
            challenge.status = HandshakeStatus.expired
            await db.commit()
            raise HTTPException(410, "Challenge expired")

    # Load the target agent's public key
    to_result = await db.execute(
        select(Agent).where(Agent.id == challenge.to_agent)
    )
    to_agent = to_result.scalar_one_or_none()
    if not to_agent:
        raise HTTPException(404, "Target agent not found")

    from_result = await db.execute(
        select(Agent).where(Agent.id == challenge.from_agent)
    )
    from_agent = from_result.scalar_one_or_none()

    # VERIFY the signature over the nonce
    nonce_bytes = challenge.nonce.encode()
    valid = verify_signature(to_agent.public_key, nonce_bytes, req.signature)

    challenge.responded_at = now
    fingerprint = public_key_fingerprint(to_agent.public_key)

    if valid:
        challenge.status = HandshakeStatus.verified

        # Create / update buddy relation (both directions)
        for (aid, bid) in [(challenge.from_agent, challenge.to_agent),
                           (challenge.to_agent, challenge.from_agent)]:
            br_result = await db.execute(
                select(BuddyRelation).where(
                    BuddyRelation.agent_id == aid,
                    BuddyRelation.buddy_id == bid,
                )
            )
            br = br_result.scalar_one_or_none()
            if br:
                br.verified = True
                br.verified_at = now
            else:
                db.add(BuddyRelation(
                    agent_id=aid,
                    buddy_id=bid,
                    verified=True,
                    verified_at=now,
                ))

        await db.commit()

        # Broadcast verification update
        await broadcast_to(from_agent.screen_name, {
            "type": "verification_complete",
            "buddy": to_agent.screen_name,
            "verified": True,
            "fingerprint": fingerprint,
        })
        await broadcast_to(to_agent.screen_name, {
            "type": "verification_complete",
            "buddy": from_agent.screen_name,
            "verified": True,
            "fingerprint": public_key_fingerprint(from_agent.public_key),
        })

        return {
            "challenge_id": challenge.id,
            "status": "verified",
            "message": f"✓ Identity Verified — {to_agent.screen_name} is cryptographically bound to key {fingerprint}",
            "fingerprint": fingerprint,
            "verified": True,
        }
    else:
        challenge.status = HandshakeStatus.failed
        await db.commit()

        return {
            "challenge_id": challenge.id,
            "status": "failed",
            "message": f"✗ Verification failed — signature does not match key {fingerprint}",
            "fingerprint": fingerprint,
            "verified": False,
        }


@router.get("/{challenge_id}")
async def get_challenge_status(challenge_id: str, db: AsyncSession = Depends(get_session)):
    """Poll challenge status (for the verify modal)."""
    result = await db.execute(
        select(HandshakeChallenge).where(HandshakeChallenge.id == challenge_id)
    )
    challenge = result.scalar_one_or_none()
    if not challenge:
        raise HTTPException(404, "Challenge not found")

    return {
        "challenge_id": challenge.id,
        "status": challenge.status.value,
        "nonce": challenge.nonce,
        "issued_at": str(challenge.issued_at),
        "responded_at": str(challenge.responded_at) if challenge.responded_at else None,
    }
