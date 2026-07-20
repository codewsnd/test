---
name: leon-fe-test
description: Write, repair, and validate synchronous-first unit tests for React 18 and TypeScript or JavaScript code with Vitest, happy-dom or jsdom, React Testing Library, and the smallest contract-correct mock data while preserving unavoidable Promise and timer behavior. Use when Codex needs to test components, hooks, state, utilities, or frontend service adapters; diagnose flaky, hanging, or slow Vitest tests; isolate browser, network, timer, router, UI-library, or Jotai boundaries; or raise verified per-source-file line coverage to a requested threshold such as 90 percent.
---

# Leon FE Test

## Purpose

Produce the smallest maintainable tests and mock data that verify observable behavior, pass reliably, and provide real evidence for every reported coverage value. Prefer synchronous execution whenever the production contract permits it, preserve repository conventions, and treat correctness as more important than coverage.

## Task Modes

Select the narrowest mode authorized by the request; sequence modes only when the user asks for a combined outcome.

- **Diagnose / Review:** inspect code, configuration, tests, logs, and safe command output without modifying files, dependencies, or persistent configuration. A request to explain, review, or diagnose does not authorize a fix.
- **Write / Repair:** add or update focused tests and only the supporting test configuration the user authorized. Do not change production behavior to make a test pass.
- **Raise Coverage:** measure the requested source files, add behavior-focused tests, and repeat only while fresh uncovered-line evidence remains.
- **Validate:** run the requested checks without editing source, tests, configuration, or dependencies; disclose any generated reports or caches.

Explicit user requirements and applicable mandatory repository instructions take precedence over this skill's defaults. Apply synchronous-first only when multiple compliant choices remain; for example, use and correctly await `userEvent` when the repository requires it.

## Core Guarantees

- Read applicable repository instructions, the target source, nearby tests, package scripts, Vitest configuration, and test setup before editing.
- Resolve the owning workspace/package and intended Vitest project before running commands. Run from that package root and avoid accidentally selecting every project in a monorepo.
- Confirm that Vitest is locally declared and record its local version before using its CLI. Prefer an existing repository script or confirmed local binary. Never let `npm exec`, `npx`, or another package-manager command auto-install tools, and never add or update dependencies without authorization.
- Inspect the target package and sibling directories for the dominant test placement and naming convention. Extend an existing relevant test when practical; when no convention exists, default to a sibling `__tests__/<name>.test.ts[x]` file.
- Keep production source changes out of a test-only task unless the user explicitly requests them or confirms a diagnosed source defect should be fixed.
- Isolate real network, storage, browser, process, and external-service I/O. Never depend on a live service or real elapsed time.
- Default to synchronous test callbacks, interactions, assertions, and mocks when the production path is synchronous. Preserve a Promise, React commit, or timer boundary when it is part of the observable production contract; never replace a Promise-returning API with a plain value merely to remove `async`.
- Use the smallest valid mock shape and dataset for the asserted behavior. Include only fields and records that the target actually reads or that are required by the contract.
- Assert public behavior, rendered output, state transitions, callback payloads, or returned values. Do not test CSS or private implementation details unless they are the requested behavior.
- Run commands before claiming they passed. Never estimate coverage or suppress a failing touched test.

## Workflow

1. **Discover the contract and execution context.** Identify the target behavior, owning package, workspace/project selection, source files, existing tests, local Vitest version, environment, aliases, setup, scripts, configuration, and coverage provider. Read local CLI help before using a version-sensitive flag; use a supported fallback when necessary.
2. **Select the task mode and validation scope.** Preserve repository files in Diagnose / Review mode; in Validate mode, do not edit inputs and disclose command-generated artifacts. Determine the checks requested by the user or required by repository acceptance criteria. When coverage is in scope, measure a file target directly; for a directory target, infer recursion and threshold semantics, enumerate eligible source files, and ask only when a remaining ambiguity would materially change the result. Exclude tests, declarations, generated files, and fixtures unless requested.
3. **Map behavior families.** Cover normal output, guards, empty and error states, conditional rendering, callbacks, state transitions, request outcomes, cleanup, and exported helpers that are part of the contract.
4. **Choose the lightest test shape.** Prefer a synchronous direct test, synchronous RTL interaction, or synchronous `renderHook` transition. Introduce async helpers only after identifying the production boundary that requires them.
5. **Control boundaries.** Mock only dependencies that make the unit nondeterministic or unnecessarily heavy. Keep the tested business logic real.
6. **Implement focused tests.** Start a normal-path fixture with one record and only required fields. Add records or fields only when they distinguish the branch under test, such as empty, ordering, selection, deduplication, grouping, or threshold behavior.
7. **Run in one-shot mode with a bounded diagnosis.** Use `vitest run` or a repository script proven to invoke run mode. Start with the exact target; without a repository baseline, give one file an initial 60-second outer budget. When the user provides no failing test, error block, or CI evidence, limit the first pass to package scripts, Vitest configuration, and setup; do not recursively scan source files or launch tests merely to reproduce an unspecified flake. Return the supported failure classes and request the missing evidence before code-level diagnosis. Run one baseline and at most two purposeful A/B diagnostics unless new evidence justifies another command. Never repeat an unchanged command or run stress loops without an explicit user request.
8. **Repair from evidence.** Read exact failures and, when coverage is in scope, uncovered lines. Add the smallest behavioral case and rerun the touched tests.
9. **Validate the deliverable.** Run the relevant typecheck, lint, build, or repository test command when provided and warranted. Run target-file coverage only when the user requests it or repository acceptance criteria require it.

## Synchronous-First Rules

- Write the test callback without `async` when render, event handling, state updates, callbacks, and assertions all complete synchronously. Remove inherited `await`, `waitFor`, `findBy*`, async `act`, and `mockResolvedValue*` from such paths.
- Use `async`/`await`, async `act`, `findBy*`, or bounded `waitFor` only when the source consumes a Promise or React commits the observable result asynchronously. Return an immediately settled Promise by default and await the specific result.
- Never change a Promise-returning dependency to return a plain object or value when the source uses `await`, `.then()`, `.catch()`, cancellation, or request ordering. That creates a different contract rather than a faster test.
- Use a controlled deferred Promise only when loading state, stale-response protection, cancellation, or request ordering is the behavior under test; settle it before the test ends.
- Prefer awaiting the operation or observable result over generic microtask flushing. Do not use `await Promise.resolve()` as a substitute for understanding the completion signal.
- When repository rules do not choose the interaction API, use `fireEvent` and synchronous `act` for a simple synchronous DOM event; use `userEvent` for realistic multi-event behavior and await it correctly. Repository-required `userEvent` always wins.
- Never use `done`, arbitrary sleeps, Promises left unresolved when a test ends, real retries, or real polling.
- Mock timer-backed modules when timing is not the behavior under test. When debounce, retry, polling, or interval behavior is the target, use local fake timers, advance them explicitly, clear them, and restore real timers.

Read [references/testing-patterns.md](references/testing-patterns.md) before implementing nontrivial async, timer, hook, browser-global, or state tests. Read [references/react-boundaries.md](references/react-boundaries.md) only when the target crosses Router, UI-library portal or measurement behavior, `userEvent` with fake timers, StrictMode, Suspense, transitions, async Jotai, abortable or streaming I/O, animation frames, observers, or object URLs.

## Mocking and Isolation Rules

- Use `vi.mock()` for modules, `vi.spyOn()` for an owned method surface, `vi.stubGlobal()` for globals such as `fetch`, `FileReader`, observers, or animation frames, and `vi.stubEnv()` for environment variables.
- Define mock values referenced by a hoisted `vi.mock()` factory inside `vi.hoisted()`.
- Prefer partial mocks when the source relies on other real exports from the same module.
- Preserve relevant contracts: Promise-returning APIs return controlled Promises that settle before the test ends, abortable APIs remain abortable, and request hooks expose the methods consumed by the component.
- Do not mock a child, store, or hook when the behavior being asserted belongs to that dependency.
- Reset shared mock modes and state before each test. Unmount rendered trees and clean timers, globals, environment stubs, observers, subscriptions, event listeners, object URLs, streams, and abort controllers after each test.
- Do not make disabled controls artificially clickable or call private callbacks solely to manufacture coverage.

## Minimal Mock Data Rules

- Use zero records for an empty-state case, one record for a normal path unless the contract requires more, and two records only when comparison, ordering, selection, deduplication, grouping, or identity requires a contrast. Use more only when the source contract or exact cardinality requires it.
- Include only properties read by the target, validated by the boundary, or required by the declared type. Do not copy full production responses, large snapshots, long HTML, or base64 payloads into unrelated tests.
- Keep identifiers and strings short but semantically distinct, such as `r1`, `r2`, `ready`, and `failed`.
- Use typed minimal builders or `satisfies` when they preserve the real contract. Do not use `as any` or `as unknown as` merely to omit required data.
- Give each fixture one behavioral purpose. Remove a field or record if deleting it does not change the branch or assertion.

## Coverage Contract

- Apply this section only when coverage is requested or is an explicit repository acceptance criterion.
- Resolve the line threshold in this order: user-specified value, explicit repository threshold, then this skill's default of at least 90 percent for every requested source file.
- Report source-file coverage, never test-file coverage. Use the per-file row rather than an overall bundle row.
- Instrument every requested source file. Use `coverage.include` only to ensure requested targets are measured, never to hide other requested files or present a narrowed aggregate as a broader result.
- Keep diagnostic `include`, reporter, and reports-directory overrides ephemeral. Write diagnostic reports to a distinct temporary location, never overwrite a fresh canonical report, and run the repository's formal coverage command for final evidence when required.
- Prefer Vitest `json-summary` output. Parse it with:

  ```text
  node <skill-dir>/scripts/vitest_line_report.cjs <reports-dir>/coverage-summary.json <source-file> --min <resolved-threshold>
  ```

- Treat a missing coverage row, nonzero command, compilation error, failing touched test, or below-threshold target as incomplete.
- Do not add ignore comments, exclude patterns, or source-only branches to manipulate the percentage unless the user explicitly authorizes that production change.

Read [references/coverage-and-timeouts.md](references/coverage-and-timeouts.md) for package-manager commands, coverage repair, directory targets, slow runs, hanging processes, worker pressure, and parser behavior.

## Stop Conditions

Stop the repair loop and report evidence when any of these conditions remains after focused diagnosis:

- the test or coverage provider cannot run in the available environment;
- the source has an unreachable or defective public path that requires production changes outside scope;
- the repository configuration does not instrument a requested target and changing it needs user approval;
- an external dependency or missing user decision blocks deterministic execution;
- the requested threshold cannot be reached without weakening assertions, testing impossible behavior, or changing unrelated code.

Do not retry an unchanged hanging command. Isolate the file, inspect active handles or timers, and report the exact blocker.

## Final Response

Match the response to the selected mode:

- **Diagnose / Review:** lead with findings and evidence, state that no files changed, then list recommendations and unverified risks.
- **Write / Repair:** summarize behavior tested, modified files, and exact validation outcomes.
- **Raise Coverage:** include modified tests, fresh command evidence, threshold source, and actual line coverage for every requested source file.
- **Validate:** report each command and result, state that no inputs were edited, disclose generated reports or caches, and identify unavailable checks.

Always disclose blockers and residual risks. Output only coverage lines when the user explicitly requests that format.
