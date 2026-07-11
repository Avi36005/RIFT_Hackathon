import { useEffect, useRef } from 'react';

/**
 * ws.js — WebSocket client for Agent Messenger.
 *
 * `useGlobalWS({ signedInAs, onEvent })` connects to the global realtime channel
 * (`/ws/global`) and dispatches each incoming message to `onEvent(data)`. It
 * reconnects when `signedInAs` changes and cleans up on unmount.
 *
 * Event types (mirrors the backend broadcast): presence, warning,
 * verification_complete, deal_start, deal_message, deal_complete, im, im_sent.
 *
 * `sendIM(signedInAs, to, text)` opens the per-agent channel `/ws/{screenName}`
 * to deliver a direct IM. (The backend routes `im` messages from there.)
 */

const WS_BASE = `ws://${window.location.hostname}:8001`;

export function useGlobalWS({ signedInAs, onEvent }) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let ws;
    let closed = false;
    try {
      ws = new WebSocket(`${WS_BASE}/ws/global`);
    } catch (_) {
      return; // backend not up yet — best-effort
    }

    ws.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch (_) { return; }
      onEventRef.current?.(data);
    };

    ws.onclose = () => { closed = true; };

    return () => {
      closed = true;
      try { ws.close(); } catch (_) {}
    };
  }, [signedInAs]);
}

// Send a direct IM by opening a short-lived socket on the sender's channel.
export function sendIM(signedInAs, to, text) {
  try {
    const ws = new WebSocket(`${WS_BASE}/ws/${signedInAs}`);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'im', to, text }));
      setTimeout(() => { try { ws.close(); } catch (_) {} }, 200);
    };
  } catch (_) {}
}
