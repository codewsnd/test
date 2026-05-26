# React TypeScript + Java Sonar Fixes

## Contents

- [Triage Order](#triage-order)
- [Target Triage](#target-triage)
- [Brace Normalization](#brace-normalization)
- [Complexity Reduction Heuristics](#complexity-reduction-heuristics)
- [Keep Behavior Stable](#keep-behavior-stable)
- [Repeated String Constants](#repeated-string-constants)
- [Java Logging Cleanup](#java-logging-cleanup)
- [Unused Declarations](#unused-declarations)
- [Validation](#validation)
- [Directory Mode](#directory-mode)

## Triage Order

Process Sonar-style cleanup in this order:

1. Missing braces on `if`, `else if`, `else`
2. Complexity 15 or higher
3. Repeated strings used more than 3 times
4. Java `System.out.println` replacement
5. Unused imports, constants, and variables

This order avoids deleting declarations too early and makes refactors easier to review.

## Target Triage

Pick the lightest path that can finish the cleanup safely:

- Java source file: Sonar cleanup only
- React frontend file: Sonar cleanup only
- Directory target: recurse through supported source files only, skip test folders and generated outputs
- Skip dependency and build folders such as `node_modules`, `dist`, `build`, `coverage`, `target`, and `out`

## Brace Normalization

Always convert implicit branches into explicit blocks.

### TypeScript

```ts
if (ready) run();
else fallback();
```

```ts
if (ready) {
  run();
} else {
  fallback();
}
```

### Java

```java
if (ready) run();
else fallback();
```

```java
if (ready) {
    run();
} else {
    fallback();
}
```

## Complexity Reduction Heuristics

Use the smallest refactor that lowers complexity without changing behavior.

### React TypeScript

- Extract pure decision helpers from large components
- Convert repeated label-selection logic into small functions
- Break long event handlers into validation, transformation, and side-effect helpers
- Prefer early returns over nested JSX conditionals when it reduces branching
- Extract render helpers only when they reduce real branching noise

### Java

- Split validation, mapping, and side-effect steps into private helpers
- Replace repeated nested branches with named helper methods
- Flatten nested control flow with guard clauses
- Extract conversion or builder logic from large service methods
- Prefer composition through private helpers over creating new class hierarchies

Refactor any function or method whose complexity is 15 or higher. Stop as soon as it drops below 15. Do not keep refactoring after the rule is satisfied unless the user asked for a broader cleanup.

## Keep Behavior Stable

- Apply the minimum-change principle: touch only the code required to fix the Sonar-style issue in scope
- Do not change business logic, branch conditions, side-effect order, or data transformations when lowering complexity
- Preserve public method signatures unless the user requested API changes
- Preserve exception types and key messages when refactoring Java methods
- Preserve callback order and side-effect order when refactoring React handlers
- Prefer tiny pure helpers over broad rewrites
- Do not create or update test files in this skill

## Repeated String Constants

If the same string literal appears more than 3 times, extract it into a constant.

### TypeScript

```ts
const STATUS_DONE = 'done';
```

Prefer file-local `const` values unless the repetition is clearly local to one helper, in which case a narrower local constant is fine.

### Java

```java
private static final String STATUS_DONE = "done";
```

Prefer class-level constants for reuse across methods. Use a local `final String` only when the repeated literal is clearly scoped to one method.

## Java Logging Cleanup

For Java source files, replace `System.out.println` with logger output.

- Add `@Slf4j` and `import lombok.extern.slf4j.Slf4j;` when the class needs a logger and does not already have one
- Reuse an existing logger when the class already has one
- Use `log.info(...)` for normal operational messages
- Use `log.warn(...)` for suspicious but recoverable conditions, fallbacks, or skipped branches
- Use `log.error(...)` for failures, caught exceptions, or unexpected states

Prefer the narrowest safe logging change. Do not rewrite control flow only to change the log level.

## Unused Declarations

- Delete unused imports, constants, and variables only after structural refactors are finished.
- Remove declarations made obsolete by helper extraction, constant extraction, logging cleanup, or complexity reduction.
- For TypeScript, remove unused local variables, file-local constants, function parameters when the signature is private, and unused imports.
- For Java, remove unused local variables, private constants, private fields, private helper methods, and imports when they are not part of a required public API or framework contract.
- Do not replace unused declarations with suppression comments unless the user explicitly asks.

## Validation

- Prefer narrow validation for the touched source file.
- Avoid whole-repo validation when a single-module compile or lint command is enough.
- For Java, prefer narrow Maven compile commands.
- For React frontend code, prefer local lint or type-check commands scoped to the touched source file when available.

## Directory Mode

For a directory target:

- Recurse through supported files
- Skip generated or dependency output folders
- Skip test folders and generated declarations such as `src/test`, `__tests__`, and `.d.ts`
- Apply the same cleanup rules consistently across the whole scope
- Keep changes focused on Sonar-style cleanup, not unrelated formatting churn
