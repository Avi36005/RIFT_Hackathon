import { useState } from 'react';
import GelButton from '../aqua/GelButton';

/**
 * SignIn — small brushed-metal Aqua sign-in window, centered.
 * Original app badge/avatar, "Screen Name" popup, glossy blue pulsing "Log In"
 * default button, and a gentle "connecting…" state. Signing on plays a chime +
 * drops the buddy list in (handled by the parent).
 */
export default function SignIn({ agents = [], onSignOn }) {
  const [screenName, setScreenName] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleLogIn = () => {
    if (!screenName.trim()) return;
    setConnecting(true);
    // Brief "connecting…" beat so the login reads as a real sign-on, then hand off.
    setTimeout(() => {
      onSignOn?.(screenName.trim());
      setConnecting(false);
    }, 1200);
  };

  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div className="signin-appbadge" aria-hidden>🤖</div>
      <div style={{ textAlign: 'center', marginBottom: 2 }}>
        <div className="embossed" style={{ fontWeight: 700, fontSize: 13 }}>Agent Messenger</div>
        <div className="dim" style={{ fontSize: 10 }}>Instant Messenger for AI Agents</div>
      </div>

      <label style={{ fontSize: 11, fontWeight: 600 }} className="embossed">Screen Name</label>
      {agents.length > 0 ? (
        <select
          className="aqua-select"
          style={{ width: '100%' }}
          value={screenName}
          onChange={(e) => setScreenName(e.target.value)}
          disabled={connecting}
        >
          <option value="">— Select Agent —</option>
          {agents.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      ) : (
        <input
          className="aqua-input"
          style={{ width: '100%' }}
          placeholder="Enter a screen name…"
          value={screenName}
          onChange={(e) => setScreenName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogIn()}
          disabled={connecting}
        />
      )}

      {connecting && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '100%', height: 12, borderRadius: 999,
            background: 'rgba(0,0,0,.08)', overflow: 'hidden',
            border: '1px solid rgba(0,0,0,.18)',
          }}>
            <div style={{
              height: '100%', width: '70%',
              background: 'linear-gradient(180deg, var(--gel-top), var(--gel-bot))',
              borderRadius: 999,
              animation: 'signin-progress 1.2s ease-in-out infinite',
            }} />
          </div>
          <div className="dim" style={{ fontSize: 10, marginTop: 4 }}>Connecting…</div>
        </div>
      )}

      <GelButton
        variant="primary"
        pulse={!connecting}
        style={{ width: '100%', padding: '6px' }}
        onClick={handleLogIn}
        disabled={connecting || !screenName.trim()}
      >
        {connecting ? 'Signing On…' : 'Log In'}
      </GelButton>

      <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 10 }} className="dim">
        © 2026 Agent Messenger · Trust Infrastructure for AI Agents
      </div>

      <style>{`@keyframes signin-progress { 0%{width:12%} 50%{width:82%} 100%{width:12%} }`}</style>
    </div>
  );
}
