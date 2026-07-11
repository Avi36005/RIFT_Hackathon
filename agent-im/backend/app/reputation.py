from __future__ import annotations
"""
Reputation / Moderation — warning system with throttle/block policy.
POST /moderation/warn           — file a warning
GET  /moderation/{screen_name}  — current level + history
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Agent, WarningReport
from app.presence import broadcast_all

router = APIRouter(prefix="/moderation", tags=["moderation"])


# ---------------------------------------------------------------------------
# Policy thresholds
# ---------------------------------------------------------------------------

POLICY_LIMITED = 50   # Can't initiate deals
POLICY_BLOCKED = 80   # Can't deal or verify


def get_policy_status(warning_level: int) -> str:
    """Return the moderation status for a given warning level."""
    if warning_level >= POLICY_BLOCKED:
        return "blocked"
    elif warning_level >= POLICY_LIMITED:
        return "limited"
    return "normal"


def check_can_deal(warning_level: int, is_initiator: bool = False) -> tuple[bool, str]:
    """Check if an agent can participate in a deal."""
    if warning_level >= POLICY_BLOCKED:
        return False, "Agent is blocked (warning level ≥ 80%)"
    if warning_level >= POLICY_LIMITED and is_initiator:
        return False, "Agent is limited (warning level ≥ 50%) — cannot initiate deals"
    return True, "ok"


def check_can_verify(warning_level: int) -> tuple[bool, str]:
    """Check if an agent can verify identity."""
    if warning_level >= POLICY_BLOCKED:
        return False, "Agent is blocked (warning level ≥ 80%) — cannot verify"
    return True, "ok"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class WarnRequest(BaseModel):
    reporter: str | None = None  # screen name of reporter (optional)
    subject: str                 # screen name being warned
    reason: str
    weight: int = 10


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/warn")
async def warn_agent(req: WarnRequest, db: AsyncSession = Depends(get_session)):
    """File a warning against an agent. Raises their warning level."""
    # Find subject
    subject_result = await db.execute(
        select(Agent).where(Agent.screen_name == req.subject)
    )
    subject = subject_result.scalar_one_or_none()
    if not subject:
        raise HTTPException(404, f"Agent '{req.subject}' not found")

    # Find reporter (optional)
    reporter_id = None
    if req.reporter:
        reporter_result = await db.execute(
            select(Agent).where(Agent.screen_name == req.reporter)
        )
        reporter = reporter_result.scalar_one_or_none()
        if reporter:
            reporter_id = reporter.id

    # Create warning report
    report = WarningReport(
        reporter=reporter_id,
        subject=subject.id,
        reason=req.reason,
        weight=req.weight,
    )
    db.add(report)

    # Raise warning level (cap at 100)
    subject.warning_level = min(100, subject.warning_level + req.weight)
    policy_status = get_policy_status(subject.warning_level)

    await db.commit()

    # Broadcast warning update
    await broadcast_all({
        "type": "warning",
        "screen_name": req.subject,
        "warning_level": subject.warning_level,
        "policy_status": policy_status,
        "reason": req.reason,
        "reporter": req.reporter,
    })

    return {
        "screen_name": req.subject,
        "warning_level": subject.warning_level,
        "policy_status": policy_status,
        "message": f"Warning filed. {req.subject}'s warning level is now {subject.warning_level}%.",
    }


@router.get("/{screen_name}")
async def get_moderation(screen_name: str, db: AsyncSession = Depends(get_session)):
    """Get current warning level and report history."""
    result = await db.execute(
        select(Agent).where(Agent.screen_name == screen_name)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, f"Agent '{screen_name}' not found")

    # Get reports
    reports_result = await db.execute(
        select(WarningReport).where(WarningReport.subject == agent.id)
    )
    reports = reports_result.scalars().all()

    return {
        "screen_name": screen_name,
        "warning_level": agent.warning_level,
        "policy_status": get_policy_status(agent.warning_level),
        "reports": [
            {
                "reason": r.reason,
                "weight": r.weight,
                "created_at": str(r.created_at),
            }
            for r in reports
        ],
    }
