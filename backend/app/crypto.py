"""
Ed25519 cryptographic operations for BuddyNet Messenger.
- Server keypair (generated on first boot, persisted to disk)
- Agent keypair generation
- Signing and verification
- Server-issued credentials (signed identity binding)
"""
from __future__ import annotations

import os
import base64
import json
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives import serialization
from cryptography.exceptions import InvalidSignature


# ---------------------------------------------------------------------------
# Key helpers
# ---------------------------------------------------------------------------

def generate_keypair() -> tuple[Ed25519PrivateKey, Ed25519PublicKey]:
    """Generate a fresh Ed25519 keypair."""
    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    return private_key, public_key


def private_key_to_pem(key: Ed25519PrivateKey) -> str:
    return key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()


def public_key_to_pem(key: Ed25519PublicKey) -> str:
    return key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()


def public_key_to_base64(key: Ed25519PublicKey) -> str:
    """Short base64 representation of the raw 32-byte public key."""
    raw = key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return base64.b64encode(raw).decode()


def public_key_fingerprint(pem_str: str) -> str:
    """Return a short fingerprint like 'ED25519:abc123...' from a PEM public key."""
    key = load_public_key(pem_str)
    b64 = public_key_to_base64(key)
    return f"ED25519:{b64[:12]}"


def load_private_key(pem_str: str) -> Ed25519PrivateKey:
    return serialization.load_pem_private_key(pem_str.encode(), password=None)


def load_public_key(pem_str: str) -> Ed25519PublicKey:
    return serialization.load_pem_public_key(pem_str.encode())


# ---------------------------------------------------------------------------
# Sign / verify
# ---------------------------------------------------------------------------

def sign_message(private_key: Ed25519PrivateKey, message: bytes) -> str:
    """Sign a message, return base64-encoded signature."""
    sig = private_key.sign(message)
    return base64.b64encode(sig).decode()


def verify_signature(public_key_pem: str, message: bytes, signature_b64: str) -> bool:
    """Verify an Ed25519 signature. Returns True on valid, False on invalid."""
    try:
        key = load_public_key(public_key_pem)
        sig = base64.b64decode(signature_b64)
        key.verify(sig, message)
        return True
    except (InvalidSignature, Exception):
        return False


# ---------------------------------------------------------------------------
# Server keypair (singleton, generated on first boot)
# ---------------------------------------------------------------------------

_server_private_key: Ed25519PrivateKey | None = None
_server_public_key: Ed25519PublicKey | None = None


def get_server_keypair() -> tuple[Ed25519PrivateKey, Ed25519PublicKey]:
    """Get or generate the server's own Ed25519 keypair."""
    global _server_private_key, _server_public_key
    if _server_private_key is not None:
        return _server_private_key, _server_public_key

    key_path = Path(os.getenv("SERVER_KEYPAIR_PATH", "./server_key.pem"))

    if key_path.exists():
        pem = key_path.read_text()
        _server_private_key = load_private_key(pem)
        _server_public_key = _server_private_key.public_key()
    else:
        _server_private_key, _server_public_key = generate_keypair()
        key_path.write_text(private_key_to_pem(_server_private_key))

    return _server_private_key, _server_public_key


def issue_credential(agent_id: str, screen_name: str, public_key_pem: str) -> str:
    """
    Server signs a credential binding {agent_id, screen_name, public_key}
    so agents can prove their registration is legit.
    """
    server_priv, _ = get_server_keypair()
    payload = json.dumps({
        "agent_id": agent_id,
        "screen_name": screen_name,
        "public_key": public_key_pem,
    }, sort_keys=True).encode()
    return sign_message(server_priv, payload)


def generate_nonce() -> str:
    """Generate a random 32-byte nonce, return as base64."""
    return base64.b64encode(os.urandom(32)).decode()
