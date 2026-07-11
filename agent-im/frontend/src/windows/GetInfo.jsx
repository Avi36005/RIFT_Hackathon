import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import GelButton from '../aqua/GelButton';

/**
 * GetInfo — small Aqua inspector for a buddy. Replaces the prior alert() popup.
 *
 * Shows: buddy pic, screen name, key fingerprint, verified status, and a glossy
 * warning-level meter (fills toward red as level rises; ticks up live via the
 * parent when a warning WS event lands — re-fetched every few seconds here too).
 * A "Warn" gel button lives here as well.
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

export default function GetInfo({ screenName, initialWarningLevel = 0, onWarn, onClose }) {
  const [info, setInfo] = useState(null);
  const [level, setLevel] = useState(initialWarningLevel);

  // Fetch the public profile + current moderation level.
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [prof, mod] = await Promise.all([
          api.getAgent(screenName).catch(() => null),
          api.getModeration(screenName).catch(() => null),
        ]);
        if (!active) return;
        if (prof) setInfo(prof);
        if (mod && typeof mod.warning_level === 'number') setLevel(mod.warning_level);
      } catch (_) {}
    }
    load();
    const t = setInterval(load, 4000); // keep the meter fresh as warnings land
    return () => { active = false; clearInterval(t); };
  }, [screenName]);

  const fingerprint = info?.public_key_fingerprint || info?.public_key || '—';
  const verifiedCount = info?.verified_buddy_count ?? 0;
  const status = info?.status || 'offline';

  const meterColor = level >= 80 ? 'var(--blocked)' : level >= 50 ? 'var(--away)' : 'var(--online)';

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* Header: buddy pic + name + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="buddy-pic lg" style={{ background: picGradient(screenName) }}>
          {initials(screenName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }} className="embossed">{screenName}</div>
          <div className="dim" style={{ fontSize: 11 }}>Status: {status}</div>
          <div className="dim" style={{ fontSize: 11 }}>Verified buddies: {verifiedCount}</div>
        </div>
      </div>

      {/* Key fingerprint */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 3 }} className="embossed">Identity Fingerprint</div>
        <div className="mono-fingerprint">ED25519:{fingerprint}</div>
      </div>

      {/* Warning-level meter */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700 }} className="embossed">Warning Level</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: meterColor }}>{level}%</span>
        </div>
        <div className="warn-meter-track">
          <div className="warn-meter-fill" style={{ width: `${level}%` }} />
        </div>
        <div className="dim" style={{ fontSize: 10, marginTop: 4 }}>
          ≥ 50%: limited (no new deals) · ≥ 80%: blocked
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <GelButton onClick={onClose}>Close</GelButton>
        <GelButton variant="primary" onClick={() => onWarn?.(screenName)}>⚠️ Warn</GelButton>
      </div>
    </div>
  );
}
