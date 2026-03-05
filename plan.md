# LuxReact — Implementation Plan

## Goal
A React library (`lux-react`) providing hooks to connect to industrial machines (PLCs). Comm layers are pluggable via an `ICommLayer` interface. LuxConnect is the first adapter written against it.

---

## Architecture Summary

```
<MachineProvider id="press1" commLayer={adapter} alwaysRead={[...]}>
  → connects on mount, disconnects on unmount
  → creates SubscriptionManager + ParentOptimizer per provider
  → registers with module-level MachineRegistry (enables cross-tree lookup)

// Parent optimization declared in a higher-level component:
useParent('Motor', { mode: 'onDemand' })   // subscribe to Motor struct if any Motor.* child is in use
useParent('Motor', { mode: 'always' })     // always subscribe to Motor struct while this component is mounted

// Children know nothing about the optimization:
useVariable<number>('Motor.Speed')             // nearest provider; may be served by a parent subscription
useVariable<number>('Motor.Speed', {}, 'press1')  // explicit machine by id
// returns [value, setValue, meta]

useMachine('press1')  // connection state + imperative controls
```

---

## Key Design Decisions

- **`ICommLayer.subscribe()` is synchronous** — returns a handle immediately; async setup is internal to the adapter. Required because React `useEffect` cleanup must unsubscribe synchronously.
- **Desired-set + reconciliation model** (not ref-count per path) — the `SubscriptionManager` tracks *what paths are wanted* (`desiredPaths`) and *what is actually subscribed* (`activeSubscriptions`). On every change, it computes the optimal set and diffs, then syncs. Mirrors the pattern used in both WebHMI and OpcUaProxy.
- **Reconciliation is debounced** — multiple `useVariable` hooks mounting in the same render cycle each call `addDesired()`; a single `queueMicrotask` schedules one reconciliation pass after all synchronous work completes.
- **Consolidation is opt-in via `useParent`** — the optimizer only substitutes a parent path for child paths when `useParent()` explicitly registers that parent. Automatic consolidation based purely on path-prefix matching does NOT happen. (This matches OpcUaProxy's TimestampBasedConsolidator rule: "only consolidate children if parent was explicitly requested.")
- **Fan-out on parent value update** — when a subscribed parent path fires, the `SubscriptionManager` navigates the struct value to extract and deliver values to all child path callbacks.
- **`callbackRef` pattern in `useVariable`** — subscription effect only depends on `path`/`options` primitives, not the callback, so re-renders don't re-subscribe.
- **Value cache in `SubscriptionManager`** — last-received event per path is stored and delivered immediately to new subscribers, eliminating loading-state flicker on component remounts.
- **Optimistic writes** — `{ optimistic: true }` in `useVariable` causes `setValue()` to update local state immediately; server confirmation overwrites it; write failure reverts it.
- **`useWrite<T>` hook** — write-only, creates no subscription. Used for buttons/controls that never need to read.
- **`VariableScope` + provider `variablePrefix`** — stackable prefix context so all hooks in a subtree resolve short path names to full PLC paths without repetition.
- **Optional `ICommLayer` methods** (`changeUser`, `writeMany`) — adapters implement only what their comm layer supports; `useMachine` exposes them when present.
- **Module-level `MachineRegistry`** (not a root Context) — cross-tree machine lookup without requiring a wrapper provider. Uses an event emitter to trigger re-renders on connection state changes.
- **`useParent` hook** declares the optimization at a higher scope; `useVariable` is unaware of it. Parent path is auto-inferred from the variable path (segment before last `.` or `[`).
- **Parent modes**: `'always'` — parent added directly to `desiredPaths` while `useParent` is mounted; `'onDemand'` — parent only enters the optimal set if at least one child path is in `desiredPaths`.
- **TypeScript strict mode** + `exactOptionalPropertyTypes: true` (mirrors LuxConnect).

---

## Folder Structure

```
e:\clients\loupe\WebHMITools\LuxReact\
├── src\
│   ├── types\
│   │   ├── ConnectionState.ts      # enum: DISCONNECTED | CONNECTING | CONNECTED | DISCONNECTING | RECONNECTING | ERROR
│   │   ├── ICommLayer.ts           # core interface every adapter implements
│   │   ├── VariableTypes.ts        # VariableChangeEvent, VariableMeta, SubscribeOptions, UnsubscribeFn
│   │   └── index.ts
│   ├── registry\
│   │   └── MachineRegistry.ts      # module-level Map<id, MachineContextValue> + event emitter
│   ├── context\
│   │   ├── MachineContext.ts       # React.createContext + useMachineContext helper
│   │   └── VariableScopeContext.ts # React.createContext for prefix stacking
│   ├── subscription\
│   │   ├── ParentOptimizer.ts      # pure static utilities: isChildOf, navigatePath, computeOptimalSet
│   │   └── SubscriptionManager.ts  # desired-set + reconciliation; debounced diffing; fan-out; value cache
│   ├── provider\
│   │   ├── MachineProvider.tsx     # connect/disconnect lifecycle, alwaysRead, variablePrefix, registry registration
│   │   └── VariableScope.tsx       # stacks a path prefix onto VariableScopeContext
│   ├── hooks\
│   │   ├── useResolvedContext.ts   # shared: nearest provider OR registry lookup by id
│   │   ├── useVariable.ts          # useVariable<T>(path, options?, machineId?)
│   │   ├── useWrite.ts             # useWrite<T>(path, machineId?) — write-only, no subscription
│   │   ├── useParent.ts            # useParent(path, { mode: 'always'|'onDemand', machineId? })
│   │   └── useMachine.ts           # connection state, connect/disconnect, changeUser, writeMany
│   ├── mock\
│   │   └── MockCommLayer.ts        # in-memory ICommLayer; setVariableValue(), getSubscribedPaths(), getLastWrittenValue()
│   └── index.ts                    # public barrel
├── tests\
│   ├── setup.ts                    # jsdom + @testing-library/jest-dom
│   ├── unit\
│   │   ├── MockCommLayer.test.ts
│   │   ├── ParentOptimizer.test.ts
│   │   ├── SubscriptionManager.test.ts
│   │   ├── MachineProvider.test.tsx
│   │   ├── VariableScope.test.tsx
│   │   ├── useVariable.test.tsx
│   │   ├── useWrite.test.tsx
│   │   ├── useParent.test.tsx
│   │   └── useMachine.test.tsx
│   └── integration\
│       └── MultiProvider.test.tsx
├── examples\
│   └── LuxConnectAdapter.ts        # reference adapter wrapping OpcuaMachine → ICommLayer
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── vite.config.ts                  # library build + vitest config combined
```

---

## Core Interfaces

### `ICommLayer`
```typescript
interface ICommLayer {
  readonly connectionState: ConnectionState;
  connect():    Promise<void>;
  disconnect(): Promise<void>;
  readVariable(path: string): Promise<unknown>;
  writeVariable(path: string, value: unknown): Promise<void>;
  subscribe(path: string, callback: VariableChangeCallback, options?: SubscribeOptions): SubscriptionHandle;
  unsubscribe(handle: SubscriptionHandle): void;
  onConnectionStateChanged(handler: ConnectionStateHandler): UnsubscribeFn;

  // Optional capabilities — adapters implement only what the comm layer supports.
  // useMachine() exposes these only when present; callers check with 'changeUser' in machine.
  changeUser?(username: string, password: string): Promise<void>;
  writeMany?(values: Record<string, unknown>): Promise<void>;  // atomic/batch write
}
```

### `useVariable` signature
```typescript
interface VariableConfig<T = unknown> {
  defaultValue?:       T;
  readGroupName?:      string;
  samplingInterval?:   number;
  publishingInterval?: number;
  optimistic?:         boolean;  // immediately update local state on setValue(); overwritten by server confirmation
  // No parentMode — that is declared via useParent()
}

function useVariable<T = unknown>(
  path:       string,
  options?:   VariableConfig<T>,
  machineId?: string,
): [T | undefined, (value: T) => Promise<void>, VariableMeta]
```

Optimistic write behaviour: when `optimistic: true` and `setValue(v)` is called, local state immediately becomes `v`. When the server confirms with a new value it overwrites the optimistic value. If the write throws, local state reverts to the pre-write value.

### `useWrite` signature
```typescript
function useWrite<T = unknown>(
  path:       string,
  machineId?: string,
): (value: T) => Promise<void>
```

Creates no subscription. Resolves the full path through any active `VariableScope` prefix. Use for buttons, sliders, or any control that only ever writes.

### `VariableScope` component
```typescript
interface VariableScopeProps {
  prefix:   string;        // prepended with '.' separator to any useVariable/useWrite path inside
  children: React.ReactNode;
}

function VariableScope({ prefix, children }: VariableScopeProps): JSX.Element
```

Scopes are stackable. Resolution order:
```tsx
<MachineProvider variablePrefix="::AsGlobalPV:">
  <VariableScope prefix="Motor">
    {/* useVariable('Speed') resolves to '::AsGlobalPV:Motor.Speed' */}
    <VariableScope prefix="Axis[0]">
      {/* useVariable('Pos') resolves to '::AsGlobalPV:Motor.Axis[0].Pos' */}
    </VariableScope>
  </VariableScope>
</MachineProvider>
```

### `useParent` signature
```typescript
interface ParentConfig {
  mode:       'always' | 'onDemand';
  machineId?: string;
}

function useParent(path: string, config: ParentConfig): void
```

- **`mode: 'always'`** — parent path subscribed while this component is mounted, regardless of any child hooks.
- **`mode: 'onDemand'`** — parent path subscribed while this component is mounted AND at least one `useVariable` for a child path is active. Auto-unsubscribes when last child hook unmounts.
- Child variables (e.g., `useVariable('Motor.Speed')`) are automatically matched to a registered parent (`'Motor'`) via path prefix inference — they need no changes.

### `MachineProvider` props
```typescript
interface MachineProviderProps {
  id:               string;
  commLayer:        ICommLayer;
  alwaysRead?:      string[];           // subscribed on mount, unsubscribed on unmount
  readGroups?:      ReadGroupConfig[];  // { name, publishingInterval, samplingInterval }
  variablePrefix?:  string;            // prepended to all paths from useVariable/useWrite/useParent inside
  children:         React.ReactNode;
}
```

`variablePrefix` sets the root of the `VariableScopeContext`. `VariableScope` children stack additional segments on top of it.

### `VariableMeta`
```typescript
interface VariableMeta {
  connectionState: ConnectionState;
  timestamp:       Date | null;
  quality:         'good' | 'uncertain' | 'bad' | 'unknown' | null;
  loading:         boolean;
  error:           Error | null;
}
```

### `useMachine` return type
```typescript
interface MachineControls {
  machineId:        string;
  connectionState:  ConnectionState;
  connect():        Promise<void>;
  disconnect():     Promise<void>;
  readVariable(path: string):                        Promise<unknown>;
  writeVariable(path: string, value: unknown):       Promise<void>;
  // Present only if the commLayer implements them:
  changeUser?(username: string, password: string):   Promise<void>;
  writeMany?(values: Record<string, unknown>):       Promise<void>;
}
```

---

## Consolidation Model (SubscriptionManager + ParentOptimizer)

This is the core algorithmic heart of the library. It mirrors the approach proven in WebHMI's `getNextReadList()` and OpcUaProxy's `TimestampBasedConsolidator`.

### Data Structures (inside SubscriptionManager)

```
desiredPaths:        Set<string>                     // all paths wanted by mounted hooks + alwaysRead
registeredParents:   Map<string, 'always'|'onDemand'> // registered by useParent()
activeSubscriptions: Map<string, SubscriptionHandle>  // what's currently subscribed on commLayer
callbacks:           Map<string, Set<VariableChangeCallback>>  // desired path → its listeners
valueCache:          Map<string, VariableChangeEvent> // last received event per desired path
```

`desiredPaths` and `callbacks` use the **original requested path** (e.g., `'Motor.Speed'`), not the consolidated path. This decouples what hooks want from what the comm layer is actually subscribed to.

`valueCache` persists last-known values for the lifetime of the `MachineProvider`. When a new hook subscribes to a path that already has a cached value, the cached event is delivered synchronously before the first server update arrives — eliminating the "flash of loading state" on component remounts.

### Reconciliation Flow

Triggered (debounced via `queueMicrotask`) whenever `desiredPaths` or `registeredParents` changes:

```
1. computeOptimalSet(desiredPaths, registeredParents) → optimalPaths: Set<string>
   For each path in desiredPaths:
     - Check if a registered parent covers it
       (parent is a prefix: 'Motor' covers 'Motor.Speed', 'Motor.Temp', 'Motor.Axis[0]')
     - If covered by an 'always' parent → replace with parent path
     - If covered by an 'onDemand' parent → replace with parent path ONLY IF
       at least one desiredPath is a child of that parent
     - Otherwise → keep original path
   De-duplicate results.

2. diff(optimalPaths, activeSubscriptions.keys()) → { toAdd, toRemove }

3. For each path in toRemove:
     commLayer.unsubscribe(activeSubscriptions.get(path))
     activeSubscriptions.delete(path)

4. For each path in toAdd:
     handle = commLayer.subscribe(path, internalHandler)
     activeSubscriptions.set(path, handle)
```

### Fan-Out (internalHandler)

When the comm layer fires a value update for a subscribed path (which may be a parent):

```
internalHandler(event: VariableChangeEvent):
  // 1. Deliver directly to any callbacks registered for this exact path
  callbacks.get(event.path)?.forEach(cb => cb(event))

  // 2. Fan out to all desired child paths covered by this parent
  for each desiredPath in callbacks.keys():
    if isChildOf(desiredPath, event.path):
      childValue = navigatePath(event.value, desiredPath, event.path)
      // e.g., for event.path='Motor', desiredPath='Motor.Speed':
      //   navigatePath({ Speed: 100, Temp: 25 }, 'Motor.Speed', 'Motor') → 100
      if childValue is not undefined:
        callbacks.get(desiredPath)?.forEach(cb => cb({
          path: desiredPath, value: childValue,
          timestamp: event.timestamp, quality: event.quality
        }))
```

### ParentOptimizer (pure logic, no side effects)

Extracted as a pure utility used by `SubscriptionManager`:

```typescript
class ParentOptimizer {
  // Infer immediate parent from path: 'Motor.Speed' → 'Motor', 'Temps[0]' → 'Temps', 'Motor' → null
  static getParentPath(path: string): string | null

  // Check if childPath is under parentPath (covers dot and bracket notation)
  static isChildOf(childPath: string, parentPath: string): boolean
  // 'Motor.Speed' isChildOf 'Motor'       → true
  // 'Motor.Axis[0]' isChildOf 'Motor'     → true
  // 'MotorSpeed' isChildOf 'Motor'        → false (no separator)
  // 'Motor.Speed' isChildOf 'Motor.Speed' → false (same path, not child)

  // Navigate a value object along the suffix of childPath relative to parentPath
  static navigatePath(parentValue: unknown, childPath: string, parentPath: string): unknown
  // navigatePath({ Speed: 100 }, 'Motor.Speed', 'Motor') → 100
  // navigatePath({ Axis: [{ Pos: 5 }] }, 'Motor.Axis[0].Pos', 'Motor') → 5

  // Given desired paths and registered parents, compute optimal subscription set
  static computeOptimalSet(
    desiredPaths: Set<string>,
    registeredParents: Map<string, 'always' | 'onDemand'>
  ): Set<string>
}
```

### Registration API (called by useVariable, useParent, MachineProvider)

```typescript
// Called by useVariable on mount/unmount:
sm.addDesired(path: string, callback: VariableChangeCallback): void
sm.removeDesired(path: string, callback: VariableChangeCallback): void

// Called by useParent on mount/unmount:
sm.registerParent(path: string, mode: 'always' | 'onDemand'): void
sm.unregisterParent(path: string): void

// Called by MachineProvider for alwaysRead[]:
sm.addDesired(path, noopCallback)  // same mechanism, callback does nothing
```

### Example Walkthrough

```
Components mounted:
  useParent('Motor', { mode: 'onDemand' })  → registeredParents: { 'Motor': 'onDemand' }
  useVariable('Motor.Speed')                → desiredPaths: { 'Motor.Speed' }
  useVariable('Motor.Temp')                 → desiredPaths: { 'Motor.Speed', 'Motor.Temp' }

Reconciliation triggered (debounced):
  computeOptimalSet:
    'Motor.Speed' → has onDemand parent 'Motor'; at least one Motor.* in desiredPaths → use 'Motor'
    'Motor.Temp'  → same → use 'Motor'
    optimalPaths = { 'Motor' }
  diff: activeSubscriptions={}, toAdd=['Motor'], toRemove=[]
  subscribe 'Motor' → activeSubscriptions: { 'Motor': handle }

Value update fires: event = { path: 'Motor', value: { Speed: 100, Temp: 25 }, ... }
  internalHandler:
    callbacks.get('Motor') → empty (no hook requested 'Motor' directly)
    isChildOf('Motor.Speed', 'Motor') → true → deliver { path: 'Motor.Speed', value: 100, ... }
    isChildOf('Motor.Temp', 'Motor')  → true → deliver { path: 'Motor.Temp',  value: 25,  ... }

useVariable('Motor.Speed') hook receives value 100 ✓
useVariable('Motor.Temp')  hook receives value 25  ✓

SpeedDisplay unmounts → removeDesired('Motor.Speed'):
  desiredPaths: { 'Motor.Temp' }
  Reconciliation: Motor.Temp still has onDemand parent 'Motor' with a child present
  optimalPaths = { 'Motor' } — no change, no unsubscribe

TempDisplay unmounts → removeDesired('Motor.Temp'):
  desiredPaths: {}
  Reconciliation: no children of 'Motor' in desiredPaths; onDemand → don't include 'Motor'
  optimalPaths = {}
  diff: toRemove=['Motor']
  unsubscribe 'Motor' ✓
```

---

## Example Application Usage

A realistic press machine HMI showing the full API surface.

### Setup — wrapping a comm layer and providing a machine

```tsx
// adapters/press1.ts
import { OpcuaMachine } from 'lux-opcua';
import { LuxConnectAdapter } from '../examples/LuxConnectAdapter';

const machine = new OpcuaMachine({ host: '192.168.1.10', port: 80 });
export const press1Adapter = new LuxConnectAdapter(machine);
```

```tsx
// App.tsx
import { MachineProvider } from 'lux-react';
import { press1Adapter } from './adapters/press1';
import { Dashboard } from './Dashboard';

export function App() {
  return (
    <MachineProvider
      id="press1"
      commLayer={press1Adapter}
      alwaysRead={['Heartbeat', 'MachineStatus']}  // always subscribed regardless of components
    >
      <Dashboard />
    </MachineProvider>
  );
}
```

---

### Connection status display

```tsx
// components/ConnectionBadge.tsx
import { useMachine } from 'lux-react';

export function ConnectionBadge() {
  const { connectionState } = useMachine(); // uses nearest provider

  return <div className={`badge badge-${connectionState}`}>{connectionState}</div>;
}
```

---

### Simple variable read/write — the easy case

```tsx
// components/SpeedControl.tsx
import { useVariable } from 'lux-react';

export function SpeedControl() {
  const [speed, setSpeed, { loading, quality }] = useVariable<number>('Motor.Speed');

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <span>{speed} RPM</span>
      <span>{quality}</span>
      <button onClick={() => setSpeed(1200)}>Set 1200</button>
    </div>
  );
}
```

---

### Parent optimization — MotorPanel reads `Motor` once for all children

```tsx
// components/MotorPanel.tsx — declares the consolidation scope
import { useParent } from 'lux-react';
import { SpeedDisplay } from './SpeedDisplay';
import { TempDisplay } from './TempDisplay';
import { DirectionDisplay } from './DirectionDisplay';

export function MotorPanel() {
  // One subscription to 'Motor' struct instead of three separate subscriptions.
  // Children are unaware of this — they just call useVariable as normal.
  // 'onDemand': subscription only active while at least one child is mounted.
  useParent('Motor', { mode: 'onDemand' });

  return (
    <div>
      <SpeedDisplay />
      <TempDisplay />
      <DirectionDisplay />
    </div>
  );
}

// components/SpeedDisplay.tsx — knows nothing about the parent optimization
function SpeedDisplay() {
  const [speed] = useVariable<number>('Motor.Speed');
  return <div>Speed: {speed}</div>;
}

function TempDisplay() {
  const [temp] = useVariable<number>('Motor.Temp');
  return <div>Temp: {temp}°C</div>;
}

function DirectionDisplay() {
  const [dir] = useVariable<string>('Motor.Direction');
  return <div>Direction: {dir}</div>;
}
```

---

### Always-read parent — heartbeat stays subscribed even when dashboard is hidden

```tsx
// components/MachineRoot.tsx
import { useParent } from 'lux-react';

export function MachineRoot({ children }: { children: React.ReactNode }) {
  // 'always': 'Status' struct is subscribed for the lifetime of this component,
  // regardless of whether any Status.* children are currently rendered.
  useParent('Status', { mode: 'always' });

  return <>{children}</>;
}
```

---

### Multiple machines — explicit machine targeting

```tsx
// App.tsx — two machines, each with their own comm layer
import { MachineProvider } from 'lux-react';

export function App() {
  return (
    <MachineProvider id="press1" commLayer={press1Adapter}>
      <MachineProvider id="press2" commLayer={press2Adapter}>
        <Dashboard />
      </MachineProvider>
    </MachineProvider>
  );
}

// components/ComparisonView.tsx — reads from both machines explicitly
import { useVariable } from 'lux-react';

export function ComparisonView() {
  const [speed1] = useVariable<number>('Motor.Speed', {}, 'press1');
  const [speed2] = useVariable<number>('Motor.Speed', {}, 'press2');

  return (
    <div>
      <div>Press 1: {speed1} RPM</div>
      <div>Press 2: {speed2} RPM</div>
    </div>
  );
}
```

---

### Accessing a named machine from anywhere in the tree

```tsx
// components/GlobalStatusBar.tsx — lives outside any specific machine's subtree
import { useMachine, useVariable } from 'lux-react';

export function GlobalStatusBar() {
  // Named lookup via MachineRegistry — works from anywhere in the tree
  const { connectionState } = useMachine('press1');
  const [heartbeat] = useVariable<number>('Heartbeat', {}, 'press1');

  return (
    <div>
      Press 1: {connectionState} | Heartbeat: {heartbeat}
    </div>
  );
}
```

---

### Default value, read groups, and meta info

```tsx
// components/PressureGauge.tsx
import { useVariable } from 'lux-react';

export function PressureGauge() {
  const [pressure, setPressure, meta] = useVariable<number>('Hydraulics.Pressure', {
    defaultValue: 0,
    samplingInterval: 50,    // request 50ms sampling on the server side
    publishingInterval: 100, // request updates every 100ms
  });

  return (
    <div>
      <span style={{ opacity: meta.quality === 'good' ? 1 : 0.4 }}>
        {pressure} bar
      </span>
      {meta.error && <div className="error">{meta.error.message}</div>}
      {meta.timestamp && <small>Updated: {meta.timestamp.toISOString()}</small>}
    </div>
  );
}
```

---

### Testing a component with MockCommLayer

```tsx
// components/SpeedControl.test.tsx
import { render, screen, act } from '@testing-library/react';
import { MachineProvider, MockCommLayer } from 'lux-react';
import { SpeedControl } from './SpeedControl';

test('displays updated speed', async () => {
  const mock = new MockCommLayer();

  render(
    <MachineProvider id="test" commLayer={mock}>
      <SpeedControl />
    </MachineProvider>
  );

  // Simulate PLC pushing a value
  await act(async () => {
    mock.setVariableValue('Motor.Speed', 1200);
  });

  expect(screen.getByText('1200 RPM')).toBeInTheDocument();
});

test('writes value when button clicked', async () => {
  const mock = new MockCommLayer();
  const { getByText } = render(
    <MachineProvider id="test" commLayer={mock}>
      <SpeedControl />
    </MachineProvider>
  );

  await act(async () => {
    getByText('Set 1200').click();
  });

  expect(mock.getLastWrittenValue('Motor.Speed')).toBe(1200);
});
```

---

### `useWrite` — write-only control with no subscription

```tsx
// components/EStopButton.tsx
import { useWrite } from 'lux-react';

export function EStopButton() {
  const writeEStop = useWrite<boolean>('Safety.EStop');

  return (
    <button onClick={() => writeEStop(true)}>
      EMERGENCY STOP
    </button>
  );
  // No subscription created, no loading state, no re-renders from PLC updates
}
```

---

### Optimistic writes — immediate UI response

```tsx
// components/SpeedSlider.tsx
import { useVariable } from 'lux-react';

export function SpeedSlider() {
  const [speed, setSpeed] = useVariable<number>('Motor.Speed', { optimistic: true });

  return (
    <input
      type="range" min={0} max={3000}
      value={speed ?? 0}
      onChange={e => setSpeed(Number(e.target.value))}
      // UI updates immediately on drag; PLC confirmation overwrites when it arrives
    />
  );
}
```

---

### `variablePrefix` + `VariableScope` — namespace configuration

```tsx
// App.tsx — set global namespace prefix once at the provider level
<MachineProvider id="press1" commLayer={adapter} variablePrefix="::AsGlobalPV:">
  <Dashboard />
</MachineProvider>

// components/AxisPanel.tsx — narrow scope for a subtree
import { VariableScope } from 'lux-react';

export function AxisPanel({ index }: { index: number }) {
  return (
    <VariableScope prefix={`Axis[${index}]`}>
      <PositionDisplay />  {/* useVariable('Pos') → '::AsGlobalPV:Axis[0].Pos' */}
      <VelocityDisplay />  {/* useVariable('Vel') → '::AsGlobalPV:Axis[0].Vel' */}
    </VariableScope>
  );
}
```

---

### User switching — operator login

```tsx
// components/LoginPanel.tsx
import { useMachine } from 'lux-react';

export function LoginPanel() {
  const machine = useMachine();

  async function handleLogin(user: string, pass: string) {
    if (machine.changeUser) {
      await machine.changeUser(user, pass);
    }
  }

  return (
    <form onSubmit={e => { /* ... */ handleLogin('operator', 'pass123') }}>
      {/* login form */}
    </form>
  );
}
```

---

### Batch write — atomic struct update

```tsx
// components/RecipeLoader.tsx
import { useMachine } from 'lux-react';

export function RecipeLoader({ recipe }: { recipe: Recipe }) {
  const { writeMany } = useMachine();

  async function applyRecipe() {
    if (!writeMany) return;
    await writeMany({
      'Process.Temp':     recipe.temperature,
      'Process.Speed':    recipe.speed,
      'Process.Pressure': recipe.pressure,
      'Process.Enable':   true,
    });
  }

  return <button onClick={applyRecipe}>Load Recipe</button>;
}
```

---

## MachineRegistry

Module-level singleton (no root Provider required):
```
Map<id, MachineContextValue>  +  Map<id, Set<Listener>>
registerMachine(id, value)   →  called on MachineProvider mount
updateMachine(id, value)     →  called when connectionState changes
unregisterMachine(id)        →  called on MachineProvider unmount
getMachineById(id)           →  used by useResolvedContext
subscribe(id, listener)      →  returns UnsubscribeFn; triggers hook re-renders
```

---

## Package Configuration

**`package.json`** key fields:
- `"type": "module"`, dual `exports` (`import` / `require`)
- peerDependencies: `react >=18`, `react-dom >=18`
- devDependencies: `vite ^5`, `vitest ^3`, `@testing-library/react ^15`, `@testing-library/jest-dom ^6`, `jsdom ^24`, `typescript ^5`, `@vitejs/plugin-react ^4`
- scripts: `build`, `build:types`, `test`, `test:run`, `test:coverage`

**`vite.config.ts`**: library mode; externals: `react`, `react-dom`, `react/jsx-runtime`; vitest environment: `jsdom`

**`tsconfig.json`**: `strict: true`, `exactOptionalPropertyTypes: true`, `target: ES2022`, `moduleResolution: bundler`, `jsx: react-jsx`

---

## LuxConnectAdapter Pattern (examples/)

LuxConnect's `OpcuaMachine.subscribe()` is async (returns `Promise<handle>`). Bridge via:
1. Return a local synchronous integer handle immediately
2. Store a `cancelled` flag in the pending map
3. When async subscribe resolves: if not cancelled, store resolved handle; if cancelled, call `machine.unsubscribe(resolved)` immediately
4. `unsubscribe(localHandle)`: set `cancelled = true`, call `machine.unsubscribe(resolvedHandle)` if already resolved

---

## Test Strategy

| File | Key assertions |
|------|---------------|
| `MockCommLayer.test.ts` | subscribe fires immediately if value exists; setVariableValue notifies all subscribers; getSubscribedPaths() accurate; getLastWrittenValue() accurate; optional changeUser/writeMany methods work |
| `ParentOptimizer.test.ts` | isChildOf with dot/bracket notation, edge cases (no separator = not child); navigatePath with nested structs and arrays; computeOptimalSet with always/onDemand parents, no-parent case |
| `SubscriptionManager.test.ts` | addDesired triggers debounced reconciliation; N desired paths with a registered parent → 1 commLayer.subscribe; removeDesired of last child triggers unsubscribe; fan-out delivers child values from parent event; valueCache delivers cached value immediately on re-subscribe |
| `MachineProvider.test.tsx` | connect on mount, disconnect on unmount, alwaysRead subscribed, variablePrefix set on VariableScopeContext, nested providers scope correctly |
| `VariableScope.test.tsx` | prefix stacks with parent scope; useVariable inside scope resolves full path; useWrite inside scope resolves full path |
| `useVariable.test.tsx` | loading→value transition, setValue calls writeVariable, optimistic: value updates immediately then server value overwrites, error reverts optimistic value, cleanup on unmount removes from desiredPaths, cross-tree by id, path resolved through active VariableScope |
| `useWrite.test.tsx` | calls writeVariable; no subscription created (getSubscribedPaths unchanged); path resolved through VariableScope |
| `useParent.test.tsx` | always: parent in desiredPaths immediately; onDemand: parent enters optimal set when child mounts, exits when last child unmounts; useParent unmount triggers re-reconciliation |
| `useMachine.test.tsx` | connectionState updates, error when outside provider, named machine via registry, changeUser/writeMany forwarded when present, absent when commLayer doesn't implement them |
| `MultiProvider.test.tsx` | two providers don't bleed desired-paths or values, cross-tree id lookup works, useParent scoped to correct provider |

---

## Implementation Order

1. **Project scaffold**: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `vite.config.ts`, `tests/setup.ts`
2. **Types**: `ConnectionState.ts`, `VariableTypes.ts`, `ICommLayer.ts` (including optional `changeUser`/`writeMany`), `types/index.ts`
3. **Mock**: `MockCommLayer.ts` + tests — validates test infrastructure
4. **Subscription logic**: `ParentOptimizer.ts` + tests, `SubscriptionManager.ts` + tests (including `valueCache`)
5. **Registry**: `MachineRegistry.ts`
6. **Scope context**: `VariableScopeContext.ts`, `VariableScope.tsx` + tests
7. **React layer**: `MachineContext.ts`, `useResolvedContext.ts`, `MachineProvider.tsx` + tests
8. **Hooks**: `useMachine.ts` + tests, `useVariable.ts` + tests (including `optimistic`), `useWrite.ts` + tests, `useParent.ts` + tests
9. **Public API**: `src/index.ts` barrel, `examples/LuxConnectAdapter.ts`
10. **Integration**: `MultiProvider.test.tsx`
11. **Build verification**: `npm run build:types`, `npm run build`, `npm run test:coverage`

---

## Critical Files

| File | Why critical |
|------|-------------|
| `src/types/ICommLayer.ts` | Every downstream file depends on this shape; optional methods affect useMachine surface |
| `src/subscription/SubscriptionManager.ts` | Most complex logic: dedup + fan-out + value cache |
| `src/subscription/ParentOptimizer.ts` | Pure utility; isChildOf/navigatePath/computeOptimalSet must handle all path formats correctly |
| `src/context/VariableScopeContext.ts` | All hooks resolve paths through this; stacking must be correct |
| `src/provider/MachineProvider.tsx` | Connection lifecycle, variablePrefix, alwaysRead, registry registration |
| `src/provider/VariableScope.tsx` | Path prefix stacking; used heavily in real apps to scope variable trees |
| `src/hooks/useVariable.ts` | Public API surface; callbackRef + optimistic write + scope prefix resolution |
| `src/hooks/useWrite.ts` | Must not create subscriptions; must resolve scope prefix |
| `src/hooks/useParent.ts` | Drives parent subscription optimization; connects useParent registrations to SubscriptionManager |
| `examples/LuxConnectAdapter.ts` | Documents the async→sync bridge pattern and optional method forwarding for any future adapter |
