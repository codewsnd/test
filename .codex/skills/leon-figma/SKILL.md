---
name: leon-figma
description: "Use when converting a Figma URL or existing local figma-data into React TypeScript with Ant Design 5 and Tailwind, especially when REST artifacts, image fills, SVG assets, proxy/token handling, or pixel-level parity matter."
---

# Leon Figma

## Goal

Translate a Figma node into integration-ready React and TypeScript using `Ant Design 5` plus `Tailwind`, with persisted REST artifacts under `figma-data` as the source of truth.

## When To Use

- The user gives a Figma URL and an absolute React output path.
- The output path already contains reusable `figma-data`, `figma-api-export.json`, `figma-summary.json`, `asset-readiness.json`, downloaded image fills, SVG assets, or related persisted Figma artifacts.
- The user expects 1:1 visual parity, extracted assets, proxy-aware Figma REST access, or repeatable reuse without manually exporting JSON.

## Modes

### Reuse Mode

- Inspect the absolute output path first.
- If persisted Figma artifacts exist, reuse them and do not call the Figma API.
- If artifacts are present but incomplete, report the missing files or readiness metadata and stop unless the user explicitly asks for refresh.
- Do not ask for token or proxy when local artifacts are complete enough for implementation.

### Live-Fetch Mode

- Use only when no reusable or partial local Figma artifacts exist under the absolute output path.
- Require a Figma URL, an absolute output path, and a Figma access token.
- Resolve token and proxy from environment variables before asking the user. Match names such as `FIGMA_TOKEN`, `figma_token`, `figmaToken`, `FIGMA_PROXY`, `figma_proxy`, and `figmaProxy`.
- Accept an empty proxy string when the user wants direct access.
- Reject relative output paths.

## Artifact Contract

Keep fetched or reused data under `<output-root>/figma-data`.

Important files include:

- `figma-api-export.json`
- `request-plan.json`
- `rendered-images.json`
- `image-fill-map.json`
- `downloaded-image-fills.json`
- `svg-export-candidates.json`
- `svg-renders.json`
- `downloaded-svg-assets.json`
- `asset-readiness.json`
- `figma-summary.json`
- `node-preview.*`

If `asset-readiness.json` says implementation is not ready, stop and report the gap instead of building an approximate page.

When the user supplies a simplified local JSON that has structure but not downloadable binary assets, continue only if the user explicitly accepts a structure-first implementation. Otherwise stop and ask for complete Figma REST artifacts or permission to refresh.

## Bundled Scripts

- `scripts/fetch_figma_api_data.py`: fetches or reuses Figma REST artifacts and persists `figma-data`.
- `scripts/inspect_figma_rest_json.py`: validates persisted JSON and writes implementation-oriented layout and asset hints.

Run the fetch script before React work only in live-fetch mode. Run the inspect script before React work whenever `figma-summary.json` is missing or stale.

## Workflow

1. Inspect the output path and choose reuse mode or live-fetch mode.
2. In live-fetch mode, fetch REST data with the bundled script. Let the script resolve token and proxy unless explicit values are required.
3. Read `asset-readiness.json`; stop on unresolved image or SVG data.
4. Generate or reuse `figma-summary.json` with the inspector script.
5. Plan page breakdown from `layout_hints`, `asset_boundaries`, top-level bounds, and the Figma hierarchy before writing JSX.
6. Extract every raster image and every SVG asset into standalone files near the generated component unless the user gives another asset path.
7. Implement visible regions with `Ant Design 5` primitives first and close fidelity gaps with inline `Tailwind` utility classes.
8. Validate against JSON bounds, text, fills, strokes, effects, screenshots, and extracted assets before handoff.

## React Output Rules

- Write `.tsx` files.
- If the output path is a file, write the primary component to that exact file and keep helpers and assets next to it.
- If the output path is a directory, create the component tree inside that directory.
- Keep generated React files and assets inside the user-provided output path unless the user asks for a wider refactor.
- Use `Ant Design 5` primitives such as `Typography`, `Flex`, `Space`, `Card`, `Layout`, `Image`, `Button`, `Input`, `Tabs`, `Tag`, `Badge`, and `Avatar` when they preserve the Figma result.
- Use `Tailwind` utility classes and arbitrary values for spacing, sizing, positioning, borders, shadows, radii, colors, overflow, and typography.
- Do not create generated `.css`, `.scss`, `.sass`, `.less`, CSS Modules, CSS-in-JS, or `<style>` blocks.
- Do not hide ordinary visual styling in shared `CSSProperties` objects or static Tailwind class constants.
- Use inline `style` only for values Tailwind cannot express cleanly or values computed at runtime.
- Emit integer pixel values in generated code. Round long Figma decimals to practical `px` values.
- Prefer concise static React, shallow component trees, and local typed arrays for repeated static regions.
- Do not use absolute positioning for primary layout, section placement, text blocks, or image columns.
- Do not collapse large sections, nav blocks, cards, footers, headers, or container regions into screenshot slices.
- Render extracted images and SVG files through imports and `<img src={...}>`; do not inline SVG markup unless the user asks.

## Reference Loading

- Read [references/figma-rest-api.md](references/figma-rest-api.md) for URL parsing, branch keys, proxy behavior, REST endpoints, and expected persisted files.
- Read [references/figma-rest-json.md](references/figma-rest-json.md) for accepted JSON shapes, important fields, inspector usage, and asset signals.
- Read [references/page-breakdown.md](references/page-breakdown.md) for full pages, dashboards, landing screens, and multi-section frames.
- Read [references/react-output-rules.md](references/react-output-rules.md) before implementation and final review.
- Read [references/fidelity-checklist.md](references/fidelity-checklist.md) before final validation or when parity issues persist.

## Delivery Rules

- Treat pixel-level parity as mandatory. Continue iterating when the result is noticeably different from Figma.
- Call out missing assets, ambiguous visual details, dependency gaps, or intentional deviations.
- Do not print, log, or restate the Figma token.
