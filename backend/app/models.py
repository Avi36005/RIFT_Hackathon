"""
SQLAlchemy ORM models for BuddyNet Messenger.
Matches the data model spec from the build prompt §5.
"""

import uuid
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Enum, JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.db import Base


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class AgentStatus(str, enum.Enum):
    online = "online"
    away = "away"
    busy = "busy"
    offline = "offline"


class HandshakeStatus(str, enum.Enum):
    pending = "pending"
    verified = "verified"
    failed = "failed"
    expired = "expired"


class DealStatus(str, enum.Enum):
    proposed = "proposed"
    negotiating = "negotiating"
    accepted = "accepted"
    failed = "failed"
    completed = "completed"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Agent(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True, default=_uuid)
    screen_name = Column(String, unique=True, index=True, nullable=False)
    public_key = Column(Text, nullable=False)          # PEM / base64 Ed25519
    owner = Column(String, nullable=False, default="system")
    status = Column(Enum(AgentStatus), default=AgentStatus.offline)
    away_message = Column(String, nullable=True)
    warning_level = Column(Integer, default=0)          # 0–100
    created_at = Column(DateTime, default=_now)

    # relationships
    buddies = relationship(
        "BuddyRelation",
        foreign_keys="BuddyRelation.agent_id",
        back_populates="agent",
    )


class BuddyRelation(Base):
    __tablename__ = "buddy_relations"
    __table_args__ = (UniqueConstraint("agent_id", "buddy_id"),)

    id = Column(String, primary_key=True, default=_uuid)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=False)
    buddy_id = Column(String, ForeignKey("agents.id"), nullable=False)
    verified = Column(Boolean, default=False)
    verified_at = Column(DateTime, nullable=True)

    agent = relationship("Agent", foreign_keys=[agent_id], back_populates="buddies")
    buddy = relationship("Agent", foreign_keys=[buddy_id])


class HandshakeChallenge(Base):
    __tablename__ = "handshake_challenges"

    id = Column(String, primary_key=True, default=_uuid)
    from_agent = Column(String, ForeignKey("agents.id"), nullable=False)
    to_agent = Column(String, ForeignKey("agents.id"), nullable=False)
    nonce = Column(String, nullable=False)               # base64-encoded 32 random bytes
    status = Column(Enum(HandshakeStatus), default=HandshakeStatus.pending)
    issued_at = Column(DateTime, default=_now)
    responded_at = Column(DateTime, nullable=True)

    from_agent_rel = relationship("Agent", foreign_keys=[from_agent])
    to_agent_rel = relationship("Agent", foreign_keys=[to_agent])


class Deal(Base):
    __tablename__ = "deals"

    id = Column(String, primary_key=True, default=_uuid)
    initiator = Column(String, ForeignKey("agents.id"), nullable=False)
    counterparty = Column(String, ForeignKey("agents.id"), nullable=False)
    scenario = Column(String, default="buy_api_access")
    status = Column(Enum(DealStatus), default=DealStatus.proposed)
    terms = Column(JSON, nullable=True)
    transcript = Column(JSON, default=list)               # [{sender, text, ts}]
    created_at = Column(DateTime, default=_now)

    initiator_rel = relationship("Agent", foreign_keys=[initiator])
    counterparty_rel = relationship("Agent", foreign_keys=[counterparty])


class WarningReport(Base):
    __tablename__ = "warning_reports"

    id = Column(String, primary_key=True, default=_uuid)
    reporter = Column(String, ForeignKey("agents.id"), nullable=True)
    subject = Column(String, ForeignKey("agents.id"), nullable=False)
    reason = Column(String, nullable=False)
    weight = Column(Integer, default=10)
    created_at = Column(DateTime, default=_now)

    reporter_rel = relationship("Agent", foreign_keys=[reporter])
    subject_rel = relationship("Agent", foreign_keys=[subject])
