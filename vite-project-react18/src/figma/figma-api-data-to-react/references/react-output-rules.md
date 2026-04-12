# React Output Rules

Use this reference when deciding where to write files and how to keep the output aligned with `Ant Design 5`, `Tailwind`, and 1:1 fidelity.

## Output Path Rules

- If the user gives a file path, write the primary React component to that exact file.
- If the user gives a directory path, create the component tree inside that directory.
- Keep helper components, styles, and extracted assets next to the primary output unless the project already uses a different local pattern.
- Do not write generated files outside the user-provided target without explicit permission.

## Ant Design 5 Plus Tailwind Rules

- Use `.tsx` component files.
- Use `Ant Design 5` as the default layer for visible primitives, not just interactive controls. Prefer `Typography`, `Flex`, `Card`, `Image`, `Button`, `Input`, `Tabs`, `Tag`, `Badge`, `Avatar`, `Space`, and related components whenever they can preserve the design.
- Use `Tailwind` to match spacing, width, height, padding, margin, flex behavior, grid behavior, borders, shadows, radii, opacity, and responsive rules exactly.
- Keep Ant Design overrides intentional. Do not leave generic Ant Design spacing, typography, radii, borders, or line heights when the Figma values differ.
- Do not ship plain `div`-only recreation when a matching `Ant Design 5` primitive can preserve the same result.
- Only use raw HTML wrappers when `Ant Design 5` would materially reduce fidelity for that exact layer.
- Do not use absolute positioning for the main layout, section placement, content columns, or text blocks.
- Translate Figma layout into flex, grid, gap, padding, margin, width constraints, min/max sizes, and intrinsic flow first.
- Use absolute positioning only for localized overlays that do not define the page's primary layout.
- Prefer Ant Design theme tokens or local constants when they help consistency, but do not let token usage drift the final visual match away from Figma.
- Do not implement large regions as a single `<Image>` or `<img>` just because a preview render exists.
- Restrict external image usage to true leaf assets surfaced by the Figma summary, not whole sections or container blocks.
- Use the numeric `layout_hints.top_level_nodes` data to drive section margin and padding values.
- When the top-level bounds differ across sections, prefer per-section wrappers with exact widths and offsets over one global content container.
- On sparse pages, keep each major visible block in its own exact-width wrapper rather than centering multiple unrelated blocks inside one shared column.

## Convention Discovery

Inspect the target repo before choosing integration details:

- match import alias and folder conventions
- inspect `tailwind.config.*`, `postcss.config.*`, and Ant Design theme files
- reuse local primitives when they help fidelity and still preserve the required stack
- preserve local linting and formatting conventions

If the repo does not provide a clear pattern, default to:

- `.tsx` component files
- `Ant Design 5` for controls and structural primitives
- `Tailwind` utility classes for visual styling and layout
- local helper constants only when they improve clarity without hiding the Figma geometry

## Fidelity Checklist

Before finishing, confirm all of the following:

- frame size, layout, and spacing follow the JSON structure exactly as closely as the source allows
- section wrappers respect the recorded `left`, `width`, `right_inset`, and `gap_from_previous` values instead of guessed shared gutters
- text content, typography, and line breaks are preserved
- fills, borders, shadows, opacity, radii, and cropping are represented in the output
- visible building blocks are primarily `Ant Design 5` plus `Tailwind`, not plain HTML-only recreation
- the main layout is implemented with padding, margin, gap, flex, or grid instead of top/left absolute placement
- extracted assets are used instead of placeholders
- exported `.svg` assets remain `.svg` assets in the implementation and are not replaced by raster screenshots or preview crops
- major layout regions from `do_not_rasterize_region_ids` are implemented as JSX structure, not pasted in as one image
- repeated sections are extracted only when the repetition is real
- static designs remain static unless the user asked for extra behavior
- every ambiguity or missing asset is mentioned clearly in the handoff
