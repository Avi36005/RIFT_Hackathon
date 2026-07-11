from __future__ import annotations
"""
Presence — online/away/busy/offline status + WebSocket hub.
POST /presence          — set status + away message
GET  /presence/{name}   — get status
WS   /ws/{screen_name}  — realtime channel for live updates
"""

import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Agent, AgentStatus

router = APIRouter(tags=["presence"])


# ---------------------------------------------------------------------------
# In-memory WebSocket hub
# ---------------------------------------------------------------------------

# screen_name -> set of WebSocket connections
_connections: dict[str, set[WebSocket]] = {}
# Global broadcast subscribers (for the UI to watch all events)
_global_subscribers: set[WebSocket] = set()


async def broadcast_to(screen_name: str, data: dict):
    """Send a message to all WebSocket connections for a given screen name."""
    if screen_name in _connections:
        dead = set()
        for ws in _connections[screen_name]:
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        _connections[screen_name] -= dead

    # Also broadcast to global subscribers
    dead = set()
    for ws in _global_subscribers:
        try:
            await ws.send_json(data)
        except Exception:
            dead.add(ws)
    _global_subscribers.difference_update(dead)


async def broadcast_all(data: dict):
    """Broadcast to ALL connected agents + global subscribers."""
    all_names = list(_connections.keys())
    for name in all_names:
        await broadcast_to(name, data)
    # Global subscribers are already covered by broadcast_to


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PresenceUpdate(BaseModel):
    screen_name: str
    status: str  # online / away / busy / offline
    away_message: str | None = None


# ---------------------------------------------------------------------------
# REST routes
# ---------------------------------------------------------------------------

@router.post("/presence")
async def set_presence(req: PresenceUpdate, db: AsyncSession = Depends(get_session)):
    """Set agent status and away message."""
    result = await db.execute(
        select(Agent).where(Agent.screen_name == req.screen_name)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, f"Agent '{req.screen_name}' not found")

    try:
        agent.status = AgentStatus(req.status)
    except ValueError:
        raise HTTPException(400, f"Invalid status: {req.status}")

    agent.away_message = req.away_message
    await db.commit()

    # Broadcast presence change
    await broadcast_all({
        "type": "presence",
        "screen_name": req.screen_name,
        "status": req.status,
        "away_message": req.away_message,
    })

    return {"screen_name": req.screen_name, "status": req.status}


@router.get("/presence/{screen_name}")
async def get_presence(screen_name: str, db: AsyncSession = Depends(get_session)):
    result = await db.execute(
        select(Agent).where(Agent.screen_name == screen_name)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, f"Agent '{screen_name}' not found")

    return {
        "screen_name": agent.screen_name,
        "status": agent.status.value if agent.status else "offline",
        "away_message": agent.away_message,
    }


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/{screen_name}")
async def ws_endpoint(websocket: WebSocket, screen_name: str):
    """Realtime channel: pushes presence changes, IMs, deal messages, warnings."""
    await websocket.accept()

    if screen_name not in _connections:
        _connections[screen_name] = set()
    _connections[screen_name].add(websocket)

    try:
        while True:
            # Keep connection alive; handle incoming messages if needed
            data = await websocket.receive_text()
            # Clients can send messages through WS too
            try:
                msg = json.loads(data)
                # Handle direct IM messages
                if msg.get("type") == "im":
                    target = msg.get("to")
                    if target:
                        await broadcast_to(target, {
                            "type": "im",
                            "from": screen_name,
                            "to": target,
                            "text": msg.get("text", ""),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        })
                        # Echo back to sender
                        await broadcast_to(screen_name, {
                            "type": "im_sent",
                            "from": screen_name,
                            "to": target,
                            "text": msg.get("text", ""),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        })
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        if screen_name in _connections:
            _connections[screen_name].discard(websocket)
            if not _connections[screen_name]:
                del _connections[screen_name]


@router.websocket("/ws/global")
async def ws_global(websocket: WebSocket):
    """Global WebSocket — receives ALL events (for the UI observer)."""
    await websocket.accept()
    _global_subscribers.add(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep alive
    except WebSocketDisconnect:
        pass
    finally:
        _global_subscribers.discard(websocket)
