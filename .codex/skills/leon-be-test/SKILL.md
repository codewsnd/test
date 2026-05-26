---
name: leon-be-test
description: Use when writing or updating Java unit tests for Spring Boot 3 Maven projects with JUnit 5, Mockito, and JaCoCo, especially when target-file line coverage must reach 90 percent or higher with correct passing tests and minimal mock data.
---

# Leon BE Test

## Goal

Create or update the smallest stable Java unit tests with minimal mock data that keep all generated or modified tests correct and passing while driving the requested source file or directory to at least 90 percent target-file line coverage.

Prefer extending an existing test. Otherwise mirror the `src/main/java` package path under `src/test/java`.

## When To Use

- Spring Boot 3 Maven projects using Java 21, JUnit 5, Mockito, and JaCoCo.
- Service, controller, mapper, utility, WebFlux, MVC, JPA, MyBatis, R2DBC, S3, HTTP, or static-helper code that needs isolated unit coverage.
- Tasks that ask for exact uncovered line numbers or target-file coverage repair.

## Defaults

- Assume Java 21, Spring Boot 3.4 or 3.5, Maven, `spring-boot-starter-test`, Mockito, and `target/site/jacoco/` unless the repo proves otherwise.
- Optimize the requested target file to at least 90 percent line coverage even when the project-wide JaCoCo threshold is lower.
- Prefer direct constructor invocation or `@ExtendWith(MockitoExtension.class)` with `@Mock` and `@InjectMocks`.
- Use simple blocking assertions for reactive return types unless the repo already prefers `reactor-test`.

## Test Placement

Mirror package paths exactly:

- Source: `/mock-workspace/demo-app/src/main/java/com/acme/service/UserService.java`
- Test: `/mock-workspace/demo-app/src/test/java/com/acme/service/UserServiceTest.java`

For directory targets, default to files directly inside the requested directory unless the user asks for recursion. Skip existing `src/test/java`, configuration, bootstrap, generated code, and DTO-only classes unless requested.

## Workflow

1. Read the target source, existing tests, and nearby test style before writing tests.
2. Map executable branch families: guards, validation, dependency delegation, exception translation, mapper branches, loops, fallback returns, static helper calls, and reactive success, empty, and error paths.
3. Choose the lightest test shape: direct service or utility invocation first; direct controller methods before standalone `MockMvc`; mocked `Mono` and `Flux` inputs for reactive code.
4. Mock every external boundary before invoking the class under test: repositories, mappers, templates, database clients, HTTP clients, S3 clients, AI clients, clocks, UUIDs, static helpers, and filesystem utilities.
5. Keep fixtures and mock data tiny and deterministic. Prefer real DTOs and value objects over mocking data carriers, and set only the fields the target branch reads.
6. Cover private logic through public methods first. Use reflection only when the code is unreachable and refactoring is out of scope.
7. Run the narrowest Maven command available for the touched test class, then inspect JaCoCo XML or HTML for exact missing lines.
8. If compilation fails, any generated or modified test fails, or the test command exits non-zero, fix the test and rerun until the touched tests pass.
9. If target-file line coverage is below 90 percent, inspect exact missing lines and keep adding or adjusting focused tests until target-file line coverage is 90 percent or higher.
10. Patch uncovered lines by branch family instead of adding broad speculative tests.

## Isolation Rules

- Do not use `@SpringBootTest`, `@WebMvcTest`, `@DataJpaTest`, real database connections, real HTTP calls, local servers, real S3, or real filesystem I/O for ordinary unit-test tasks.
- If a failure shows real HTTP, repository, JDBC, ORM, R2DBC, socket, or filesystem access, restore isolation before continuing coverage work.
- Use `MockedStatic` only for static-heavy legacy code that cannot be reached cleanly another way.
- Avoid sleeps, polling, background-thread timing, retry timing, and scheduler waits.

## Minimal Mock Data Rules

- Use the shortest DTO, entity, collection, request, response, and exception fixture that executes the target branch.
- Do not build complete business objects, deep object graphs, or realistic payloads when a smaller object is enough.
- Do not use fixture builders, factories, random data, or shared sample datasets unless the repo already requires them and the branch cannot run without them.
- Mock collaborators, not passive data carriers. Use real tiny DTOs, records, entities, maps, or value objects with only required fields.
- For collections, prefer one-item or empty collections unless the branch depends on count, ordering, grouping, or loop variation.
- For negative paths, pass the smallest invalid value such as `null`, `""`, an empty list, or a single malformed field.
- Remove unused fixture fields and unnecessary stubbing before reporting completion.

## Coverage Output

- Report actual tool output, not estimates.
- Do not output reusable coverage templates.
- Report the Maven command, test pass/fail state, target source file, test file, target-file line coverage percentage, and any remaining uncovered lines.
- Treat the result as incomplete until all generated or modified tests pass and target-file line coverage is 90 percent or higher.
- Use executable line counts from JaCoCo, not physical source line counts.
- Include exact uncovered line numbers for any touched target file below 90 percent.
- If coverage cannot run, say so and mark the result failed rather than inventing numbers.
- Finish after the actual verification result unless the user asks for additional analysis.

## Reference

Read [references/java21-maven-mockito-jacoco.md](references/java21-maven-mockito-jacoco.md) when you need Mockito skeletons, minimal mock data patterns, controller patterns, reactive examples, JaCoCo parsing guidance, or coverage repair guidance.
