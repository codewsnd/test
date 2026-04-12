# Fidelity Checklist

Use this checklist before marking the implementation complete.

## Tech Stack Check

- Confirm the implementation is written in `React + TypeScript`.
- Confirm interactive UI uses `Ant Design 5` where appropriate.
- Confirm `Tailwind` is used to achieve the exact spacing, sizing, positioning, and visual tuning required by the design.

## Layout

- Match outer width, min-height, padding, section gaps, and internal spacing.
- Match flex and grid behavior, including wrapping, alignment, and justification.
- Match overflow, clipping, sticky areas, and z-order.

## Typography

- Match font family, size, weight, line height, letter spacing, and text transform.
- Match text alignment, truncation, and multiline behavior.
- Match emphasis differences between headings, body text, metadata, and captions.

## Visual Styling

- Match fill colors, gradients, opacity, borders, shadows, blur, and corner radius.
- Match background layering, separators, chips, tags, and focus rings.
- Match icon size, stroke weight, and alignment relative to text.

## Assets

- Use Figma-provided images, SVGs, and logos directly when available.
- Confirm every SVG has been extracted into its own standalone `.svg` file.
- Confirm every image and SVG is imported and rendered with `<img src={...}>`.
- Match cropping, object-fit behavior, masking, and aspect ratio.
- Avoid placeholder imagery when the source asset exists.

## Interaction

- Match hover, active, selected, pressed, disabled, and expanded states when relevant.
- Preserve cursor behavior, hit area size, and keyboard accessibility.
- Preserve semantic HTML for links, buttons, inputs, dialogs, lists, and tables.

## Responsive Behavior

- Match Auto Layout intent, constraints, and resizing behavior from Figma.
- Preserve the breakpoint behavior implied by the design.
- Avoid introducing collapse rules that are not supported by the source layout.

## Final Sanity Check

- Compare the implementation side by side with the screenshot.
- Reject the result if the layout or styling is only approximately similar. The target is 1:1 parity.
- Note every intentional deviation and why it exists.
- If a project token changes the raw value, adjust nearby spacing or sizing until the page still looks like Figma.
