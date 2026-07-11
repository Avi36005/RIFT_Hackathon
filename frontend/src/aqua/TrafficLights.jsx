/**
 * TrafficLights — the three gel orbs in the top-LEFT of every Aqua window.
 * (Mac puts them left — never right.) On window-hover the ×, −, + glyphs fade in.
 * Four-layer gloss: base gradient + top-half white sheen + 1px inner light line +
 * soft inner shadow — handled in index.css (.tl-orb).
 *
 * Close #FF5F57 · Minimize #FEBC2E · Zoom #28C840.
 */
export default function TrafficLights({ onClose, onMinimize, onZoom, showMin = true, showZoom = false }) {
  return (
    <div className="aqua-traffic-lights">
      <button
        type="button"
        className="tl-orb tl-close"
        onClick={onClose}
        title="Close"
        aria-label="Close"
      >
        <span className="tl-glyph">×</span>
      </button>
      {showMin && (
        <button
          type="button"
          className="tl-orb tl-min"
          onClick={onMinimize}
          title="Minimize"
          aria-label="Minimize"
        >
          <span className="tl-glyph">−</span>
        </button>
      )}
      {showZoom && (
        <button
          type="button"
          className="tl-orb tl-zoom"
          onClick={onZoom}
          title="Zoom"
          aria-label="Zoom"
        >
          <span className="tl-glyph">+</span>
        </button>
      )}
    </div>
  );
}
