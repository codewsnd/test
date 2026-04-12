# Page Breakdown

Use this guide when the target node is a full page, dashboard, landing page, or any frame with multiple visual regions.

## Framework Rules

- Implement page output as `React + TypeScript` components.
- Favor `Ant Design 5` components for interactive primitives such as buttons, forms, inputs, menus, tabs, and feedback elements.
- Use `Tailwind` to match the Figma geometry, spacing, alignment, radii, borders, shadows, and responsive behavior exactly.
- Keep extracted images and vectors as external assets, then import them and render them with `<img src={...}>`.
- Split every SVG into an independent file, even when multiple SVG nodes appear in the same region.

## Breakdown Order

1. Identify the page shell.
2. Identify major sections.
3. Identify repeated composites.
4. Identify leaf controls.
5. Identify and extract assets.

## Page Shell

- Map the outermost frame to the top-level React page component.
- Preserve global padding, max width, background layers, and page-level gaps before extracting children.
- Keep the shell responsible for overall stacking and responsive width behavior.
- Read `figma-summary.json.layout_hints.root_bounds` and `top_level_nodes` before choosing shell gutters.
- If the design uses section-specific left/right insets, keep the shell neutral and express those offsets at the section level.

## Major Sections

- Extract sections when they represent distinct visual regions such as hero, sidebar, top bar, content grid, footer, or modal body.
- Keep single-use wrappers inline when extraction would only add indirection.
- Name sections after their visual role in Figma to make comparison easier during review.
- Keep section boundaries aligned with Figma frames so asset placement and spacing stay 1:1.
- Read `figma-summary.json.asset_boundaries.implementation_regions` and use those nodes as the default section boundaries.
- Treat every node listed in `do_not_rasterize_region_ids` as JSX layout work, not as an image placeholder.
- Use each top-level node's `left`, `width`, `right_inset`, and `gap_from_previous` values to build section wrappers.
- Avoid replacing multiple distinct section offsets with one shared `padding-left` or `padding-right` unless the bounds prove they are identical.

## Repeated Composites

- Extract cards, nav items, stat blocks, list rows, tabs, and similar repeated groups into reusable components.
- Keep repeated composites close to their parent page until a second use case proves they belong elsewhere in the project.
- Preserve internal layout rules exactly before adding optional props.
- Do not over-abstract repeated composites if doing so makes precise styling harder.

## Leaf Controls

- Reuse existing Ant Design 5 buttons, inputs, avatars, badges, typography primitives, and layout helpers whenever their behavior already matches.
- Create new leaf components only when the existing design system cannot reach the required fidelity without awkward overrides.
- Keep leaf component props small and explicit.

## Assets

- Extract raster images into standalone files.
- Extract every SVG node or SVG group into its own standalone `.svg` file.
- Keep asset filenames stable and descriptive relative to the component or region they belong to.
- Reference extracted assets through imports and `<img src={...}>`, not inline SVG markup.
- Only keep nodes from `leaf_raster_asset_node_ids` and `svg_asset_node_ids` as external assets.
- Never rasterize a major section, component showcase, or layout container into one image just to avoid implementing it.

## Data and Props

- Keep static Figma text and imagery inline for purely presentational tasks.
- Introduce typed props only when the same structure clearly repeats or the user asks for reusable data-driven components.
- Do not invent API contracts, loading states, or empty states unless the design shows them or the user requests them.

## File Shape

- Start with one page entry component.
- Place section components next to the page until reuse justifies moving them.
- Keep style tokens or constants near the component that owns them unless they match shared project tokens.

## Review Prompt

Before finishing, check whether each extracted component answers a real visual or reuse boundary from Figma. If it does not, inline it again.
