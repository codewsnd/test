# Java 21 + Maven + Mockito + JaCoCo

## Contents

- [Coverage Checklist](#coverage-checklist)
- [Target Triage](#target-triage)
- [Test File Placement](#test-file-placement)
- [Minimal Mock Data](#minimal-mock-data)
- [Minimal Patterns](#minimal-patterns)
- [Heuristics](#heuristics)
- [Coverage Run](#coverage-run)

## Coverage Checklist

- Happy path
- Null or blank guard
- Empty collection or empty reactive branch
- Alternate dependency result branch
- Exception translation branch
- Loop or conditional fallback
- Static utility branch
- Controller request or validation branch

## Target Triage

Pick the lightest backend test style that can still cover the lines:

- Service class: direct constructor or `@InjectMocks` plus collaborator mocks
- Controller: direct method call first, standalone `MockMvc` only when binding lines matter
- Reactive class: mocked `Mono` or `Flux` inputs plus direct blocking assertions
- Utility, mapper, or converter: direct pure method invocation

## Test File Placement

- Use mock example roots such as `/mock-workspace/demo-app/`.
- Never place a real user project path in skill examples.

- Target file: `/mock-workspace/demo-app/src/main/java/com/acme/service/UserService.java`
- Test file: `/mock-workspace/demo-app/src/test/java/com/acme/service/UserServiceTest.java`

- Target directory: `/mock-workspace/demo-app/src/main/java/com/acme/service`
- Test directory: `/mock-workspace/demo-app/src/test/java/com/acme/service/`

## Minimal Mock Data

- Use only the fields and stubs read by the branch under test.
- Prefer `new UserEntity(1L, "A")`, `Map.of("id", 1)`, `List.of(item)`, `List.of()`, or `Optional.empty()` over large business fixtures.
- Do not create complete domain graphs, realistic payloads, random data, or shared sample datasets when one primitive, one field, or one item is enough.
- Mock repositories, clients, gateways, static helpers, and filesystem or network boundaries. Do not mock passive DTOs, records, simple entities, maps, optionals, or collections unless the type cannot be instantiated.
- Avoid builder or factory helpers that silently populate unused fields. If a helper exists, pass only the minimum values needed for the tested branch.
- Keep stubbing narrow: stub only methods called by the branch and remove unused stubs before rerunning tests.
- For error cases, use the smallest invalid input and the exact exception needed by the branch.

## Minimal Patterns

### Base Imports

```java
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
```

### Service Test Shape

```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    @Test
    void findName_shouldReturnRepositoryValue() {
        when(userRepository.findNameById(1L)).thenReturn("A");

        assertEquals("A", userService.findName(1L));
        verify(userRepository).findNameById(1L);
    }
}
```

### Exception Branch

```java
@Test
void findName_shouldThrowWhenIdMissing() {
    IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> userService.findName(null)
    );

    assertEquals("id must not be null", exception.getMessage());
}
```

### ArgumentCaptor Branch

```java
ArgumentCaptor<UserEntity> captor = ArgumentCaptor.forClass(UserEntity.class);

verify(userRepository).save(captor.capture());
assertEquals("A", captor.getValue().getName());
```

### Static Utility Mock

```java
try (MockedStatic<UuidUtil> mocked = mockStatic(UuidUtil.class)) {
    mocked.when(UuidUtil::newId).thenReturn("fixed-id");

    assertEquals("fixed-id", userService.createId());
}
```

### Static HTTP Boundary Mock

```java
AtomicReference<Map<String, Object>> capturedBody = new AtomicReference<>();
AtomicReference<Map<String, String>> capturedHeaders = new AtomicReference<>();
AtomicReference<String> capturedUrl = new AtomicReference<>();
HttpResponse<String> response = mock(HttpResponse.class);

try (MockedStatic<HttpUtil> httpUtil = mockStatic(HttpUtil.class)) {
    httpUtil.when(() -> HttpUtil.post(any(), any(), anyString())).thenAnswer(invocation -> {
        capturedBody.set(invocation.getArgument(0));
        capturedHeaders.set(invocation.getArgument(1));
        capturedUrl.set(invocation.getArgument(2));
        return response;
    });

    ResponseEntity<String> result = controller.convert(request);
    assertEquals(200, result.getStatusCode().value());
}
```

Use this pattern when a controller talks to a static HTTP utility instead of an injected client bean. It keeps the test unit-level, captures the outgoing request shape, and avoids starting any real HTTP infrastructure.

### Repository Boundary Mock

```java
when(userRepository.findById(1L)).thenReturn(Optional.of(new UserEntity(1L, "A")));

User result = userService.loadUser(1L);

assertEquals("A", result.getName());
verify(userRepository).findById(1L);
```

Repositories, mappers, `JdbcTemplate`, `DatabaseClient`, and similar persistence boundaries must always be mocked in unit tests. Never let a unit test open a real database connection or execute a real query just to raise coverage.

### Real I/O Tripwire

If a test failure stack trace reaches a real HTTP helper, repository implementation, JDBC driver, ORM session, or network client, treat that as a broken unit test setup. Patch the missing Mockito boundary first, then rerun coverage.

### Controller Direct Call

```java
@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock
    private UserService userService;

    @InjectMocks
    private UserController userController;

    @Test
    void getUser_shouldDelegateToService() {
        when(userService.findName(1L)).thenReturn("A");

        UserResponse response = userController.getUser(1L);

        assertEquals("A", response.name());
    }
}
```

### Standalone MockMvc

```java
mockMvc = MockMvcBuilders.standaloneSetup(userController)
        .setControllerAdvice(new GlobalExceptionHandler())
        .build();
```

Use standalone `MockMvc` only when HTTP binding or exception-handler lines must be covered.

### Reactive Service Branch

```java
when(userGateway.loadUser("A")).thenReturn(Mono.just(new UserDto("A")));
assertEquals("A", userService.loadUser("A").block().name());

when(userGateway.loadUser("A")).thenReturn(Mono.error(new IllegalStateException("boom")));
RuntimeException exception = assertThrows(RuntimeException.class, () -> userService.loadUser("A").block());
assertEquals("boom", exception.getCause().getMessage());
```

### WebFlux FilePart Controller Branch

```java
FilePart filePart = mock(FilePart.class);
HttpHeaders headers = new HttpHeaders();
headers.setContentType(MediaType.TEXT_PLAIN);

when(filePart.filename()).thenReturn("note.txt");
when(filePart.headers()).thenReturn(headers);
when(filePart.content()).thenReturn(Flux.just(new DefaultDataBufferFactory().wrap("hello".getBytes(StandardCharsets.UTF_8))));

ResponseEntity<Map<String, Object>> response = controller.uploadFile(filePart).block();
assertEquals(200, response.getStatusCode().value());
```

Use direct `FilePart` mocks plus real `DataBuffer` instances when you only need controller branch coverage. This is usually faster and smaller than `MockMvc` multipart setup for reactive unit tests.

### CompletableFuture Async Helper Branch

```java
try (MockedStatic<CompletableFuture> futureMock = mockStatic(CompletableFuture.class)) {
    futureMock.when(() -> CompletableFuture.runAsync(any(Runnable.class))).thenAnswer(invocation -> {
        Runnable runnable = invocation.getArgument(0);
        runnable.run();
        return CompletableFuture.completedFuture(null);
    });

    controller.processFileAsync("job-1");
}

Thread.currentThread().interrupt();
controller.processFileAsync("job-1");
assertTrue(Thread.currentThread().isInterrupted());
Thread.interrupted();
```

Prefer synchronous execution of the captured runnable over mocking `Thread.sleep`. If the source catches `InterruptedException`, setting the current thread to interrupted before invocation is often enough to cover the branch without brittle static mocking of `Thread`.

### Reflection Fallback

```java
Method method = Target.class.getDeclaredMethod("normalize", String.class);
method.setAccessible(true);
assertEquals("", method.invoke(target, "   "));
```

Use reflection only when the logic cannot be reached through public methods and refactoring is out of scope.

## Heuristics

- Treat every HTTP client and every database entry point as a mandatory Mockito boundary. If a stack trace reaches `HttpUtil`, `WebClient`, `RestTemplate`, Feign, a repository, `JdbcTemplate`, or `DatabaseClient`, stop and mock that boundary before trusting the test.
- Mock repositories, clients, and gateways before considering framework setup.
- Prefer pure Mockito tests over Spring context startup.
- Prefer direct method calls for controllers unless request-binding lines matter.
- Prefer real tiny DTOs and value objects over mocking data carriers.
- Prefer tiny DTO fixtures with only the fields the target reads.
- Reject oversized mock data: if deleting a fixture field does not change the branch, delete it.
- If the code calls static helpers, mock only the exact static branch you need.
- If the class returns `Mono` or `Flux`, mock the dependency publisher directly and assert with `.block()` or `.collectList().block()`.
- If a branch depends on wrapped exceptions, make the mock throw the exact source exception.
- If no current test exists, check local git history for deleted tests or sibling tests that already solved similar fixtures.
## Coverage Run

- Prefer the repo's existing Maven command first.
- Keep the executed test scope narrow, but keep JaCoCo behavior aligned with the repo default.
- Do not invent a separate coverage tool when JaCoCo is already configured in `pom.xml`.
- All generated or modified tests must compile and pass. If the Maven test command fails or any touched test fails, fix the test and rerun until it passes.
- Target-file line coverage must be at least 90 percent. If it is below 90 percent, inspect exact uncovered lines, add or adjust focused tests, and rerun until target-file line coverage reaches 90 percent or higher.
- Remember that `mvn -Dtest=ClassNameTest test` narrows the executed tests, but JaCoCo may still report coverage against the whole analyzed module or bundle.
- Prefer a command such as:

```bash
mvn -Dtest=UserServiceTest test
```

```bash
mvn -Dtest=UserServiceTest,UserControllerTest test
```

- After the run, inspect:
  - `target/site/jacoco/jacoco.xml`
  - `target/site/jacoco/index.html`

- Use `jacoco.xml` for exact line counts and uncovered lines when terminal output is too coarse.
- Prefer the bundled parser for target-file counts when `jacoco.xml` exists:

```bash
node <skill-dir>/scripts/jacoco_line_report.js target/site/jacoco/jacoco.xml src/main/java/com/acme/service/UserService.java
```

- Final output must print only the final line coverage for each final modified or verified file, one numbered line per file.
- Use this format exactly: `1. Test1.java - Line coverage: 95%`
- Do not include commands, coverage tables, uncovered lines, explanations, or summaries in the final output.
