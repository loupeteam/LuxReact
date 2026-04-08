import { useCallback, useEffect, useRef, useState } from 'react';
import { useResolvedContext } from './useResolvedContext';
import { useVariablePrefix, resolvePath } from '../context/VariableScopeContext';

export interface MomentaryHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
}

export interface MomentaryResult {
  /** True while the control is being held. Use for visual feedback. */
  pressed: boolean;
  /** Spread these directly onto the element: <button {...handlers} /> */
  handlers: MomentaryHandlers;
}

export interface MomentaryConfig {
  /** Value written when the control is pressed. Default: `true` */
  pressValue?: unknown;
  /** Value written when the control is released. Default: `false` */
  releaseValue?: unknown;
  /**
   * If set, the `pressValue` is re-written to `path` every `intervalMs`
   * milliseconds while the control is held. Useful for jog commands where the
   * PLC expects a repeating pulse rather than a single rising edge.
   */
  intervalMs?: number;
  /**
   * Optional second variable written on each interval tick (requires `intervalMs`).
   * Useful for a PLC watchdog / handshake signal that must change each cycle.
   * Path is resolved against the nearest VariableScope prefix, same as `path`.
   */
  heartbeatPath?: string;
  /**
   * Value written to `heartbeatPath` on each tick. Default: `true`.
   * The PLC is expected to reset this variable each scan cycle; a missing
   * tick (tab hidden, connection lost) is how it detects the signal is gone.
   */
  heartbeatValue?: unknown;
  /** Optional: target a specific machine by id */
  machineId?: string;
}

/**
 * Write-on-press, write-on-release hook for momentary PLC controls.
 *
 * Writes `pressValue` as soon as the pointer goes down and `releaseValue` when
 * it comes up, leaves the element, or is cancelled. Critically, also writes
 * `releaseValue` on component unmount so the PLC is never left in the pressed
 * state if the UI navigates away while the control is held.
 *
 * @param path   Variable path (resolved against nearest VariableScope prefix)
 * @param config Optional: pressValue, releaseValue, machineId
 *
 * @example
 * function JogButton() {
 *   const { pressed, handlers } = useMomentary('Motor.Jog');
 *   return <button {...handlers} className={pressed ? 'active' : ''}>JOG</button>;
 * }
 *
 * @example
 * // Numeric jog speed: 500 while held, 0 at rest
 * const { pressed, handlers } = useMomentary('Motor.JogSpeed', { pressValue: 500, releaseValue: 0 });
 *
 * @example
 * // Jog with repeating pulse every 100 ms + PLC watchdog handshake
 * const { pressed, handlers } = useMomentary('Motor.Jog', {
 *   intervalMs: 100,
 *   heartbeatPath: 'Motor.JogAlive', // writes true each tick; PLC resets it
 * });
 */
export function useMomentary(
  path: string,
  config?: MomentaryConfig,
): MomentaryResult {
  const {
    pressValue = true,
    releaseValue = false,
    intervalMs,
    heartbeatPath,
    heartbeatValue,
    machineId,
  } = config ?? {};

  const context = useResolvedContext(machineId);
  const prefix = useVariablePrefix();
  const resolvedPath = resolvePath(path, prefix);
  const resolvedHeartbeatPath = heartbeatPath
    ? resolvePath(heartbeatPath, prefix)
    : undefined;

  const [pressed, setPressed] = useState(false);

  // Keep a ref to the latest write capability so the unmount cleanup can still
  // fire even after the context value has been torn down.
  const writeRef = useRef<((value: unknown) => Promise<void>) | null>(null);
  const writeHeartbeatRef = useRef<((value: unknown) => Promise<void>) | null>(null);
  if (context) {
    writeRef.current = (value: unknown) =>
      context.commLayer.writeVariable(resolvedPath, value) as Promise<void>;
    if (resolvedHeartbeatPath) {
      writeHeartbeatRef.current = (value: unknown) =>
        context.commLayer.writeVariable(resolvedHeartbeatPath, value) as Promise<void>;
    }
  }

  // Keep release value in a ref so unmount cleanup always uses the latest value.
  const releaseValueRef = useRef(releaseValue);
  releaseValueRef.current = releaseValue;

  const pressedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Capture config in refs so interval callbacks always use latest values.
  const intervalMsRef = useRef(intervalMs);
  intervalMsRef.current = intervalMs;
  const heartbeatValueRef = useRef(heartbeatValue);
  heartbeatValueRef.current = heartbeatValue;
  const pressValueRef = useRef(pressValue);
  pressValueRef.current = pressValue;

  const clearJogInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startJogInterval = useCallback(() => {
    if (intervalMsRef.current === undefined) return;
    clearJogInterval();
    intervalRef.current = setInterval(() => {
      writeRef.current?.(pressValueRef.current).catch(() => {});
      if (writeHeartbeatRef.current) {
        const hbValue = heartbeatValueRef.current !== undefined ? heartbeatValueRef.current : true;
        writeHeartbeatRef.current(hbValue).catch(() => {});
      }
    }, intervalMsRef.current);
  }, [clearJogInterval]);

  // Release on unmount (navigation / component teardown) and on page unload
  // (refresh / tab close). The pagehide listener handles the case where the
  // browser tears down the page without React unmounting components.
  // Note: the write may not complete if the OPC UA connection closes first;
  // the PLC watchdog is the last-resort safety net in that case.
  useEffect(() => {
    const handlePageHide = () => {
      if (pressedRef.current) {
        clearJogInterval();
        writeRef.current?.(releaseValueRef.current).catch(() => {});
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      clearJogInterval();
      if (pressedRef.current) {
        writeRef.current?.(releaseValueRef.current).catch(() => {});
      }
    };
  }, [clearJogInterval]);

  const activate = useCallback(() => {
    if (pressedRef.current) return;
    pressedRef.current = true;
    setPressed(true);
    writeRef.current?.(pressValue).catch(() => {});
    startJogInterval();
  // pressValue is intentionally in deps — if it changes between renders the
  // next press will use the new value. Release uses a ref for unmount safety.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pressValue, startJogInterval]);

  const release = useCallback(() => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    setPressed(false);
    clearJogInterval();
    writeRef.current?.(releaseValueRef.current).catch(() => {});
  }, [clearJogInterval]);

  const handlers: MomentaryHandlers = {
    onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); activate(); },
    onPointerUp: release,
    onPointerLeave: release,
    onPointerCancel: release,
  };

  return { pressed, handlers };
}

// Backwards-compat aliases — kept for any code that still imports the old names
export type MomentaryButtonHandlers = MomentaryHandlers;
export type MomentaryButtonResult = MomentaryResult;
