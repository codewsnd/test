# Figma REST API Notes

Use this reference when the input is a live Figma URL rather than a pre-exported JSON file.

## Supported URL Shapes

- Accept URLs like `https://www.figma.com/design/<fileKey>/<name>?node-id=1-2`.
- Accept URLs like `https://www.figma.com/file/<fileKey>/<name>?node-id=1-2`.
- Accept branch URLs like `https://www.figma.com/design/<fileKey>/branch/<branchKey>/<name>?node-id=1-2`.
- Normalize `node-id` from `1-2` to `1:2`.
- Prefer the branch key as the effective file key when the URL points to a branch.

## Output Persistence

- Treat the user-provided absolute output path as the root for persistence.
- Create a `figma-data` directory under that output root.
- Persist the fetched REST payload to `figma-data/figma-api-export.json`.
- If `figma-data/figma-api-export.json` already exists, reuse it and skip the API entirely.
- Use `--force-refresh` only when the user explicitly wants a fresh API fetch.
- Do not use time-based cache directories or 24-hour API caches.
- Treat `figma-data` as the full implementation handoff package for page development, not just a partial cache.

## Fetch Sequence

1. Parse the URL into `file_key` and `node_id`.
2. Create `<output-root>/figma-data`.
3. If `figma-data/figma-api-export.json` already exists, stop fetching and reuse that persisted JSON.
4. Otherwise call `GET /v1/files/:key/nodes?ids=<node_id>&geometry=paths`.
5. Call `GET /v1/images/:key?ids=<node_id>&format=png&scale=2` to obtain a preview render when possible.
6. If the selected node references image fills, call `GET /v1/files/:key/images` and filter the returned map to the image refs used by the selected node.
7. Identify exportable vector nodes and call `GET /v1/images/:key?ids=<svg-node-ids>&format=svg` to persist standalone `.svg` files for them.
8. Persist all returned artifacts under `figma-data`, including an implementation-readiness summary.
9. If implementation-critical data is still missing, stop and report the missing pieces instead of proceeding with page development.

## Expected Output Files

- `request-plan.json`: Parsed URL, effective file key, selected node id, output root, and the planned endpoints.
- `figma-api-export.json`: Wrapped export payload that includes the raw node response plus fetch metadata.
- `rendered-images.json`: Response from the preview render endpoint.
- `raw-image-fills-response.json`: The raw file-images response when image fills were queried.
- `image-fill-map.json`: Filtered map from the file-images endpoint for the selected node only.
- `downloaded-image-fills.json`: Manifest of the actual image-fill files downloaded to disk.
- `svg-export-candidates.json`: Candidate vector nodes that must be exported as standalone `.svg` assets.
- `svg-renders.json`: Raw mapping from exportable vector node ids to temporary SVG render URLs.
- `downloaded-svg-assets.json`: Manifest of the actual `.svg` files downloaded to disk.
- `asset-readiness.json`: Whether the fetched data is complete enough for faithful implementation and which assets are still unresolved.
- `node-preview.png` or another render extension: Downloaded preview image when the node is renderable.

## Common Failure Modes

- Missing `node-id` in the URL: ask the user which node to convert or require `--node-id`.
- `403` responses: token is invalid, expired, missing scope, or lacks access to the file.
- `404` responses: wrong file key, wrong branch key, or inaccessible file.
- Null rendered image URL: the node cannot be rendered directly, often because it is invisible or has no renderable content.
- Empty image-fill map: the node may not use raster image fills, which is fine.
- Missing SVG render URLs for vector candidates: treat the export as incomplete and block implementation until the vector assets are resolved.
- Stale persisted JSON: if the user expects fresh design changes, rerun with `--force-refresh`.
- Stale persisted JSON without SVG metadata: refetch automatically rather than reusing a pre-fix export.

## Practical Guidance

- Prefer storing the token in `FIGMA_TOKEN` instead of repeating it in commands.
- Keep `figma-data` next to the generated component so later runs can reuse the same JSON.
- Treat the preview image as a visual checkpoint, not as the structural source of truth.
- Treat the preview image as a checkpoint only. Do not crop it and pretend the crop is an extracted SVG asset.
- Treat `figma-api-export.json` and the summary derived from it as the structural source of truth.
- Read `asset-readiness.json` before implementation. If it reports unresolved image refs, unresolved SVG node ids, or a missing preview, treat the work as blocked for 1:1 implementation until the data gap is resolved.
