import { useVariable, useParent, VariableScope } from 'lux-react';
import { Readout } from '../components/Readout';
import { Indicator } from '../components/Indicator';
import { PageHeader } from '../components/PageHeader';
import { MomentaryButton } from '../components/MomentaryButton';
import { HoldToConfirm } from '../components/HoldToConfirm';

export function OperatorPage() {
  useParent('HMIDemo', { mode: 'onDemand' });

  return (
    <div className="page">
      <PageHeader title="Operator" description="Machine overview and controls" />

      <div className="op-grid">
        <PowerCard />
        <VariableScope prefix="HMIDemo">
          <MotorCard />
          <HydraulicsCard />
          <SystemCard />
        </VariableScope>
      </div>

      <VariableScope prefix="HMIDemo">
        <SetpointSlider />
      </VariableScope>

      <VariableScope prefix="HMIDemo">
        <MotorControls />
      </VariableScope>
    </div>
  );
}

// ---- Power control ------------------------------------------------

function PowerCard() {
  const [running] = useVariable<boolean>('HMIDemo.Running', { defaultValue: false });
  const [status] = useVariable<string>('HMIDemo.Status', { defaultValue: '---' });
  const [power, writePower] = useVariable<boolean>('HMIDemo.Power');

  const isRunning = (power || running) ?? false;

  return (
    <section className="card power-card">
      <h2 className="card-title">Power</h2>
      <button
        className={`power-btn${isRunning ? ' power-btn--on' : ''}`}
        onClick={() => void writePower(!isRunning)}
      >
        <span className="power-icon">{'\u23FB'}</span>
        <span className="power-label">{isRunning ? 'STOP' : 'START'}</span>
      </button>
      <div className="power-indicators">
        <Indicator active={isRunning} label="Running" color="green" />
        <Indicator active={!isRunning} label="Idle" color="blue" />
      </div>
      <div className="power-status">{status}</div>
    </section>
  );
}

// ---- Motor status -------------------------------------------------

function MotorCard() {
  const [speed, , speedMeta] = useVariable<number>('Speed', { defaultValue: 0 });
  const [temp, , tempMeta] = useVariable<number>('Temp', { defaultValue: 22 });
  const [running] = useVariable<boolean>('Running', { defaultValue: false });

  return (
    <section className="card">
      <h2 className="card-title">Motor</h2>
      <div className="readout-grid">
        <Readout label="Speed" value={speed ?? 0} unit="RPM" loading={speedMeta.loading} />
        <Readout
          label="Temperature"
          value={temp ?? 22}
          unit={'\u00B0C'}
          warn={(temp ?? 0) > 60}
          loading={tempMeta.loading}
        />
        <Readout
          label="Running"
          value={running ? 'YES' : 'NO'}
          highlight={!!running}
        />
      </div>
    </section>
  );
}

// ---- Hydraulics ---------------------------------------------------

function HydraulicsCard() {
  const [pressure, , meta] = useVariable<number>('Pressure', { defaultValue: 0 });
  const [target] = useVariable<number>('PressureTarget', { defaultValue: 180 });
  const [lock] = useVariable<boolean>('HydraulicsLock', { defaultValue: false });

  return (
    <section className="card">
      <h2 className="card-title">Hydraulics</h2>
      <div className={`readout-grid ${lock ? 'readonly' : ''}`}>
        <Readout
          label="Pressure"
          value={pressure ?? 0}
          unit="bar"
          warn={(pressure ?? 0) > 160}
          loading={meta.loading}
        />
        <Readout label="Target" value={target ?? 180} unit="bar" />
      </div>
    </section>
  );
}

// ---- System info --------------------------------------------------

function SystemCard() {
  const [heartbeat] = useVariable<boolean>('Heartbeat');
  const [cycles] = useVariable<number>('Cycles', { defaultValue: 0 });

  return (
    <section className="card">
      <h2 className="card-title">System</h2>
      <div className="readout-grid">
        <Readout
          label="Heartbeat"
          value={heartbeat ? '\u25B2' : '\u25BD'}
          highlight={!!heartbeat}
        />
        <Readout label="Cycles" value={cycles ?? 0} />
      </div>
    </section>
  );
}

// ---- Speed setpoint -----------------------------------------------

function SetpointSlider() {
  const [speed, setSpeed] = useVariable<number>('Setpoint', {
    defaultValue: 0,
    optimistic: true,
  });
  const displaySpeed = speed ?? 0;

  return (
    <div className="card setpoint-card">
      <div className="setpoint-header">
        <span className="setpoint-label">Speed Setpoint</span>
        <span className="setpoint-value">{displaySpeed} RPM</span>
      </div>
      <input
        type="range"
        min={0}
        max={3000}
        step={50}
        value={displaySpeed}
        onChange={(e) => void setSpeed(Number(e.target.value))}
        className="slider"
        aria-label="Speed Setpoint"
      />
      <div className="slider-ticks">
        <span>0</span>
        <span>750</span>
        <span>1500</span>
        <span>2250</span>
        <span>3000</span>
      </div>
    </div>
  );
}

// ---- Motor jog + cycle reset --------------------------------------

function MotorControls() {
  return (
    <div className="card controls-card">
      <h2 className="card-title">Controls</h2>
      <div className="controls-row">
        <div className="control-item">
          <span className="control-label">Jog Forward</span>
          <MomentaryButton path="JogForward">▶ Hold to Jog</MomentaryButton>
        </div>
        <div className="control-item">
          <span className="control-label">Jog Reverse</span>
          <MomentaryButton path="JogReverse">◀ Hold to Jog</MomentaryButton>
        </div>
        <div className="control-item">
          <span className="control-label">Reset Cycles</span>
          <HoldToConfirm path="ResetCycles" holdMs={1000}>⟳ Hold to Reset</HoldToConfirm>
        </div>
      </div>
    </div>
  );
}
