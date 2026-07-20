# Vitest Testing Patterns

Use only the smallest pattern that matches the target. Replace example aliases and symbols with the repository's real imports. Preserve the repository's existing Vitest setup and test placement conventions.

Repository instructions and established test conventions take precedence over the interaction defaults in this reference. If the repository requires `userEvent`, use it for supported interactions, await each call, and preserve any real Promise contract. Read [React Boundary Patterns](react-boundaries.md) only when the target crosses Router, UI-library, StrictMode, Suspense, async Jotai, timer-driven `userEvent`, browser-resource, or streaming boundaries.

## Table of Contents

- [Choose a Test Shape](#choose-a-test-shape)
- [Prefer Synchronous Execution](#prefer-synchronous-execution)
- [Keep Mock Data Minimal](#keep-mock-data-minimal)
- [Keep Tests Isolated](#keep-tests-isolated)
- [Declare Hoist-Safe Module Mocks](#declare-hoist-safe-module-mocks)
- [Test Pure Modules Directly](#test-pure-modules-directly)
- [Test Components Through Behavior](#test-components-through-behavior)
- [Test Hooks with renderHook](#test-hooks-with-renderhook)
- [Control Asynchronous Work](#control-asynchronous-work)
- [Drive Time with Fake Timers](#drive-time-with-fake-timers)
- [Stub Browser Globals](#stub-browser-globals)
- [Test Jotai State](#test-jotai-state)
- [Escalate to React Boundary Patterns](#escalate-to-react-boundary-patterns)
- [Avoid Fragile Patterns](#avoid-fragile-patterns)

## Choose a Test Shape

| Target | Preferred shape | Add DOM only when |
| --- | --- | --- |
| Pure function or data transformer | Direct import and table-driven assertions | The public behavior is exposed only through JSX |
| Hook | `renderHook` plus `act` | A provider or real child lifecycle is part of the contract |
| Small component | `render`, semantic queries, and events | Always; mock only expensive external boundaries |
| Large container | A shared render helper plus narrow boundary mocks | Exercise parent-owned callbacks and branch families |
| Jotai-derived behavior | Real `Provider` and `createStore` | Prefer this when atom derivation or rerendering matters |

Do not mount an application shell to test a helper, and do not replace target-owned logic with a mock merely to reach its lines.

## Prefer Synchronous Execution

Choose the test form from the production contract, not from a blanket style rule:

| Production behavior | Test form | Boundary result |
| --- | --- | --- |
| Pure return, guard, callback, reducer, or synchronous state update | Synchronous `it`, repository-required interaction helper, or `act` | Plain value or synchronous mock |
| Source consumes a Promise and renders its result | Async `it` that awaits the observable result | Immediate `mockResolvedValueOnce` or `mockRejectedValueOnce` |
| Loading, cancellation, stale response, or request ordering | Async `it` with a controlled deferred Promise | Explicitly settle every request before completion |
| Timer is not the behavior under test | Synchronous test around a mocked timer-owning module | Preserve that module's declared return type |
| Debounce, retry, polling, or interval is the behavior | Local fake timers; use async timer APIs only if the callback awaits | Advance only the required duration |

An `async` test callback is not itself a timeout cause. Watch mode, real delays, unresolved work, and leaked resources are. Remove accidental async wrappers from synchronous paths, but never make a Promise API return a plain value when the source awaits or chains it.

## Keep Mock Data Minimal

Start with the smallest cardinality that proves the branch:

```ts
const normalRows = [{ id: 'r1', label: 'A' }];
const duplicateRows = [
  { id: 'r1', label: 'A' },
  { id: 'r2', label: 'A' },
];
```

Use `normalRows` for ordinary rendering. Use both rows only for duplicate-label, ordering, selection, grouping, or identity behavior. Empty-state tests use `[]`. Include a third row only when a three-item threshold or transitive relationship is the contract.

For object shape:

- Include fields the target reads, fields the boundary validates, and fields required by the real type.
- Prefer short values and tiny data URLs or markup only when parsing that content is the behavior.
- Use a typed builder when several tests need the same required baseline, but keep its defaults minimal and override only branch-specific fields.
- Do not weaken types with `as any`, build full backend envelopes for a two-field consumer, or share a kitchen-sink fixture across unrelated cases.

## Keep Tests Isolated

Use project-level setup when it already provides cleanup. Otherwise use this local baseline:

```ts
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
```

Reset mutable mock implementations in `beforeEach` when a test changes them. Do not use `vi.resetModules()` as routine cleanup; it invalidates module identity and adds substantial runtime cost.
Prefer `vi.stubEnv()` for environment variables so `vi.unstubAllEnvs()` can restore them. If legacy code requires direct `process.env` mutation, save whether the key existed and restore or delete it in cleanup.

## Declare Hoist-Safe Module Mocks

`vi.mock()` is hoisted. Any mutable value referenced by its factory must come from `vi.hoisted()` or be created inside the factory.

```ts
import { beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadUser: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/api/users', () => ({
  loadUser: mocks.loadUser,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

beforeEach(() => {
  mocks.loadUser.mockReset();
  mocks.navigate.mockReset();
});
```

Use a synchronous factory when the target consumes a small explicit surface. Use async `importOriginal` only when the source needs other real exports from the same module; that factory is module setup and does not require the test callback itself to be async. Avoid importing the mocked module before `vi.mock()` is evaluated.

## Test Pure Modules Directly

Prefer a compact decision table over repeated setup:

```ts
import { describe, expect, it } from 'vitest';
import { formatLabel } from '../formatLabel';

describe('formatLabel', () => {
  it.each([
    { input: undefined, expected: 'Unknown' },
    { input: '', expected: 'Unknown' },
    { input: 'ready', expected: 'READY' },
  ])('maps $input to $expected', ({ input, expected }) => {
    expect(formatLabel(input)).toBe(expected);
  });
});
```

Cover observable partitions: normal input, boundary values, missing input, invalid input, and guards. Do not assert private intermediate values.

## Test Components Through Behavior

Make child mocks expose only the behavior the parent owns:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ProfilePanel } from '../ProfilePanel';

vi.mock('../Avatar', () => ({
  Avatar: ({ name }: { name: string }) => <span aria-label="avatar">{name}</span>,
}));

it('renders the selected user and delegates close', () => {
  const onClose = vi.fn();
  const { rerender } = render(
    <ProfilePanel name="Ada" open onClose={onClose} />,
  );

  expect(screen.getByLabelText('avatar').textContent).toBe('Ada');
  fireEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalledTimes(1);

  rerender(<ProfilePanel name="Ada" open={false} onClose={onClose} />);
  expect(screen.queryByLabelText('avatar')).toBeNull();
});
```

Prefer roles, labels, text, and callback payloads. Assert CSS only when styling itself is the explicit public contract.

## Test Hooks with renderHook

Wrap state transitions in `act` and assert the hook's public result:

```ts
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useCounter } from '../useCounter';

it('increments and resets the counter', () => {
  const { result } = renderHook(() => useCounter(2));

  act(() => {
    result.current.increment();
  });
  expect(result.current.count).toBe(3);

  act(() => {
    result.current.reset();
  });
  expect(result.current.count).toBe(2);
});
```

Supply a `wrapper` to `renderHook` only when the hook truly consumes context or a provider.

## Control Asynchronous Work

First verify that a Promise-driven transition is part of the source contract. When it is, keep the test deterministic: create every Promise in the test, settle it explicitly, and await the state transition.

```tsx
import { act, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { UserCard } from '../UserCard';

const mocks = vi.hoisted(() => ({
  fetchUser: vi.fn(),
}));

vi.mock('@/api/users', () => ({
  fetchUser: mocks.fetchUser,
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

it('replaces the loading state with the resolved user', async () => {
  const request = createDeferred<{ name: string }>();
  mocks.fetchUser.mockReturnValueOnce(request.promise);

  render(<UserCard userId="1" />);
  expect(screen.getByRole('status').textContent).toMatch(/loading/i);

  await act(async () => {
    request.resolve({ name: 'Ada' });
    await request.promise;
  });

  expect(screen.getByText('Ada')).toBeTruthy();
});
```

Use `mockResolvedValueOnce` or `mockRejectedValueOnce` when request ordering does not matter. Use a deferred Promise only to assert an intermediate state. Never leave it pending at test completion. Use `findBy*` or a bounded `waitFor` when React commits after an opaque async boundary; do not add sleeps.

## Drive Time with Fake Timers

Use fake timers only when timer behavior belongs to the target. Mock the timer-backed module when only the boundary matters.

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SearchBox } from '../SearchBox';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

it('debounces the search callback', () => {
  const onSearch = vi.fn();
  render(<SearchBox delay={300} onSearch={onSearch} />);

  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'vitest' },
  });
  expect(onSearch).not.toHaveBeenCalled();

  act(() => {
    vi.advanceTimersByTime(300);
  });
  expect(onSearch).toHaveBeenCalledWith('vitest');
});
```

If the timer callback awaits a Promise, use `await vi.advanceTimersByTimeAsync(...)` inside async `act`. Always restore real timers in the same `describe` scope that enabled fake timers.

Do not combine this `fireEvent` example mechanically with `userEvent`. When repository rules or interaction fidelity require `userEvent` under fake timers, use the configured `advanceTimers` pattern in [React Boundary Patterns](react-boundaries.md#userevent-with-fake-timers).

## Stub Browser Globals

Use `vi.stubGlobal()` for globals; `vi.mock()` is for modules.

```ts
import { beforeEach, vi } from 'vitest';

class ResizeObserverStub {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

beforeEach(() => {
  const fetchMock = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ id: '1' }),
    ok: true,
  });

  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});
```

Keep the stub structurally limited to what the target reads. Let shared cleanup call `vi.unstubAllGlobals()`.

For animation frames, observers, object URLs, abortable requests, sockets, or streams, use the lifecycle-specific patterns in [React Boundary Patterns](react-boundaries.md#browser-runtime-boundaries).

## Test Jotai State

Use a real store when atom updates, derived atoms, or rerendering are part of the behavior:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { expect, it } from 'vitest';
import { statusAtom } from '@/state/status';
import { StatusButton } from '../StatusButton';

it('updates the status atom through the component', () => {
  const store = createStore();
  store.set(statusAtom, 'idle');

  render(
    <Provider store={store}>
      <StatusButton />
    </Provider>,
  );

  expect(screen.getByRole('button').textContent).toBe('idle');
  fireEvent.click(screen.getByRole('button'));
  expect(store.get(statusAtom)).toBe('ready');
  expect(screen.getByRole('button').textContent).toBe('ready');
});
```

For a component that only reads one atom or invokes one setter, a hoist-safe partial mock is cheaper:

```ts
import { beforeEach, vi } from 'vitest';

const jotaiMocks = vi.hoisted(() => ({
  setAtom: vi.fn(),
  useAtomValue: vi.fn(),
}));

vi.mock('jotai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jotai')>();
  return {
    ...actual,
    useAtomValue: jotaiMocks.useAtomValue,
    useSetAtom: () => jotaiMocks.setAtom,
  };
});

beforeEach(() => {
  jotaiMocks.setAtom.mockReset();
  jotaiMocks.useAtomValue.mockReset();
  jotaiMocks.useAtomValue.mockReturnValue('idle');
});
```

Do not build a handwritten reactive atom engine. Use `createStore()` when real subscription semantics matter.

## Escalate to React Boundary Patterns

Load [React Boundary Patterns](react-boundaries.md) only when the tested contract includes one of these boundaries:

- route matching, navigation history, data routers, or Router context;
- UI-library portals, modal/select behavior, animation, or measurement;
- `userEvent` while fake timers are active;
- React 18 StrictMode lifecycle replay, Suspense, or transitions;
- Promise-valued Jotai atoms;
- abortable fetches, SSE, WebSockets, streams, animation frames, observers, object URLs, or other browser globals.

Keep the patterns in this file for ordinary synchronous components, hooks, utilities, and atoms. Do not load or reproduce advanced boundary setup when a direct test already proves the behavior.

## Avoid Fragile Patterns

| Avoid | Use instead |
| --- | --- |
| Top-level `const mock = vi.fn()` referenced inside `vi.mock()` | `vi.hoisted()` |
| Marking every test `async` | A synchronous callback unless an observable Promise or React commit requires awaiting |
| Large shared fixtures with unrelated fields and rows | The smallest typed payload and cardinality for the current branch |
| Real network, storage, observers, or clocks | Module mocks or `vi.stubGlobal()` |
| Promises left unresolved when a test ends | Immediate results or explicitly settled deferred Promises |
| Arbitrary `setTimeout` sleeps | Observable-state waits or fake timers |
| Calling callbacks extracted from component internals | Semantic DOM events |
| Mocking the function whose logic must be covered | Mock its external dependencies |
| One global fake-timer setup for every test | A narrow `describe` with guaranteed restoration |
| Reimplementing Jotai subscriptions | `Provider` plus `createStore()` |
| Assertions coupled to UI-library markup | Roles, labels, text, and owned callback payloads |
| Ignoring a repository-mandated `userEvent` convention | Await configured `userEvent` interactions and follow repository rules |
