# Contributing

## Scope

LuxReact is a React communication library for machine and PLC data access. The source of truth is the library code in `src/` and the tests in `tests/`.

The demo app in `demo/gui/` and the B&R demo server in `demo/server/` are reference assets only. Changes to those areas should support the library and not drive the library API.

## Setup

```bash
npm ci
```

Optional demo setup:

1. Copy `.env.example` to `.env.local`.
2. Fill in connection values for your local demo PLC or test target.
3. Do not commit `.env.local`.

## Development commands

```bash
npm run dev
npm run build
npm run build:types
npm run test:run
npm run test:coverage
```

## Change guidelines

- Keep edits small and focused.
- Fix root causes in `src/` when possible.
- Add or update tests for behavior changes in `src/`.
- Preserve the current desired-set plus debounced reconciliation model in the subscription layer unless the task specifically requires changing it.
- Keep parent consolidation opt-in through `useParent()`.
- Follow TypeScript strict-mode expectations, especially `exactOptionalPropertyTypes`.

## Pull requests

Before opening a pull request:

1. Run `npm run test:run`.
2. Run `npm run build`.
3. Update `README.md` if the public API, hook behavior, or adapter expectations changed.
4. Explain any demo-only changes separately from library behavior.

## Reporting issues

- Use GitHub issues for bugs and feature requests.
- Do not report security vulnerabilities in public issues. Follow `SECURITY.md` instead.