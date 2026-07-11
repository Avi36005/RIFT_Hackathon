import { useState, useRef, useCallback, useEffect } from 'react';
import TrafficLights from './TrafficLights';

/**
 * Window — a draggable brushed-metal Aqua window.
 *
 * Chrome = brushed metal (textured aluminium + faint vertical noise + gradient).
 * Title is centered, Lucida Grande, dark grey, embossed (white text-shadow).
 * Left-side traffic lights (close/min/zoom). Big soft drop shadow so it floats.
 * Rounded ~8-10px top corners. Optional bottom-right resize grip.
 *
 * The drag + resize mechanics are ported from the prior window manager; only the
 * visual chrome is Aqua.
 */
export default function Window({
  id,
  title = 'Window',
  children,
  defaultPosition = { x: 100, y: 40 },
  defaultSize = { width: 320, height: 360 },
  resizable = true,
  onClose,
  onMinimize,
  onFocus,
  focused = false,
  minimized = false,
  style = {},
  sheet = null, // optional <Sheet/> rendered inside the window body
}) {
  const [position, setPosition] = useState(defaultPosition);
  const [size, setSize] = useState(defaultSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const prevRect = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // ---------- Zoom / maximize (green orb + double-click title) ----------
  const toggleZoom = useCallback(() => {
    setMaximized((wasMax) => {
      if (!wasMax) {
        prevRect.current = { position, size };
        const pad = 10;
        setPosition({ x: pad, y: 26 });
        setSize({
          width: Math.max(320, window.innerWidth - pad * 2),
          height: Math.max(240, window.innerHeight - 26 - pad),
        });
        onFocus?.();
        return true;
      }
      if (prevRect.current) {
        setPosition(prevRect.current.position);
        setSize(prevRect.current.size);
      }
      return false;
    });
  }, [position, size, onFocus]);

  // ---------- Drag (title bar) ----------
  const onTitleMouseDown = useCallback((e) => {
    if (e.target.closest('.aqua-traffic-lights')) return; // don't drag from orbs
    setIsDragging(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    onFocus?.();
  }, [position, onFocus]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: Math.max(22, e.clientY - dragOffset.current.y), // keep below the menu bar
      });
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  // ---------- Resize (bottom-right grip) ----------
  const onResizeMouseDown = useCallback((e) => {
    e.stopPropagation();
    setIsResizing(true);
    dragOffset.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height };
  }, [size]);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e) => {
      setSize({
        width: Math.max(200, dragOffset.current.w + (e.clientX - dragOffset.current.x)),
        height: Math.max(120, dragOffset.current.h + (e.clientY - dragOffset.current.y)),
      });
    };
    const onUp = () => setIsResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizing]);

  if (minimized) return null;

  return (
    <div
      className={`aqua-window ${focused ? 'focused' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: focused ? 100 : 10,
        ...style,
      }}
      onMouseDown={() => onFocus?.()}
    >
      {/* Brushed-metal title bar */}
      <div className="aqua-title-bar" onMouseDown={onTitleMouseDown} onDoubleClick={toggleZoom}>
        <TrafficLights
          onClose={onClose}
          onMinimize={onMinimize}
          onZoom={toggleZoom}
          showZoom={true}
        />
        <span className="aqua-title-text">{title}</span>
      </div>

      {/* Body: faint pinstripe + optional sheet */}
      <div className="aqua-window-body">
        {children}
        {sheet}
      </div>

      {/* Resize grip */}
      {resizable && (
        <div
          onMouseDown={onResizeMouseDown}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 16,
            height: 16,
            cursor: 'nwse-resize',
            background:
              'linear-gradient(135deg, transparent 50%, rgba(0,0,0,.18) 50%, transparent 56%, transparent 66%, rgba(0,0,0,.18) 66%, transparent 72%, transparent 82%, rgba(0,0,0,.18) 82%)',
          }}
        />
      )}
    </div>
  );
}
