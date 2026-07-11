from __future__ import annotations
"""
Negotiation — AI agent deal orchestration (the load-bearing AI).
POST /deals/start  — start a gated negotiation between two agents
GET  /deals/{id}   — get deal status + transcript
GET  /deals        — list all deals
"""

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session, async_session
from app.models import Agent, BuddyRelation, Deal, DealStatus
from app.reputation import check_can_deal
from app.agents.llm import llm_chat, llm_json
from app.agents.personas import get_scenario
from app.presence import broadcast_to, broadcast_all

router = APIRouter(prefix="/deals", tags=["deals"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class DealStartRequest(BaseModel):
    initiator: str       # screen_name
    counterparty: str    # screen_name
    scenario: str = "buy_api_access"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/start")
async def start_deal(req: DealStartRequest, db: AsyncSession = Depends(get_session)):
    """
    Start a gated negotiation between two AI agents.
    GATES: both must be mutually verified buddies + pass reputation policy.
    """
    # Load agents
    init_result = await db.execute(
        select(Agent).where(Agent.screen_name == req.initiator)
    )
    initiator = init_result.scalar_one_or_none()
    if not initiator:
        raise HTTPException(404, f"Agent '{req.initiator}' not found")

    cp_result = await db.execute(
        select(Agent).where(Agent.screen_name == req.counterparty)
    )
    counterparty = cp_result.scalar_one_or_none()
    if not counterparty:
        raise HTTPException(404, f"Agent '{req.counterparty}' not found")

    # GATE 1: Mutual verification check
    fwd = await db.execute(
        select(BuddyRelation).where(
            BuddyRelation.agent_id == initiator.id,
            BuddyRelation.buddy_id == counterparty.id,
            BuddyRelation.verified == True,
        )
    )
    rev = await db.execute(
        select(BuddyRelation).where(
            BuddyRelation.agent_id == counterparty.id,
            BuddyRelation.buddy_id == initiator.id,
            BuddyRelation.verified == True,
        )
    )
    if not fwd.scalar_one_or_none() or not rev.scalar_one_or_none():
        raise HTTPException(
            403,
            f"Identity not verified. Both agents must complete mutual handshake verification first."
        )

    # GATE 2: Reputation policy
    can_init, msg1 = check_can_deal(initiator.warning_level, is_initiator=True)
    if not can_init:
        raise HTTPException(403, f"{req.initiator}: {msg1}")

    can_cp, msg2 = check_can_deal(counterparty.warning_level, is_initiator=False)
    if not can_cp:
        raise HTTPException(403, f"{req.counterparty}: {msg2}")

    # Create deal
    deal = Deal(
        initiator=initiator.id,
        counterparty=counterparty.id,
        scenario=req.scenario,
        status=DealStatus.negotiating,
        transcript=[],
    )
    db.add(deal)
    await db.commit()
    await db.refresh(deal)

    # Broadcast deal start
    await broadcast_all({
        "type": "deal_start",
        "deal_id": deal.id,
        "initiator": req.initiator,
        "counterparty": req.counterparty,
        "scenario": req.scenario,
    })

    # Run negotiation in background
    asyncio.create_task(_run_negotiation(
        deal.id, req.initiator, req.counterparty, req.scenario
    ))

    return {
        "deal_id": deal.id,
        "status": "negotiating",
        "initiator": req.initiator,
        "counterparty": req.counterparty,
        "scenario": req.scenario,
    }


@router.get("/{deal_id}")
async def get_deal(deal_id: str, db: AsyncSession = Depends(get_session)):
    """Get deal status and transcript."""
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(404, "Deal not found")

    # Resolve screen names
    init_r = await db.execute(select(Agent).where(Agent.id == deal.initiator))
    cp_r = await db.execute(select(Agent).where(Agent.id == deal.counterparty))
    init_agent = init_r.scalar_one_or_none()
    cp_agent = cp_r.scalar_one_or_none()

    return {
        "deal_id": deal.id,
        "initiator": init_agent.screen_name if init_agent else deal.initiator,
        "counterparty": cp_agent.screen_name if cp_agent else deal.counterparty,
        "scenario": deal.scenario,
        "status": deal.status.value,
        "terms": deal.terms,
        "transcript": deal.transcript or [],
    }


@router.get("")
async def list_deals(db: AsyncSession = Depends(get_session)):
    """List all deals."""
    result = await db.execute(select(Deal))
    deals = result.scalars().all()

    items = []
    for d in deals:
        init_r = await db.execute(select(Agent).where(Agent.id == d.initiator))
        cp_r = await db.execute(select(Agent).where(Agent.id == d.counterparty))
        init_a = init_r.scalar_one_or_none()
        cp_a = cp_r.scalar_one_or_none()
        items.append({
            "deal_id": d.id,
            "initiator": init_a.screen_name if init_a else d.initiator,
            "counterparty": cp_a.screen_name if cp_a else d.counterparty,
            "scenario": d.scenario,
            "status": d.status.value,
        })

    return {"deals": items}


# ---------------------------------------------------------------------------
# Negotiation loop (runs in background)
# ---------------------------------------------------------------------------

async def _run_negotiation(deal_id: str, buyer_name: str, seller_name: str, scenario_key: str):
    """
    Turn-based negotiation between two LLM agents.
    Messages stream into the chat window via WebSocket.
    """
    scenario = get_scenario(scenario_key)
    buyer_config = scenario["buyer"]
    seller_config = scenario["seller"]
    max_turns = scenario.get("max_turns", 8)

    transcript = []
    buyer_messages = [{"role": "system", "content": buyer_config["system_prompt"]}]
    seller_messages = [{"role": "system", "content": seller_config["system_prompt"]}]

    # Opening context
    opening = f"You're about to negotiate: {scenario['description']}. Start the conversation."
    buyer_messages.append({"role": "user", "content": opening})

    try:
        for turn in range(max_turns):
            # Buyer's turn (odd turns) or seller starts responding
            if turn == 0:
                # Buyer opens
                response = await llm_chat(buyer_messages, temperature=0.7, max_tokens=200)
                sender = buyer_name
                buyer_messages.append({"role": "assistant", "content": response})
                seller_messages.append({"role": "user", "content": response})
            elif turn % 2 == 1:
                # Seller responds
                response = await llm_chat(seller_messages, temperature=0.7, max_tokens=200)
                sender = seller_name
                seller_messages.append({"role": "assistant", "content": response})
                buyer_messages.append({"role": "user", "content": response})
            else:
                # Buyer responds
                response = await llm_chat(buyer_messages, temperature=0.7, max_tokens=200)
                sender = buyer_name
                buyer_messages.append({"role": "assistant", "content": response})
                seller_messages.append({"role": "user", "content": response})

            ts = datetime.now(timezone.utc).isoformat()
            entry = {"sender": sender, "text": response, "ts": ts}
            transcript.append(entry)

            # Broadcast message via WebSocket
            await broadcast_all({
                "type": "deal_message",
                "deal_id": deal_id,
                "sender": sender,
                "text": response,
                "timestamp": ts,
                "turn": turn + 1,
                "max_turns": max_turns,
            })

            # Small delay for "live typing" feel
            await asyncio.sleep(1.5)

        # --- Structured close ---
        close_messages = [
            {"role": "system", "content": "You are a neutral deal analysis AI."},
            {"role": "user", "content": (
                "Here is the negotiation transcript:\n\n" +
                "\n".join(f"{e['sender']}: {e['text']}" for e in transcript) +
                "\n\n" + scenario.get("close_prompt", "Extract agreed terms as JSON.")
            )},
        ]
        terms = await llm_json(close_messages, temperature=0.2)

        # Update deal in DB
        async with async_session() as db:
            result = await db.execute(select(Deal).where(Deal.id == deal_id))
            deal = result.scalar_one_or_none()
            if deal:
                deal.transcript = transcript
                deal.terms = terms
                deal.status = DealStatus.completed if terms.get("agreed") else DealStatus.failed
                await db.commit()

        # Broadcast deal complete
        await broadcast_all({
            "type": "deal_complete",
            "deal_id": deal_id,
            "status": "completed" if terms.get("agreed") else "failed",
            "terms": terms,
            "transcript": transcript,
        })

    except Exception as e:
        print(f"[Negotiation] Error: {e}")
        # Mark deal as failed
        async with async_session() as db:
            result = await db.execute(select(Deal).where(Deal.id == deal_id))
            deal = result.scalar_one_or_none()
            if deal:
                deal.transcript = transcript
                deal.status = DealStatus.failed
                deal.terms = {"error": str(e)}
                await db.commit()

        await broadcast_all({
            "type": "deal_complete",
            "deal_id": deal_id,
            "status": "failed",
            "error": str(e),
        })
