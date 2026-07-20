# Coverage and Timeout Diagnosis

Use this reference when a Vitest command is slow, does not exit, fails only with coverage, or needs defensible target-file coverage evidence. Diagnose the failure class before changing configuration.
Coverage-specific sections apply only when the user requests coverage or repository acceptance criteria require it; a timeout-only task should skip them.

## Table of Contents

- [Classify the Symptom](#classify-the-symptom)
- [Resolve the Package, Project, and Local Vitest](#resolve-the-package-project-and-local-vitest)
- [Use the Correct Run Mode](#use-the-correct-run-mode)
- [Bound Diagnostic Attempts](#bound-diagnostic-attempts)
- [Narrow the Reproduction](#narrow-the-reproduction)
- [Diagnose Cross-File and Worker Pressure](#diagnose-cross-file-and-worker-pressure)
- [Diagnose Hanging Processes](#diagnose-hanging-processes)
- [Eliminate Async Leaks](#eliminate-async-leaks)
- [Diagnose Timer Leaks](#diagnose-timer-leaks)
- [Keep the Coverage Loop Fast](#keep-the-coverage-loop-fast)
- [Protect Coverage Artifacts](#protect-coverage-artifacts)
- [Read Target-File Coverage Correctly](#read-target-file-coverage-correctly)
- [Use Timeouts Only as a Last Resort](#use-timeouts-only-as-a-last-resort)
- [Complete Final Validation](#complete-final-validation)

## Classify the Symptom

| Symptom | Likely class | First check |
| --- | --- | --- |
| Command waits for edits after tests pass | Watch mode | Confirm the command contains `vitest run` |
| One test fails at the timeout threshold | Unsettled async work or a real delay | Run only that test with a verbose reporter |
| All tests pass but the process remains alive | Open timer, socket, worker, or listener | Use the hanging-process reporter |
| Suite is slow before any test executes | Transform, setup, or dependency cost | Run one trivial existing test in the same project |
| Normal run is fast but coverage is slow | Instrumentation or heavy reporters | Use only `text` and `json-summary` during iteration |
| Failure occurs only in the full suite | Shared state, global mock, or resource pressure | Run the smallest failing file pair, then expand |

Do not treat all six cases by increasing `testTimeout`; that hides leaks and makes failures slower.

## Resolve the Package, Project, and Local Vitest

Establish the execution context before invoking a test command:

1. Start at the target source file and find its owning `package.json`. Inspect the nearest repository instructions, `packageManager` field, lockfile, workspace manifest, package scripts, Vitest configuration, and test setup.
2. In a monorepo, inspect root workspace configuration and package-local configuration for named Vitest projects. Run from the owning package root unless an existing repository command intentionally runs from the workspace root.
3. Select only the intended project. Resolve paths from the owning package working directory; when local help supports them, use `--project <exact-name>` or `--config <package-config>` deliberately. Otherwise let the package-local config load from its package root. Do not start at the repository root if that would silently execute unrelated packages.
4. Confirm that `vitest` is declared by the package or resolved workspace and that a local binary is already installed. Check that the selected coverage provider is locally declared and compatible with the installed Vitest major version.

Do not call `npx`, `npm exec`, or another package-manager executor to discover whether Vitest exists; these commands can fetch a missing package. Never install, upgrade, or rewrite dependencies without authorization. Prefer, in order:

1. An existing repository script proven to select the correct package, project, and run mode.
2. A confirmed local Vitest binary exposed by the repository's package manager with installation disabled.
3. Stop and report the missing local tool when neither is available.

In the examples below, `<vitest-cli>` means that confirmed local invocation; it is a placeholder, not a literal shell token. Record `<vitest-cli> --version`, then inspect `<vitest-cli> --help` and `<vitest-cli> run --help` before using version-sensitive options such as project selection, file parallelism, heap logging, reporters, or coverage overrides. If a flag is absent, use a documented local equivalent or omit it and narrow by file/config; do not change the installed version merely to obtain the flag.

## Use the Correct Run Mode

`vitest` starts an interactive/watch-oriented process in common local configurations. Automation must use run mode:

```text
<vitest-cli> run src/foo/__tests__/Widget.test.tsx
```

If scripts are being maintained, make their intent explicit:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Prefer the repository's existing script when it already enforces equivalent run-mode behavior.
When an existing script expands to bare `vitest` and changing `package.json` is outside the task, pass run mode explicitly:

```bash
npm test -- --run src/foo/__tests__/Widget.test.tsx
```

Use that `npm` example only when the inspected repository actually uses npm and its `test` script resolves the already-installed local Vitest. Substitute the repository's declared package manager otherwise.

## Bound Diagnostic Attempts

Run mode prevents watch waits, but a test process can still hang before Vitest can report an open handle. Give every diagnostic invocation an outer wall-clock budget:

1. Prefer an existing CI timeout or a measured baseline for a nearby test of similar scope.
2. When no baseline exists, use 60 seconds as the initial budget for one frontend unit-test file, then adjust only from measured evidence.
3. Start the command through an execution environment that can interrupt or terminate the specific process.
4. If the budget expires, interrupt the process, preserve its last output, and continue with a narrower test name, one file, or the hanging-process reporter.

If the execution environment cannot identify and interrupt the launched process or session, do not start a command that may wait indefinitely. The outer budget is a diagnostic guard, not Vitest's `testTimeout`. Do not rely on GNU `timeout`, which is not portable to default macOS and Windows environments, and do not force the process to exit in a way that hides open resources.

When the report does not identify a failing test, hook, error block, or CI resource limit, inspect only package scripts, Vitest configuration, and test setup on the first pass. Do not recursively scan source or test files and do not run the full suite, full coverage, or a stress loop solely to manufacture a reproduction. Return the supported symptom classes, state that no code-level root cause is confirmed, and request the exact failure evidence. Use one already-known lightweight smoke test only after stating a hypothesis that it can distinguish within the available budget.

Use a finite diagnostic budget for one symptom:

- Run one baseline, then at most two purposeful A/B commands when no repository procedure specifies otherwise.
- Change one diagnostic variable per comparison, such as coverage off/on, normal/serial workers, or default/hanging-process reporter. State the hypothesis before running it.
- Do not rerun an unchanged command without new evidence. A different failure, stack, active handle, or uncovered branch may justify a new focused command; normal timing variance does not.
- Do not run repeated stress, flake, or soak loops unless the user explicitly requests them.
- After a repair, run the required focused validation once; expand to the repository-required suite only when its scope and budget are known.

## Narrow the Reproduction

Start without coverage and name the exact file:

```text
<vitest-cli> run src/foo/__tests__/Widget.test.tsx --reporter=verbose
```

Then narrow to one test name when needed:

```text
<vitest-cli> run src/foo/__tests__/Widget.test.tsx -t "loads the selected user"
```

Expand scope only after the narrow run is stable:

1. One test name
2. One test file
3. Target test directory
4. The repository's required verification suite

This sequence separates target behavior from cross-file leakage. It is a diagnosis technique, not permission to omit the required final suite.

## Diagnose Cross-File and Worker Pressure

When a file passes alone but fails or stalls in the suite, rerun the smallest failing file set serially:

```text
<vitest-cli> run src/foo/__tests__/Widget.test.tsx \
  --maxWorkers=1 \
  --no-file-parallelism \
  --logHeapUsage \
  --reporter=verbose
```

If serial execution fixes the problem, inspect shared globals, environment stubs, fixed ports, temporary paths, process-wide caches, and unbounded imports. Keep file isolation enabled. Cap workers to a measured value such as two to four in memory-constrained CI only after confirming resource pressure; do not use one worker as the permanent default merely to hide shared-state defects.

Use `--slowTestThreshold=100` and `--silent=passed-only` when excessive logging hides timing evidence.

## Diagnose Hanging Processes

Vitest includes a reporter for processes that remain open after the test run:

```text
<vitest-cli> run src/foo/__tests__/Widget.test.tsx \
  --reporter=default \
  --reporter=hanging-process
```

Inspect the owning code for:

- `setInterval`, recursive `setTimeout`, or unflushed debounce work
- `EventSource`, `WebSocket`, HTTP servers, or stream subscriptions
- worker threads or child processes
- DOM or application event listeners without matching removal
- observer instances with no `disconnect()`
- unresolved Promises that keep downstream resources open

Fix or mock the boundary that owns the handle. A forced process exit can conceal data loss and should not be used as a test repair.

## Eliminate Async Leaks

Every test-created async resource must reach a terminal state:

- Remove `async`, `await`, `waitFor`, and Promise mocks from paths that are genuinely synchronous.
- Do not make an awaited or chained production API synchronous; return an immediately settled Promise instead.
- Await the user-visible state transition, not an arbitrary delay.
- Resolve or reject every deferred Promise before the test ends.
- Give request mocks immediate deterministic results unless ordering is under test.
- Close streams, sockets, and subscriptions during unmount or test cleanup.
- Await async `act`, `findBy*`, and `waitFor`; never fire and forget them.
- Treat unhandled rejection and React `act(...)` warnings as failures to repair.

For a source-level cancellation contract, verify cleanup directly:

```tsx
import { render } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { LivePanel } from '../LivePanel';

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
}));

vi.mock('@/stream/createStream', () => ({
  createStream: () => ({ close: mocks.close }),
}));

it('closes the stream on unmount', () => {
  const { unmount } = render(<LivePanel />);
  unmount();
  expect(mocks.close).toHaveBeenCalledTimes(1);
});
```

If the target does not own cleanup and the external library does, mock at that library boundary rather than duplicating its internals.

## Diagnose Timer Leaks

When timer ownership is under test, fake time and inspect pending timers:

```tsx
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PollingPanel } from '../PollingPanel';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

it('stops polling on unmount', () => {
  const { unmount } = render(<PollingPanel />);

  act(() => {
    vi.advanceTimersByTime(1_000);
  });
  expect(vi.getTimerCount()).toBeGreaterThan(0);

  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
```

Do not call `vi.runAllTimers()` against an intentionally recurring interval; it can loop until Vitest aborts. Advance only the time required for the asserted transition.

## Keep the Coverage Loop Fast

Prove correctness without coverage first. Add coverage only after the scoped tests pass:

```text
<vitest-cli> run src/foo/__tests__/Widget.test.tsx \
  --coverage \
  --coverage.reporter=text \
  --coverage.reporter=json-summary \
  --coverage.reportsDirectory=<diagnostic-report-dir>
```

During iteration:

- Avoid HTML and LCOV generation unless the repository requires them for final CI.
- Remove noisy application logging through a narrow spy or existing test setup.
- Mock real I/O and large UI-library behavior surfaces, not target-owned logic.
- Prefer a target test directory over a full-suite coverage run while repairing exact lines.
- Limit workers only when profiling shows memory contention; do not make serial execution the default.

Coverage instrumentation has real cost. A modest increase over the non-coverage run is expected; an indefinite wait is not.

## Protect Coverage Artifacts

Treat coverage reports as evidence with ownership and freshness, not as interchangeable build output:

1. Preserve the repository's canonical reports directory during diagnosis. Create a unique execution-environment temporary directory and pass it as the diagnostic reports directory only if local CLI help confirms the override.
2. Keep temporary `include`, reporter, and reports-directory choices on the diagnostic command line. Do not edit committed configuration in Diagnose / Review or Validate mode, and do not persist a narrowed include solely to improve the displayed aggregate.
3. Write `text` and `json-summary` to the temporary directory during iteration. Do not overwrite a fresh HTML, LCOV, JSON, or summary report produced by a formal run.
4. Delete only a temporary directory created and positively identified by the current task. Never delete or reuse an existing report to manufacture freshness.
5. If the installed version cannot isolate diagnostic output, avoid coverage for that A/B check or obtain authorization for a safe configuration change. Do not silently write over canonical evidence.
6. For final evidence, run the repository's required formal coverage command from the correct package/project context. Confirm that the report was generated by that successful run before parsing it.

When a temporary `coverage.include` is necessary, enumerate every requested target and label the result target-scoped. An isolated report must never be described as project-wide coverage.

## Read Target-File Coverage Correctly

Use the fresh diagnostic or formal `coverage-summary.json` as machine-readable evidence when the configured provider emits it:

```text
node <skill-dir>/scripts/vitest_line_report.cjs \
  <reports-dir>/coverage-summary.json \
  src/foo/Widget.tsx \
  --min <resolved-threshold>
```

Validate all of the following:

- The matched row is the requested source file, not a same-basename file in another directory.
- The target is package-root-relative or absolute and resolves exactly from the command's working directory; the parser does not guess from a basename or partial suffix.
- The reported metric is line coverage, not statement, branch, or function coverage.
- The target path is resolved relative to the coverage report or project root consistently.
- A directory target is expanded by the agent into the intended source files before invoking the parser; tests and declarations are excluded.
- Missing target rows fail validation instead of inheriting the aggregate `total` row.
- The command exits non-zero when the report is malformed, a target is missing, or the threshold is unmet.

Use `coverage.include` only when needed to ensure the explicitly requested source scope is instrumented. Never use it to omit another requested file, inflate an aggregate, or present a target-only aggregate as project-wide coverage. Inspect the text report or raw JSON for uncovered lines, add the smallest behavior-focused test, and rerun the same command.

## Use Timeouts Only as a Last Resort

Increase a timeout only when all of these are true:

1. The test performs legitimate deterministic work that cannot be replaced by controlled time or a boundary mock.
2. No open handle, unresolved Promise, real network request, or timer leak remains.
3. The narrow test has a measured, stable runtime close to the current limit.
4. The exception is local to the test or suite, not a blanket project increase.

Prefer an explicit local option with a short reason:

```ts
import { expect, it } from 'vitest';
import { processFixture } from '../processFixture';
import { fixedLargeFixture } from './fixtures/fixedLargeFixture';

it(
  'processes the fixed large fixture',
  { timeout: 10_000 },
  () => {
    const result = processFixture(fixedLargeFixture);
    expect(result.items).toHaveLength(5_000);
  },
);
```

Do not use a larger timeout to compensate for watch mode, real sleeps, retry backoff, polling, or a missing mock.

## Complete Final Validation

Before reporting completion, retain evidence that:

- Every generated or modified test compiles and passes in run mode.
- The required project-level test, lint, or typecheck command passes when in scope.
- When coverage is in scope, it completes with exit code zero using the repository's configured provider.
- When coverage is in scope, every requested source-file row is present, resolves exactly, and has at least the required line coverage.
- The final run has no unhandled rejection, React `act(...)` warning, or hanging-process report.
- The final response names actual target source files and uses measured results only.
- Any command that could not run is reported as unverified with the concrete reason.

Do not claim success from a cached report created before the final test changes. Record the command and fresh result internally, then format the user-facing answer according to the skill's output contract.
