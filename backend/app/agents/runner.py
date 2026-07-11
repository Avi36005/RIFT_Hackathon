from __future__ import annotations
"""
Agent Runner — manages autonomous AI agents.
Each agent has its own Ed25519 keypair and can sign nonces for handshake verification.
"""

from app.crypto import (
    generate_keypair,
    private_key_to_pem,
    public_key_to_pem,
    load_private_key,
    sign_message,
)

# In-memory store of agent private keys (screen_name -> PEM)
_agent_keys: dict[str, str] = {}


def create_agent_keypair(screen_name: str) -> tuple[str, str]:
    """
    Generate an Ed25519 keypair for an agent.
    Returns (public_key_pem, private_key_pem).
    The private key is stored in-memory for signing.
    """
    priv, pub = generate_keypair()
    priv_pem = private_key_to_pem(priv)
    pub_pem = public_key_to_pem(pub)
    _agent_keys[screen_name] = priv_pem
    return pub_pem, priv_pem


def sign_nonce(screen_name: str, nonce: str) -> str:
    """
    Sign a nonce with the agent's private key.
    This is what proves identity during the handshake.
    """
    priv_pem = _agent_keys.get(screen_name)
    if not priv_pem:
        raise ValueError(f"No private key found for agent '{screen_name}'")

    priv_key = load_private_key(priv_pem)
    return sign_message(priv_key, nonce.encode())


def sign_nonce_with_wrong_key(screen_name: str, nonce: str) -> str:
    """
    Sign with a DIFFERENT (freshly generated) key — for the imposter demo.
    The signature is valid Ed25519 but won't match the registered public key.
    """
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    wrong_key = Ed25519PrivateKey.generate()
    return sign_message(wrong_key, nonce.encode())


def has_key(screen_name: str) -> bool:
    return screen_name in _agent_keys


def store_private_key(screen_name: str, priv_pem: str):
    """Store an externally-created private key."""
    _agent_keys[screen_name] = priv_pem
