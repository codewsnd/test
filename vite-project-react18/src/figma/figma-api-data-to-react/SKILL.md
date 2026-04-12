---
name: figma-api-data-to-react
description: "Fetch design data directly from the Figma REST API, persist it under a figma-data folder next to the target output, and turn that persisted JSON into production-ready React and TypeScript implementations that use Ant Design 5 plus Tailwind. Use when Codex receives or needs (1) a Figma access token, (2) a Figma design/file URL, (3) an absolute React output path, and (4) a Figma proxy value for Figma REST calls, and the task is to convert the referenced Figma node into a 1:1 React page or component."
---

# Figma Api Data To React

## Overview

Translate a live Figma node into React and TypeScript without requiring the user to export JSON manually.
Persist the fetched REST API data under `<output>/figma-data`, reuse that JSON on later runs instead of calling the API again, then treat the persisted JSON as the structural source of truth for a 1:1 React implementation.
The Figma REST API step must gather all implementation-critical data up front so missing assets or incomplete layout information do not silently leak into page development.

## Required Inputs

- Require a Figma access token from the user.
- Require a Figma URL that points to a specific file or node.
- Require an absolute path to the React output target.
- Require the user to provide the Figma proxy value for Figma REST API calls.
- Accept an empty Figma proxy string when the user wants direct access with no proxy.
- Accept user input in this shape when the values are supplied directly in chat:
  - `figma token: ...`
  - `figma url: ...`
  - `figma proxy: ...` or `figma proxy:`
  - `absolute path: ...`
- Reject relative paths and ask for an absolute path instead.
- Prefer a URL that already contains `node-id`.
- Ask for the missing node id when the URL does not include one and the user does not provide an override.
- Interpret the output path like this:
  - If it is a directory, create the component tree inside that directory.
  - If it is a file path, write the primary component to that exact file path and place helper files next to it.

## Output Target

- If the output path is a directory, place the generated component tree inside that directory.
- If the output path is a file, place the primary `.tsx` component at that exact file path and keep helper files next to it.
- Create a sibling or child folder named `figma-data` from the output target and keep the fetched REST artifacts there.
- Reuse `<output-root>/figma-data/figma-api-export.json` on later runs instead of calling the Figma API again.
- Keep all generated React files inside the user-provided output path unless the user explicitly asks for a wider refactor.

## Hard Constraints

- Implement the result with `React`, `TypeScript`, `Ant Design 5`, and `Tailwind`.
- Write component files as `.tsx`, not `.jsx` or plain `.js`.
- Use `Ant Design 5` components as the default visible building blocks. Prefer `Typography`, `Flex`, `Card`, `Image`, `Button`, `Input`, `Tabs`, `Tag`, `Badge`, `Avatar`, `Space`, `Layout`, and related Ant Design 5 primitives whenever they can preserve the Figma result.
- Use `Tailwind` for spacing, layout, sizing, positioning, borders, shadows, radii, colors, overflow, and visual tuning needed to reach the Figma result exactly.
- Do not deliver plain `div`-only recreations when equivalent `Ant Design 5` components can preserve the same visuals and behavior.
- Only fall back to raw HTML wrappers when `Ant Design 5` would materially reduce fidelity for that specific layer.
- Run `scripts/fetch_figma_api_data.py` before writing React code unless the required JSON already exists under `figma-data`.
- Always pass the user-provided Figma proxy value to `scripts/fetch_figma_api_data.py`.
- When the proxy value is a non-empty string, all Figma REST API requests and downloaded assets must use that proxy.
- When the proxy value is an empty string, do not use a proxy for the Figma fetch step.
- If `figma-data/figma-api-export.json` already exists, do not call the Figma API again unless the user explicitly asks for a refresh.
- Remove reliance on time-based API caches. The persisted `figma-data` JSON is the reuse mechanism.
- Require the REST API step to persist all implementation-critical artifacts, including node JSON, rendered preview, image-fill mapping, downloaded image assets, exported SVG assets, and an implementation-readiness summary.
- If the persisted data is not complete enough for faithful page development, stop and report the missing artifacts instead of building an approximate page.
- Run `scripts/inspect_figma_rest_json.py` on the persisted JSON before implementation.
- Extract every image and every SVG from the JSON into separate asset files next to the generated component unless the user asks for a different asset location.
- Split every SVG into its own standalone `.svg` file. Do not merge multiple vectors into one sprite or icon font.
- Import extracted assets in the component and render them with `<img src={...} />`. Do not inline SVG markup into JSX unless the user explicitly asks for inline SVG.
- Do not rasterize SVG/vector assets into `.png`, crop them out of preview renders, or silently substitute screenshot slices for missing SVG exports.
- Treat pixel-level parity as mandatory. Do not intentionally simplify layout, typography, spacing, decoration, cropping, alignment, or interaction states.
- Reject approximate similarity as complete. If the result still looks noticeably different from Figma, keep iterating.
- Do not silently fall back to raw HTML-only output, CSS modules, inline-only styling, or another component library when the user asked for this skill.
- Do not print, log, or restate the Figma token in the final handoff.
- Do not collapse large sections, cards, nav blocks, footers, headers, or other container regions into a single screenshot or raster image.
- Only treat true leaf assets as external images: image-fill nodes, embedded image nodes, and standalone exported `.svg` assets.

## Required Workflow

Follow these steps in order. Do not start coding before Step 3.

### 1. Secure the token, URL, output path, and proxy

- Confirm that the React output path is absolute.
- Require the user to provide token, URL, absolute output path, and Figma proxy value before starting.
- Treat the Figma proxy input as mandatory even when the value is intentionally empty.
- Prefer `FIGMA_TOKEN` to avoid echoing secrets in repeated commands after the user has supplied the token.
- Create the output directory when it does not exist yet.
- Create `<output-root>/figma-data` before fetching or inspecting JSON.
- Ask only for the missing token, missing node id, missing absolute output path, or missing proxy value when one of the required inputs is absent.

### 2. Persist or reuse the Figma REST API data

- Run `scripts/fetch_figma_api_data.py` before generating React code.
- Use the script like this in PowerShell:

```powershell
$env:FIGMA_TOKEN = "fgd_..."
python scripts/fetch_figma_api_data.py `
  --figma-url "https://www.figma.com/design/FILE_KEY/Example?node-id=1-2" `
  --figma-proxy "http://127.0.0.1:7890" `
  --output-path "D:\github\demo\vite-project-react18\src\mytest\Test1"
```

- Pass `--token` only when `FIGMA_TOKEN` is unavailable.
- Pass `--node-id 1:2` only when the URL does not already contain `node-id`.
- Always pass `--figma-proxy`.
- Pass `--figma-proxy ""` when the user explicitly wants no proxy.
- Let the script create and reuse:
  - `<output-root>\figma-data\figma-api-export.json`
  - `<output-root>\figma-data\request-plan.json`
  - `<output-root>\figma-data\rendered-images.json`
  - `<output-root>\figma-data\raw-image-fills-response.json` when image fills are queried
  - `<output-root>\figma-data\image-fill-map.json`
  - `<output-root>\figma-data\downloaded-image-fills.json`
  - `<output-root>\figma-data\svg-export-candidates.json`
  - `<output-root>\figma-data\svg-renders.json`
  - `<output-root>\figma-data\downloaded-svg-assets.json`
  - `<output-root>\figma-data\asset-readiness.json`
  - `<output-root>\figma-data\node-preview.*` when the node is renderable
- If `figma-data\figma-api-export.json` already exists, let the script reuse it and skip the API entirely.
- If the persisted export predates SVG support and lacks SVG readiness metadata, treat it as stale and refetch instead of reusing it.
- Pass `--force-refresh` only when the user explicitly wants to discard the persisted JSON and fetch fresh data.
- Use `--parse-only` when you need to validate URL parsing or inspect the planned endpoints without making network requests.
- Preserve the same proxy behavior during reuse and refresh runs: non-empty proxy means proxy on, empty string means direct connection.
- Read `references/figma-rest-api.md` when the URL shape, branch key handling, or persisted files are unclear.
- If the Figma API returns permission, scope, or rate-limit errors, stop and report the exact failure instead of guessing.
- Read `figma-data\asset-readiness.json` after fetching. If `ready_for_implementation` is `false`, stop and report the missing data instead of starting page implementation.

### 3. Inspect the persisted JSON before implementation

- Run `scripts/inspect_figma_rest_json.py` on `figma-data/figma-api-export.json` before generating React code.
- Use the script like this:

```powershell
python scripts/inspect_figma_rest_json.py `
  "D:\github\demo\vite-project-react18\src\mytest\Test1\figma-data\figma-api-export.json" `
  --output "D:\github\demo\vite-project-react18\src\mytest\Test1\figma-data\figma-summary.json"
```

- Read `references/figma-rest-json.md` when the incoming JSON shape is unclear.
- Treat the persisted JSON plus the generated summary as the structural source of truth.
- Treat `figma-summary.json.layout_hints.top_level_nodes` as the source of truth for section-level margin, padding, width, and vertical spacing.
- Treat `figma-summary.json.asset_boundaries.do_not_rasterize_region_ids` as implementation boundaries that must become JSX structure, not single images.
- Treat `figma-summary.json.asset_boundaries.leaf_raster_asset_node_ids` and `figma-summary.json.asset_boundaries.svg_asset_node_ids` as the only nodes that may remain external image/SVG assets.
- If the JSON contains multiple node documents, require `--node-id` or ask the user which node to convert.
- If screenshots or extracted assets are missing from the JSON, do not continue with a page implementation that would distort the result. Report the missing artifacts first.
- If SVG export candidates exist but `asset-readiness.json` reports unresolved SVG node ids, stop. Do not convert those vectors into raster screenshots.

### 4. Plan the React breakdown

- Read `references/page-breakdown.md` before implementing a full page, dashboard, landing screen, or any multi-section frame.
- Identify the page shell, repeated regions, leaf controls, and assets before writing JSX.
- Identify every raster asset and every SVG asset before writing JSX so extraction happens before implementation.
- Classify SVG/vector assets separately from raster assets. A vector logo, icon, illustration, or decorative shape must remain an `.svg` asset or native code primitive, not a bitmap fallback.
- Classify container regions separately from assets. If a node appears in `do_not_rasterize_region_ids`, it must be translated into layout, typography, and local subcomponents rather than a single cropped preview.
- Keep component names close to the Figma hierarchy to reduce ambiguity during iteration.
- Split the output into reusable components only when the Figma structure or repetition clearly justifies it.
- Decide which `Ant Design 5` primitives map cleanly onto each visible Figma region before writing JSX.
- Translate Figma layout into normal document flow first: flex, grid, gap, padding, margin, align-self, justify-content, min/max sizes, and width constraints.
- Derive section wrappers from the recorded `left`, `top`, `width`, `right_inset`, and `gap_from_previous` values instead of guessing a shared page gutter.
- Do not invent a global `px-*` or `mx-auto` content gutter when the top-level bounds show different insets for different sections.
- For sparse marketing pages and editorial layouts, prefer one explicit wrapper per top-level section with exact width and left inset from `layout_hints.top_level_nodes`.
- Do not plan the main page structure around `absolute` positioning.

### 5. Translate into Ant Design 5 plus Tailwind

- Inspect the nearest `package.json`, `tailwind.config.*`, `postcss.config.*`, theme files, and nearby components around the output path.
- Reuse existing `Ant Design 5` theme tokens, project aliases, and local primitives when they help fidelity without changing the required stack.
- Translate Figma auto layout and constraints into matching React layout behavior with flex, grid, and sizing rules.
- Prefer `Ant Design 5` controls and structure for form fields, buttons, navigation affordances, tables, tabs, cards, typography, layout containers, and feedback UI when they can be tuned to match the design.
- Use `Tailwind` utility classes to close the gap between Ant Design defaults and the exact Figma spacing, dimensions, colors, radii, shadows, opacity, and alignment.
- Tune or reset Ant Design defaults whenever they drift from Figma. Default paddings, line heights, borders, font sizes, or radii are not acceptable if the design shows different values.
- Build page layout with proper padding, margin, gap, and intrinsic sizing. Do not use absolute positioning for primary layout, section placement, text blocks, or image columns.
- Match section-specific padding and margin numerically. If one section starts at `left=96` and another starts at `left=309`, preserve those distinct offsets through wrappers, gaps, and widths rather than flattening them into one generic content container.
- Use absolute positioning only for small overlays or decorative layers that are explicitly overlayed in the design and do not define page flow.
- If the target repo is missing `Ant Design 5` or `Tailwind`, still generate code in that stack and clearly call out the dependency gap in the final handoff instead of downgrading the implementation.

### 6. Implement for 1:1 fidelity

- Preserve hierarchy, layout mode, spacing, sizing, typography, fills, strokes, shadows, radii, clipping, and visible layer order.
- Preserve exact typography, line breaks, icon placement, image cropping, and SVG positioning from the JSON and extracted assets.
- Reproduce all visible states shown or implied by Figma, including hover, active, selected, disabled, empty, and focused states when relevant.
- Extract standalone assets when the JSON includes image references, `imageUrl`, vector data, or embedded `svgContent`.
- When the fetch step exports standalone `.svg` files, prefer those files over preview crops or `.png` fallbacks.
- Keep all generated files inside the user-provided output path unless the user explicitly asks for a broader refactor.
- Prefer semantic HTML and accessible interactions.
- Keep props minimal. Do not invent generic abstractions that weaken fidelity.
- Render extracted images and extracted SVG files through imported asset paths and `<img src={...}>`.
- Never use the node preview, subtree preview crops, or large rendered section snapshots as substitutes for implementable layout regions.
- Do not invent data fetching, state management, or abstractions that are not present in the design request.
- Match the Figma canvas size first, then match internal spacing and typography at that same scale.
- Validate every major section's top offset, left offset, width, and bottom spacing against `figma-summary.json.layout_hints.top_level_nodes` before calling the page complete.
- If a previous draft looks visually off, treat it as incomplete rather than good enough.
- Preserve real layout relationships with padding and margin rather than simulating placement through top/left offsets.

### 7. Validate before handoff

- Read `references/react-output-rules.md` before implementation and final review.
- Read `references/fidelity-checklist.md` when performing final review.
- Compare the result against the persisted JSON hierarchy, bounds, styles, and any available screenshots or extracted assets.
- Validate at the same frame size as Figma before calling the work complete.
- When screenshots are unavailable, validate against the JSON hierarchy, bounds, layout settings, text content, fills, strokes, and effects.
- Confirm that the main visible primitives are implemented with `Ant Design 5` plus `Tailwind`, not plain HTML-only recreation.
- Confirm that the main layout is driven by flex/grid/padding/margin rather than absolute coordinates.
- Confirm that every SVG in the source is written as its own `.svg` file and that every extracted asset is referenced through `<img src={...}>`.
- Confirm that the output path was respected exactly.
- Reject approximate similarity as complete. Keep iterating until the result is visually aligned with the source.
- Call out every missing asset, ambiguous visual detail, or intentional deviation in the final handoff.

## Delivery Rules

- Prefer page-level composition plus reusable leaf components over one giant JSX file.
- Prefer project-native `Ant Design 5` usage plus `Tailwind` tuning over raw HTML controls and raw HTML layout when behavior must match the design.
- Keep the generated components integration-ready instead of returning pseudo-code.
- Use minimal props and abstractions; prefer literal layout when the design is static.
- Keep implementation accessible: preserve semantic structure, keyboard behavior, labels, and contrast.
- Do not ask for live Figma access, tokens, or MCP tools when the local persisted JSON already exists.
- Do not deliver partial fidelity as finished. Keep iterating until layout and styling are visually aligned with the source.

## Example Triggers

- "Use my Figma token, Figma URL, output path, and Figma proxy to build the React page."
- "figma token: figd_xxx / figma url: https://www.figma.com/... / figma proxy: http://user:pass@host:8080 / absolute path: D:\repo\src\mytest\Test1"
- "figma token: figd_xxx / figma url: https://www.figma.com/... / figma proxy: / absolute path: D:\repo\src\mytest\Test1"
- "Use my Figma token and this Figma URL to build the React page in `D:\repo\src\mytest\Test1`."
- "Create `figma-data` under my output folder, reuse the JSON if it already exists, and generate the component."
- "Fetch this Figma node once, save the REST JSON locally, and use that JSON to generate a 1:1 React component."
- "Turn this Figma URL into Ant Design 5 + Tailwind React without making me export JSON first."
- "Use `figma-api-data-to-react` to read a live Figma file and create the component in the path I give you."

## References

- `references/figma-rest-api.md`: Read when the Figma URL shape, REST endpoint mapping, or persisted `figma-data` artifacts are unclear.
- `references/figma-rest-json.md`: Read when the JSON shape, node selection, or asset hints are unclear.
- `references/page-breakdown.md`: Read when the target is a page or a large multi-section frame.
- `references/react-output-rules.md`: Read before implementation and final validation to keep the React output aligned with Ant Design 5 and Tailwind.
- `references/fidelity-checklist.md`: Read before final validation or when parity issues keep appearing.
