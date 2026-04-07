interface ReadoutProps {
  label: string;
  value: string | number;
  unit?: string;
  loading?: boolean;
  warn?: boolean;
  highlight?: boolean;
}

export function Readout({ label, value, unit, loading, warn, highlight }: ReadoutProps) {
  const cls = [
    'readout',
    warn ? 'readout--warn' : '',
    highlight ? 'readout--highlight' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls}>
      <span className="readout-label">{label}</span>
      <span className="readout-value">
        {loading ? (
          <span className="readout-loading">&mdash;</span>
        ) : (
          <>
            {typeof value === 'number' ? formatNumber(value) : value}
            {unit && <span className="readout-unit"> {unit}</span>}
          </>
        )}
      </span>
    </div>
  );
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
