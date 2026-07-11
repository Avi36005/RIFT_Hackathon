/**
 * Pinstripe — the very faint horizontal pinstripe texture that Aqua's interior
 * white panels carry. The .aqua-window-body already paints this; this component
 * is a reusable overlay for any extra panel that wants it.
 *
 * (repeating-linear-gradient of ~2px bands, ~2-3% darker — texture, not stripes
 * you consciously notice.)
 */
export default function Pinstripe({ children, className = '', style = {} }) {
  return (
    <div
      className={`aqua-pinstripe ${className}`}
      style={{
        background:
          'repeating-linear-gradient(180deg, var(--pinstripe) 0 1px, transparent 1px 3px), var(--panel)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
