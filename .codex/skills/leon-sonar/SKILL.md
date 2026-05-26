---
name: leon-sonar
description: Use when fixing SonarQube-style issues in React TypeScript or Java files and directories, including missing braces, unused imports, repeated string literals, Java System.out.println calls, or functions and methods over complexity 15.
---

# Leon Sonar

## Goal

Fix SonarQube-oriented issues in React TypeScript and Java code with the smallest behavior-preserving edit.

Use this for single files or directories containing `.ts`, `.tsx`, or `.java` source. Skip generated output, dependency folders, `src/test`, and `__tests__`.

## Rules

- Preserve runtime behavior, public APIs, exception behavior, callback order, and side-effect order unless the user asks for a broader refactor.
- Add braces to every `if`, `else if`, and `else` branch in the target scope.
- Keep each React TypeScript function, function component, hook-heavy helper, Java method, and Java constructor at complexity 15 or below.
- Extract string literals into constants only when the same literal is used more than 3 times in the target scope.
- Replace Java `System.out.println` with an existing logger or Lombok `@Slf4j`; choose `info`, `warn`, or `error` by message intent.
- Remove unused imports after structural edits are complete.
- Update or create unit tests only for source files changed in this run.

## Workflow

1. Inventory the target before editing. For directories, enumerate supported source files recursively.
2. Map brace issues, repeated strings, unused imports, `System.out.println`, complexity over 15, and matching unit-test files.
3. Fix braces first without changing branch order.
4. Reduce complexity with the smallest safe extraction, guard clause, or pure helper. Stop once the function or method is at or below 15.
5. Lift repeated strings to the narrowest sensible constant.
6. Normalize Java logging.
7. Remove unused imports last.
8. Update tests for changed source files: use `$leon-be-unittest` for Java and `$leon-fe-unittest` for React TypeScript.
9. Run the narrowest local compile, lint, or test command that verifies the touched code.

## Refactoring Defaults

For React TypeScript, prefer pure branching helpers, early returns, display-label helpers, focused event-handler helpers, and tiny render helpers when JSX branches dominate.

For Java, prefer private helper methods, guard clauses, separated validation or transformation steps, and repeated-branch helpers. Do not introduce inheritance or design-pattern churn just to satisfy complexity.

## Output Rules

- Do not print coverage tables.
- Return a concise result with changed source files and any created or updated unit tests.
- Mention validation commands that were run, or state why validation could not run.
- State any remaining manual follow-up plainly.

## Reference

Read [references/react-ts-java-sonar.md](references/react-ts-java-sonar.md) when you need compact refactor patterns for braces, complexity reduction, repeated-string extraction, logging cleanup, unused imports, or test handoff rules.
