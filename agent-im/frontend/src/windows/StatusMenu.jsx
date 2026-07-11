import { useState } from 'react';
import GelButton from '../aqua/GelButton';

/**
 * StatusMenu — the status popup (Available / Away / Busy) with an editable
 * custom away message. Ports the prior AwayMsg behavior into Aqua chrome.
 * Saves presence via onSave(status, awayMessage).
 */
export default function StatusMenu({ currentStatus = 'online', currentMessage = '', onSave, onClose }) {
  const [status, setStatus] = useState(currentStatus);
  const [msg, setMsg] = useState(currentMessage);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave?.(status, msg.trim() || null);
    } catch (err) {
      alert(`Failed to save presence: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ fontSize: 12, fontWeight: 700 }} className="embossed">My Status</div>

      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }} className="embossed">
          Availability
        </label>
        <select
          className="aqua-select"
          style={{ width: '100%' }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="online">🟢 Available</option>
          <option value="away">🟡 Away</option>
          <option value="busy">🔴 Busy</option>
        </select>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }} className="embossed">
          Away Message
        </label>
        <textarea
          className="aqua-textarea"
          style={{ width: '100%', flex: 1, resize: 'none' }}
          placeholder="I'm away from my desk…"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <GelButton onClick={onClose} disabled={saving}>Cancel</GelButton>
        <GelButton variant="primary" pulse onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Apply'}
        </GelButton>
      </div>
    </div>
  );
}
