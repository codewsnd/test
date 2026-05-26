---
name: leon-fe-unittest
description: Use when writing or updating React 18, TypeScript, or JavaScript unit tests with Vitest, happy-dom, and React Testing Library, especially for synchronous isolated tests, __tests__ placement, UI-library mocks, Jotai state, or target-file line coverage.
---

# Leon FE UnitTest

## Goal

Create or update the smallest stable frontend unit tests that drive the requested file or directory to 100 percent target-file line coverage while staying synchronous, deterministic, and isolated from browser timing, router trees, app shells, network clients, and heavy UI implementations.

Prefer extending an existing test. Otherwise place new tests in the required `__tests__` directory.

## When To Use

- React 18 components, hooks, helpers, and JavaScript or TypeScript modules tested with Vitest, happy-dom, and React Testing Library.
- Large stateful components that need a synchronous harness, Jotai mocks, UI-library mocks, request-hook mocks, or exact uncovered line repair.
- Tasks that require `.test.ts` or `.test.tsx` placement and real coverage evidence.

## Test Placement

Always generate tests in `__tests__`.

- File target: `/mock-workspace/demo-app/src/components/Button.tsx`
- Test file: `/mock-workspace/demo-app/src/components/__tests__/Button.test.tsx`

For a directory target, put every generated test in exactly one `targetDirectory/__tests__/` folder. Default to files directly inside that directory unless the user asks for recursion. Skip existing `__tests__` and `.d.ts` files. Reuse existing tests before creating duplicates.

Use `.test.tsx` for JSX components and `.test.ts` for non-JSX modules unless the repo already uses another convention.

## Workflow

1. Read the target source, existing tests, and nearby test style before writing tests.
2. Map executable branch families: fallback renders, conditional JSX, callbacks, helpers, derived values, exported functions, request success and error paths, confirm flows, table renderers, and guard clauses.
3. Choose the lightest test shape: direct function tests for pure modules; `render(...)` for small components; one reusable synchronous harness for large containers.
4. Mock every external boundary with minimal `vi.mock()` stubs: child components, hooks, stores, router modules, request clients, browser APIs, and utility modules with side effects.
5. Keep tests synchronous from top to bottom. Use `render`, `rerender`, `screen`, and `fireEvent`; avoid `async`, `await`, `findBy*`, `waitFor`, `userEvent`, real timers, and `done` callbacks.
6. Repair coverage by branch family, starting with guards, empty fallbacks, and pure helpers before heavier UI flows.
7. Run the narrowest real Vitest coverage command available and inspect precise uncovered line data before reporting.

## Large Component Fast Path

- Build one `renderSubject()` helper and a small `renderCase(overrides)` wrapper.
- Seed only the minimal state the component reads.
- Prefer one mixed fixture that covers normal values, empty values, invalid JSON, merged-cell metadata, and variant labels when those branch families exist.
- Put shared mode flags, atom symbols, and mock functions inside `vi.hoisted(...)` when Vitest hoisting matters.
- Shrink heavy UI libraries to behavior surfaces that execute render callbacks, selection callbacks, modal handlers, table cell renderers, and synthetic edge-case triggers.
- Mock request hooks with synchronous modes such as idle, success callback, error callback, service success, and service error.

## Jotai Rules

- Mock atom modules or `useAtomValue` directly when the component only reads a few values.
- Mock `useSetAtom` and assert setter payloads when the component only writes.
- Use a real `Provider` plus `createStore()` only when the branch depends on real atom derivation or rerendering from atom updates.
- For components that read and write many atoms, use a tiny reactive `useAtom` mock backed by `Map` and listener sets.

## Timeout Rules

- Never wait for real time to pass.
- Mock or flush debounce, throttle, polling, retry, delayed Promise, animation-frame, upload, download, `fetch`, `WebSocket`, `EventSource`, `ResizeObserver`, and `IntersectionObserver` boundaries when the target touches them.
- Restore fake timers with `vi.useRealTimers()` whenever they are used.
- Avoid full-suite coverage when a scoped test command can verify the target.

## Coverage Output

- Report actual tool output, not estimates.
- Put the command-level row first and label it `Whole run / bundle` when available.
- Add `Target file only` rows only when they come from real coverage data or the user explicitly requested target-file-only coverage.
- Include exact uncovered line numbers for touched source rows below 100 percent.
- If coverage cannot run, say so and mark the result failed rather than inventing numbers.
- Finish after the compact coverage table unless the user asks for additional analysis.

## Reference

Read [references/react18-vitest-rtl.md](references/react18-vitest-rtl.md) when you need mock patterns, synchronous test skeletons, Jotai examples, timeout safety checks, or the final table template.
