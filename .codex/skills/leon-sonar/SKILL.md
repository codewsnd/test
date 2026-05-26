---
name: leon-sonar
description: Use when fixing SonarQube-style issues in React TypeScript or Java source, especially missing braces, unused imports, unused constants or variables, repeated string literals, Java System.out.println calls, or functions and methods with complexity 15 or higher.
---

# Leon Sonar

## Goal

Fix SonarQube-oriented issues in React TypeScript and Java code with the smallest behavior-preserving edit.

Use this for single files or directories containing `.ts`, `.tsx`, or `.java` source. Skip generated output, dependency folders, build artifacts, test folders, and generated declarations.

## Rules

- Preserve runtime behavior, code logic, public APIs, exception behavior, callback order, and side-effect order unless the user asks for a broader refactor.
- Add braces to every `if`, `else if`, and `else` branch in the target scope.
- Refactor each React TypeScript function, function component, hook-heavy helper, Java method, and Java constructor when complexity is 15 or higher; use the smallest behavior-preserving edit needed to bring it below 15.
- Extract string literals into constants only when the same literal is used more than 3 times in the target scope.
- Replace Java `System.out.println` with an existing logger or Lombok `@Slf4j`; choose `info`, `warn`, or `error` by message intent.
- Remove unused imports, constants, and variables after structural edits are complete.
- Do not create or update test files as part of this skill.

## Workflow

1. Inventory the target before editing. For directories, enumerate supported source files recursively while skipping `node_modules`, `dist`, `build`, `coverage`, `target`, `out`, `src/test`, `__tests__`, generated folders, and `.d.ts` files.
2. Map brace issues, repeated strings, unused imports, unused constants, unused variables, `System.out.println`, and complexity 15 or higher.
3. Fix braces first without changing branch order.
4. Reduce complexity with the smallest safe extraction, guard clause, or pure helper. Stop once the function or method is below 15.
5. Lift repeated strings to the narrowest sensible constant.
6. Normalize Java logging.
7. Remove unused imports, constants, and variables last.
8. Run the narrowest local compile or lint command that verifies the touched code.

## Refactoring Defaults

For React TypeScript, prefer pure branching helpers, early returns, display-label helpers, focused event-handler helpers, and tiny render helpers when JSX branches dominate.

For Java, prefer private helper methods, guard clauses, separated validation or transformation steps, and repeated-branch helpers. Do not introduce inheritance or design-pattern churn just to satisfy complexity.

## Output Rules

- Return a concise result with changed source files and Sonar-style fixes applied.
- Mention validation commands that were run, or state why validation could not run.
- State any remaining manual follow-up plainly.

## Reference

Read [references/react-ts-java-sonar.md](references/react-ts-java-sonar.md) when you need compact refactor patterns for braces, complexity reduction, repeated-string extraction, logging cleanup, unused import/constant/variable cleanup, or directory-mode cleanup rules.
