# React TypeScript + Java Sonar Fixes

## Triage Order

Process Sonar-style cleanup in this order:

1. Missing braces on `if`, `else if`, `else`
2. Complexity over 15
3. Repeated strings used more than 3 times
4. Java `System.out.println` replacement
5. Unused imports
6. Update or create the matching unit test

This order avoids deleting imports too early and makes refactors easier to review.

## Target Triage

Pick the lightest path that can finish the cleanup safely:

- Java source file: Sonar cleanup plus mirrored `src/test/java` handoff
- React frontend file: Sonar cleanup plus matching `__tests__` handoff
- Directory target: recurse through supported source files only, skip test folders and generated outputs

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

Stop as soon as the function or method drops to 15 or below. Do not keep refactoring after the rule is satisfied unless the user asked for a broader cleanup.

## Keep Behavior Stable

- Apply the minimum-change principle: touch only the code required to fix the Sonar-style issue in scope
- Preserve public method signatures unless the user requested API changes
- Preserve exception types and key messages when refactoring Java methods
- Preserve callback order and side-effect order when refactoring React handlers
- Prefer tiny pure helpers over broad rewrites
- Update tests only for source files that actually changed during the run

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

## Unused Imports

- Delete imports only after structural refactors are finished
- Remove both direct unused imports and imports made obsolete by helper extraction
- Do not replace unused imports with suppression comments unless the user explicitly asks

## Test Handoff

After the Sonar-style code fix, update or create the matching unit test.

- Java source file: use `$leon-be-unittest`
- React frontend source file: use `$leon-fe-unittest`

Prefer updating an existing test file when one already exists.
Create a new test file only when there is no suitable existing unit test.
For directory targets, apply the same rule per touched source file.
Keep the final `leon-sonar` response concise even if the child unit-test workflow internally runs coverage.

## Validation

- Prefer narrow validation for the touched file or test file
- Avoid whole-repo validation when a single-module or single-test command is enough
- For Java, prefer narrow Maven compile or targeted test commands
- For React frontend code, prefer local lint or test commands scoped to the touched file or its test

## Directory Mode

For a directory target:

- Recurse through supported files
- Skip generated or dependency output folders
- Apply the same cleanup and test-update rules consistently across the whole scope
- Keep changes focused on Sonar-style cleanup, not unrelated formatting churn
