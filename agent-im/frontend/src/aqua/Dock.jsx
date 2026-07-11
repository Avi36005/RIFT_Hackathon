import { useState, useRef } from 'react';

/**
 * Dock — bottom-center translucent rounded-rectangle shelf with a subtle
 * reflective floor line. Large glossy rounded-square icons (original homages).
 *
 * MAGNIFICATION (fisheye): as the pointer moves across the dock, the hovered
 * icon scales up and its neighbors scale progressively less based on their
 * horizontal distance from the pointer. This is the signature Aqua moment.
 *
 * Each item: { id, label, emoji, color (CSS background), running?, onClick }.
 *
 * `runningIds` is the set of ids that should show a running-indicator dot.
 */
const MAX_SCALE = 1.7;       // hovered icon scale
const INFLUENCE = 130;       // px radius of the fisheye falloff

export default function Dock({ items = [], runningIds = [], onItemClick }) {
  const [mouseX, setMouseX] = useState(null); // pointer x relative to the dock content
  const wrapRef = useRef(null);

  const onMove = (e) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMouseX(e.clientX - rect.left);
  };

  return (
    <div className="aqua-dock-wrap" ref={wrapRef} onMouseMove={onMove} onMouseLeave={() => setMouseX(null)}>
      {items.map((it, idx) => {
        // center x of this icon, approximated from its offset within the dock
        // Each item is ~56px wide (44 icon + gaps/padding). We compute live.
        const itemCenterX = idx * 56 + 28;
        const dist = mouseX == null ? Infinity : Math.abs(mouseX - itemCenterX);
        let scale = 1;
        if (dist < INFLUENCE) {
          const t = 1 - dist / INFLUENCE; // 0..1
          scale = 1 + (MAX_SCALE - 1) * Math.pow(t, 1.4);
        }
        const running = runningIds.includes(it.id);

        return (
          <div
            key={it.id}
            className="aqua-dock-item"
            style={{ transform: `scale(${scale})`, ['--dock-bg']: it.color }}
            onClick={() => onItemClick?.(it)}
            title={it.label}
          >
            <span className="dock-label">{it.label}</span>
            <div className="dock-icon">{it.emoji}</div>
            <div className="dock-reflection" />
            {running && <span className="dock-indicator" />}
          </div>
        );
      })}
    </div>
  );
}
