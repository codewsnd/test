# React Output Rules

Use this reference when deciding where to write files and how to keep the output aligned with `Ant Design 5`, `Tailwind`, and 1:1 fidelity.

## Output Path Rules

- If the user gives a file path, write the primary React component to that exact file.
- If the user gives a directory path, create the component tree inside that directory.
- Keep helper components, styles, and extracted assets next to the primary output unless the project already uses a different local pattern.
- Do not write generated files outside the user-provided target without explicit permission.

## Ant Design 5 Plus Tailwind Rules

- Use `.tsx` component files.
- Use `Ant Design 5` for interactive primitives such as buttons, inputs, forms, menus, tabs, drawers, cards, and badges whenever those components can preserve the design.
- Use `Tailwind` to match spacing, width, height, padding, margin, flex behavior, grid behavior, borders, shadows, and responsive rules exactly.
- Keep Ant Design overrides intentional. Do not leave generic Ant Design spacing, typography, or radii when the Figma values differ.
- Prefer Ant Design theme tokens or local constants when they help consistency, but do not let token usage drift the final visual match away from Figma.

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

- layout and spacing follow the JSON structure exactly as closely as the source allows
- text content, typography, and line breaks are preserved
- fills, borders, shadows, opacity, and radii are represented in the output
- extracted assets are used instead of placeholders
- repeated sections are extracted only when the repetition is real
- static designs remain static unless the user asked for extra behavior
- every ambiguity or missing asset is mentioned clearly in the handoff
