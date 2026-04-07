interface IndicatorProps {
  active: boolean;
  label: string;
  color: 'green' | 'yellow' | 'red' | 'blue';
}

export function Indicator({ active, label, color }: IndicatorProps) {
  return (
    <div className="indicator">
      <span className={`indicator-dot${active ? ` indicator-dot--${color}` : ''}`} />
      <span className="indicator-label">{label}</span>
    </div>
  );
}
