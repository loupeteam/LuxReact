# HMIDemo — B&R Automation Studio Project

PLC-side logic for the `lux-react` demo HMI.

## What this provides

A `HMIDemo` global variable (struct) that the React demo reads and writes via OPC UA. The `HMIDemoTask` cyclic program simulates a simple motor drive and hydraulic system so the demo works without any real hardware.

## Folder structure

```
Logical/
  Types/
    HMIDemo_typ.typ      — HMIDemo_typ structure definition
  GVL/
    Global.var           — HMIDemo : HMIDemo_typ global variable
  HMIDemoTask/
    INIT.st              — Initialise values on task start
    CYCLIC.st            — Motor simulation, heartbeat, cycle counter
    EXIT.st              — Safe-state on task stop
    Local.var            — TON timer variables
```

## Adding to an existing Automation Studio project

1. In Automation Studio, open your project's **Logical View**.
2. Drag the `Logical/Types`, `Logical/GVL`, and `Logical/HMIDemoTask` folders into the Logical view. Automation Studio will import the package structure and source files.
3. In the **Physical View**, assign `HMIDemoTask` to a CPU with:
   - Task class: **Cyclic**
   - Cycle time: **100 ms** (adjustable — the timer logic is time-based, not scan-count-based)
4. Build and transfer/run.

## HMIDemo variable layout

| Field | Type | Direction | Description |
|-------|------|-----------|-------------|
| `Power` | `BOOL` | HMI → PLC | `TRUE` = run, `FALSE` = stop |
| `Setpoint` | `REAL` | HMI → PLC | Speed setpoint (RPM) |
| `Speed` | `REAL` | PLC → HMI | Actual motor speed (RPM) |
| `Temp` | `REAL` | PLC → HMI | Motor temperature (°C) |
| `Running` | `BOOL` | PLC → HMI | Motor running flag |
| `Pressure` | `REAL` | PLC → HMI | Hydraulic pressure (bar) |
| `Status` | `STRING[80]` | PLC → HMI | Status text |
| `Heartbeat` | `BOOL` | PLC → HMI | Toggled every 500 ms |
| `Cycles` | `UDINT` | PLC → HMI | Incremented every 2 s while running |

OPC UA paths are relative to your project's default namespace and task — configure these in `demo/gui/LuxConnectAdapter.ts` via `OpcuaMachine` if needed.

## CYCLIC logic summary

| Feature | Detail |
|---------|--------|
| Heartbeat | `TON` with `IN := NOT Q, PT := T#500ms` — self-toggling |
| Speed ramp | ±50 RPM/scan toward `Setpoint` when `Power = TRUE`; −80 RPM/scan when `Power = FALSE` |
| Temperature | `22.0 + Speed × 0.06` (instantaneous, no lag) |
| Pressure | +10 bar/scan toward 180 bar when running; −5 bar/scan when stopped |
| Cycle counter | `TON` with `IN := Running AND NOT Q, PT := T#2s` — fires every 2 s while running |
| Status text | `'IDLE'` / `'STARTING'` / `'RUNNING'` / `'STOPPING'` based on speed and power state |
