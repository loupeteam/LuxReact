import { useEffect, useRef, useState } from 'react';
import { useWrite } from 'lux-react';

interface HoldToConfirmProps {
  /** PLC variable path to write `true` to when confirmed. */
  path: string;
  /** How long the user must hold in milliseconds. Default 1500. */
  holdMs?: number;
  /** Button label. */
  children: React.ReactNode;
  className?: string;
  machineId?: string;
  disabled?: boolean;
}

/**
 * A button that requires the user to hold for a sustained press before the write fires.
 * Cancels if released early. A CSS fill animation shows progress while held.
 * Good for dangerous or irreversible actions (mode changes, resets, etc.).
 */
export function HoldToConfirm({
  path,
  holdMs = 1500,
  children,
  className = '',
  machineId,
  disabled,
}: HoldToConfirmProps) {
  const write = useWrite<boolean>(path, machineId);
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function startHold() {
    if (disabled) return;
    // Set animation duration as a CSS custom property directly on the DOM node —
    // avoids JSX inline styles while still supporting variable holdMs values.
    btnRef.current?.style.setProperty('--hold-duration', `${holdMs}ms`);
    setHolding(true);
    timerRef.current = setTimeout(() => {
      setHolding(false);
      void write(true);
    }, holdMs);
  }

  function cancel() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setHolding(false);
  }

  useEffect(() => cancel, []);

  return (
    <button
      ref={btnRef}
      className={`hold-btn${holding ? ' hold-btn--holding' : ''}${className ? ` ${className}` : ''}`}
      disabled={disabled}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startHold(); }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
