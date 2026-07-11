import { useState } from 'react';

/**
 * BuddyList — iChat-style tall, narrow brushed-metal buddy list.
 *
 * Top: self row (buddy-pic thumb + screen name + status popup text). A search
 * field below. Then grouped buddies ("Buddies" / "Offline"). Each row: buddy-pic
 * thumbnail + name + status line + colored status dot + a glossy ✓ Verified seal
 * on the pic once verified + warning % in muted text.
 *
 * Ctrl-click a row (Mac had no right-click) or use the Buddies menu → Send
 * Message / Verify Identity / Get Info / Warn. Bottom gel toolbar.
 *
 * Keeps the same callback contract as before: onSendIM/onVerify/onWarn/onGetInfo.
 */

// Phase-1 mock fallback so the list renders before sign-on / without a backend.
const MOCK_BUDDIES = [
  { screenName: 'AgentBuyer42', status: 'online', verified: true, warningLevel: 5 },
  { screenName: 'DataSeller_X', status: 'online', verified: true, warningLevel: 0 },
  { screenName: 'APIBroker99', status: 'away', verified: false, warningLevel: 25 },
  { screenName: 'CryptoBot_3', status: 'busy', verified: true, warningLevel: 60 },
];
const MOCK_OFFLINE = [
  { screenName: 'IdleAgent_7', status: 'offline', verified: false, warningLevel: 0 },
  { screenName: 'TradeBot_Z', status: 'offline', verified: true, warningLevel: 10 },
];

// Deterministic buddy-pic color from a screen name (no external avatars shipped).
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

const STATUS_LABEL = { online: 'Available', away: 'Away', busy: 'Busy', offline: 'Offline' };

function BuddyRow({ buddy, selected, onSelect, onContext, onDoubleClick }) {
  const dotClass = buddy.warningLevel >= 80 ? 'blocked'
    : buddy.status === 'online' ? 'online'
    : buddy.status === 'away' ? 'away'
    : 'offline';
  return (
    <div
      className={`buddy-row ${selected ? 'selected' : ''}`}
      onClick={() => onSelect?.(buddy)}
      onContextMenu={(e) => { e.preventDefault(); onContext?.(e, buddy); }}
      onDoubleClick={() => onDoubleClick?.(buddy)}
    >
      <div className="buddy-pic" style={{ background: picGradient(buddy.screenName) }}>
        {initials(buddy.screenName)}
        {buddy.verified && <span className="verified-seal" title="Identity Verified">✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="buddy-row-name">{buddy.screenName}</div>
        <div className="buddy-row-status">
          {STATUS_LABEL[buddy.status] || buddy.status}
          {buddy.warningLevel > 0 && <> · <span style={{ color: buddy.warningLevel >= 50 ? '#b03030' : undefined }}>{buddy.warningLevel}%</span></>}
        </div>
      </div>
      <span className={`status-dot ${dotClass}`} title={STATUS_LABEL[buddy.status]} />
    </div>
  );
}

export default function BuddyList({
  currentUser = 'MyAgent',
  currentStatus = 'online',
  currentAwayMessage = '',
  buddies = MOCK_BUDDIES,
  offlineBuddies = MOCK_OFFLINE,
  onSendIM,
  onVerify,
  onWarn,
  onGetInfo,
  onStatusOpen,
}) {
  const [expOnline, setExpOnline] = useState(true);
  const [expOffline, setExpOffline] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [menu, setMenu] = useState(null); // {x,y,buddy}

  const closeMenu = () => setMenu(null);

  const doAction = (action, buddy) => {
    closeMenu();
    const b = buddy;
    switch (action) {
      case 'im': onSendIM?.(b); break;
      case 'verify': onVerify?.(b); break;
      case 'warn': onWarn?.(b); break;
      case 'info': onGetInfo?.(b); break;
    }
  };

  const onContext = (e, buddy) => setMenu({ x: e.clientX, y: e.clientY, buddy });

  const filterFn = (b) => !query || b.screenName.toLowerCase().includes(query.toLowerCase());
  const online = buddies.filter(filterFn);
  const offline = offlineBuddies.filter(filterFn);

  const selfDot = currentStatus === 'online' ? 'online' : currentStatus === 'away' ? 'away' : currentStatus === 'busy' ? 'blocked' : 'offline';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Self row */}
      <div className="buddylist-self">
        <div className="buddy-pic" style={{ background: picGradient(currentUser) }}>
          {initials(currentUser)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 12 }} className="embossed">{currentUser}</div>
          <div className="dim" style={{ fontSize: 10 }}>
            {STATUS_LABEL[currentStatus] || 'Available'}
            {currentAwayMessage ? ` — ${currentAwayMessage}` : ''}
          </div>
        </div>
        <span className={`status-dot ${selfDot}`} />
        <button className="gel-icon-btn" title="Set status / away message" onClick={onStatusOpen}>✎</button>
      </div>

      {/* Search */}
      <div className="buddylist-search">
        <input
          className="aqua-search"
          style={{ width: '100%' }}
          placeholder="Search buddies"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Groups */}
      <div className="aqua-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div
          className="buddylist-group-header"
          onClick={() => setExpOnline(!expOnline)}
        >
          {expOnline ? '▾' : '▸'} Buddies ({online.length}/{online.length + offline.length})
        </div>
        {expOnline && online.map((b) => (
          <BuddyRow
            key={b.screenName}
            buddy={b}
            selected={selected?.screenName === b.screenName}
            onSelect={setSelected}
            onContext={onContext}
            onDoubleClick={(bdy) => onSendIM?.(bdy)}
          />
        ))}

        <div
          className="buddylist-group-header"
          onClick={() => setExpOffline(!expOffline)}
        >
          {expOffline ? '▾' : '▸'} Offline ({offline.length})
        </div>
        {expOffline && offline.map((b) => (
          <BuddyRow
            key={b.screenName}
            buddy={b}
            selected={selected?.screenName === b.screenName}
            onSelect={setSelected}
            onContext={onContext}
            onDoubleClick={(bdy) => onSendIM?.(bdy)}
          />
        ))}
      </div>

      {/* Bottom gel toolbar */}
      <div className="buddylist-toolbar">
        <button
          className="gel-icon-btn"
          title="Send Message"
          disabled={!selected}
          onClick={() => selected && doAction('im', selected)}
        >💬</button>
        <button
          className="gel-icon-btn"
          title="Get Info"
          disabled={!selected}
          onClick={() => selected && doAction('info', selected)}
        >ℹ️</button>
        <button
          className="gel-icon-btn"
          title="Verify Identity"
          disabled={!selected}
          onClick={() => selected && doAction('verify', selected)}
        >🔑</button>
        <button
          className="gel-icon-btn"
          title="Warn"
          disabled={!selected}
          onClick={() => selected && doAction('warn', selected)}
        >⚠️</button>
        <div style={{ flex: 1 }} />
        <button className="gel-icon-btn" title="Add buddy">＋</button>
      </div>

      {/* Ctrl-click / right-click context menu */}
      {menu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 11000 }} onClick={closeMenu} onContextMenu={(e) => { e.preventDefault(); closeMenu(); }} />
          <div className="aqua-context-menu" style={{ left: menu.x, top: menu.y }}>
            <div className="ctx-item" onClick={() => doAction('im', menu.buddy)}>💬 Send Message</div>
            <div className="ctx-item" onClick={() => doAction('verify', menu.buddy)}>🔑 Verify Identity</div>
            <div className="ctx-sep" />
            <div className="ctx-item" onClick={() => doAction('info', menu.buddy)}>ℹ️ Get Info</div>
            <div className="ctx-item" onClick={() => doAction('warn', menu.buddy)}>⚠️ Warn</div>
          </div>
        </>
      )}
    </div>
  );
}
