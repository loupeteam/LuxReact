# LuxReact — Implementation Tracker

## Progress

- [x] Architecture & planning (see `.claude/plans/mossy-doodling-torvalds.md`)
- [x] **Step 1**: Project scaffold (`package.json`, tsconfig files, `vite.config.ts`, `tests/setup.ts`)
- [x] **Step 2**: Types (`ConnectionState.ts`, `VariableTypes.ts`, `ICommLayer.ts`, `types/index.ts`)
- [x] **Step 3**: Mock (`MockCommLayer.ts` + `MockCommLayer.test.ts`)
- [x] **Step 4**: Subscription logic (`ParentOptimizer.ts` + tests, `SubscriptionManager.ts` + tests)
- [x] **Step 5**: Registry (`MachineRegistry.ts`)
- [x] **Step 6**: Scope context (`VariableScopeContext.ts`, `VariableScope.tsx` + tests)
- [x] **Step 7**: React layer (`MachineContext.ts`, `useResolvedContext.ts`, `MachineProvider.tsx` + tests)
- [x] **Step 8**: Hooks (`useMachine`, `useVariable`, `useWrite`, `useParent` + tests each)
- [x] **Step 9**: Public API (`src/index.ts` barrel, `examples/LuxConnectAdapter.ts`)
- [x] **Step 10**: Integration tests (`MultiProvider.test.tsx`)
- [x] **Step 11**: Build verification — **106/106 tests pass, 96.4% coverage, zero type errors**

---

## Design Decisions Made During Planning

These were discussed with the user and are reflected in the plan:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Comm layer abstraction | `ICommLayer` interface (adapter pattern) | LuxConnect is first adapter; others (WebSocket, mock) plug in without changing library |
| Multi-machine | Named `MachineProvider` with string `id` | Allows co-mounted providers; hooks look up nearest provider or by id |
| Parent optimization API | Separate `useParent()` hook at higher scope | Child components stay unaware of optimization; consolidation declared once per subtree |
| Parent path inference | Auto-inferred from variable path prefix | `useParent('Motor')` covers all `Motor.*` without manual registration per child |
| Subscription model | Desired-set + debounced reconciliation | Mirrors WebHMI `getNextReadList()` and OpcUaProxy `TimestampBasedConsolidator`; one reconciliation pass per render cycle |
| Consolidation opt-in | Only consolidate when parent explicitly registered via `useParent()` | Matches OpcUaProxy rule: no automatic prefix consolidation |
| Hook return shape | `[value, setValue, meta]` tuple | Mirrors React useState; meta carries connectionState, quality, timestamp, loading, error |
| Variable config | Inline options on `useVariable` | `defaultValue`, `optimistic`, `samplingInterval`, `publishingInterval`, `readGroupName` |
| Connection lifecycle | Provider manages connect/disconnect | `connect()` on mount, `disconnect()` on unmount |
| TypeScript | Strict mode + `exactOptionalPropertyTypes: true` | Matches LuxConnect conventions |
| MachineRegistry | Module-level singleton + event emitter | Cross-tree machine lookup without a root context wrapper |
| `ICommLayer.subscribe()` | Synchronous handle return | React `useEffect` cleanup must unsubscribe synchronously; async setup is internal to adapter |

---

## Design Decisions Made During Implementation

| Decision | Choice | Rationale |
|----------|--------|-----------|
| MachineRegistry registration timing | Synchronous in render body (guarded by `useRef`) | `useEffect` fires after children render; children that use `useMachine(id)` would throw on first render if registration was deferred to `useEffect`. React renders parent before children, so render-body registration makes the machine available to all children immediately. |
| Registry update timing | `useLayoutEffect` (runs after DOM mutations, before paint) | Keeps registry in sync with connectionState changes while avoiding the async gap of `useEffect`. Running on every render (no deps array) ensures it's always up to date. |
| `callbackRef` pattern in `useVariable` | Subscription effect deps: `[resolvedPath, machineId, context?.machineId]` only | Re-subscribing on every render/option change would cause excessive subscriptions. The callback is stored in a ref updated each render; the subscription remains stable while path is unchanged. |
| `MockCommLayer.options` typed as `SubscribeOptions \| undefined` (not `SubscribeOptions?`) | Explicit union to satisfy `exactOptionalPropertyTypes` | With `exactOptionalPropertyTypes: true`, assigning `options` (which may be `undefined`) to an optional field requires explicit `T \| undefined` typing to avoid a TS error. |
| Test cleanup: manual registry unregisters removed | Use RTL `cleanup()` via `afterEach` instead | Manually calling `MachineRegistry.unregisterMachine()` while a component using `useSyncExternalStore` is still mounted triggers a synchronous re-render. `useMachine` throws when context is null, producing an unhandled exception. Letting RTL unmount components first (which runs cleanup effects including unregister) avoids the race. |
| `SubscribeOptions` conditional build in `useVariable` | Build options object field-by-field checking `!== undefined` | With `exactOptionalPropertyTypes: true`, spreading `{ readGroupName: options?.readGroupName }` fails when the value is `string \| undefined` but the field type is `string`. Conditional assignment satisfies the type system without losing ergonomics. |

---

## Notes

- Reference projects: `LuxConnect` (OPC UA client), `OpcUaProxy` (server-side consolidation), `WebHMI` (legacy JS HMI with `getNextReadList`)
- Full architecture details: `.claude/plans/mossy-doodling-torvalds.md`
- Target package name: `lux-react`
- Peer dependencies: `react >=18`, `react-dom >=18`
