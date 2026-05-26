# React 18 + Vitest + RTL

## Table of Contents

- [Coverage Checklist](#coverage-checklist)
- [Target Triage](#target-triage)
- [Large Component Fast Path](#large-component-fast-path)
- [Coverage Repair Order](#coverage-repair-order)
- [Test File Placement](#test-file-placement)
- [Minimal Patterns](#minimal-patterns)
- [Timeout Safety](#timeout-safety)
- [Heuristics](#heuristics)
- [Coverage Run](#coverage-run)
- [Final Table Template](#final-table-template)

## Coverage Checklist

- Render path
- Empty or null fallback
- Variant flag branch
- Event callback branch
- Derived label or text branch
- Early return or guard clause
- No-op guard or defensive branch
- Exported helper or pure function branch

## Target Triage

Pick the smallest test style that can still reach the lines:

- Pure module or helper: import functions directly and skip RTL unless JSX is involved.
- Small component: `render(...)` plus local `vi.mock(...)` stubs.
- Large stateful container: one reusable synchronous harness plus mode-driven mocks.
- Wrapper component: mock the child boundary and assert delegated props or callbacks instead of rebuilding the full child UI.

## Large Component Fast Path

Use this order for large stateful containers so the first draft already lands near the final coverage target:

1. Split the file into branch families before writing tests.
   - Render fallback and derived text
   - Toolbar actions and hidden inputs
   - Confirm dialogs and cancel flows
   - Selection helpers and dedupe guards
   - Delete or transform helpers
   - Request, export, compare, or upload pipelines

2. Build one reusable synchronous harness.
   - `resetState()` seeds the minimal atom or prop state.
   - `renderSubject()` renders once.
   - `renderCase(overrides)` flips only the few inputs needed for a branch.
   - One compact mixed fixture should contain valid data, empty data, invalid JSON, merged-cell metadata, and variant labels when the target uses them.

3. Keep all complicated mocks mode-driven.
   - Put mutable flags and shared mock functions inside `vi.hoisted(...)`.
   - Change modes per test instead of re-mocking the same module repeatedly.
   - Prefer one request-hook mock with several synchronous modes over many ad hoc mock implementations.

4. Patch uncovered lines by family.
   - Read the uncovered rows.
   - Decide which family they belong to.
   - Add the smallest scenario that flips that family.

## Coverage Repair Order

Patch missing frontend lines in this order:

1. Guards, empty fallbacks, and pure helpers
2. Derived labels, variant text, and render callbacks
3. Event callbacks, confirm flows, and selection helpers
4. Request wrapper callbacks and upload or export plumbing
5. Truly post-`await` leftovers that cannot be reached synchronously

## Test File Placement

- Use mock example roots such as `/mock-workspace/demo-app/`.
- Never place a real user project path in skill examples.

- Target file: `/mock-workspace/demo-app/src/foo/bar.ts`
- Test file: `/mock-workspace/demo-app/src/foo/__tests__/bar.test.ts`

- Target file: `/mock-workspace/demo-app/src/foo/Bar.tsx`
- Test file: `/mock-workspace/demo-app/src/foo/__tests__/Bar.test.tsx`

- Target directory: `/mock-workspace/demo-app/src/api/tool`
- Test directory: `/mock-workspace/demo-app/src/api/tool/__tests__/`
- Example outputs:
  - `/mock-workspace/demo-app/src/api/tool/__tests__/api.test.ts`
  - `/mock-workspace/demo-app/src/api/tool/__tests__/toolApi.test.ts`

- Create `__tests__` when missing.
- Reuse an existing file in that folder before creating a second test file for the same target.
- For directory targets, place all generated tests in the given directory's `__tests__` folder.
- For directory targets, default to direct child source files unless the user explicitly asks for recursion.
- If directory-target output names collide, prefix the relative path segment to keep filenames unique.

## Minimal Patterns

### Base Imports

```ts
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
```

## Timeout Safety

- Never use `done`.
- Never depend on real sleeping or delayed retries.
- Always reset fake timers after a timer-driven test.
- Keep network, router, browser API, and observer mocks synchronous and local.
- Prefer one-file test runs and one-directory coverage runs over broad project-wide runs.
- Do not use `vi.resetModules()` as a default cleanup tool. Reach for it only when import-time side effects make it necessary.

### Timer Cleanup

```ts
import { afterEach, vi } from 'vitest';

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});
```

### Drive Source Timers Immediately

```ts
it('flushes the source delay without waiting', () => {
  vi.useFakeTimers();
  runSomethingThatSchedulesWork();
  vi.runAllTimers();
  expect(handleResult()).toBe('done');
});
```

### Child Component Mock

```tsx
vi.mock('@/Child', () => ({
  default: (props: { onClick?: () => void; label?: string }) => (
    <button data-testid="child" onClick={props.onClick}>
      {props.label ?? 'child'}
    </button>
  ),
}));
```

### Hook Mock

```ts
const mockUseFoo = vi.fn();

vi.mock('@/hooks/useFoo', () => ({
  useFoo: mockUseFoo,
}));
```

### Router Mock

```ts
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: '1' }),
}));
```

### API Mock

```ts
const mockRequest = vi.fn();

vi.mock('@/api/client', () => ({
  client: { get: mockRequest, post: mockRequest },
}));
```

### Jotai Write Mock

```ts
const mockSetAtom = vi.fn();

vi.mock('jotai', () => ({
  useSetAtom: () => mockSetAtom,
  useAtomValue: () => false,
}));
```

### Jotai Reactive Harness

```ts
const hoisted = vi.hoisted(() => {
  const atomStore = new Map<unknown, unknown>();
  const atomListeners = new Map<unknown, Set<(value: unknown) => void>>();

  const setAtomValue = (atom: unknown, value: unknown) => {
    atomStore.set(atom, value);
    atomListeners.get(atom)?.forEach((listener) => listener(value));
  };

  return { atomStore, atomListeners, setAtomValue };
});

vi.mock('jotai', () => ({
  useAtom: (atom: unknown) => {
    const [value, setValue] = React.useState(hoisted.atomStore.get(atom));

    React.useEffect(() => {
      if (!hoisted.atomListeners.has(atom)) {
        hoisted.atomListeners.set(atom, new Set());
      }
      const listeners = hoisted.atomListeners.get(atom)!;
      listeners.add(setValue);
      return () => listeners.delete(setValue);
    }, [atom]);

    return [value, (next: unknown) => hoisted.setAtomValue(atom, next)] as const;
  },
}));
```

### Jotai Minimal Store

```tsx
import { Provider, createStore } from 'jotai';

const store = createStore();
store.set(openAtom, true);

render(
  <Provider store={store}>
    <Target />
  </Provider>,
);
```

### Mode-Based Request Hook Mock

```ts
const hoisted = vi.hoisted(() => ({
  requestMode: {
    current: 'idle' as 'idle' | 'success' | 'error' | 'service-error' | 'mount-service',
  },
}));

vi.mock('ahooks', () => ({
  useRequest: (service: () => unknown, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
    if (hoisted.requestMode.current === 'mount-service') {
      service();
    }

    return {
      loading: false,
      run: () => {
        if (hoisted.requestMode.current === 'service-error') {
          service();
          options?.onError?.(new Error('request failed'));
          return;
        }

        if (hoisted.requestMode.current === 'success') {
          options?.onSuccess?.();
          return;
        }

        if (hoisted.requestMode.current === 'error') {
          options?.onError?.(new Error('request failed'));
        }
      },
    };
  },
}));
```

### Modal + Disabled Button Mock

```tsx
const hoisted = vi.hoisted(() => ({
  autoConfirm: { current: true },
}));

vi.mock('antd', () => ({
  Button: ({ disabled, onClick, children }: { disabled?: boolean; onClick?: () => void; children?: React.ReactNode }) => (
    <button aria-disabled={disabled ? 'true' : 'false'} data-disabled={disabled ? 'true' : 'false'} onClick={onClick}>
      {children}
    </button>
  ),
  Modal: {
    confirm: (config: { footer?: (...args: unknown[]) => unknown; onOk?: () => void }) => {
      config.footer?.(null, {
        OkBtn: () => <button>ok-footer</button>,
        CancelBtn: () => <button>cancel-footer</button>,
      });
      if (hoisted.autoConfirm.current) {
        config.onOk?.();
      }
      return {};
    },
  },
}));
```

### Table Shell Mock

```tsx
vi.mock('antd', () => ({
  Table: ({
    columns,
    dataSource,
    rowKey,
  }: {
    columns: Array<{
      key: string;
      dataIndex: string;
      render?: (text: string, record: Record<string, unknown>) => React.ReactNode;
      onCell?: (record: Record<string, unknown>) => { rowSpan?: number };
    }>;
    dataSource: Array<Record<string, unknown>>;
    rowKey: string | ((record: Record<string, unknown>) => React.Key);
  }) => (
    <table data-testid="mock-table">
      <tbody>
        {dataSource.map((record) => {
          const key = typeof rowKey === 'function' ? rowKey(record) : (record[rowKey] as React.Key);
          return (
            <tr key={String(key)}>
              {columns.map((column) => {
                const cellProps = column.onCell?.(record) || {};
                const content = column.render
                  ? column.render((record[column.dataIndex] as string) || '', record)
                  : (record[column.dataIndex] as React.ReactNode);
                return (
                  <td data-rowspan={cellProps.rowSpan ?? ''} key={column.key}>
                    {content}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  ),
}));
```

### Component Test Shape

```tsx
it('renders both branches and fires callbacks', () => {
  const onChange = vi.fn();
  const { rerender } = render(<Target open onChange={onChange} value="A" />);

  expect(screen.getByText('A')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'close' }));
  expect(onChange).toHaveBeenCalledWith(false);

  rerender(<Target open={false} onChange={onChange} value="" />);
  expect(screen.queryByText('A')).not.toBeInTheDocument();
});
```

### Function Test Shape

```ts
it('covers all line paths', () => {
  expect(pickLabel()).toBe('default');
  expect(pickLabel('x')).toBe('x');
});
```

## Heuristics

- Mock modules at file scope and clear call history only when a test truly needs a reset.
- Prefer `getBy*` for presence and `queryBy*` for absence.
- Replace child components with the smallest stub that still lets the parent execute its branch.
- Trigger callback-only lines through `fireEvent` instead of calling internals directly.
- If the current file has no test, check local git history for a deleted test or a nearby sibling test that can donate compact fixtures or edge-case ideas.
- If a helper can be tested directly and that removes UI setup, add one tiny pure-function test.
- If a source module is timeout-prone, assert the synchronous boundary instead of waiting for the whole chain to settle.
- If a mock could stay unresolved, replace it with an immediate deterministic return value.
- For Jotai, prefer mocking one atom read or one setter over mounting a large store.
- If a real Jotai store is necessary, seed only the atoms touched by the branch under test.
- If a large component reads and writes many atoms, a tiny reactive `useAtom` mock is often faster and more controllable than `Provider + createStore()`.
- If a guard sits behind a disabled UI control, keep the control clickable in the mock and expose disabled state only through attributes.
- If a confirm dialog owns important lines, make the mock execute `footer` and optionally `onOk`.
- If edge-case coverage depends on table selection behavior, add one synthetic trigger in the mock instead of building a huge DOM fixture.
- After each run, ask whether the hard part was a branch family, a mock shape, or a coverage reporting gap, then promote only the durable answer back into the skill.

## Coverage Run

- Prefer the repo's existing package manager and test script first.
- Keep the executed test scope narrow, but keep coverage behavior aligned with the repo default or the user's provided Vitest command.
- Do not add `--coverage.include`, custom `coverage.include`, or similar narrowing flags for the final reported number unless the user explicitly asks for target-file-only coverage.
- Prefer a text reporter that prints per-file coverage to the terminal.
- Remember that a single-test command can still yield an overall row for the whole executed coverage bundle or run, not just the target file.
- If the real coverage output includes both an overall row and a target-file row, report the overall row first and label the target-file row separately.
- If any relevant file row is below 100 percent line coverage, capture its `Uncovered Line #s` and print them in the final result.
- If terminal output is too coarse, rerun with a JSON coverage reporter and inspect `coverage-final.json` to recover exact uncovered line numbers quickly.
- If a run exposes a faster or safer coverage workflow, update the skill reference before finishing so the next run starts with the better default.

### Common Commands

```bash
pnpm vitest run src/foo/__tests__/bar.test.ts --coverage --coverage.reporter=text
```

```bash
npm exec -- vitest run src/foo/__tests__/bar.test.ts --coverage --coverage.reporter=text
```

```bash
yarn vitest run src/foo/__tests__/bar.test.ts --coverage --coverage.reporter=text
```

```bash
npm exec -- vitest run src/api/tool/__tests__ --coverage --coverage.reporter=text
```

## Final Table Template

```md
| Coverage scope | Source file | Test file | Covered executable lines | Total executable lines | Coverage | Missing executable lines | Result |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| Whole run / bundle | src/foo/bar.ts | src/foo/__tests__/bar.test.ts | 48 | 56 | 85.71% | see file rows | 🟢 success |
| Target file only | src/foo/bar.ts | src/foo/__tests__/bar.test.ts | 12 | 14 | 85.71% | 20, 33 | 🟢 success |
```
