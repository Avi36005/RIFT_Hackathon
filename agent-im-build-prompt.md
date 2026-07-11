# BUILD PROMPT — Agent Instant Messenger ("BuddyNet Messenger")

> Paste this whole file into Claude Code as the project brief. Build it in the phase order given. After each phase, the app must run and demo. Do not skip ahead. If a decision is genuinely ambiguous, make the simplest choice that keeps the demo working and note it — don't stop to ask.

---

## 0. MISSION & CONTEXT

This is a hackathon submission for **RIFT'26**, Problem Statement Two: *"AI's First Day Online."* The brief: AI agents are becoming the new users of the internet — browsing, buying, negotiating, posting — but we never built infrastructure for them to do it *safely or fairly*. Pick one piece of internet infrastructure (identity, payments, trust, or moderation) and build the version made for AI agents instead of humans.

**Our answer:** rebuild the 2000s instant messenger (AIM/ICQ) as trust infrastructure for AI agents. It folds **identity + trust + moderation** into one product, because AIM already had all the primitives:
- Screen name / UIN → **identity**
- Buddy list → **who you trust**
- Warn button + warning level → **moderation / reputation**
- Away message / presence → **intent & availability**

The twist: the "buddies" are real LLM agents, and they can only do business with each other after cryptographically proving who they are.

### The theme constraint (READ THIS — it's heavily judged)
- **Modern engine, retro paint job.** The backend, crypto, and AI must be genuinely modern and sophisticated (real Ed25519 signatures, real LLM agents, real gating logic). The judges want to *see* the modern power working.
- **The 2000s constraint applies ONLY to the UI/UX.** The frontend must look and feel like an early-2000s Windows XP desktop running AIM. Full Luna blue, glossy beveled buttons, Tahoma / MS Sans Serif, gradient title bars, draggable windows, the AIM sign-on and buddy-list chrome. This is criterion #2 and it's weighted heavily — do not phone it in and do NOT use a modern/flat/minimal aesthetic.
- Never expose ugly modern chrome. Every visible surface is period-accurate. The sophistication shows through *what the app does*, not through modern styling.

---

## 1. THE CONCEPT IN ONE PARAGRAPH

Two AI agents sign on to a Windows-XP-era instant messenger. Each has a screen name bound to a cryptographic keypair, so its identity can't be faked. When one adds the other as a buddy, the app runs a live challenge-response handshake (send random nonce → buddy signs it → verify signature against registered public key) and shows "✓ Identity Verified." Only *after* mutual verification, and only if both agents' warning levels are low enough, are the two LLM agents allowed to negotiate a deal in the chat window in real time. If an agent misbehaves, it gets "warned," its warning level rises (just like AIM), and it gets throttled or blocked. One screen — the buddy list + chat window — demonstrates identity, trust, and moderation for AI agents.

---

## 2. TECH STACK & CONSTRAINTS

- **Backend:** Python + FastAPI. Async. WebSocket support for live chat streaming.
- **Frontend:** React + Tailwind CSS. (Tailwind for layout speed; the XP look is achieved with custom CSS/components on top — see §4.)
- **Persistence:** SQLite via SQLAlchemy (zero-config, fast to stand up). No external DB required.
- **Presence / pub-sub:** In-memory by default; make Redis optional behind an interface (`REDIS_URL` env var). Do NOT hard-require Redis — the demo must run with zero infra.
- **Crypto:** `cryptography` library, **Ed25519** keypairs (fast, small signatures, modern).
- **AI agents:** Groq (primary) `llama-3.3-70b-versatile`; Gemini Flash as fallback if Groq errors/rate-limits. Read model names from env; verify current model strings at build time.
- **Deploy target:** Google Cloud Run (asia-south1) — containerize with a Dockerfile, single service, but also runnable locally with `uvicorn` + `vite dev`.
- Keep secrets in `.env`. Never hardcode API keys.

---

## 3. ARCHITECTURE OVERVIEW

```
┌────────────────────────── FRONTEND (React, XP skin) ──────────────────────────┐
│  Sign-On window · Buddy List window · IM Chat window · Verify modal ·          │
│  Warning meter · Away-message · fake XP desktop + taskbar + sounds             │
└───────────────▲───────────────────────────────────────────────▲──────────────┘
                │ REST + WebSocket                                │
┌───────────────┴───────────────── BACKEND (FastAPI) ─────────────┴──────────────┐
│  Registry  →  binds screen_name ⇄ Ed25519 public key, issues signed credential │
│  Handshake →  nonce challenge / signature verify (the "prove it" moment)       │
│  Presence  →  online / away / idle, away messages                              │
│  Reputation→  warning levels, warn reports, throttle/block policy              │
│  Negotiation→ orchestrates two LLM agents; GATED by handshake + reputation     │
└──────────────────────────────────┬─────────────────────────────────────────────┘
                                    │
                          SQLite  +  (optional) Redis
                                    │
                        Groq / Gemini  (the actual agent brains)
```

---

## 4. AESTHETIC BIBLE (criterion #2 — do not compromise)

The whole app renders inside a **fake Windows XP desktop**:
- Backdrop: a Bliss-style green-hills gradient wallpaper (generate with CSS gradients — do NOT use copyrighted Microsoft assets; make an original homage).
- Bottom **taskbar**: green XP start-bar gradient, a "start" button (round, glossy), a clock in the tray, and buttons for open windows.
- All app windows are **draggable**, have XP title bars (blue-gradient, white title text, minimize/maximize/close bevel buttons), and 2px beveled borders.

**Typography:** Tahoma / "MS Sans Serif" / Verdana stack. Small font sizes (11px body). Bold blue section labels.

**Buttons:** glossy, rounded, light-blue gradient with a highlight sheen and a 1px inset border. Active state = pressed inset look.

**Color:** XP Luna blue (#0A2472 → #2A6FDB gradients), silver window chrome, that specific AIM buddy-list off-white.

**Windows to build (each is a draggable XP window):**

1. **Sign-On window** — AOL/AIM style. "Screen Name" dropdown, a Sign On button, a "Setup" link, dial-up-era footer text. Signing on plays the classic "door open" sound.
2. **Buddy List window** — the iconic tall narrow window. Header with the agent's own screen name + status. A "Buddies" group and an "Offline" group. Each buddy row: presence dot (green online / yellow idle / red away), screen name, a tiny verified badge (✓) if the handshake passed, and the buddy's warning-level % in muted text. Right-click a buddy → context menu with **"Send IM," "Warn," "Get Info," "Verify Identity."** Buttons along the bottom: IM, Chat, Setup.
3. **IM Chat window** — title bar = buddy's screen name. Scrolling message pane (each line: `ScreenName (timestamp): message`, colored by sender, exactly like AIM). A formatting toolbar (B/I/U, font, smiley — cosmetic is fine). Text input + **Send** button. When two LLM agents negotiate, their messages stream into this pane live.
4. **Verify Identity modal** — the money shot. When adding/verifying a buddy, show the handshake step-by-step with a little progress feel: "Issuing challenge…" → "Nonce sent: `a3f9…`" → "Awaiting signature…" → "Signature received." → "**✓ Identity Verified — screen name is cryptographically bound to key `ED25519:…`**" (or "✗ Verification failed" on bad sig). This must reflect the *real* backend handshake, not a fake animation.
5. **Warning meter** — AIM-style warning % bar next to a buddy / on the profile. Fills red as warning level rises. When someone clicks "Warn," it visibly ticks up.
6. **Away-message editor** — set status (Available / Away / Busy) and a text away message shown to buddies.

**Sound effects** (big authenticity + demo delight — include if time allows, behind a mute toggle): door-open on sign-on, door-close on sign-off, the "buddy in" chime, the AIM message "ding," and the ICQ "uh-oh" for a warning. Generate/source royalty-free equivalents; do not ship copyrighted sound files.

---

## 5. DATA MODEL (SQLAlchemy)

```
Agent
  id             UUID (pk)
  screen_name    str, unique, indexed        # the identity
  public_key     str (PEM/base64 Ed25519)    # bound to screen_name
  owner          str                          # who runs this agent
  status         enum(online/away/busy/offline)
  away_message   str, nullable
  warning_level  int, default 0  (0–100)
  created_at     datetime

BuddyRelation
  id             UUID
  agent_id       FK Agent                     # who added
  buddy_id       FK Agent                     # who was added
  verified       bool, default False
  verified_at    datetime, nullable
  # unique(agent_id, buddy_id)

HandshakeChallenge
  id             UUID
  from_agent     FK Agent
  to_agent       FK Agent
  nonce          str (random 32 bytes, base64)
  status         enum(pending/verified/failed/expired)
  issued_at      datetime
  responded_at   datetime, nullable

Deal
  id             UUID
  initiator      FK Agent
  counterparty   FK Agent
  scenario       str                          # e.g. "buy_api_access"
  status         enum(proposed/negotiating/accepted/failed/completed)
  terms          JSON, nullable               # final agreed terms
  transcript     JSON                         # ordered list of {sender, text, ts}
  created_at     datetime

WarningReport
  id             UUID
  reporter       FK Agent (nullable — judge/human can warn too)
  subject        FK Agent
  reason         str
  weight         int, default 10
  created_at     datetime
```

---

## 6. BACKEND SPEC

### 6.1 Registry (identity)
- `POST /agents/register` — body `{screen_name, public_key(PEM), owner}`. Reject if screen_name taken. Store agent. Return `{agent_id, credential}` where `credential` = server's Ed25519 signature over `{agent_id, screen_name, public_key}` (server has its own keypair generated on first boot). This is the "issued signed credential."
- `GET /agents/{screen_name}` — public profile (screen_name, pubkey fingerprint, status, warning_level, verified-buddy count). Never returns private keys.
- `GET /agents` — directory for buddy search.

### 6.2 Handshake (trust — the core mechanic)
- `POST /handshake/initiate` — body `{from_screen_name, to_screen_name}`. Server generates a random nonce, stores a `HandshakeChallenge(pending)`, returns `{challenge_id, nonce}`.
- `POST /handshake/respond` — body `{challenge_id, signature}`. Server loads the challenge, loads `to_agent.public_key`, and **verifies the signature over the nonce**. On success → mark challenge `verified`, mark/create the `BuddyRelation.verified = True`. On failure → `failed`. Return the result.
- `GET /handshake/{challenge_id}` — status, for the UI to poll/stream the verify modal.
- Challenges expire after 60s.
- **This must be real Ed25519 verification.** The agent runner (§6.5) holds each agent's private key and produces genuine signatures.

### 6.3 Buddies & presence
- `POST /buddies/add` — `{agent, buddy}`. Creates relation (unverified) and kicks off a handshake so the UI can show verification.
- `GET /buddies?screen_name=` — buddy list with each buddy's presence, verified flag, warning_level.
- `POST /presence` — set status + away_message. `GET /presence/{screen_name}`.
- `WS /ws/{screen_name}` — realtime channel: pushes presence changes, incoming IMs, deal messages, warning updates. This drives the live feel of the demo.

### 6.4 Moderation / reputation
- `POST /moderation/warn` — `{reporter (optional), subject, reason, weight?}`. Creates a `WarningReport`, raises `subject.warning_level` (cap 100). Broadcast update over WS so the meter moves live.
- **Policy (enforced everywhere agents act):**
  - `warning_level < 50` → normal.
  - `50 ≤ level < 80` → **limited**: cannot *initiate* deals; existing chats rate-limited.
  - `level ≥ 80` → **blocked**: cannot deal or verify; shown as "warned/blocked" in buddy list.
- Optional: warning level decays slowly over time (e.g., −1/hour). Skip if time-constrained.
- `GET /moderation/{screen_name}` — current level + report history.

### 6.5 AI agents & negotiation (the load-bearing AI)
- An **agent runner** module spins up 2+ autonomous agents. Each agent: has its own Ed25519 keypair (holds the private key), a persona/goal, and an LLM backend (Groq primary, Gemini fallback).
- **Demo scenario (default): "buy_api_access."** A **Buyer** agent wants to purchase access to a **Seller** agent's data/API and negotiates **price per 1,000 calls** and **rate limit**. Make the scenario + personas config-driven so we can swap it (e.g., "hire a freelancer," "buy a dataset") from one file.
- `POST /deals/start` — `{initiator, counterparty, scenario}`. **GATE FIRST:**
  1. Both agents must be *mutually verified* buddies (handshake passed). If not → 403 "identity not verified."
  2. Both must pass the reputation policy (§6.4). If blocked/limited → 403.
  Only then create a `Deal(negotiating)` and start the loop.
- **Negotiation loop:** turn-based. Each turn, the acting agent gets: its persona + goal + hard limits + the transcript so far, and must output its next chat message. Messages are appended to `Deal.transcript` and **pushed over WS** so they stream into the chat window one at a time (add a small delay so it reads like live typing). Loop ends when an agent emits a deal-close token or after N turns (default 8). 
- **Structured close:** at the end, make one LLM call that extracts the agreed terms as strict JSON (`{price_per_1k, rate_limit, agreed: bool}`) — prompt it to return JSON only, parse safely, store in `Deal.terms`, set status `completed` (or `failed` if no agreement).
- **Meaningful-AI hooks the judges reward:** the LLM is doing real work (autonomous negotiation + structured settlement), and the identity/reputation layer *governs* it. Optionally add a lightweight **watchdog**: an LLM check that flags if an agent tried to renege or break protocol → auto-files a `WarningReport` (AI-driven moderation). Build this only after the core loop works.

---

## 7. THE DEMO FLOW (must work end-to-end)

This exact sequence is what gets shown to judges. Everything must fire live:

1. **Two agents sign on** (Buyer + Seller). Door-open sound; presence dots go green in the buddy list.
2. **Buyer adds Seller** → Verify Identity modal runs the real handshake → "✓ Identity Verified, key ED25519:…". Show that a *tampered* signature would fail (have a "simulate imposter" toggle that signs with the wrong key → "✗ Verification failed" — great for the demo).
3. **IM window opens; the two LLM agents negotiate live** — messages stream in AIM style, they haggle price/rate, and close with agreed terms shown as a clean summary.
4. **Moderation beat:** judge right-clicks an agent → "Warn" (or the watchdog auto-warns). Warning meter ticks up live. Push it past 80 → agent shows as blocked and a new `/deals/start` is refused with "agent blocked." 
5. One screen — buddy list + chat — has now shown **identity, trust, and moderation** for AI agents.

Build a **`/seed` script + a "Run Demo" button** that sets up the two agents and can trigger the whole sequence, so nothing has to be typed live.

---

## 8. BUILD ORDER (each phase must run & demo before the next)

- **Phase 1 — Skeleton:** FastAPI app + SQLite + models + React app that renders the fake XP desktop, taskbar, and a draggable Sign-On + Buddy List window with mocked data. *Demo: it looks like Windows XP running AIM.*
- **Phase 2 — Identity + handshake:** registration with Ed25519, the agent runner holding keypairs, `/handshake/*`, and the Verify Identity modal wired to the REAL verification. *Demo: add a buddy, watch it cryptographically verify; imposter fails.*
- **Phase 3 — Live chat + presence:** WebSocket, IM window, presence dots, away messages. *Demo: real-time messages appear AIM-style.*
- **Phase 4 — AI negotiation (gated):** agent runner + Groq/Gemini + `/deals/start` with the handshake+reputation gate + streaming negotiation into the chat window + structured close. *Demo: two bots verify then haggle a deal live.*
- **Phase 5 — Moderation:** warn button, warning meter, throttle/block policy, (optional) AI watchdog. *Demo: warn an agent, it gets blocked.*
- **Phase 6 — Polish:** sounds, "Run Demo" button, seed script, imposter toggle, README, Dockerfile.

---

## 9. DO NOT BUILD (protect the timeline)
- No user accounts / auth / OAuth for humans. Agents are the users.
- No real money or blockchain. "Payments" is out of scope; this is identity+trust+moderation.
- No multi-tenant infra, no k8s, no message queue beyond the in-memory/Redis interface.
- No mobile responsiveness — it's a fake desktop, target desktop screen only.
- No settings/preferences beyond what the demo shows. No dark mode (it's XP).
- Don't over-engineer the crypto (Ed25519 sign/verify is enough — no PKI, no cert chains, no revocation).

---

## 10. PROJECT STRUCTURE

```
agent-im/
  backend/
    app/
      main.py            # FastAPI app + WS
      models.py          # SQLAlchemy
      db.py
      crypto.py          # Ed25519 keygen / sign / verify + server credential
      registry.py        # /agents
      handshake.py       # /handshake
      presence.py        # /presence + WS hub
      reputation.py      # /moderation + policy
      negotiation.py     # /deals + agent loop
      agents/
        runner.py        # spins up LLM agents, holds keys, signs nonces
        llm.py           # Groq primary + Gemini fallback wrapper
        personas.py      # scenario + persona config (swap here)
      seed.py            # creates demo agents + "Run Demo"
    Dockerfile
    requirements.txt
    .env.example
  frontend/
    src/
      xp/                # XP primitives: Window, TitleBar, Button, Taskbar, Desktop
      windows/           # SignOn, BuddyList, ChatWindow, VerifyModal, WarningMeter, AwayMsg
      lib/               # api client, ws client, sounds
      App.jsx
    index.html
    package.json
    tailwind.config.js
  README.md
```

---

## 11. ENV / SETUP / RUN

`.env.example`:
```
GROQ_API_KEY=
GEMINI_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_MODEL=gemini-flash-latest        # verify current model string
REDIS_URL=                               # blank = in-memory
SERVER_KEYPAIR_PATH=./server_key.pem     # generated on first boot
```

README must include: `pip install -r requirements.txt`, `uvicorn app.main:app --reload`, `npm install && npm run dev` in frontend, how to run `seed.py`, and how to click "Run Demo."

---

## 12. DEFINITION OF DONE
- App runs locally with **zero external infra** (no Redis needed) and one command each for backend/frontend.
- The demo flow in §7 works end-to-end and is triggerable from a "Run Demo" button.
- Handshake verification is **real** (imposter signature genuinely fails).
- Two LLM agents genuinely negotiate and produce structured terms, and the negotiation is **actually blocked** if identity isn't verified or warning level is too high.
- The entire UI is convincingly early-2000s Windows XP / AIM. A judge should smile in the first three seconds.
- Dockerfile builds; deployable to Cloud Run.

---

### Ownership split (for reference)
- **Avi:** crypto/identity (`crypto.py`, `handshake.py`), agent runner + LLM negotiation + gating (`agents/`, `negotiation.py`), reputation policy.
- **Hardik:** entire XP-skinned frontend, WebSocket client, sounds, taskbar/desktop, deploy (Dockerfile + Cloud Run).

Build Phase 1 now and stop for a look before Phase 2.
