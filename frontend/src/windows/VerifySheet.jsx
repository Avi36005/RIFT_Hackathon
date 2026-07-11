import { useState, useEffect } from 'react';
import Sheet from '../aqua/Sheet';
import GelButton from '../aqua/GelButton';

/**
 * VerifySheet — the "prove it" moment, rendered as an Aqua Sheet that slides
 * down from under the parent window's title bar. Shows the REAL handshake
 * step-by-step and reflects the actual backend result (not a canned animation).
 *
 * Steps: Issuing challenge → Nonce: a3f9… → Awaiting signature → Signature
 * received → "✓ Identity Verified — ED25519:…" or red "✗ Verification failed".
 * The imposter path signs with the wrong key → fails (the trust money-shot).
 *
 * Logic is ported from the prior VerifyModal; only presentation is Aqua.
 */
export default function VerifySheet({ fromName, toName, imposter = false, onClose, onComplete, api }) {
  const [steps, setSteps] = useState([]);
  const [status, setStatus] = useState('pending'); // pending | verified | failed
  const [fingerprint, setFingerprint] = useState('');

  useEffect(() => {
    let active = true;

    async function runHandshake() {
      try {
        // Step 1: issue challenge
        if (!active) return;
        setSteps([{ text: 'Issuing challenge…', state: 'active' }]);
        await new Promise((r) => setTimeout(r, 600));

        const initRes = await api.initiateHandshake(fromName, toName);
        if (!active) return;
        const nonceShort = (initRes.nonce || '').slice(0, 16);
        setSteps([
          { text: `Challenge issued. Nonce: ${nonceShort}…`, state: 'done' },
          { text: 'Awaiting agent signature…', state: 'active' },
        ]);

        // Step 2: target agent signs & server verifies
        await new Promise((r) => setTimeout(r, 800));
        if (!active) return;
        const verifyRes = await api.runDemoVerify(fromName, toName, imposter);
        if (!active) return;

        await new Promise((r) => setTimeout(r, 500));
        if (!active) return;

        setFingerprint(verifyRes.fingerprint);
        if (verifyRes.verified) {
          setStatus('verified');
          setSteps((prev) => [
            ...prev.slice(0, -1),
            { text: 'Signature received.', state: 'done' },
            { text: `✓ Identity Verified — bound to ED25519:${verifyRes.fingerprint}`, state: 'done' },
          ]);
          onComplete?.(true);
        } else {
          setStatus('failed');
          setSteps((prev) => [
            ...prev.slice(0, -1),
            { text: 'Signature received.', state: 'done' },
            { text: `✗ Verification failed — signature does not match ED25519:${verifyRes.fingerprint}`, state: 'fail' },
          ]);
          onComplete?.(false);
        }
      } catch (err) {
        if (!active) return;
        setStatus('failed');
        setSteps((prev) => [...prev, { text: `Error: ${err.message}`, state: 'fail' }]);
        onComplete?.(false);
      }
    }

    runHandshake();
    return () => { active = false; };
  }, [fromName, toName, imposter]);

  return (
    <Sheet onClose={() => {}}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }} className="embossed">
        Cryptographic Identity Handshake
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
        Verifying trust: <strong>{fromName}</strong> ↔ <strong>{toName}</strong>
        {imposter && <span style={{ color: 'var(--blocked)', fontWeight: 700, marginLeft: 6 }}>(Imposter mode — wrong key)</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {steps.map((step, idx) => (
          <div key={idx} className={`sheet-step ${step.state}`}>
            <span className="step-dot">
              {step.state === 'done' ? '✓' : step.state === 'fail' ? '✗' : ''}
            </span>
            <span>{step.text}</span>
          </div>
        ))}
      </div>

      {status !== 'pending' && (
        <div className={`sheet-result ${status === 'verified' ? 'ok' : 'no'}`}>
          {status === 'verified' ? (
            <>
              <div>✓ Identity Verified</div>
              <div className="mono-fingerprint" style={{ marginTop: 4 }}>
                ED25519:{fingerprint}
              </div>
            </>
          ) : (
            <>
              <div>✗ Verification Failed</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                The signature could not be verified against the registered identity key.
              </div>
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <GelButton variant="primary" onClick={onClose} disabled={status === 'pending'}>
          {status === 'pending' ? 'Verifying…' : 'Done'}
        </GelButton>
      </div>
    </Sheet>
  );
}
