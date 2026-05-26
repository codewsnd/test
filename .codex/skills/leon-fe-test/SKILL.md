---
name: leon-fe-test
description: Use when writing or updating synchronous React 18, TypeScript, or JavaScript unit tests with Vitest, happy-dom, and React Testing Library, especially when target-file line coverage must reach 90 percent or higher with correct passing tests.
---

# Leon FE Test

## Goal

Act as a senior frontend test engineer. Create or update the smallest stable React 18, Vitest, happy-dom, and React Testing Library unit tests that keep all generated or modified tests correct and passing while driving the requested file or directory to at least 90 percent target-file line coverage.

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
5. Keep tests synchronous from top to bottom. Use `render`, `rerender`, `screen`, and `fireEvent`; do not use `async`, `await`, `findBy*`, `waitFor`, `userEvent`, `Promise`, `setTimeout`, `setInterval`, real timers, fake timers, or `done` callbacks in generated or modified tests.
6. Repair coverage by branch family, starting with guards, empty fallbacks, and pure helpers before heavier UI flows.
7. Run the narrowest real Vitest coverage command available and inspect precise uncovered line data before reporting.
8. If compilation fails, any generated or modified test fails, or the test command exits non-zero, fix the test and rerun until the touched tests pass.
9. If target-file line coverage is below 90 percent, inspect exact missing lines and keep adding or adjusting focused tests until target-file line coverage is 90 percent or higher.

## Strict Constraints

- Do not write `async` or `await` inside `it(...)` or `test(...)`.
- Do not use RTL async APIs such as `findBy*` or `waitFor`.
- Do not import or use `@testing-library/user-event`; all user interaction must use `fireEvent`.
- Do not put `Promise`, `setTimeout`, or `setInterval` in generated or modified tests.
- Mock external dependencies with `vi.mock()`: child components, custom hooks, stores, router modules, request clients, network calls, browser APIs, and side-effect utilities.
- Keep tests isolated from real I/O, real timers, and external services.
- Do not assert `className`, inline `style`, computed style, or CSS properties.
- Focus assertions on rendering, conditional branches, pure function results, and event callbacks.
- Use minimal fixtures and micro mocks; include only the properties required to execute the branch.
- Merge connected synchronous checks into one test block when doing so reduces boilerplate without hiding failures.

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
- Mock debounce, throttle, polling, retry, delayed Promise, animation-frame, upload, download, `fetch`, `WebSocket`, `EventSource`, `ResizeObserver`, and `IntersectionObserver` boundaries with immediate synchronous stubs.
- Do not add fake-timer tests; replace timer behavior at the module boundary instead.
- Avoid full-suite coverage when a scoped test command can verify the target.

## Bundled Scripts

- `scripts/vitest_line_report.js`: parse Vitest coverage JSON and print per-target line coverage.

## Coverage Output

- Base final line coverage on actual tool output, not estimates.
- Do not output reusable coverage templates.
- Treat the result as incomplete until all generated or modified tests pass and target-file line coverage is 90 percent or higher.
- If coverage cannot run, say so and mark the result failed rather than inventing numbers.
- Final response must print only the final line coverage for each final modified or verified file, one numbered line per file.
- Use this format exactly: `1. Test1.tsx - Line coverage: 95%`
- For multiple files, continue numbering: `2. Test2.ts - Line coverage: 95.2%`
- Do not include commands, coverage tables, uncovered lines, explanations, or summaries in the final response.
- If coverage cannot run for a file, print one numbered line for that file with the reason, for example: `1. Target.tsx - Line coverage unavailable: Vitest coverage did not complete successfully.`

## Reference

Read [references/react18-vitest-rtl.md](references/react18-vitest-rtl.md) when you need mock patterns, synchronous test skeletons, Jotai examples, timeout safety checks, coverage JSON parsing, or coverage repair guidance.
