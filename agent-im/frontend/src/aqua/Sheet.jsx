/**
 * Sheet — a very Mac modal: it slides DOWN from under the parent window's title
 * bar, attached to the window, dimming the window behind it. Renders inside the
 * window body (position: absolute) so it stays attached when the window drags.
 *
 * `onClose` closes the sheet. Children are the sheet's contents.
 */
export default function Sheet({ children, onClose }) {
  return (
    <>
      <div className="aqua-sheet-backdrop" onClick={onClose} />
      <div className="aqua-sheet" role="dialog" aria-modal="true">
        {children}
      </div>
    </>
  );
}
