import {
  MachineProvider,
  useVariable,
  useWrite,
  useParent,
  useMachine,
  VariableScope,
  ConnectionState,
} from 'lux-react';
import { OpcuaMachine } from 'lux-opcua';
import { connectionConfig } from './config';
import './App.css';

// ---------------------------------------------------------------------------
// Single machine instance — created once at module level.
// MachineProvider calls connect() on mount and disconnect() on unmount.
// ---------------------------------------------------------------------------
const machine = new OpcuaMachine(connectionConfig);

// ---------------------------------------------------------------------------
// App root
// ---------------------------------------------------------------------------

export function App() {
  return (
    <MachineProvider id="press1" machine={machine}>
      <HMIShell />
    </MachineProvider>
  );
}

// ---------------------------------------------------------------------------
// Shell layout
// ---------------------------------------------------------------------------

function HMIShell() {
  const { connectionState } = useMachine();

  return (
    <div className="hmi-shell">
      <header className="hmi-header">
        <div className="hmi-title">
          <span className="hmi-logo">⬡</span>
          LuxReact HMI — Press #1
        </div>
        <ConnectionBadge state={connectionState} />
      </header>

      <main className="hmi-main">
        <div className="hmi-left">
          <PowerPanel />
          <SystemPanel />
        </div>
        <div className="hmi-right">
          <MotorPanel />
          <HydraulicsPanel />
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connection badge
// ---------------------------------------------------------------------------

function ConnectionBadge({ state }: { state: ConnectionState }) {
  const cls =
    state === ConnectionState.CONNECTED
      ? 'badge badge-connected'
      : state === ConnectionState.ERROR
        ? 'badge badge-error'
        : 'badge badge-neutral';
  return <span className={cls}>{state}</span>;
}

// ---------------------------------------------------------------------------
// Power panel — reads HMIDemo.Running, writes HMIDemo.Power
// ---------------------------------------------------------------------------

function PowerPanel() {
  const [running] = useVariable<boolean>('HMIDemo.Running', { defaultValue: false });
  const [status] = useVariable<string>('HMIDemo.Status', { defaultValue: '—' });
  const writePower = useWrite<boolean>('HMIDemo.Power');

  const isRunning = running ?? false;

  function handlePower() {
    void writePower(!isRunning);
  }

  return (
    <section className="panel power-panel">
      <h2 className="panel-title">Power</h2>
      <button
        className={`power-btn ${isRunning ? 'power-btn-on' : ''}`}
        onClick={handlePower}
      >
        <span className="power-icon">⏻</span>
        <span className="power-label">{isRunning ? 'STOP' : 'START'}</span>
      </button>
      <div className="status-row">
        <Indicator active={isRunning} label="Running" color="green" />
        <Indicator active={!isRunning} label="Idle" color="blue" />
      </div>
      <div className="status-text">{status}</div>
    </section>
  );
}

function Indicator({
  active,
  label,
  color,
}: {
  active: boolean;
  label: string;
  color: string;
}) {
  return (
    <div className="indicator">
      <span className={`indicator-dot ${active ? `dot-${color}` : 'dot-off'}`} />
      <span className="indicator-label">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// System panel — heartbeat, cycle count, live status
// ---------------------------------------------------------------------------

function SystemPanel() {
  const [heartbeat] = useVariable<boolean>('HMIDemo.Heartbeat');
  const [cycles] = useVariable<number>('HMIDemo.Cycles', { defaultValue: 0 });

  return (
    <section className="panel system-panel">
      <h2 className="panel-title">System</h2>
      <div className="readout-grid">
        <Readout
          label="Heartbeat"
          value={heartbeat ? '▲' : '▽'}
          unit=""
          highlight={!!heartbeat}
        />
        <Readout label="Cycles" value={cycles ?? 0} unit="" />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Motor panel — useParent consolidates HMIDemo.* subscriptions into one.
// VariableScope lets child components use short names like 'Speed'.
// ---------------------------------------------------------------------------

function MotorPanel() {
  // Register HMIDemo as a parent — one struct subscription for all children below.
  // mode:'onDemand' means the subscription is only active while children are mounted.
  useParent('HMIDemo', { mode: 'onDemand' });

  return (
    <section className="panel motor-panel">
      <h2 className="panel-title">Motor</h2>
      <VariableScope prefix="HMIDemo">
        <div className="readout-grid">
          <MotorSpeed />
          <MotorTemp />
          <MotorRunning />
        </div>
        <SpeedSetpoint />
      </VariableScope>
    </section>
  );
}

// Inside VariableScope prefix="HMIDemo" — paths resolve to HMIDemo.*

function MotorSpeed() {
  const [speed, , meta] = useVariable<number>('Speed', { defaultValue: 0 });
  return <Readout label="Speed" value={speed ?? 0} unit="RPM" loading={meta.loading} />;
}

function MotorTemp() {
  const [temp, , meta] = useVariable<number>('Temp', { defaultValue: 22 });
  const warn = (temp ?? 0) > 60;
  return <Readout label="Temperature" value={temp ?? 22} unit="°C" warn={warn} loading={meta.loading} />;
}

function MotorRunning() {
  const [running] = useVariable<boolean>('Running', { defaultValue: false });
  return <Readout label="Running" value={running ? 'YES' : 'NO'} unit="" highlight={!!running} />;
}

function SpeedSetpoint() {
  // optimistic: true — slider feels immediate; PLC confirmation overwrites when it arrives
  const [speed, setSpeed] = useVariable<number>('Setpoint', {
    defaultValue: 0,
    optimistic: true,
  });
  const displaySpeed = speed ?? 0;

  return (
    <div className="setpoint">
      <label className="setpoint-label">
        Speed Setpoint
        <span className="setpoint-value">{displaySpeed} RPM</span>
      </label>
      <input
        type="range"
        min={0}
        max={3000}
        step={50}
        value={displaySpeed}
        onChange={(e) => { void setSpeed(Number(e.target.value)); }}
        className="setpoint-slider"
      />
      <div className="setpoint-ticks">
        <span>0</span>
        <span>750</span>
        <span>1500</span>
        <span>2250</span>
        <span>3000</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hydraulics panel — VariableScope for HMIDemo.Pressure
// ---------------------------------------------------------------------------

function HydraulicsPanel() {
  return (
    <section className="panel hydraulics-panel">
      <h2 className="panel-title">Hydraulics</h2>
      <VariableScope prefix="HMIDemo">
        <div className="readout-grid">
          <HydraulicsPressure />
        </div>
      </VariableScope>
    </section>
  );
}

function HydraulicsPressure() {
  // 'Pressure' resolves to 'HMIDemo.Pressure' via the enclosing VariableScope
  const [pressure, , meta] = useVariable<number>('Pressure', { defaultValue: 0 });
  const warn = (pressure ?? 0) > 190;
  return (
    <Readout
      label="Pressure"
      value={pressure ?? 0}
      unit="bar"
      warn={warn}
      loading={meta.loading}
      wide
    />
  );
}

// ---------------------------------------------------------------------------
// Generic readout tile
// ---------------------------------------------------------------------------

function Readout({
  label,
  value,
  unit,
  loading,
  warn,
  highlight,
  wide,
}: {
  label: string;
  value: string | number;
  unit: string;
  loading?: boolean;
  warn?: boolean;
  highlight?: boolean;
  wide?: boolean;
}) {
  return (
    <div
      className={[
        'readout',
        wide ? 'readout-wide' : '',
        warn ? 'readout-warn' : '',
        highlight ? 'readout-highlight' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="readout-label">{label}</span>
      <span className="readout-value">
        {loading ? (
          <span className="readout-loading">—</span>
        ) : (
          <>
            {value}
            {unit && <span className="readout-unit"> {unit}</span>}
          </>
        )}
      </span>
    </div>
  );
}
