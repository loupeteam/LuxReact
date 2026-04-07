# LuxReact Workspace Instructions

## Project Focus

- LuxReact is a React communication library for machine and PLC data access.
- Treat the core library in `src/` and its tests in `tests/` as the source of truth.
- This repo is still a proof of concept. The public API is usable, but it is still under review and may change.
- The demo app in `demo/gui/` and the example adapter in `examples/` are useful references, but they are not polished and should not drive API design decisions.

## Source Of Truth

- Start with `README.md` for public API and usage expectations.
- Use `plan.md` for architecture and design rationale.
- Use `todo.md` for implementation history, edge cases, and known testing/type-system pitfalls.
- When code and docs disagree, prefer `src/` plus tests, then update the docs.

## Commands

- `npm run dev` starts the demo app with `vite.demo.config.ts`.
- `npm run build` builds the library bundle.
- `npm run build:types` emits declaration files only.
- `npm run test` runs Vitest in watch mode.
- `npm run test:run` runs the test suite once.
- `npm run test:coverage` generates coverage for `src/**`.

## Architecture Boundaries

- `src/types/` defines the core contracts, especially `ICommLayer` and variable event types.
- `src/subscription/` contains the core reconciliation logic. Keep behavior changes here tightly scoped and well tested.
- `src/provider/` owns machine lifecycle, registry registration, and scope root setup.
- `src/hooks/` is the consumer-facing React API. Preserve existing ergonomics unless the change is explicitly about API design.
- `src/registry/` supports cross-tree machine lookup by id.
- `src/mock/MockCommLayer.ts` is the preferred test double for most library behavior.

## Repo-Specific Rules

- `ICommLayer.subscribe()` must return a handle synchronously. Adapters may do async work internally, but the interface contract is synchronous.
- Parent consolidation is opt-in through `useParent()`. Do not introduce implicit path-prefix consolidation.
- `SubscriptionManager` uses a desired-set plus debounced reconciliation model. Preserve that model unless a task explicitly requires reworking it.
- The repo uses TypeScript strict mode with `exactOptionalPropertyTypes: true`. Avoid spreading optional fields with possibly undefined values; assign them conditionally.
- In React hooks, follow the existing `callbackRef` pattern where stable subscriptions matter.
- Keep provider and registry behavior compatible with multi-provider and cross-tree lookup tests.

## Testing Expectations

- Add or update tests for any behavior change in `src/`.
- Prefer unit tests near the affected area, and use integration tests when provider interactions or registry lookup are involved.
- Do not manually unregister machines during tests while mounted components still depend on them. Let normal unmount cleanup handle registry teardown.

## Demo And Example Guidance

- Treat `demo/gui/` as a rough sandbox, not a quality bar.
- Treat `examples/LuxConnectAdapter.ts` as an adapter pattern reference, not as a stable product integration.
- If a task touches the demo, avoid expanding the demo-specific API surface unless that change also improves the library itself.

## Documentation Guidance

- Link to existing docs instead of copying large architecture explanations into new files.
- Update `README.md` when public behavior, hook signatures, or adapter requirements change.
- Update `plan.md` or `todo.md` only when the architectural rationale or implementation caveats materially change.

## Change Strategy

- Prefer small, focused edits.
- Fix root causes in the library rather than patching around symptoms in the demo.
- Keep exported API changes intentional and explicit.
- If you change public types or hook behavior, verify tests and docs together.