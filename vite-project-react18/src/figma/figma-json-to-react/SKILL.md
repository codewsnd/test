---
name: figma-json-to-react
description: "Convert a local JSON file produced by the Figma REST API into production-ready React and TypeScript implementations that use Ant Design 5 plus Tailwind and match the source with 1:1 visual fidelity. Use when Codex receives or needs two paths: (1) the absolute location of a Figma REST API JSON file and (2) the absolute file or directory where the React component should be created, and the task is to translate the JSON structure into React code."
---

# Figma Json To React

## Overview

Translate a local Figma REST API JSON file into React and TypeScript code that is ready to drop into the target project.
Treat the JSON as the structural source of truth for layout, text, fills, effects, hierarchy, and embedded assets, then implement the result with `Ant Design 5` and `Tailwind` while preserving 1:1 visual fidelity.

## Required Inputs

- Require an absolute path to the input JSON file.
- Require an absolute path to the output React target.
- Reject relative paths and ask for absolute paths instead.
- Interpret the output path like this:
  - If it is a directory, create the component tree inside that directory.
  - If it is a file path, write the primary component to that exact file path and place helper files next to it.

## Output Target

- If the output path is a directory, place the generated component tree inside that directory.
- If the output path is a file, place the primary `.tsx` component at that exact file path and keep helper files next to it.
- Keep all generated files inside the user-provided output path unless the user explicitly asks for a wider refactor.

## Hard Constraints

- Implement the result with `React`, `TypeScript`, `Ant Design 5`, and `Tailwind`.
- Write component files as `.tsx`, not `.jsx` or plain `.js`.
- Use `Ant Design 5` components for controls and structural primitives whenever they can preserve the Figma behavior without reducing fidelity.
- Use `Tailwind` for spacing, layout, sizing, positioning, borders, shadows, and visual tuning needed to reach the Figma result exactly.
- Extract every image and every SVG from the JSON into separate asset files next to the generated component unless the user asks for a different asset location.
- Split every SVG into its own standalone `.svg` file. Do not merge multiple vectors into one sprite or icon font.
- Import extracted assets in the component and render them with `<img src={...} />`. Do not inline SVG markup into JSX unless the user explicitly asks for inline SVG.
- Treat pixel-level parity as mandatory. Do not intentionally simplify layout, typography, spacing, decoration, or interaction states.
- Do not silently fall back to raw HTML-only output, CSS modules, or another component library when the user asked for this skill.

## Required Workflow

Follow these steps in order. Do not start coding before Step 3.

### 1. Secure the two paths

- Confirm that the JSON path exists and is a file.
- Confirm that the output path is absolute.
- Create the output directory when it does not exist yet.
- Ask only for the missing absolute path when one of the two required paths is missing.

### 2. Inspect the JSON before implementation

- Run `scripts/inspect_figma_rest_json.py` before generating React code.
- Use the script like this:

```bash
python scripts/inspect_figma_rest_json.py "C:\absolute\path\figma.json" --output "C:\absolute\path\figma-summary.json"
```

- Read `references/figma-rest-json.md` when the incoming JSON shape is unclear.
- Treat the raw JSON plus the generated summary as the structural source of truth.
- If the JSON contains multiple node documents, require `--node-id` or ask the user which node to convert.
- If screenshots or extracted assets are missing from the JSON, continue with structure-first implementation and call out every visual unknown in the handoff.

### 3. Plan the React breakdown

- Read `references/page-breakdown.md` before implementing a full page, dashboard, landing screen, or any multi-section frame.
- Identify the page shell, repeated regions, leaf controls, and assets before writing JSX.
- Identify every raster asset and every SVG asset before writing JSX so extraction happens before implementation.
- Keep component names close to the Figma hierarchy to reduce ambiguity during iteration.
- Split the output into reusable components only when the Figma structure or repetition clearly justifies it.

### 4. Translate into Ant Design 5 plus Tailwind

- Inspect the nearest `package.json`, `tailwind.config.*`, `postcss.config.*`, theme files, and nearby components around the output path.
- Reuse existing `Ant Design 5` theme tokens, project aliases, and local primitives when they help fidelity without changing the required stack.
- Translate Figma auto layout and constraints into matching React layout behavior with flex, grid, and sizing rules.
- Prefer `Ant Design 5` controls for form fields, buttons, navigation affordances, tables, tabs, cards, and feedback UI when they can be tuned to match the design.
- Use `Tailwind` utility classes to close the gap between Ant Design defaults and the exact Figma spacing, dimensions, colors, radii, shadows, and alignment.
- If the target repo is missing `Ant Design 5` or `Tailwind`, still generate code in that stack and clearly call out the dependency gap in the final handoff instead of downgrading the implementation.

### 5. Implement for 1:1 fidelity

- Preserve hierarchy, layout mode, spacing, sizing, typography, fills, strokes, shadows, radii, clipping, and visible layer order.
- Preserve exact typography, line breaks, icon placement, image cropping, and SVG positioning from the JSON and extracted assets.
- Reproduce all visible states shown or implied by Figma, including hover, active, selected, disabled, empty, and focused states when relevant.
- Extract standalone assets when the JSON includes image references, `imageUrl`, vector data, or embedded `svgContent`.
- Keep all generated files inside the user-provided output path unless the user explicitly asks for a broader refactor.
- Prefer semantic HTML and accessible interactions.
- Keep props minimal. Do not invent generic abstractions that weaken fidelity.
- Render extracted images and extracted SVG files through imported asset paths and `<img src={...}>`.
- Do not invent data fetching, state management, or abstractions that are not present in the design request.

### 6. Validate before handoff

- Read `references/react-output-rules.md` before implementation and final review.
- Read `references/fidelity-checklist.md` when performing final review.
- Compare the result against the JSON hierarchy, bounds, styles, and any available screenshots or extracted assets.
- When screenshots are unavailable, validate against the JSON hierarchy, bounds, layout settings, text content, fills, strokes, and effects.
- Confirm that every SVG in the source is written as its own `.svg` file and that every extracted asset is referenced through `<img src={...}>`.
- Confirm that the output path was respected exactly.
- Reject approximate similarity as complete. Keep iterating until the result is visually aligned with the source.
- Call out every missing asset, ambiguous visual detail, or intentional deviation in the final handoff.

## Delivery Rules

- Prefer page-level composition plus reusable leaf components over one giant JSX file.
- Prefer project-native `Ant Design 5` usage plus `Tailwind` tuning over raw HTML controls when behavior must match the design.
- Keep the generated components integration-ready instead of returning pseudo-code.
- Use minimal props and abstractions; prefer literal layout when the design is static.
- Keep implementation accessible: preserve semantic structure, keyboard behavior, labels, and contrast.
- Do not ask for live Figma access, tokens, or MCP tools when the local JSON file already exists.
- Do not deliver partial fidelity as finished. Keep iterating until layout and styling are visually aligned with the source.

## Example Triggers

- "Use this Figma REST API JSON file to generate a React component."
- "Input JSON: `C:\exports\figma-node.json`, output: `D:\repo\src\components\HeroCard.tsx`."
- "Convert this saved Figma API response into React files under `D:\repo\src\generated\profile-page` with Ant Design 5 and Tailwind."
- "Turn this local Figma REST JSON into a 1:1 React page using Ant Design 5."
- "Read my local Figma JSON and create the component in the path I give you."

## References

- `references/figma-rest-json.md`: Read when the JSON shape, node selection, or asset hints are unclear.
- `references/page-breakdown.md`: Read when the target is a page or a large multi-section frame.
- `references/react-output-rules.md`: Read before implementation and final validation to keep the React output aligned with Ant Design 5 and Tailwind.
- `references/fidelity-checklist.md`: Read before final validation or when parity issues keep appearing.
