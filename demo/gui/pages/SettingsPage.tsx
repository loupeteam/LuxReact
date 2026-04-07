import { useVariable, VariableScope } from 'lux-react';
import { PageHeader } from '../components/PageHeader';

export function SettingsPage() {
  return (
    <div className="page">
      <PageHeader title="Settings" description="Machine configuration parameters" />

      <VariableScope prefix="HMIDemo.Settings">
        <div className="settings-grid">
          <SliderSetting
            path="SpeedLimit"
            label="Speed Limit"
            unit="RPM"
            min={0}
            max={3000}
            step={50}
          />
          <SliderSetting
            path="TempWarnThreshold"
            label="Temperature Warning"
            unit={'\u00B0C'}
            min={30}
            max={200}
            step={5}
          />
          <SliderSetting
            path="PressureWarnThreshold"
            label="Pressure Warning"
            unit="bar"
            min={50}
            max={250}
            step={10}
          />
          <ToggleSetting path="AutoStopOnAlarm" label="Auto-Stop on Alarm" />
        </div>
      </VariableScope>
    </div>
  );
}

// ---- Slider setting -----------------------------------------------

function SliderSetting({
  path,
  label,
  unit,
  min,
  max,
  step,
}: {
  path: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
}) {
  const [value, setValue] = useVariable<number>(path, {
    defaultValue: min,
    optimistic: true,
  });
  const display = value ?? min;

  return (
    <div className="card setting-card">
      <div className="setting-header">
        <span className="setting-label">{label}</span>
        <span className="setting-value">
          {typeof display === 'number' && !Number.isInteger(display)
            ? display.toFixed(1)
            : display}{' '}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={display}
        onChange={(e) => void setValue(Number(e.target.value))}
        className="slider"
        aria-label={label}
      />
      <div className="slider-ticks">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// ---- Toggle setting -----------------------------------------------

function ToggleSetting({ path, label }: { path: string; label: string }) {
  const [value, setValue] = useVariable<boolean>(path, {
    defaultValue: false,
    optimistic: true,
  });
  const isOn = value ?? false;

  return (
    <div className="card setting-card setting-card--toggle">
      <span className="setting-label">{label}</span>
      <button
        className={`toggle${isOn ? ' toggle--on' : ''}`}
        onClick={() => void setValue(!isOn)}
        role="switch"
        aria-checked={isOn}
        aria-label={label}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}
