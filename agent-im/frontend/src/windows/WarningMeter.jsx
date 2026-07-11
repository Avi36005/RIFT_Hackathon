import { useState } from 'react';
import GelButton from '../aqua/GelButton';

/**
 * WarningMeter — file a warning report against an agent + visualize the current
 * warning level with a glossy gel meter that fills toward red. Ports the prior
 * WarningMeter behavior into Aqua chrome.
 */
export default function WarningMeter({ screenName, warningLevel = 0, onWarn, onClose }) {
  const [reason, setReason] = useState('');
  const [weight, setWeight] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  const handleWarn = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await onWarn?.(screenName, reason.trim(), weight);
      setReason('');
    } catch (err) {
      alert(`Failed to file warning: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const meterColor = warningLevel >= 80 ? 'var(--blocked)' : warningLevel >= 50 ? 'var(--away)' : 'var(--online)';

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ fontSize: 12, fontWeight: 700 }} className="embossed">
        Warning Level: {screenName}
      </div>

      {/* Glossy meter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="warn-meter-track" style={{ flex: 1 }}>
          <div className="warn-meter-fill" style={{ width: `${warningLevel}%` }} />
        </div>
        <span style={{ fontWeight: 700, minWidth: 34, textAlign: 'right', color: meterColor }}>{warningLevel}%</span>
      </div>
      <div className="dim" style={{ fontSize: 10 }}>
        ≥ 50%: limited (cannot initiate negotiations)<br />
        ≥ 80%: blocked (all communication suspended)
      </div>

      {/* Report form */}
      <div style={{
        padding: 8,
        borderRadius: 8,
        background: 'rgba(255,255,255,.6)',
        border: '1px solid rgba(0,0,0,.18)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,.12)',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{ fontWeight: 700, fontSize: 10 }} className="embossed">Report Infraction</div>
        <input
          className="aqua-input"
          style={{ width: '100%' }}
          placeholder="e.g. Protocol violation, spam, reneged on terms…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: 10 }} className="dim">
            Weight:
            <select
              className="aqua-select"
              style={{ marginLeft: 6 }}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
            >
              <option value={10}>10% (Minor)</option>
              <option value={20}>20% (Medium)</option>
              <option value={50}>50% (Major)</option>
            </select>
          </label>
          <GelButton variant="primary" onClick={handleWarn} disabled={submitting || !reason.trim()}>
            ⚠️ File Warning
          </GelButton>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
        <GelButton onClick={onClose}>Close</GelButton>
      </div>
    </div>
  );
}
