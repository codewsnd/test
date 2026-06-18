# Figma REST JSON

Use this reference when the user provides a local JSON file exported from the Figma REST API or a cached response based on that API.

## Output Requirements

- Generate `React + TypeScript` output as `.tsx` files.
- Implement the UI with `Ant Design 5` plus `Tailwind`.
- Treat 1:1 fidelity as mandatory. The target is pixel-level parity, not approximate similarity.
- Extract raster images and SVG assets into standalone files next to the generated component unless the user specifies a different absolute asset path.
- Import extracted assets and render them with `<img src={...}>`.
- Split every SVG into its own independent `.svg` file.

## Accepted Shapes

Support these input shapes:

- A top-level `document` object from the file endpoint
- A top-level `payload.document` object from a wrapped response
- A top-level `nodes` map from the nodes endpoint
- A top-level `payload.nodes` map from a wrapped nodes response
- A simplified top-level node tree with fields like `id`, `name`, `type`, `children`, `fills`, and `style`
- Simplified exports that include `imageUrl` and `svgContent`

If a `nodes` map contains more than one document candidate, require `--node-id` or ask the user which node should be converted.

## Fields That Matter Most

Prioritize these fields during translation:

- `absoluteBoundingBox` and `absoluteRenderBounds`
- `layoutMode`, `primaryAxisSizingMode`, `counterAxisSizingMode`, and `itemSpacing`
- `paddingLeft`, `paddingRight`, `paddingTop`, and `paddingBottom`
- `constraints`, `layoutAlign`, and `layoutGrow`
- `fills`, `strokes`, `effects`, and `opacity`
- `style`, `characters`, and text alignment fields
- `cornerRadius` and per-corner radius fields
- `imageUrl` and `svgContent`
- `children`

Use these fields to reconstruct layout before adding polish.

## Inspector Script

Run the bundled inspector first:

```bash
node scripts/inspect_figma_rest_json.js "C:\absolute\path\figma.json" --output "C:\absolute\path\figma-summary.json"
```

Useful options:

- `--node-id <id>` to target a single node inside a multi-node payload
- `--max-depth <n>` to keep very large trees easier to inspect
- `--output <path>` to write a reusable summary file

## Asset Hints

Look for these asset signals:

- `fills[].imageRef` for raster fills
- `imageUrl` for embedded or base64 image payloads
- `svgContent` for embedded vector markup
- vector-like node types such as `VECTOR`, `BOOLEAN_OPERATION`, `STAR`, `LINE`, `ELLIPSE`, and `POLYGON`
- any embedded SVG-like or image-like content in simplified exports

If the source lacks actual binary assets, continue with structure-first React code only when the user explicitly accepts that reduced-fidelity mode. Otherwise stop and ask for complete persisted Figma REST artifacts or permission to refresh from Figma.
Do not swap in placeholder assets when the source already provides real image or SVG content.
Do not call a structure-first implementation 1:1 complete when required image or SVG assets are missing.
