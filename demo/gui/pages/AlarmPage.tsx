import { useVariable, useWrite, VariableScope } from 'lux-react';
import { PageHeader } from '../components/PageHeader';

const alarmDefs = [
  {
    path: 'TempHigh',
    label: 'Temperature High',
    severity: 'warning' as const,
    description: 'Motor temperature exceeds warning threshold',
  },
  {
    path: 'PressureHigh',
    label: 'Pressure High',
    severity: 'warning' as const,
    description: 'Hydraulic pressure exceeds warning threshold',
  },
  {
    path: 'SpeedFault',
    label: 'Overspeed Fault',
    severity: 'critical' as const,
    description: 'Motor speed exceeds configured speed limit',
  },
];

export function AlarmPage() {
  const [anyActive] = useVariable<boolean>('HMIDemo.Alarms.AnyActive', {
    defaultValue: false,
  });
  const writeAck = useWrite<boolean>('HMIDemo.Alarms.AckAll');

  return (
    <div className="page">
      <PageHeader title="Alarms" description="Active alarm conditions">
        <button
          className="ack-btn"
          onClick={() => void writeAck(true)}
          disabled={!anyActive}
        >
          Acknowledge All
        </button>
      </PageHeader>

      <VariableScope prefix="HMIDemo.Alarms">
        <div className="alarm-list">
          {alarmDefs.map((a) => (
            <AlarmRow key={a.path} {...a} />
          ))}
        </div>
      </VariableScope>

      {!anyActive && (
        <div className="alarm-empty">No active alarms</div>
      )}
    </div>
  );
}

// ---- Alarm row ----------------------------------------------------

function AlarmRow({
  path,
  label,
  severity,
  description,
}: {
  path: string;
  label: string;
  severity: 'warning' | 'critical';
  description: string;
}) {
  const [active] = useVariable<boolean>(path, { defaultValue: false });
  const isActive = active ?? false;

  return (
    <div
      className={`alarm-row${isActive ? ` alarm-row--${severity}` : ''}`}
    >
      <span
        className={`alarm-dot${isActive ? ` alarm-dot--${severity}` : ''}`}
      />
      <div className="alarm-info">
        <span className="alarm-label">{label}</span>
        <span className="alarm-desc">{description}</span>
      </div>
      <span className={`alarm-status${isActive ? ' alarm-status--active' : ''}`}>
        {isActive ? 'ACTIVE' : 'OK'}
      </span>
    </div>
  );
}
