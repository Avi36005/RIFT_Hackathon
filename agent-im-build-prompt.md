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
- **The 2000s constraint applies ONLY to the UI/UX.** The frontend must look and feel like an early-2000s **Mac OS X (Aqua) desktop running iChat** — glossy candy "gel" buttons, brushed-metal windows, left-side traffic-light controls, a magnifying Dock, a top menu bar, Lucida Grande type, and iChat's glossy chat bubbles. This is criterion #2 and it's weighted heavily — do not phone it in and do NOT use a modern/flat/minimal aesthetic. Full design brief in §4.
- Never expose ugly modern chrome. Every visible surface is period-accurate. The sophistication shows through *what the app does*, not through modern styling.

---

## 1. THE CONCEPT IN ONE PARAGRAPH

Two AI agents sign on to an early-2000s Mac OS X instant messenger (iChat-style). Each has a screen name bound to a cryptographic keypair, so its identity can't be faked. When one adds the other as a buddy, the app runs a live challenge-response handshake (send random nonce → buddy signs it → verify signature against registered public key) and shows "✓ Identity Verified." Only *after* mutual verification, and only if both agents' warning levels are low enough, are the two LLM agents allowed to negotiate a deal in the chat window in real time. If an agent misbehaves, it gets "warned," its warning level rises (just like AIM), and it gets throttled or blocked. One screen — the buddy list + chat window — demonstrates identity, trust, and moderation for AI agents.

---

## 2. TECH STACK & CONSTRAINTS

- **Backend:** Python + FastAPI. Async. WebSocket support for live chat streaming.
- **Frontend:** React + Tailwind CSS. (Tailwind for layout/spacing only; the Aqua gloss is achieved with custom CSS/components on top — layered gradients, sheens, brushed-metal texture — see §4. Do not let Tailwind's default flat look leak through.)
- **Persistence:** SQLite via SQLAlchemy (zero-config, fast to stand up). No external DB required.
- **Presence / pub-sub:** In-memory by default; make Redis optional behind an interface (`REDIS_URL` env var). Do NOT hard-require Redis — the demo must run with zero infra.
- **Crypto:** `cryptography` library, **Ed25519** keypairs (fast, small signatures, modern).
- **AI agents:** Groq (primary) `llama-3.3-70b-versatile`; Gemini Flash as fallback if Groq errors/rate-limits. Read model names from env; verify current model strings at build time.
- **Deploy target:** Google Cloud Run (asia-south1) — containerize with a Dockerfile, single service, but also runnable locally with `uvicorn` + `vite dev`.
- Keep secrets in `.env`. Never hardcode API keys.

---

## 3. ARCHITECTURE OVERVIEW

```
┌───────────────────────── FRONTEND (React, Aqua/iChat skin) ────────────────────┐
│  Sign-In · iChat Buddy List · Chat window (gel bubbles) · Verify sheet ·        │
│  Get Info + warning meter · fake Aqua desktop + Dock + menu bar + sounds        │
└───────────────▲───────────────────────────────────────────────▲──────────────┘
                │ REST + WebSocket                                │
┌───────────────┴───────────────────────────────── BACKEND (FastAPI) ────────────┴──────────────┐
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

## 4. AESTHETIC BIBLE — Mac OS X "Aqua" + iChat, 2003–2005 (criterion #2 — do NOT compromise)

> This is the most heavily judged criterion and the biggest reason a judge smiles in the first three seconds. Read this section twice. The whole app is a **fake early-2000s Mac OS X desktop** (Panther/Tiger-era **Aqua**), and the messenger inside it is modeled on **iChat AV**. Aqua is the glossiest, most "lickable" UI of the decade, and iChat's glossy chat bubbles are the perfect stage for two AI agents negotiating live. **Modern engine, Aqua paint.** Nothing on screen may look modern, flat, or Material/Tailwind-default. If a surface looks like a 2020s web app, it's wrong.

### 4.1 Why Mac, not Windows
The 2000s Mac equivalent of AIM is **iChat** (2002). Its signature glossy speech bubbles are ideal for showing an agent-to-agent negotiation, and Aqua's candy gloss reads as "premium retro" on a projector. Commit fully to this look.

### 4.2 The desktop shell (build this first — it's the frame everything sits in)
- **Menu bar** — a thin (~22px) translucent white bar pinned to the top of the screen. Left: an **original** menu glyph (a small stylized mark — do NOT use Apple's logo/trademark), then a **bold app-name menu** ("Agent Messenger"), then File / Edit / Buddies / View. Right side: a couple of status glyphs and a **live clock** ("Sun 9:41 PM"). Faint bottom hairline, subtle blur/translucency.
- **Wallpaper** — generate an **original** flowing-ribbon / aqua-wave gradient in the spirit of the Tiger "Aurora" and "Aqua Blue" desktops (deep blue → teal → violet ribbons of light). Pure CSS gradients + blurred blobs. Do NOT ship Apple's actual wallpaper images.
- **The Dock** — bottom-center, a semi-transparent rounded-rectangle shelf with a subtle reflective floor line. Large **glossy rounded-square icons** (original homages, not Apple's icons). **Magnification MUST work**: hovering scales the hovered icon up with neighbors scaling progressively less (the fisheye effect) — this is a signature Aqua moment and judges will hover it. A small indicator dot/triangle sits under a "running" app. Include a light reflection of each icon on the shelf floor.

### 4.3 Aqua design language & quality bar (this is what separates "good" from "flat")
The look is **gloss achieved by layering**, never a single flat fill. For every glossy element (buttons, bubbles, traffic lights, Dock icons) layer these four things:
1. a **base gradient** (lighter top → darker bottom),
2. a **top-half white sheen** overlay (`linear-gradient(rgba(255,255,255,.75) → transparent)` on the upper ~50%) — this is the "gel" highlight,
3. a **1px inner light line** along the very top edge,
4. a **soft inner shadow** along the bottom.

Specifics:
- **Traffic-light window controls**, top-**LEFT** of every window (Mac puts them left): three ~12px gel orbs — **close `#FF5F57`**, **minimize `#FEBC2E`**, **zoom `#28C840`** — each with a bright radial highlight in the upper-left. On window-hover, the ×, −, + glyphs fade in inside them.
- **Aqua "gel" buttons** — pill/rounded-rect, glossy. The **default/primary button is Aqua blue and gently pulses/glows** (a slow breathing box-shadow) exactly like OS X's default button. Blue gradient ~`#A9CCF5 → #4A90E2 → #1C5FCB` with the white top sheen; secondary buttons are the same gloss in white/silver.
- **Window chrome = brushed metal** (iChat, iTunes, and Safari used it in this era). Textured aluminium: base `#B8B8B8` with a faint vertical noise/texture and a `#D6D6D6 → #ABABAB` gradient. Title text centered, **Lucida Grande**, dark grey, with a 1px white text-shadow (embossed).
- **Pinstripes** — the interior white panels of Aqua windows carry a *very* faint horizontal pinstripe (a `repeating-linear-gradient` of ~2px bands, ~2–3% darker). Subtle — texture, not stripes you consciously notice.
- **Window shadows are dramatic** — big soft drop shadow, e.g. `0 22px 70px rgba(0,0,0,.45)`, so windows float off the desktop.
- **Rounded corners** — windows ~8px top corners; buttons/fields fully rounded; bubbles ~14px.
- **Aqua scrollbars** — glossy blue gel thumb on a pinstriped track (cosmetic is fine; don't over-invest).

**Typography:** `"Lucida Grande", "Lucida Sans Unicode", "Helvetica Neue", sans-serif`. Body ~12px, anti-aliased. Titles slightly embossed (white text-shadow). Never use a modern geometric sans.

**Color tokens** (define as CSS variables): aqua-blue `#3875D7` (selection/highlight), gel-blue gradient stops as above, metal `#B8B8B8`, panel `#ECECEC`, pinstripe line `rgba(0,0,0,.03)`, text `#1a1a1a`, secondary text `#6a6a6a`, online `#28C840`, away `#FEBC2E`, busy/blocked `#FF5F57`.

### 4.4 Windows to build (each is a **draggable** brushed-metal Aqua window)

1. **Sign-In window** — small brushed-metal window, centered. An **original** app badge/avatar, a "Screen Name" popup and a glossy blue **"Log In"** default button that pulses. A gentle "connecting…" state. Signing on plays a soft original chime and drops the buddy list in.
2. **Buddy List window (iChat-style)** — brushed metal, tall and narrow. **Top:** your own row — a rounded-square **buddy picture** thumbnail, your screen name, and a **status popup** (Available ▸ Away ▸ Busy) with the away-message text under it. A **search field** below. **Then grouped buddies** ("Buddies", "Offline"). Each buddy row = **buddy-pic thumbnail** + name + status line + a **colored status dot** (green/yellow/red) + a small **glossy "✓ Verified" seal on the pic** once the handshake passes + the buddy's **warning %** in muted text. Ctrl-click a row (Mac had no right-click) **or** use the **Buddies menu** → **"Send Message," "Verify Identity," "Get Info," "Warn."** Bottom toolbar: rounded gel buttons (message / info / +).
3. **Chat window (THE STAR — iChat glossy bubbles)** — brushed-metal window titled with the buddy's name. Message area shows **glossy speech bubbles**: **your** agent's messages on the **right** in a glossy blue gel bubble (white text), **their** messages on the **left** in a glossy light-grey gel bubble (dark text). Each bubble has a **little tail** pointing to that sender's **buddy-pic thumbnail** sitting beside it. Bubbles use the four-layer gloss recipe. Bottom: a **rounded pill input** with the buddy pic beside it and a gel Send button. When the two LLM agents negotiate, their bubbles **stream in one at a time** with a brief "typing…" shimmer between turns so it reads like a live conversation. This window is what wins the demo — make the bubbles genuinely lickable.
4. **Verify Identity — as an Aqua "sheet"** (very Mac: a modal that **slides down from under the window's title bar**, attached to the chat/buddy window, dimming the window behind it). Show the REAL handshake step-by-step: "Issuing challenge…" → "Nonce: `a3f9…`" → "Awaiting signature…" → "Signature received" → "**✓ Identity Verified — screen name cryptographically bound to `ED25519:…`**", or a red "✗ Verification failed" if the signature is bad. Must reflect the actual backend result, not a canned animation. Include the **"simulate imposter"** path here (signs with the wrong key → fails) — this is the trust money-shot.
5. **Get Info panel** — small Aqua inspector for a buddy: buddy pic, key fingerprint, verified status, and the **warning-level meter** (a glossy gel progress bar that fills toward red as level rises; it visibly ticks up when "Warn" is used). A **"Warn"** gel button lives here too.
6. **Status menu / away message** — the status popup (Available / Away / Busy) with an editable custom away message, shown under buddies who set it.

### 4.5 Sounds (big authenticity + demo delight — behind a mute toggle)
Original, royalty-free equivalents of: a soft **login chime** on sign-on, a **"buddy online"** blip when an agent comes up, the iChat-style **incoming-message "blip"** as each bubble lands, and a distinct **alert tone** when a warning fires. Do NOT ship Apple's actual system sounds (e.g. the startup chord) — use original clips.

### 4.6 Copyright guardrails (this is a public submission — keep it clean)
Everything Apple is an **homage, not a copy**: no Apple logo/trademark, no real Apple wallpapers, no Apple app icons, no Apple system sounds, no "Mac OS X"/"iChat" branding in the product name. Build original glossy assets in the *style* of Aqua. Name the product something original (default: **"Agent Messenger"**).

### 4.7 Self-check — what "good looking" means before you call the frontend done
- [ ] Windows float with big soft shadows and have **left-side traffic lights** that reveal glyphs on hover.
- [ ] Every glossy element uses the **four-layer gloss** (not a flat fill); the default button **pulses** blue.
- [ ] Window chrome reads as **brushed metal**; interior panels carry a **faint pinstripe**.
- [ ] The **Dock magnifies** on hover with icon reflections; the **menu bar** clock is live.
- [ ] Chat uses **iChat gel bubbles with tails + buddy pics**, left/right by sender, streaming in.
- [ ] Font is **Lucida Grande**; nothing on screen looks like a modern flat web app.
- [ ] Verify runs as a **sheet** sliding from the title bar and reflects the real handshake.

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
  created_at
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

1. **Two agents sign on** (Buyer + Seller). Login chime + "buddy online" blip; status dots go green in the iChat buddy list, buddy pics appear.
2. **Buyer adds Seller** → Verify Identity modal runs the real handshake → "✓ Identity Verified, key ED25519:…". Show that a *tampered* signature would fail (have a "simulate imposter" toggle that signs with the wrong key → "✗ Verification failed" — great for the demo).
3. **IM window opens; the two LLM agents negotiate live** — messages stream in AIM style, they haggle price/rate, and close with agreed terms shown as a clean summary.
4. **Moderation beat:** judge Ctrl-clicks an agent (or uses the Buddies menu / Get Info) → "Warn" (or the watchdog auto-warns). Warning meter ticks up live. Push it past 80 → agent shows as blocked and a new `/deals/start` is refused with "agent blocked."
5. One screen — buddy list + chat — has now shown **identity, trust, and moderation** for AI agents.

Build a **`/seed` script + a "Run Demo" button** that sets up the two agents and can trigger the whole sequence, so nothing has to be typed live.

---

## 8. BUILD ORDER (each phase must run & demo before the next)

- **Phase 1 — Skeleton + the Aqua shell:** FastAPI app + SQLite + models + React app that renders the fake **Aqua desktop** (original wallpaper, top menu bar with live clock, magnifying Dock) plus draggable brushed-metal **Sign-In** and **iChat Buddy List** windows with mocked data. Nail the gloss here — this frame carries the whole look. *Demo: it convincingly looks like Mac OS X running iChat.*
- **Phase 2 — Identity + handshake:** registration with Ed25519, the agent runner holding keypairs, `/handshake/*`, and the Verify Identity modal wired to the REAL verification. *Demo: add a buddy, watch it cryptographically verify; imposter fails.*
- **Phase 3 — Live chat + presence:** WebSocket, the iChat chat window with **glossy gel bubbles**, status dots, away messages. *Demo: real-time messages stream in as iChat bubbles.*
- **Phase 4 — AI negotiation (gated):** agent runner + Groq/Gemini + `/deals/start` with the handshake+reputation gate + streaming negotiation into the chat window + structured close. *Demo: two bots verify then haggle a deal live.*
- **Phase 5 — Moderation:** warn button, warning meter, throttle/block policy, (optional) AI watchdog. *Demo: warn an agent, it gets blocked.*
- **Phase 6 — Polish:** sounds, "Run Demo" button, seed script, imposter toggle, README, Dockerfile.

---

## 9. DO NOT BUILD (protect the timeline)
- No user accounts / auth / OAuth for humans. Agents are the users.
- No real money or blockchain. "Payments" is out of scope; this is identity+trust+moderation.
- No multi-tenant infra, no k8s, no message queue beyond the in-memory/Redis interface.
- No mobile responsiveness — it's a fake desktop, target desktop screen only.
- No settings/preferences beyond what the demo shows. No dark mode (it's Aqua).
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
      aqua/              # Aqua primitives: Window(brushed-metal), TrafficLights, GelButton, Dock, MenuBar, Sheet, Pinstripe
      windows/           # SignIn, BuddyList(iChat), ChatWindow(bubbles), VerifySheet, GetInfo, StatusMenu
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
- The entire UI is convincingly early-2000s **Mac OS X Aqua / iChat** — glossy gel buttons, brushed-metal windows, left-side traffic lights, a **working magnifying Dock**, a live menu-bar clock, and **iChat gel chat bubbles**. A judge should smile in the first three seconds.
- Dockerfile builds; deployable to Cloud Run.

---

### Ownership split (for reference)
- **Avi:** crypto/identity (`crypto.py`, `handshake.py`), agent runner + LLM negotiation + gating (`agents/`, `negotiation.py`), reputation policy.
- **Hardik:** entire Aqua-skinned frontend (Dock + magnification, menu bar, brushed-metal windows, iChat gel bubbles, traffic lights, sheets), WebSocket client, sounds, deploy (Dockerfile + Cloud Run).

Build Phase 1 now and stop for a look before Phase 2.
