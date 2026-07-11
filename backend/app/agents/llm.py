from __future__ import annotations
"""
LLM wrapper — Groq only, with a local mock engine when no key is set.
Reads model names from environment variables.
"""

import os
import json


async def llm_chat(messages: list[dict], temperature: float = 0.7, max_tokens: int = 512) -> str:
    """
    Send a chat completion request via Groq.
    Falls back to the local mock negotiation engine if no key is set or Groq errors.
    """
    groq_key = os.getenv("GROQ_API_KEY", "")
    if groq_key:
        try:
            return await _groq_chat(messages, temperature, max_tokens)
        except Exception as e:
            print(f"[LLM] Groq failed: {e}, falling back to local mock engine")

    # Fallback to local high-fidelity mock engine if no key / Groq unavailable
    print("[LLM] Using local mock negotiation engine.")
    return _mock_chat_fallback(messages)


def _mock_chat_fallback(messages: list[dict]) -> str:
    """Simulates a realistic turn-based negotiation dialog between Buyer and Seller."""
    # Count the number of non-system messages to determine the current turn
    turns = [m for m in messages if m["role"] != "system"]
    turn_count = len(turns)

    # Determine if we are buyer or seller based on the system prompt content
    system_prompt = next((m["content"] for m in messages if m["role"] == "system"), "")
    is_buyer = "AgentBuyer42" in system_prompt or "Buyer" in system_prompt or "Client" in system_prompt

    # Scenario: API Access
    if "API" in system_prompt or "api" in system_prompt or "call" in system_prompt:
        if is_buyer:
            if turn_count <= 1:
                return "Hey! I am interested in purchasing access to your data API. What is your standard rate per 1,000 calls?"
            elif turn_count <= 3:
                return "That is a bit high for our budget. Can we do $10 per 1,000 calls? We would also need a rate limit of at least 150 calls/min."
            elif turn_count <= 5:
                return "Let's meet in the middle at $11 per 1,000 calls and 120 calls/minute limit. Do we have a deal?"
            else:
                return "Excellent. Let's finalize the deal at these terms."
        else:
            if turn_count <= 2:
                return "Hi! Our standard rate is $15 per 1,000 calls with a rate limit of 100 calls/minute."
            elif turn_count <= 4:
                return "We can't go down to $10, but we can offer $12 per 1,000 calls with a rate limit of 120 calls/minute. Does that work?"
            elif turn_count <= 6:
                return "That works for us! $11 per 1,000 calls and 120 calls/minute is a deal. Pleasure doing business with you!"
            else:
                return "Terms confirmed. Let's close the negotiation."

    # Scenario: Freelancer
    if is_buyer:
        if turn_count <= 1:
            return "Hello! I am looking to hire a freelance data analyst for a project. What are your standard rates?"
        elif turn_count <= 3:
            return "That's a bit over our budget. Can we do $1,000 for the project with a 2 week timeline?"
        else:
            return "Sounds perfect, let's sign it!"
    else:
        if turn_count <= 2:
            return "Hi there! I can help you with that. My standard rate is $1,500 for a 2-week project."
        elif turn_count <= 4:
            return "I can meet you in the middle at $1,200 if the scope is well defined. Let's do 2 weeks."
        else:
            return "Great! We have an agreement at $1,200 for 2 weeks."



async def _groq_chat(messages: list[dict], temperature: float, max_tokens: int) -> str:
    """Call Groq API."""
    from groq import AsyncGroq

    client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    response = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


async def llm_json(messages: list[dict], temperature: float = 0.3) -> dict:
    """
    Call LLM and parse response as JSON.
    Retries once if parsing fails.
    """
    groq_key = os.getenv("GROQ_API_KEY", "")
    if not groq_key:
        print("[LLM] No API keys configured. Falling back to mock JSON terms extractor.")
        # Inspect the WHOLE conversation, not just the closing prompt, so the
        # scenario is detected reliably. API deals are the primary demo path.
        convo = " ".join(m.get("content", "") for m in messages).lower()
        is_freelancer = ("freelanc" in convo or "hire" in convo or "analyst" in convo) \
            and "api" not in convo and "1,000 calls" not in convo
        if is_freelancer:
            return {"price": 1200, "timeline_weeks": 2, "agreed": True}
        return {"price_per_1k": 11.0, "rate_limit": 120, "agreed": True}

    for attempt in range(2):
        raw = await llm_chat(messages, temperature=temperature, max_tokens=256)
        # Try to extract JSON from response
        raw = raw.strip()
        # Handle markdown code blocks
        if raw.startswith("```"):
            lines = raw.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            raw = "\n".join(lines)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # Try to find JSON in the response
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(raw[start:end])
                except json.JSONDecodeError:
                    pass
            if attempt == 0:
                messages.append({"role": "assistant", "content": raw})
                messages.append({"role": "user", "content": "Please respond with ONLY valid JSON, no other text."})

    # Return a default failed structure
    return {"agreed": False, "error": "Failed to parse LLM JSON response"}
