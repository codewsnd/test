# Copy Test AntD Table Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CopyTest iframe preview with an Ant Design Table view while preserving Confluence storage write-back safety.

**Architecture:** Move the Confluence storage table implementation under `copyTest/table`. Keep storage parsing and write-back as DOM-backed pure functions, add a view-model layer that maps parsed `rowspan` and `colspan` data into AntD Table rows and columns, and render only text except for generated `Test Result` and `Test Evidence -` cells. Never write AntD view state back directly; write only managed generated content into original/generated storage cells.

**Tech Stack:** React 18, TypeScript, Ant Design 5 Table/Image/Button/Checkbox, Vitest, happy-dom, React Testing Library.

---

### File Structure

- Move existing storage table internals from `vite-project-react18/src/pages/home/components/confluenceStorageTable` to `vite-project-react18/src/pages/home/components/copyTest/table`.
- Create `vite-project-react18/src/pages/home/components/copyTest/table/viewModel/antdTableViewModel.ts` for AntD columns/dataSource mapping.
- Create `vite-project-react18/src/pages/home/components/copyTest/table/components/CopyTestStorageTable.tsx` for the AntD preview component.
- Create `vite-project-react18/src/pages/home/components/copyTest/table/components/CopyTestResultCell.tsx` and `CopyTestEvidenceCell.tsx` for generated cell rendering.
- Update `vite-project-react18/src/pages/home/components/copyTest/CopyTest.tsx`, hooks, and types to import from `./table`.
- Keep legacy compatibility export at `vite-project-react18/src/pages/home/components/confluenceStorageTable/index.ts` during the migration if other modules still import it.

### Task 1: AntD View Model

**Files:**
- Create: `vite-project-react18/src/pages/home/components/copyTest/table/viewModel/antdTableViewModel.ts`
- Test: `vite-project-react18/src/pages/home/components/copyTest/table/viewModel/__tests__/antdTableViewModel.test.ts`

- [ ] **Step 1: Write failing tests**

Tests must cover:
- normal source cells expose text only;
- `rowspan` and `colspan` are mapped to AntD `onCell`;
- only `Test Evidence -` generated cells can produce vertical row spans;
- hidden span cells return `{ rowSpan: 0 }` or `{ colSpan: 0 }`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd vite-project-react18 && npm test -- src/pages/home/components/copyTest/table/viewModel/__tests__/antdTableViewModel.test.ts`

Expected: fail because `antdTableViewModel.ts` does not exist yet.

- [ ] **Step 3: Implement the minimal view model**

Implement:
- `buildCopyTestAntdTableViewModel(tableHtml, options)`;
- `CopyTestAntdRow`, `CopyTestAntdCell`, `CopyTestAntdColumn` types;
- source cells render `text`;
- generated result/evidence cells carry structured metadata but no storage mutation.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `cd vite-project-react18 && npm test -- src/pages/home/components/copyTest/table/viewModel/__tests__/antdTableViewModel.test.ts`

Expected: PASS.

### Task 2: Generated Content Write Safety

**Files:**
- Modify: `vite-project-react18/src/pages/home/components/copyTest/table/core/generatedContent/writer.ts`
- Test: `vite-project-react18/src/pages/home/components/copyTest/table/__tests__/generatedWriteSafety.test.ts`

- [ ] **Step 1: Write failing tests**

Tests must prove:
- writing validation results changes only `Test Result` and `Test Evidence -` cells;
- user-authored content inside generated cells remains;
- source/original cells remain byte-equivalent at text and HTML level;
- only evidence cells receive rowSpan from validation output.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd vite-project-react18 && npm test -- src/pages/home/components/copyTest/table/__tests__/generatedWriteSafety.test.ts`

Expected: fail until moved imports and stricter writer behavior are in place.

- [ ] **Step 3: Implement write-safety changes**

Reuse existing DOM-backed writer logic. Keep managed containers for result/evidence content. Do not write preview-only attributes into export HTML. Ensure `Test Result` never receives vertical rowSpan.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `cd vite-project-react18 && npm test -- src/pages/home/components/copyTest/table/__tests__/generatedWriteSafety.test.ts`

Expected: PASS.

### Task 3: AntD Preview Component

**Files:**
- Create: `vite-project-react18/src/pages/home/components/copyTest/table/components/CopyTestStorageTable.tsx`
- Create: `vite-project-react18/src/pages/home/components/copyTest/table/components/CopyTestResultCell.tsx`
- Create: `vite-project-react18/src/pages/home/components/copyTest/table/components/CopyTestEvidenceCell.tsx`
- Test: `vite-project-react18/src/pages/home/components/copyTest/table/components/__tests__/CopyTestStorageTable.test.tsx`

- [ ] **Step 1: Write failing component tests**

Tests must cover:
- source cells show text;
- selected rows are controlled by checkboxes;
- evidence image preview and delete callbacks fire;
- result and evidence renderers are used for generated cells.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd vite-project-react18 && npm test -- src/pages/home/components/copyTest/table/components/__tests__/CopyTestStorageTable.test.tsx`

Expected: fail because the new component does not exist.

- [ ] **Step 3: Implement AntD component**

Render `Table` with `pagination={false}`, controlled row selection, horizontal/vertical scroll, and custom cell renderers. Remove iframe, overlay measurement, and custom scrollbar responsibilities from the new implementation.

- [ ] **Step 4: Run focused test and verify GREEN**

Run: `cd vite-project-react18 && npm test -- src/pages/home/components/copyTest/table/components/__tests__/CopyTestStorageTable.test.tsx`

Expected: PASS.

### Task 4: CopyTest Integration

**Files:**
- Modify: `vite-project-react18/src/pages/home/components/copyTest/CopyTest.tsx`
- Modify: `vite-project-react18/src/pages/home/components/copyTest/hooks/useCopyTestTables.ts`
- Modify: `vite-project-react18/src/pages/home/components/copyTest/hooks/useCopyTestEvidenceState.ts`
- Modify: `vite-project-react18/src/pages/home/components/copyTest/types.ts`
- Modify: `vite-project-react18/src/pages/home/components/copyTest/table/index.ts`
- Modify or delete old compatibility files under `vite-project-react18/src/pages/home/components/confluenceStorageTable`

- [ ] **Step 1: Update imports and compatibility exports**

Point CopyTest internals to `./table`. Keep external imports passing where still needed.

- [ ] **Step 2: Replace component usage**

Replace `ConfluenceStorageTable` usage with `CopyTestStorageTable` while preserving props for disabled state, selected rows, visible columns, evidence preview, and evidence deletion.

- [ ] **Step 3: Run existing CopyTest/table tests**

Run: `cd vite-project-react18 && npm test -- src/pages/home/components/copyTest src/pages/home/components/confluenceStorageTable`

Expected: PASS or targeted failures that are repaired in this task.

### Task 5: Full Verification

**Files:**
- All files touched above.

- [ ] **Step 1: Run frontend test suite for affected area**

Run: `cd vite-project-react18 && npm test -- src/pages/home/components/copyTest src/pages/home/components/confluenceStorageTable`

Expected: PASS.

- [ ] **Step 2: Run build or typecheck**

Run: `cd vite-project-react18 && npm run build`

Expected: PASS.

- [ ] **Step 3: Inspect git diff**

Run: `git diff --stat && git diff -- vite-project-react18/src/pages/home/components/copyTest vite-project-react18/src/pages/home/components/confluenceStorageTable`

Expected: only frontend CopyTest/table refactor changes plus this plan.

