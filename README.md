# lux-react

React hooks for connecting to industrial machines (PLCs) with a pluggable comm layer.

`lux-react` provides the React wiring — providers, hooks, subscription management, and value caching — without knowing anything about how variables are actually read from or written to the machine. You supply an adapter that implements the `ICommLayer` interface; the library handles the rest.

**106 tests · zero TypeScript errors · strict mode + `exactOptionalPropertyTypes`**

---

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Core concepts](#core-concepts)
- [Hooks](#hooks)
  - [useVariable](#usevariable)
  - [useWrite](#usewrite)
  - [useMachine](#usemachine)
  - [useParent](#useparent)
- [Components](#components)
  - [MachineProvider](#machineprovider)
  - [VariableScope](#variablescope)
- [Parent subscription optimization](#parent-subscription-optimization)
- [ICommLayer interface](#icommlayer-interface)
- [Writing an adapter](#writing-an-adapter)
- [MockCommLayer](#mockcommlayer)
- [Multiple machines](#multiple-machines)
- [Demo app](#demo-app)

---

## Installation

```bash
npm install lux-react
```

Peer dependencies:

```bash
npm install react react-dom   # react >= 18 required
```

---

## Quick start

```tsx
import { MachineProvider, useVariable, useMachine, MockCommLayer } from 'lux-react';

const mock = new MockCommLayer();

export function App() {
  return (
    <MachineProvider id="press1" machine={mock}>
      <Dashboard />
    </MachineProvider>
  );
}

function Dashboard() {
  const { connectionState } = useMachine();
  const [speed, setSpeed, meta] = useVariable<number>('Motor.Speed', { defaultValue: 0 });

  return (
    <div>
      <p>Connection: {connectionState}</p>
      <p>Speed: {meta.loading ? '…' : `${speed} RPM`}</p>
      <button onClick={() => setSpeed(1200)}>Set 1200</button>
    </div>
  );
}
```

---

## Core concepts

### Pluggable comm layer

`lux-react` is transport-agnostic. You write a class that implements `ICommLayer` for your specific protocol (OPC UA, Modbus, WebSocket, REST, etc.), and pass an instance to `MachineProvider`. The library ships a `MockCommLayer` for use in tests and Storybook.

### Desired-set model

The `SubscriptionManager` inside each `MachineProvider` maintains a *desired set* of paths (one entry per mounted `useVariable` / `useParent` / `alwaysRead`). On every change it reconciles the desired set against the actual subscriptions on the comm layer via a debounced diff, subscribing new paths and unsubscribing removed ones. Multiple hooks mounting in the same render cycle are batched into a single reconciliation pass.

### Value cache

The last received value for every subscribed path is cached. When a component remounts, the cached value is delivered synchronously before the first server update arrives, preventing a flash of loading state.

### Synchronous subscribe contract

`ICommLayer.subscribe()` **must return a handle synchronously**. React's `useEffect` cleanup runs synchronously, which means `unsubscribe()` is called synchronously too. Adapters that use an async underlying subscription (like OPC UA) must bridge the gap themselves — see [Writing an adapter](#writing-an-adapter).

---

## Hooks

### useVariable

```typescript
function useVariable<T = unknown>(
  path:       string,
  options?:   VariableConfig<T>,
  machineId?: string,
): [T | undefined, (value: T) => Promise<void>, VariableMeta]
```

Subscribes to a variable and returns `[value, setValue, meta]`.

```tsx
const [speed, setSpeed, meta] = useVariable<number>('Motor.Speed', {
  defaultValue: 0,
  samplingInterval:   50,   // ms — forwarded to comm layer
  publishingInterval: 100,  // ms — forwarded to comm layer
});

// meta shape:
// {
//   connectionState: ConnectionState;
//   timestamp:       Date | null;
//   quality:         'good' | 'uncertain' | 'bad' | 'unknown' | null;
//   loading:         boolean;
//   error:           Error | null;
// }
```

**Optimistic writes**: pass `optimistic: true` to have `setValue()` update local state immediately. The server confirmation overwrites the optimistic value when it arrives; a write failure reverts it.

```tsx
const [speed, setSpeed] = useVariable<number>('Motor.Speed', { optimistic: true });

// UI responds instantly; PLC confirmation follows
<input type="range" value={speed ?? 0} onChange={e => setSpeed(Number(e.target.value))} />
```

By default the hook uses the nearest `MachineProvider`. Pass `machineId` to target a specific machine by ID regardless of provider nesting:

```tsx
const [speed] = useVariable<number>('Motor.Speed', {}, 'press1');
```

Paths are resolved against any active [`VariableScope`](#variablescope) prefix.

---

### useWrite

```typescript
function useWrite<T = unknown>(
  path:       string,
  machineId?: string,
): (value: T) => Promise<void>
```

Write-only hook. Creates no subscription and causes no re-renders from PLC updates. Use for buttons, sliders, or any control that only ever writes.

```tsx
const writeEStop = useWrite<boolean>('Safety.EStop');

<button onClick={() => writeEStop(true)}>EMERGENCY STOP</button>
```

---

### useMachine

```typescript
function useMachine(machineId?: string): MachineControls
```

Returns connection state and imperative controls for the nearest (or named) machine.

```typescript
interface MachineControls {
  machineId:        string;
  connectionState:  ConnectionState;
  connect():        Promise<void>;
  disconnect():     Promise<void>;
  readVariable(path: string):                       Promise<unknown>;
  writeVariable(path: string, value: unknown):      Promise<void>;
  // Present only if the commLayer implements them:
  changeUser?(username: string, password: string):  Promise<void>;
  writeMany?(values: Record<string, unknown>):      Promise<void>;
}
```

```tsx
function ConnectionBadge() {
  const { connectionState } = useMachine();
  return <span className={`badge-${connectionState}`}>{connectionState}</span>;
}
```

`changeUser` and `writeMany` are only present in the returned object when the underlying `ICommLayer` implements the optional methods. Always guard with `if (machine.changeUser)` before calling.

Throws if called outside a `MachineProvider` and no machine with the given ID is registered.

---

### useParent

```typescript
function useParent(path: string, config: ParentConfig): void

interface ParentConfig {
  mode:       'always' | 'onDemand';
  machineId?: string;
}
```

Declares a *parent subscription optimization* for the component's lifetime. See [Parent subscription optimization](#parent-subscription-optimization) for the full explanation.

- **`always`** — the parent path is subscribed while this component is mounted, regardless of whether any child `useVariable` hooks are active.
- **`onDemand`** — the parent path is subscribed only while at least one `useVariable` targeting a child path is mounted. The subscription is unsubscribed when the last child hook unmounts.

---

## Components

### MachineProvider

Wraps a subtree with a machine connection.

```tsx
<MachineProvider
  id="press1"
  machine={adapter}
  alwaysRead={['Heartbeat', 'MachineStatus']}   // subscribed for provider lifetime
  variablePrefix="::AsGlobalPV:"                 // prepended to all paths inside
>
  {children}
</MachineProvider>
```

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Unique machine ID. Used for cross-tree lookup via `useMachine(id)` / `useVariable(..., id)`. |
| `machine` | `ICommLayer` | Communication implementation (OpcuaMachine-compatible). Treated as stable — if you need a new machine instance, remount the provider. |
| `alwaysRead` | `string[]` | Paths subscribed on mount and held for the provider's lifetime. |
| `variablePrefix` | `string` | Root namespace prefix. All paths from hooks inside this provider are prepended with this value. |

Calls `machine.connect()` on mount and `machine.disconnect()` on unmount.

---

### VariableScope

Stacks an additional path prefix onto the current scope. Scopes are nestable.

```tsx
<MachineProvider variablePrefix="::AsGlobalPV:">
  <VariableScope prefix="Motor">
    {/* useVariable('Speed') → '::AsGlobalPV:Motor.Speed' */}
    <VariableScope prefix="Axis[0]">
      {/* useVariable('Pos') → '::AsGlobalPV:Motor.Axis[0].Pos' */}
    </VariableScope>
  </VariableScope>
</MachineProvider>
```

Both `useVariable` and `useWrite` resolve paths through the active scope. `useParent` does too — declare it at a level where the path resolves correctly.

---

## Parent subscription optimization

In industrial applications a single struct variable (e.g., `Motor`) often contains many child fields (`Motor.Speed`, `Motor.Temp`, `Motor.Direction`). Without optimization each child would create a separate OPC UA monitored item. `useParent` lets you consolidate them into one.

```tsx
function MotorPanel() {
  // One subscription to the Motor struct instead of three separate ones.
  // Children are completely unaware of this.
  useParent('Motor', { mode: 'onDemand' });

  return (
    <>
      <SpeedDisplay />   {/* useVariable('Motor.Speed') */}
      <TempDisplay />    {/* useVariable('Motor.Temp')  */}
      <DirDisplay />     {/* useVariable('Motor.Direction') */}
    </>
  );
}
```

When the `Motor` subscription fires, the `SubscriptionManager` fans the struct value out to all registered `Motor.*` callbacks automatically. Children receive their individual values as if they had their own subscriptions.

**Rules:**
- Consolidation only happens when `useParent` explicitly declares it. There is no automatic path-prefix inference.
- `useParent` must be called **outside** any `VariableScope` that would alter the parent path, or at a scope level where the path resolves correctly.
- Multiple components can call `useParent` for the same path; the subscription is reference-counted correctly.

---

## ICommLayer interface

```typescript
interface ICommLayer {
  readonly connectionState: ConnectionState;

  connect():    Promise<void>;
  disconnect(): Promise<void>;

  readVariable(path: string): Promise<unknown>;
  writeVariable(path: string, value: unknown): Promise<void>;

  // Must return a handle SYNCHRONOUSLY — React cleanup calls unsubscribe() synchronously
  subscribe(path: string, callback: VariableChangeCallback, options?: SubscribeOptions): SubscriptionHandle;
  unsubscribe(handle: SubscriptionHandle): void;

  onConnectionStateChanged(handler: ConnectionStateHandler): UnsubscribeFn;

  // Optional — useMachine() exposes these only when present
  changeUser?(username: string, password: string): Promise<void>;
  writeMany?(values: Record<string, unknown>): Promise<void>;
}
```

`ConnectionState` enum:

| Value | String |
|-------|--------|
| `DISCONNECTED` | `'DISCONNECTED'` |
| `CONNECTING` | `'CONNECTING'` |
| `CONNECTED` | `'CONNECTED'` |
| `DISCONNECTING` | `'DISCONNECTING'` |
| `RECONNECTING` | `'RECONNECTING'` |
| `ERROR` | `'ERROR'` |

---

## Writing an adapter

The only non-obvious constraint is that `subscribe()` must return a handle synchronously, even when the underlying subscription setup is async (e.g., OPC UA requires an async handshake before the monitored item exists).

The standard bridge is a *pending-map* pattern:

```typescript
import type { ICommLayer, SubscriptionHandle, UnsubscribeFn,
              VariableChangeCallback, ConnectionStateHandler, SubscribeOptions } from 'lux-react';
import { ConnectionState } from 'lux-react';

interface PendingEntry {
  cancelled: boolean;
  resolvedHandle: string | null;
}

export class MyAdapter implements ICommLayer {
  private _nextHandle = 1;
  private _pending = new Map<number, PendingEntry>();
  private _connectionState = ConnectionState.DISCONNECTED;
  private _stateHandlers = new Set<ConnectionStateHandler>();

  get connectionState() { return this._connectionState; }

  connect()    { return this._underlying.connect(); }
  disconnect() { return this._underlying.disconnect(); }
  readVariable(path: string)               { return this._underlying.read(path); }
  writeVariable(path: string, value: unknown) { return this._underlying.write(path, value); }

  subscribe(path: string, callback: VariableChangeCallback, options?: SubscribeOptions): SubscriptionHandle {
    const handle = this._nextHandle++;
    const entry: PendingEntry = { cancelled: false, resolvedHandle: null };
    this._pending.set(handle, entry);

    this._underlying.subscribeAsync(path, (value) => {
      callback({ path, value, timestamp: new Date(), quality: 'good' });
    }).then((resolvedHandle) => {
      if (entry.cancelled) {
        this._underlying.unsubscribe(resolvedHandle); // too late — clean up immediately
      } else {
        entry.resolvedHandle = resolvedHandle;
      }
    }).catch(() => { entry.cancelled = true; });

    return handle; // returned synchronously
  }

  unsubscribe(handle: SubscriptionHandle): void {
    const entry = this._pending.get(handle as number);
    if (!entry) return;
    entry.cancelled = true;
    this._pending.delete(handle as number);
    if (entry.resolvedHandle !== null) {
      this._underlying.unsubscribe(entry.resolvedHandle);
    }
    // if still pending, the .then() above handles cleanup when it resolves
  }

  onConnectionStateChanged(handler: ConnectionStateHandler): UnsubscribeFn {
    // If your underlying library doesn't return an unsubscribe fn, maintain your own set:
    this._stateHandlers.add(handler);
    return () => this._stateHandlers.delete(handler);
  }
}
```

A full working `OpcuaMachine` injection example is in [`demo/gui/App.tsx`](./demo/gui/App.tsx).

---

## MockCommLayer

`MockCommLayer` ships in the main bundle for use in tests and Storybook. It is a fully functional in-memory `ICommLayer` implementation.

```typescript
const mock = new MockCommLayer();

// Push a value to all subscribers of a path
mock.setVariableValue('Motor.Speed', 1200);

// Push a struct — all Motor.* subscribers receive their child value
mock.setVariableValue('Motor', { Speed: 1200, Temp: 45, Running: true });

// Inspect what the library subscribed to
mock.getSubscribedPaths(); // Set<string>

// Inspect the last value written by the library
mock.getLastWrittenValue('Motor.Speed'); // unknown

// Simulate a connection state change
mock.simulateConnectionState(ConnectionState.ERROR);
```

### Testing example

```tsx
import { render, screen, act } from '@testing-library/react';
import { MachineProvider, MockCommLayer, ConnectionState } from 'lux-react';
import { SpeedDisplay } from './SpeedDisplay';

test('shows motor speed', async () => {
  const mock = new MockCommLayer();

  render(
    <MachineProvider id="test" machine={mock}>
      <SpeedDisplay />
    </MachineProvider>
  );

  await act(async () => {
    mock.setVariableValue('Motor.Speed', 1200);
  });

  expect(screen.getByText('1200 RPM')).toBeInTheDocument();
});

test('write fires on button click', async () => {
  const mock = new MockCommLayer();
  const { getByRole } = render(
    <MachineProvider id="test" machine={mock}>
      <SpeedControl />
    </MachineProvider>
  );

  await act(async () => {
    getByRole('button', { name: /set 1200/i }).click();
  });

  expect(mock.getLastWrittenValue('Motor.Speed')).toBe(1200);
});
```

---

## Multiple machines

Nest providers and use the `machineId` argument to reach across the tree:

```tsx
<MachineProvider id="press1" machine={press1Adapter}>
  <MachineProvider id="press2" machine={press2Adapter}>
    <ComparisonView />
  </MachineProvider>
</MachineProvider>

function ComparisonView() {
  const [speed1] = useVariable<number>('Motor.Speed', {}, 'press1');
  const [speed2] = useVariable<number>('Motor.Speed', {}, 'press2');
  …
}
```

`useMachine('press1')` also works from anywhere in the tree, even outside the `press1` subtree, via the module-level `MachineRegistry`.

---

## Demo app

The `demo/` directory contains two projects:

```
demo/
  gui/     — React HMI (Vite), connects to the PLC via lux-opcua
  server/  — B&R Automation Studio packages (types, GVL, cyclic task)
```

### Server-side setup (Automation Studio)

Import the packages in `demo/server/Logical/` into your AS project's Logical view:

| Package | Contents |
|---------|----------|
| `Types/` | `HMIDemo_typ` struct definition |
| `GVL/` | `HMIDemo : HMIDemo_typ` global variable |
| `HMIDemoTask/` | Cyclic program — motor simulation, heartbeat, cycle counter |

Assign `HMIDemoTask` to a CPU with **task class Cyclic, 100 ms** cycle time. See [`demo/server/README.md`](./demo/server/README.md) for full setup instructions.

### GUI setup

**1. Configure the connection**

Create a `.env.local` file in the `LuxReact` root:

```
VITE_OPC_HOST=192.168.1.10
VITE_OPC_PORT=80
VITE_OPC_PROTOCOL=http
VITE_OPC_USER=admin
VITE_OPC_PASS=secret
```

Or edit `demo/gui/config.ts` directly.

**2. Run**

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

The demo illustrates:
- `useParent('HMIDemo', { mode: 'onDemand' })` — one struct subscription replaces eight individual ones
- `<VariableScope prefix="HMIDemo">` — child components use short names (`'Speed'`) without knowing the full path
- `useWrite<boolean>('HMIDemo.Power')` — write-only power button, no subscription
- `optimistic: true` on the speed setpoint slider for immediate UI response

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the demo app dev server |
| `npm run build` | Build the library (ESM + UMD) |
| `npm run build:types` | Emit TypeScript declarations |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage report |
