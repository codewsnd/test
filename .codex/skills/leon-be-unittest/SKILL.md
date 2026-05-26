---
name: leon-be-unittest
description: Use when writing or updating Java unit tests for Spring Boot 3 Maven projects with JUnit 5, Mockito, and JaCoCo, especially when target-file line coverage, isolated collaborators, or exact uncovered JaCoCo lines matter.
---

# Leon BE UnitTest

## Goal

Create or update the smallest stable Java unit tests that drive the requested source file or directory to 100 percent target-file line coverage while staying isolated from real Spring context startup, databases, HTTP, S3, filesystem, schedulers, and network I/O.

Prefer extending an existing test. Otherwise mirror the `src/main/java` package path under `src/test/java`.

## When To Use

- Spring Boot 3 Maven projects using Java 21, JUnit 5, Mockito, and JaCoCo.
- Service, controller, mapper, utility, WebFlux, MVC, JPA, MyBatis, R2DBC, S3, HTTP, or static-helper code that needs isolated unit coverage.
- Tasks that ask for exact uncovered line numbers or target-file coverage repair.

## Defaults

- Assume Java 21, Spring Boot 3.4 or 3.5, Maven, `spring-boot-starter-test`, Mockito, and `target/site/jacoco/` unless the repo proves otherwise.
- Optimize the requested target file to 100 percent line coverage even when the project-wide JaCoCo threshold is lower.
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
5. Keep fixtures tiny and deterministic. Prefer real DTOs and value objects over mocking data carriers.
6. Cover private logic through public methods first. Use reflection only when the code is unreachable and refactoring is out of scope.
7. Run the narrowest Maven command available for the touched test class, then inspect JaCoCo XML or HTML for exact missing lines.
8. Patch uncovered lines by branch family instead of adding broad speculative tests.

## Isolation Rules

- Do not use `@SpringBootTest`, `@WebMvcTest`, `@DataJpaTest`, real database connections, real HTTP calls, local servers, real S3, or real filesystem I/O for ordinary unit-test tasks.
- If a failure shows real HTTP, repository, JDBC, ORM, R2DBC, socket, or filesystem access, restore isolation before continuing coverage work.
- Use `MockedStatic` only for static-heavy legacy code that cannot be reached cleanly another way.
- Avoid sleeps, polling, background-thread timing, retry timing, and scheduler waits.

## Coverage Output

- Report actual tool output, not estimates.
- Put the command-level row first when available and label it as `Whole run / module` or `Whole run / JaCoCo bundle`.
- Add `Target file only` rows only when they come from real JaCoCo data.
- Use executable line counts from JaCoCo, not physical source line counts.
- Include exact uncovered line numbers for any touched target row below 100 percent.
- If coverage cannot run, say so and mark the result failed rather than inventing numbers.
- Finish after the compact coverage table unless the user asks for additional analysis.

## Reference

Read [references/java21-maven-mockito-jacoco.md](references/java21-maven-mockito-jacoco.md) when you need Mockito skeletons, controller patterns, reactive examples, JaCoCo parsing guidance, or the final table template.
