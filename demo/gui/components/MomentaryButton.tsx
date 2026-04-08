import { useMomentary } from 'lux-react';

interface MomentaryButtonProps {
  /** PLC variable path to write true/false to. */
  path: string;
  /** Button label. */
  children: React.ReactNode;
  className?: string;
  machineId?: string;
  disabled?: boolean;
}

/**
 * A button that writes `true` to a PLC variable while held and `false` on release.
 * Also releases on unmount so the PLC is never left stuck.
 */
export function MomentaryButton({
  path,
  children,
  className = '',
  machineId,
  disabled,
}: MomentaryButtonProps) {
  const { pressed, handlers } = useMomentary(path, machineId ? { machineId } : undefined);

  return (
    <button
      {...handlers}
      className={`momentary-btn${pressed ? ' momentary-btn--active' : ''}${className ? ` ${className}` : ''}`}
      disabled={disabled}
      // Prevent context menu on long-press (mobile)
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
