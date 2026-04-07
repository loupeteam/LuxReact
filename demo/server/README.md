# HMIDemo — B&R Automation Studio Project

PLC-side logic for the `lux-react` demo HMI.

## What this provides

A `HMIDemo` global variable (struct) that the React demo reads and writes via OPC UA. The `HMIDemoTask` cyclic program simulates a motor drive, hydraulic system, recipe management, and basic alarm evaluation — no real hardware needed.

## Folder structure

```
Logical/
  Global.typ             — Type definitions (HMIDemo_typ and sub-types)
  Global.var             — HMIDemo : HMIDemo_typ global variable
  Program/
    Init.st              — Initialise values on task start
    Cyclic.st            — Simulation, recipes, alarms
    Exit.st              — Safe-state on task stop
    Variables.var        — TON timer variables
  Libraries/             — Standard B&R binary libraries
```

## Adding to an existing Automation Studio project

1. In Automation Studio, open your project's **Logical View**.
2. Import the `Logical/` folder contents into the Logical view.
3. In the **Physical View**, assign the program to a CPU with:
   - Task class: **Cyclic**
   - Cycle time: **100 ms**
4. Build and transfer/run.

## HMIDemo variable layout

### Core (motor / hydraulics / system)

| Field | Type | Direction | Description |
|-------|------|-----------|-------------|
| `Power` | `BOOL` | HMI → PLC | `TRUE` = run, `FALSE` = stop |
| `Setpoint` | `REAL` | HMI → PLC | Speed setpoint (RPM) |
| `PressureTarget` | `REAL` | HMI → PLC | Pressure target (bar) |
| `Speed` | `REAL` | PLC → HMI | Actual motor speed (RPM) |
| `Temp` | `REAL` | PLC → HMI | Motor temperature (°C) |
| `Running` | `BOOL` | PLC → HMI | Motor running flag |
| `Pressure` | `REAL` | PLC → HMI | Hydraulic pressure (bar) |
| `Status` | `STRING[80]` | PLC → HMI | Status text |
| `Heartbeat` | `BOOL` | PLC → HMI | Toggled every 500 ms |
| `Cycles` | `UDINT` | PLC → HMI | Incremented every 2 s while running |

### Settings (`HMIDemo.Settings.*`)

| Field | Type | Direction | Description |
|-------|------|-----------|-------------|
| `SpeedLimit` | `REAL` | HMI ↔ PLC | Maximum allowed speed (RPM) |
| `TempWarnThreshold` | `REAL` | HMI ↔ PLC | Temperature alarm threshold (°C) |
| `PressureWarnThreshold` | `REAL` | HMI ↔ PLC | Pressure alarm threshold (bar) |
| `AutoStopOnAlarm` | `BOOL` | HMI ↔ PLC | Auto-stop motor when any alarm is active |

### Recipes (`HMIDemo.Recipes.*`)

| Field | Type | Direction | Description |
|-------|------|-----------|-------------|
| `ActiveIndex` | `USINT` | HMI → PLC | Recipe index to load (0..3) |
| `Load` | `BOOL` | HMI → PLC | Set `TRUE` to load the active recipe |
| `LoadedIndex` | `USINT` | PLC → HMI | Currently loaded recipe index |
| `Slots[0..3].Name` | `STRING[40]` | PLC → HMI | Recipe display name |
| `Slots[0..3].Setpoint` | `REAL` | PLC → HMI | Speed setpoint (RPM) |
| `Slots[0..3].PressureTarget` | `REAL` | PLC → HMI | Pressure target (bar) |

Default recipes: **Slow** (500 RPM / 80 bar), **Medium** (1500 / 120), **Fast** (2500 / 160), **Custom** (0 / 0).

### Alarms (`HMIDemo.Alarms.*`)

| Field | Type | Direction | Description |
|-------|------|-----------|-------------|
| `TempHigh` | `BOOL` | PLC → HMI | Temperature above threshold |
| `PressureHigh` | `BOOL` | PLC → HMI | Pressure above threshold |
| `SpeedFault` | `BOOL` | PLC → HMI | Speed exceeds limit |
| `AnyActive` | `BOOL` | PLC → HMI | OR of all alarm conditions |
| `AckAll` | `BOOL` | HMI → PLC | Write `TRUE` to acknowledge (PLC resets) |

## CYCLIC logic summary

| Feature | Detail |
|---------|--------|
| Heartbeat | `TON` self-toggle at 500 ms |
| Speed clamp | Setpoint clamped to `Settings.SpeedLimit` |
| Speed ramp | ±50 RPM/scan toward setpoint; −80 RPM/scan when stopped |
| Temperature | `22.0 + Speed × 0.06` |
| Pressure | +10 bar/scan toward `PressureTarget` when running; −5 bar/scan when stopped |
| Cycle counter | +1 every 2 s while running |
| Status text | IDLE / STARTING / RUNNING / STOPPING |
| Recipe load | On `Recipes.Load` rising: apply Setpoint + PressureTarget from slot |
| Alarm eval | Condition-based: `Temp > threshold`, `Pressure > threshold`, `Speed > limit` |
| Auto-stop | If `Settings.AutoStopOnAlarm` and any alarm active: `Power := FALSE` |
