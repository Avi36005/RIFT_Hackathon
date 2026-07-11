/**
 * sounds.js — original, royalty-free sound equivalents synthesized via the Web
 * Audio API (no external audio assets shipped — keeps the submission clean and
 * zero-dependency). These are NOT any platform's real system sounds.
 *
 * Clips:
 *   door_open — soft login chime on sign-on (rising sweep)
 *   buddy_online — "buddy online" blip when an agent comes up
 *   message — incoming-message "blip" as each bubble lands
 *   warn — distinct alert tone when a warning fires
 *   verify — success chime when identity verification passes
 *
 * `createSounds(mutedRef)` returns a play(type) function. Pass a ref/object with
 * a `.current` boolean (or just a boolean) so the mute toggle is read live.
 */
export function createSounds(getMuted) {
  const readMuted = () => {
    if (typeof getMuted === 'function') return getMuted();
    if (getMuted && typeof getMuted === 'object') return !!getMuted.current;
    return !!getMuted;
  };

  return function play(type) {
    if (readMuted()) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      switch (type) {
        case 'door_open': // sign-on chime
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
          break;

        case 'buddy_online': // buddy-online blip
          osc.type = 'sine';
          osc.frequency.setValueAtTime(660, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.18);
          gain.gain.setValueAtTime(0.07, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
          osc.start();
          osc.stop(ctx.currentTime + 0.22);
          break;

        case 'message': // incoming-message blip
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1200, ctx.currentTime);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
          break;

        case 'warn': // alert tone
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(150, ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
          break;

        case 'verify': // success chime
          osc.frequency.setValueAtTime(600, ctx.currentTime);
          osc.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
          osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.2);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
          break;

        default:
          break;
      }
    } catch (_) {
      // Audio is best-effort — never block the demo.
    }
  };
}
