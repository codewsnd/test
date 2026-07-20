# React Boundary Patterns

Load only the sections required by the target. Preserve the repository's setup and types, keep fixtures minimal, and test behavior owned by the source. Promise APIs must return Promises; make them settle deterministically instead of converting them to plain values.

## Table of Contents

- [Router Boundaries](#router-boundaries)
- [UI-Library Portals and Owned Behavior](#ui-library-portals-and-owned-behavior)
- [userEvent with Fake Timers](#userevent-with-fake-timers)
- [React 18 StrictMode](#react-18-strictmode)
- [Suspense and Transitions](#suspense-and-transitions)
- [Async Jotai Atoms](#async-jotai-atoms)
- [Abortable and Streaming I/O](#abortable-and-streaming-io)
- [Browser Runtime Boundaries](#browser-runtime-boundaries)

## Router Boundaries

Choose the smallest Router surface that owns the asserted behavior:

| Contract | Test boundary |
| --- | --- |
| Link resolution, route params, location, nested routes, or back/forward history | `MemoryRouter` with real `Routes` |
| Loader, action, redirect, error element, or pending navigation | `createMemoryRouter` plus `RouterProvider` |
| Component only delegates one already-tested destination to `useNavigate` | Partial hook mock that preserves other exports |

```tsx
render(
  <MemoryRouter initialEntries={['/users/7']}>
    <Routes>
      <Route path="/users/:id" element={<UserPage />} />
    </Routes>
  </MemoryRouter>,
);

expect(screen.getByRole('heading', { name: 'User 7' })).toBeTruthy();
```

For a navigation callback only, partially mock `useNavigate` with a hoist-safe function and assert its exact payload. Do not mock the whole `react-router-dom` package, duplicate route matching in a fake hook, or use a real browser history when memory history proves the contract.

## UI-Library Portals and Owned Behavior

Render the real library component when its accessible behavior is stable and material. Add a portal host only if the library requires one, query portalled content through `screen`, and remove the host after the test. Mock a heavy Modal, Select, tooltip, animation, or measurement boundary only when the parent—not the library—owns the asserted branch.

```tsx
vi.mock('@acme/ui', () => ({
  Modal: ({ children, onClose, open }: ModalProps) =>
    open ? (
      <section role="dialog">
        {children}
        <button type="button" onClick={onClose}>Close</button>
      </section>
    ) : null,
  Select: ({ disabled, onChange, value }: SelectProps) => (
    <select
      aria-label="status"
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="ready">Ready</option>
    </select>
  ),
}));
```

Expose only consumed props, semantic controls, and owned callbacks. Disable animation or stub observers at their boundary; do not reproduce the library internals. Avoid static mocks that cannot close, select, respect `disabled`, or reflect `open`, because they bypass parent-owned behavior.

## userEvent with Fake Timers

Use this only when timer behavior belongs to the target and repository rules require `userEvent`. Configure timer advancement before creating the user, await every interaction, advance only the target delay, and restore real timers locally.

```tsx
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

it('submits after the debounce', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const onSubmit = vi.fn();
  render(<Search onSubmit={onSubmit} />);

  await user.type(screen.getByRole('textbox'), 'a');
  expect(onSubmit).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(onSubmit).toHaveBeenCalledWith('a');
});
```

Use `advanceTimersByTimeAsync` when the timer callback awaits. Do not set `delay: null`, run all timers around recurring work, enable fake timers globally, or replace awaited user interactions with unawaited calls.

## React 18 StrictMode

StrictMode may replay mount effects in development. Test the externally visible invariant and balanced cleanup, not an incidental single invocation.

```tsx
it('keeps one active subscription and cleans it on unmount', () => {
  const unsubscribe = vi.fn();
  const subscribe = vi.fn(() => unsubscribe);
  const { unmount } = render(
    <StrictMode><Feed subscribe={subscribe} /></StrictMode>,
  );

  expect(subscribe.mock.calls.length - unsubscribe.mock.calls.length).toBe(1);
  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(subscribe.mock.calls.length);
});
```

Make effects idempotent and cleanup owned resources. Do not remove StrictMode merely to force `toHaveBeenCalledTimes(1)`, and do not loosen assertions when duplicate requests reveal a real missing cleanup or deduplication defect.

## Suspense and Transitions

Control the suspending Promise and await rendered state. For `startTransition`, trigger the public action and assert the final committed UI; assert pending UI only when it is part of the contract.

```tsx
it('reveals a lazy panel after its module resolves', async () => {
  const module = createDeferred<{ default: () => JSX.Element }>();
  const Panel = lazy(() => module.promise);
  render(<Suspense fallback={<span role="status">Loading</span>}><Panel /></Suspense>);

  expect(screen.getByRole('status')).toBeTruthy();
  await act(async () => {
    module.resolve({ default: () => <h2>Ready</h2> });
    await module.promise;
  });
  expect(await screen.findByRole('heading', { name: 'Ready' })).toBeTruthy();
});
```

For a component that calls `startTransition`, drive its public interaction and await the committed result:

```tsx
const user = userEvent.setup();
render(<ResultFilter />);
await user.type(screen.getByRole('textbox'), 'ready');
expect(await screen.findByText('Ready result')).toBeTruthy();
```

Reuse the controlled deferred helper from the core patterns and settle it before completion. Do not call a private transition callback, use arbitrary microtask flushes or sleeps, or mock Suspense away when fallback or transition behavior is the target.

## Async Jotai Atoms

Use a real store and Provider when Promise-valued atom resolution, dependency tracking, or rerendering is the behavior. Mock only the external request with an immediately settled or controlled Promise.

```tsx
it('renders the async atom value', async () => {
  api.loadName.mockResolvedValueOnce('Ada');
  const store = createStore();
  render(
    <Provider store={store}>
      <Suspense fallback={<span role="status">Loading</span>}>
        <UserName />
      </Suspense>
    </Provider>,
  );

  expect(screen.getByRole('status')).toBeTruthy();
  expect(await screen.findByText('Ada')).toBeTruthy();
  await expect(store.get(nameAtom)).resolves.toBe('Ada');
});
```

Create a fresh store per test and settle rejected Promises too. Do not replace the async atom with a synchronous fake value, reuse a settled store across tests, or implement a handwritten subscription engine.

## Abortable and Streaming I/O

Preserve lifecycle contracts while replacing transport. Let production create and own its `AbortController`; capture the `fetch` signal rather than replacing the controller with a boolean fake.

| Boundary | Minimal controlled behavior | Cleanup to assert |
| --- | --- | --- |
| `fetch` | Promise plus the supplied `signal` | signal becomes aborted; Promise settles |
| SSE / `EventSource` | Explicit open/message/error callbacks | `close()` and listener removal |
| `WebSocket` | Explicit open/message/close callbacks | `close()` and listener removal |
| `ReadableStream` reader | One minimal chunk or controlled pending read | `cancel()` and `releaseLock()` when owned |

```tsx
it('aborts and settles the request on unmount', async () => {
  let requestSignal: AbortSignal | undefined;
  let requestPromise: Promise<Response> | undefined;
  const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    requestSignal = init?.signal ?? undefined;
    requestPromise = new Promise<Response>((_resolve, reject) => {
      requestSignal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
    return requestPromise;
  });
  vi.stubGlobal('fetch', fetchMock);

  const { unmount } = render(<RequestPanel />);
  unmount();
  expect(requestSignal?.aborted).toBe(true);
  await expect(requestPromise).rejects.toMatchObject({ name: 'AbortError' });
});
```

Drive transport callbacks explicitly, close every instance, and settle every read/request before the test ends. Do not open real connections, leave a Promise pending after unmount, or replace an abortable Promise API with a plain response.

## Browser Runtime Boundaries

Stub only methods consumed by the source and verify owned teardown:

| Boundary | Controlled surface | Cleanup |
| --- | --- | --- |
| `requestAnimationFrame` | capture callback and return a small numeric id | `cancelAnimationFrame(id)` |
| `ResizeObserver` / `IntersectionObserver` | `observe`, explicit callback delivery | `unobserve` or `disconnect` |
| `URL.createObjectURL` | return `blob:r1` | `URL.revokeObjectURL('blob:r1')` |
| browser global | `vi.stubGlobal()` with the smallest typed shape | `vi.unstubAllGlobals()` |

```ts
const rafCallbacks = new Map<number, FrameRequestCallback>();
class URLStub extends URL {
  static createObjectURL = vi.fn(() => 'blob:r1');
  static revokeObjectURL = vi.fn();
}
vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
  rafCallbacks.set(1, callback);
  return 1;
}));
vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
  rafCallbacks.delete(id);
}));
vi.stubGlobal('URL', URLStub);

const view = render(<Preview file={new File(['x'], 'a.txt')} />);
act(() => {
  rafCallbacks.get(1)?.(0);
});
view.unmount();
expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
expect(URLStub.revokeObjectURL).toHaveBeenCalledWith('blob:r1');
```

Restore spies and globals in `afterEach`; disconnect observer instances and clear captured callbacks. Do not use real animation frames, native layout timing, large files, or no-op cleanup stubs that cannot prove resource ownership.
