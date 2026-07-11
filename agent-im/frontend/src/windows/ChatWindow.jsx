import { useState, useEffect, useRef } from 'react';
import GelButton from '../aqua/GelButton';

/**
 * ChatWindow — THE STAR. iChat glossy gel bubbles with tails + buddy pics.
 *
 * My messages on the RIGHT in a glossy blue gel bubble (white text); theirs on
 * the LEFT in a glossy light-grey gel bubble (dark text). Each bubble has a tail
 * pointing to the sender's buddy-pic thumbnail beside it. Bubbles stream in one
 * at a time with a "typing…" shimmer between turns during a negotiation.
 *
 * Bottom: rounded pill input + buddy pic + gel Send. "Start Negotiation" gel
 * button gated by moderation. Structured deal-terms summary panel on completion.
 */

function picGradient(name = '') {
  const palettes = [
    'linear-gradient(135deg,#8fe2ff,#4a90e2 55%,#1c5fcb)',
    'linear-gradient(135deg,#b5a7ff,#6a4bd6 55%,#3a1f8f)',
    'linear-gradient(135deg,#9be7b4,#28b463 55%,#117a3c)',
    'linear-gradient(135deg,#ffd28a,#ef8e30 55%,#a8530b)',
    'linear-gradient(135deg,#ff9db0,#e23a6a 55%,#8f1739)',
    'linear-gradient(135deg,#8fe2ff,#28c8c8 55%,#137a7a)',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}
function initials(name = '') {
  const clean = name.replace(/[^A-Za-z0-9]/g, '');
  if (!clean) return '🤖';
  if (/[0-9]/.test(clean)) return clean.slice(0, 2);
  return clean.slice(0, 2).toUpperCase();
}
function MiniPic({ name }) {
  return (
    <div className="buddy-pic" style={{ width: 26, height: 26, fontSize: 13, borderRadius: 7, background: picGradient(name) }}>
      {initials(name)}
    </div>
  );
}

export default function ChatWindow({
  buddyName,
  currentUser,
  messages = [],
  dealId = null,
  dealStatus = null,
  dealTerms = null,
  onSendMessage,
  onStartNegotiation,
  onVerify,
  verified = false,
  warningLevel = 0,
}) {
  const [inputText, setInputText] = useState('');
  const endRef = useRef(null);
  const prevCountRef = useRef(messages.length);

  // Auto-scroll as messages stream in.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, dealStatus]);

  // A message is "entering" if it landed within the last render (streaming feel).
  const lastIdx = messages.length - 1;

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage?.(inputText.trim());
    setInputText('');
  };

  const isBlocked = warningLevel >= 80;
  const isLimited = warningLevel >= 50 && !isBlocked;
  const negotiating = dealStatus === 'negotiating';
  const inputDisabled = isBlocked || negotiating;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Identity / deal status header */}
      <div style={{
        padding: '6px 10px',
        borderBottom: '1px solid rgba(0,0,0,.14)',
        background: 'linear-gradient(180deg, rgba(255,255,255,.5), rgba(255,255,255,.1))',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
      }}>
        <div style={{ fontSize: 11 }}>
          <span className="embossed">Identity:</span>{' '}
          {verified ? (
            <strong style={{ color: 'var(--online)' }}>✓ Verified</strong>
          ) : (
            <strong style={{ color: 'var(--away)' }}>⚠ Unverified</strong>
          )}
          {dealStatus && (
            <span style={{ marginLeft: 8 }}>
              Deal:{' '}
              <strong style={{
                color: dealStatus === 'negotiating' ? '#b07a00'
                  : dealStatus === 'completed' ? 'var(--online)'
                  : dealStatus === 'failed' ? 'var(--blocked)' : 'var(--muted)',
              }}>{dealStatus.toUpperCase()}</strong>
            </span>
          )}
        </div>
        {!dealId && (
          verified ? (
            <GelButton
              variant="primary"
              onClick={onStartNegotiation}
              disabled={isBlocked || isLimited}
              title={isBlocked ? 'Blocked by moderation policy' : isLimited ? 'Limited — cannot initiate' : 'Initiate secure agent deal'}
              style={{ padding: '4px 12px', fontSize: 11 }}
            >
              🤝 Start Negotiation
            </GelButton>
          ) : (
            <GelButton
              variant="primary"
              onClick={onVerify}
              title="Run the Ed25519 handshake to verify this agent's identity before negotiating"
              style={{ padding: '4px 12px', fontSize: 11 }}
            >
              🔑 Verify Identity
            </GelButton>
          )
        )}
      </div>

      {/* Transcript with gel bubbles */}
      <div className="chat-transcript aqua-scroll">
        {messages.map((msg, idx) => {
          const isSelf = msg.sender === currentUser;
          const isSystem = !msg.sender || msg.sender === 'System' || msg.sender === 'system';
          const entering = idx === lastIdx && idx === prevCountRef.current; // just appended
          if (isSystem) {
            return (
              <div key={idx} style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)', padding: '2px 0' }}>
                {msg.text}
              </div>
            );
          }
          return (
            <div key={idx} className={`chat-row ${isSelf ? 'mine' : 'theirs'}`}>
              {!isSelf && <MiniPic name={msg.sender} />}
              <div className={`bubble ${isSelf ? 'mine' : 'theirs'} ${entering ? 'enter' : ''}`}>
                {msg.text}
              </div>
              {isSelf && <MiniPic name={currentUser} />}
            </div>
          );
        })}
        {negotiating && (
          <div className="chat-row theirs">
            <MiniPic name={buddyName} />
            <div className="typing-shimmer"><span /><span /><span /></div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Deal-terms settlement summary */}
      {dealTerms && (
        <div className={`deal-summary ${dealTerms.agreed ? 'ok' : 'no'}`}>
          <div style={{ fontWeight: 700, color: dealTerms.agreed ? 'var(--online)' : 'var(--blocked)' }}>
            {dealTerms.agreed ? '✓ Deal Settled' : '✗ Negotiation Failed'}
          </div>
          {dealTerms.agreed && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: 4, gap: 4 }}>
              <div>💰 Price / 1K calls: <strong>${dealTerms.price_per_1k}</strong></div>
              <div>⚡ Rate Limit: <strong>{dealTerms.rate_limit} calls/min</strong></div>
            </div>
          )}
          {dealTerms.error && <div style={{ color: 'var(--blocked)', marginTop: 2 }}>{dealTerms.error}</div>}
        </div>
      )}

      {/* Pill input row */}
      <div className="chat-input-row">
        <MiniPic name={currentUser} />
        <input
          className="chat-input"
          placeholder={
            isBlocked ? 'Blocked by moderation (warning ≥ 80%)'
              : isLimited ? 'Rate-limited (warning ≥ 50%)'
              : negotiating ? 'Negotiation in progress…'
              : 'Type a message…'
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={inputDisabled}
        />
        <GelButton
          variant="primary"
          onClick={handleSend}
          disabled={inputDisabled || !inputText.trim()}
          style={{ padding: '5px 14px' }}
        >
          Send
        </GelButton>
      </div>
    </div>
  );
}
