import { useState, useEffect } from 'react';

/**
 * MenuBar — thin (~22px) translucent white bar pinned to the top of the screen.
 *
 * Left: an ORIGINAL menu glyph (stylized speech-bubble mark — never Apple's logo),
 * then a bold app-name menu ("Agent Messenger"), then File / Edit / Buddies / View.
 * Right: a couple of status glyphs and a LIVE clock ("Sun 9:41 PM").
 *
 * `buddiesMenu` is a list of {label, onClick, disabled} items rendered under the
 * Buddies menu so it can act on the currently-selected buddy.
 */

// Original app glyph — a glossy speech bubble (homage, not a trademark).
function AppGlyph() {
  return (
    <svg className="menubar-logo" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="mb-gel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cfe6ff" />
          <stop offset="55%" stopColor="#4a90e2" />
          <stop offset="100%" stopColor="#1c5fcb" />
        </linearGradient>
      </defs>
      <path d="M3 5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H9l-5 4z" fill="url(#mb-gel)"
        stroke="rgba(255,255,255,.6)" strokeWidth="1" />
      <circle cx="8.5" cy="9" r="1.3" fill="#fff" />
      <circle cx="12" cy="9" r="1.3" fill="#fff" />
      <circle cx="15.5" cy="9" r="1.3" fill="#fff" />
    </svg>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 20);
    return () => clearInterval(t);
  }, []);
  // "Sun 9:41 PM"
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return <span className="menubar-clock">{days[now.getDay()]} {h}:{m} {ampm}</span>;
}

export default function MenuBar({ buddiesMenu = [], onRunDemo, onSeed, onReset, onToggleSound, soundOn }) {
  const [open, setOpen] = useState(null); // which menu name is open

  const close = () => setOpen(null);

  const MenuItem = ({ name, label, bold = false, items }) => (
    <div
      className={`menu-item ${bold ? 'bold' : ''}`}
      onMouseDown={(e) => { e.stopPropagation(); setOpen(open === name ? null : name); }}
      onMouseEnter={() => open && setOpen(name)}
    >
      {label}
      {open === name && items && (
        <div className="aqua-menubar-dropdown" onMouseDown={(e) => e.stopPropagation()}>
          {items.map((it, idx) =>
            it.sep ? (
              <div key={idx} className="dd-sep" />
            ) : (
              <div
                key={idx}
                className={`dd-item ${it.disabled ? 'disabled' : ''}`}
                onClick={() => { close(); it.onClick?.(); }}
              >
                {it.label}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 9400 }} onClick={close} />}
      <div className="aqua-menubar">
        <AppGlyph />
        <MenuItem name="app" label="Agent Messenger" bold items={[
          { label: '⚡ Run Demo Flow', onClick: onRunDemo },
          { label: '🌱 Seed Demo Agents', onClick: onSeed },
          { label: '🔄 Reset Database', onClick: onReset },
          { sep: true },
          { label: soundOn ? '🔇 Mute Sound' : '🔊 Enable Sound', onClick: onToggleSound },
        ]} />
        <MenuItem name="file" label="File" items={[
          { label: 'Close Window', onClick: () => {} },
        ]} />
        <MenuItem name="edit" label="Edit" items={[
          { label: 'Undo', disabled: true },
          { label: 'Redo', disabled: true },
        ]} />
        <MenuItem name="buddies" label="Buddies" items={buddiesMenu} />
        <MenuItem name="view" label="View" items={[
          { label: 'Show Offline Buddies', onClick: () => {} },
        ]} />

        <div className="menubar-right">
          <span title={soundOn ? 'Sound on' : 'Muted'}>{soundOn ? '🔊' : '🔇'}</span>
          <span aria-hidden>📶</span>
          <span aria-hidden>🔋</span>
          <Clock />
        </div>
      </div>
    </>
  );
}
