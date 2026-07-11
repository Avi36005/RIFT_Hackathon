/**
 * GelButton — Aqua "gel" pill button. Four-layer gloss recipe in index.css.
 *
 * variant:
 *   "primary"   → aqua-blue gradient (the default action); pass `pulse` to make
 *                 it gently breathe (OS X's pulsing default button).
 *   "secondary" → silver gloss (default).
 */
export default function GelButton({
  children,
  variant = 'secondary',
  pulse = false,
  className = '',
  ...rest
}) {
  const classes = [
    'gel-btn',
    variant === 'primary' ? 'primary' : '',
    pulse ? 'pulse' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
