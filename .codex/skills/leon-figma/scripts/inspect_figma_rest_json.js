#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const VECTOR_LIKE_TYPES = new Set([
  'VECTOR',
  'BOOLEAN_OPERATION',
  'STAR',
  'LINE',
  'ELLIPSE',
  'POLYGON',
]);
const DIRECT_SVG_NODE_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON']);
const BASIC_VECTOR_NODE_TYPES = new Set(['ELLIPSE', 'LINE']);
const SVG_CONTAINER_TYPES = new Set(['GROUP', 'FRAME', 'COMPONENT', 'INSTANCE']);
const SVG_ELIGIBLE_NODE_TYPES = new Set([
  ...DIRECT_SVG_NODE_TYPES,
  ...BASIC_VECTOR_NODE_TYPES,
  ...SVG_CONTAINER_TYPES,
]);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseDataUrlMimeType(value) {
  if (!value.startsWith('data:')) {
    return null;
  }
  const header = value.split(',', 1)[0];
  const mimeType = header.slice(5).split(';', 1)[0];
  return mimeType || null;
}

function parseArgs(argv) {
  const args = {
    jsonPath: undefined,
    nodeId: undefined,
    maxDepth: undefined,
    output: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--node-id') {
      index += 1;
      args.nodeId = readOptionValue(argv, index, arg);
      continue;
    }
    if (arg === '--max-depth') {
      index += 1;
      args.maxDepth = Number.parseInt(readOptionValue(argv, index, arg), 10);
      continue;
    }
    if (arg === '--output') {
      index += 1;
      args.output = readOptionValue(argv, index, arg);
      continue;
    }
    if (arg.startsWith('--')) {
      fail(`Unknown argument: ${arg}`);
    }
    if (args.jsonPath) {
      fail(`Unexpected positional argument: ${arg}`);
    }
    args.jsonPath = arg;
  }

  if (!args.jsonPath) {
    fail('Missing JSON path.');
  }
  if (args.maxDepth !== undefined && !Number.isInteger(args.maxDepth)) {
    fail('--max-depth must be an integer.');
  }
  return args;
}

function readOptionValue(argv, index, optionName) {
  if (index >= argv.length) {
    fail(`Missing value for ${optionName}`);
  }
  return argv[index];
}

function isAbsolutePath(value) {
  return path.isAbsolute(value) || path.win32.isAbsolute(value);
}

function ensureAbsolutePath(value, label) {
  if (!isAbsolutePath(value)) {
    fail(`${label} must be an absolute path: ${value}`);
  }
  return value;
}

function loadJson(jsonPath) {
  if (!fs.existsSync(jsonPath)) {
    fail(`Input JSON file does not exist: ${jsonPath}`);
  }
  if (!fs.statSync(jsonPath).isFile()) {
    fail(`Input JSON path is not a file: ${jsonPath}`);
  }
  try {
    const payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!isPlainObject(payload)) {
      fail('Unsupported Figma JSON shape: top-level value must be an object.');
    }
    return payload;
  } catch (error) {
    fail(`Input JSON file is not valid JSON: ${error.message}`);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractNodeEntry(nodeEntry, nodeId) {
  if (!isPlainObject(nodeEntry)) {
    fail(`Node entry for ${nodeId} is not an object.`);
  }
  if (!isPlainObject(nodeEntry.document)) {
    fail(`Node entry for ${nodeId} does not contain a document object.`);
  }
  return nodeEntry.document;
}

function resolveDocument(payload, requestedNodeId) {
  if (isPlainObject(payload.payload)) {
    return resolveDocument(payload.payload, requestedNodeId);
  }
  if (isPlainObject(payload.nodes)) {
    return resolveNodesDocument(payload.nodes, requestedNodeId);
  }
  if (isPlainObject(payload.document)) {
    return {
      nodeId: requestedNodeId || payload.node_id || payload.document.id,
      sourceFormat: 'document',
      document: payload.document,
    };
  }
  if (typeof payload.name === 'string' && typeof payload.type === 'string') {
    return {
      nodeId: requestedNodeId || payload.id,
      sourceFormat: 'direct-node',
      document: payload,
    };
  }
  fail('Unsupported Figma JSON shape. Expected a top-level document, a payload.document, a nodes map, or a simplified top-level node.');
}

function resolveNodesDocument(nodes, requestedNodeId) {
  if (requestedNodeId) {
    if (!Object.prototype.hasOwnProperty.call(nodes, requestedNodeId)) {
      fail(`Requested node id not found in JSON: ${requestedNodeId}`);
    }
    return {
      nodeId: requestedNodeId,
      sourceFormat: 'nodes',
      document: extractNodeEntry(nodes[requestedNodeId], requestedNodeId),
    };
  }

  const candidates = Object.entries(nodes)
    .filter(([, nodeEntry]) => isPlainObject(nodeEntry) && isPlainObject(nodeEntry.document))
    .map(([nodeId, nodeEntry]) => ({ nodeId, document: nodeEntry.document }));
  if (candidates.length === 0) {
    fail('The JSON contains a nodes object but no document entries.');
  }
  if (candidates.length > 1) {
    const available = candidates.slice(0, 20).map((candidate) => candidate.nodeId).join(', ');
    fail(`Multiple node documents were found. Pass --node-id to select one. Available node ids: ${available}`);
  }
  return {
    nodeId: candidates[0].nodeId,
    sourceFormat: 'nodes',
    document: candidates[0].document,
  };
}

function pickKeys(source, keys) {
  const picked = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      picked[key] = source[key];
    }
  }
  return picked;
}

function simplifyPaint(paint) {
  return pickKeys(paint, [
    'type',
    'visible',
    'opacity',
    'blendMode',
    'scaleMode',
    'imageRef',
    'color',
    'gradientStops',
  ]);
}

function simplifyEffect(effect) {
  return pickKeys(effect, [
    'type',
    'visible',
    'radius',
    'spread',
    'blendMode',
    'offset',
    'color',
  ]);
}

function simplifyStyle(style) {
  return pickKeys(style, [
    'fontFamily',
    'fontPostScriptName',
    'fontWeight',
    'fontSize',
    'textAlignHorizontal',
    'textAlignVertical',
    'letterSpacing',
    'lineHeightPx',
    'lineHeightPercent',
    'lineHeightPercentFontSize',
    'lineHeightUnit',
    'textCase',
    'textDecoration',
  ]);
}

function simplifyNode(node, depth = 0, maxDepth = undefined) {
  const cleaned = pickKeys(node, [
    'id',
    'name',
    'type',
    'visible',
    'opacity',
    'blendMode',
    'clipsContent',
    'layoutMode',
    'primaryAxisSizingMode',
    'counterAxisSizingMode',
    'primaryAxisAlignItems',
    'counterAxisAlignItems',
    'itemSpacing',
    'layoutAlign',
    'layoutGrow',
    'layoutWrap',
    'paddingLeft',
    'paddingRight',
    'paddingTop',
    'paddingBottom',
    'cornerRadius',
    'topLeftRadius',
    'topRightRadius',
    'bottomLeftRadius',
    'bottomRightRadius',
    'strokeWeight',
    'strokeAlign',
    'strokeJoin',
    'strokeCap',
    'characters',
    'constraints',
    'componentPropertyDefinitions',
    'componentProperties',
    'overflowDirection',
  ]);
  addGeometry(node, cleaned);
  addVisualFields(node, cleaned);
  addEmbeddedAssetFlags(node, cleaned);
  addSimplifiedChildren(node, cleaned, depth, maxDepth);
  return cleaned;
}

function addGeometry(node, cleaned) {
  if (Object.prototype.hasOwnProperty.call(node, 'absoluteBoundingBox')) {
    cleaned.absoluteBoundingBox = node.absoluteBoundingBox;
  }
  if (Object.prototype.hasOwnProperty.call(node, 'absoluteRenderBounds')) {
    cleaned.absoluteRenderBounds = node.absoluteRenderBounds;
  }
}

function addVisualFields(node, cleaned) {
  if (Array.isArray(node.fills)) {
    cleaned.fills = node.fills.filter(isPlainObject).map(simplifyPaint);
  }
  if (Array.isArray(node.strokes)) {
    cleaned.strokes = node.strokes.filter(isPlainObject).map(simplifyPaint);
  }
  if (Array.isArray(node.effects)) {
    cleaned.effects = node.effects.filter(isPlainObject).map(simplifyEffect);
  }
  if (isPlainObject(node.style)) {
    cleaned.style = simplifyStyle(node.style);
  }
}

function addEmbeddedAssetFlags(node, cleaned) {
  if (typeof node.imageUrl === 'string' && node.imageUrl) {
    cleaned.hasImageUrl = true;
    const mimeType = parseDataUrlMimeType(node.imageUrl);
    if (mimeType) {
      cleaned.imageUrlMimeType = mimeType;
    }
  }
  if (typeof node.svgContent === 'string' && node.svgContent.trim()) {
    cleaned.hasSvgContent = true;
  }
}

function addSimplifiedChildren(node, cleaned, depth, maxDepth) {
  if (!Array.isArray(node.children)) {
    return;
  }
  cleaned.childCount = node.children.length;
  if (maxDepth === undefined || maxDepth === null || depth < maxDepth) {
    cleaned.children = node.children
      .filter(isPlainObject)
      .map((child) => simplifyNode(child, depth + 1, maxDepth));
  }
}

function walkNodes(node) {
  const nodes = [node];
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (isPlainObject(child)) {
        nodes.push(...walkNodes(child));
      }
    }
  }
  return nodes;
}

function iterPaints(node) {
  const paints = [];
  for (const paintKey of ['fills', 'strokes']) {
    if (Array.isArray(node[paintKey])) {
      paints.push(...node[paintKey].filter(isPlainObject));
    }
  }
  return paints;
}

function nodeHasRasterPaint(node) {
  return iterPaints(node).some((paint) => {
    if (paint.type === 'IMAGE') {
      return true;
    }
    return typeof paint.imageRef === 'string' && Boolean(paint.imageRef);
  });
}

function nodeHasTextContent(node) {
  if (node.type === 'TEXT') {
    return true;
  }
  return typeof node.characters === 'string' && Boolean(node.characters.trim());
}

function isExportableSvgCandidate(node, rootNodeId) {
  if (typeof node.id !== 'string' || node.id === rootNodeId) {
    return false;
  }
  if (typeof node.svgContent === 'string' && node.svgContent.trim()) {
    return true;
  }
  if (typeof node.type !== 'string' || !SVG_ELIGIBLE_NODE_TYPES.has(node.type)) {
    return false;
  }
  if (nodeHasTextContent(node) || nodeHasRasterPaint(node)) {
    return false;
  }
  const descendants = walkNodes(node).filter((descendant) => descendant !== node);
  if (DIRECT_SVG_NODE_TYPES.has(node.type)) {
    return true;
  }
  if (BASIC_VECTOR_NODE_TYPES.has(node.type) || descendants.length === 0) {
    return false;
  }
  return descendantTypesAllowSvgExport(descendants);
}

function descendantTypesAllowSvgExport(descendants) {
  const descendantTypes = new Set();
  for (const descendant of descendants) {
    if (!isValidSvgDescendant(descendant)) {
      return false;
    }
    descendantTypes.add(descendant.type);
  }
  return [...descendantTypes].some((type) => {
    return DIRECT_SVG_NODE_TYPES.has(type) || BASIC_VECTOR_NODE_TYPES.has(type);
  });
}

function isValidSvgDescendant(descendant) {
  if (typeof descendant.type !== 'string' || !SVG_ELIGIBLE_NODE_TYPES.has(descendant.type)) {
    return false;
  }
  if (nodeHasTextContent(descendant) || nodeHasRasterPaint(descendant)) {
    return false;
  }
  return !(typeof descendant.layoutMode === 'string' && descendant.layoutMode);
}

function collectSvgExportCandidates(document, rootNodeId) {
  const candidates = [];
  function visit(node) {
    if (isExportableSvgCandidate(node, rootNodeId)) {
      candidates.push({
        id: node.id,
        name: node.name,
        type: node.type,
        has_svg_content: typeof node.svgContent === 'string' && Boolean(node.svgContent.trim()),
        absolute_bounding_box: node.absoluteBoundingBox,
      });
      return;
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (isPlainObject(child)) {
          visit(child);
        }
      }
    }
  }
  visit(document);
  return candidates;
}

function nodeUsesRasterAsset(node) {
  if (typeof node.imageUrl === 'string' && node.imageUrl) {
    return true;
  }
  return nodeHasRasterPaint(node);
}

function summarizeBoundaryNode(node) {
  const descendants = walkNodes(node).filter((descendant) => descendant !== node);
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    layout_mode: node.layoutMode,
    child_count: Array.isArray(node.children) ? node.children.length : 0,
    absolute_bounding_box: node.absoluteBoundingBox,
    direct_raster_asset: nodeUsesRasterAsset(node),
    descendant_text_count: countDescendants(descendants, (descendant) => descendant.type === 'TEXT'),
    descendant_raster_count: countDescendants(descendants, nodeUsesRasterAsset),
    descendant_vector_count: countDescendants(descendants, isVectorLikeNode),
  };
}

function countDescendants(descendants, predicate) {
  return descendants.reduce((count, descendant) => {
    return predicate(descendant) ? count + 1 : count;
  }, 0);
}

function isVectorLikeNode(node) {
  return typeof node.type === 'string' && VECTOR_LIKE_TYPES.has(node.type);
}

function collectImplementationRegions(document) {
  if (!Array.isArray(document.children)) {
    return [];
  }
  const svgCandidateIds = new Set(
    collectSvgExportCandidates(document, document.id)
      .map((candidate) => candidate.id)
      .filter((id) => typeof id === 'string'),
  );
  return document.children
    .filter((child) => isImplementationRegion(child, svgCandidateIds))
    .map((child) => {
      const summary = summarizeBoundaryNode(child);
      summary.do_not_rasterize = true;
      summary.recommended_strategy = 'jsx-region';
      return summary;
    });
}

function isImplementationRegion(child, svgCandidateIds) {
  if (!isPlainObject(child)) {
    return false;
  }
  const childCount = Array.isArray(child.children) ? child.children.length : 0;
  if (childCount === 0 && nodeUsesRasterAsset(child)) {
    return false;
  }
  return !(childCount === 0 && typeof child.id === 'string' && svgCandidateIds.has(child.id));
}

function collectRasterAssetNodes(document) {
  return walkNodes(document)
    .filter(nodeUsesRasterAsset)
    .map((node) => {
      const summary = summarizeBoundaryNode(node);
      summary.recommended_strategy = 'leaf-image-asset';
      summary.is_leaf_asset = summary.child_count === 0;
      return summary;
    });
}

function collectTopLevelLayoutHints(document) {
  const root = readRootBounds(document);
  if (!root || !Array.isArray(document.children)) {
    return [];
  }
  return boundedChildren(document.children)
    .sort(compareNodeBounds)
    .reduce((state, child) => {
      const hint = buildLayoutHint(child, root, state.previousBottom);
      state.previousBottom = Math.max(state.previousBottom, hint.top + hint.height);
      state.hints.push(hint);
      return state;
    }, { previousBottom: 0, hints: [] }).hints;
}

function readRootBounds(document) {
  if (!isPlainObject(document.absoluteBoundingBox)) {
    return null;
  }
  const box = document.absoluteBoundingBox;
  const values = [box.x, box.y, box.width, box.height];
  if (!values.every((value) => typeof value === 'number')) {
    return null;
  }
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  };
}

function boundedChildren(children) {
  return children.filter((child) => {
    return isPlainObject(child) && isPlainObject(child.absoluteBoundingBox);
  });
}

function compareNodeBounds(leftNode, rightNode) {
  const leftBox = leftNode.absoluteBoundingBox;
  const rightBox = rightNode.absoluteBoundingBox;
  return (leftBox.y || 0) - (rightBox.y || 0) || (leftBox.x || 0) - (rightBox.x || 0);
}

function buildLayoutHint(child, root, previousBottom) {
  const box = child.absoluteBoundingBox;
  const left = (box.x || 0) - root.x;
  const top = (box.y || 0) - root.y;
  const width = box.width || 0;
  const height = box.height || 0;
  const rightInset = root.width - (left + width);
  const bottomInset = root.height - (top + height);
  return {
    id: child.id,
    name: child.name,
    type: child.type,
    left,
    top,
    width,
    height,
    right_inset: rightInset,
    bottom_inset: bottomInset,
    gap_from_previous: top - previousBottom,
    horizontal_alignment: resolveHorizontalAlignment(left, rightInset, width, root.width),
  };
}

function resolveHorizontalAlignment(left, rightInset, width, rootWidth) {
  if (Math.abs(left) <= 1 && Math.abs(width - rootWidth) <= 1) {
    return 'full-width';
  }
  if (Math.abs(left - rightInset) <= 1) {
    return 'centered';
  }
  if (Math.abs(rightInset) <= 1) {
    return 'flush-right';
  }
  if (Math.abs(left) <= 1) {
    return 'flush-left';
  }
  return 'custom';
}

function collectStats(document) {
  const nodes = walkNodes(document);
  const imageRefs = new Set();
  const nodeTypes = new Map();
  const embeddedImageNodes = [];
  const embeddedSvgNodes = [];
  const counter = { textNodes: 0, vectorNodes: 0 };
  const svgExportCandidates = collectSvgExportCandidates(document, document.id);
  const implementationRegions = collectImplementationRegions(document);
  const rasterAssetNodes = collectRasterAssetNodes(document);
  const topLevelLayoutHints = collectTopLevelLayoutHints(document);

  for (const node of nodes) {
    collectNodeTypeStats(node, nodeTypes, counter);
    collectImageRefs(node, imageRefs);
    collectEmbeddedImageNode(node, embeddedImageNodes);
    collectEmbeddedSvgNode(node, embeddedSvgNodes);
  }

  return {
    total_nodes: nodes.length,
    text_nodes: counter.textNodes,
    vector_like_nodes: counter.vectorNodes,
    image_fill_refs: [...imageRefs].sort(),
    embedded_image_url_count: embeddedImageNodes.length,
    embedded_image_url_nodes: embeddedImageNodes.slice(0, 20),
    embedded_svg_count: embeddedSvgNodes.length,
    embedded_svg_nodes: embeddedSvgNodes.slice(0, 20),
    svg_export_candidate_count: svgExportCandidates.length,
    svg_export_candidates: svgExportCandidates.slice(0, 50),
    implementation_region_count: implementationRegions.length,
    implementation_regions: implementationRegions.slice(0, 50),
    raster_asset_node_count: rasterAssetNodes.length,
    raster_asset_nodes: rasterAssetNodes.slice(0, 50),
    non_leaf_raster_asset_node_count: rasterAssetNodes.filter((node) => !node.is_leaf_asset).length,
    top_level_layout_hints: topLevelLayoutHints.slice(0, 50),
    node_types: Object.fromEntries([...nodeTypes.entries()].sort(([left], [right]) => left.localeCompare(right))),
  };
}

function collectNodeTypeStats(node, nodeTypes, counter) {
  if (typeof node.type !== 'string') {
    return;
  }
  nodeTypes.set(node.type, (nodeTypes.get(node.type) || 0) + 1);
  if (node.type === 'TEXT') {
    counter.textNodes += 1;
  }
  if (VECTOR_LIKE_TYPES.has(node.type)) {
    counter.vectorNodes += 1;
  }
}

function collectImageRefs(node, imageRefs) {
  for (const paint of iterPaints(node)) {
    if (typeof paint.imageRef === 'string' && paint.imageRef) {
      imageRefs.add(paint.imageRef);
    }
  }
}

function collectEmbeddedImageNode(node, embeddedImageNodes) {
  if (typeof node.imageUrl !== 'string' || !node.imageUrl) {
    return;
  }
  embeddedImageNodes.push({
    id: node.id,
    name: node.name,
    mime_type: parseDataUrlMimeType(node.imageUrl),
  });
}

function collectEmbeddedSvgNode(node, embeddedSvgNodes) {
  if (typeof node.svgContent !== 'string' || !node.svgContent.trim()) {
    return;
  }
  embeddedSvgNodes.push({
    id: node.id,
    name: node.name,
  });
}

function writeJson(payload, outputPath) {
  const content = JSON.stringify(payload, null, 2);
  if (!outputPath) {
    console.log(content);
    return;
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, 'utf8');
  console.log(`Wrote JSON summary to ${outputPath}`);
}

function buildSummary(jsonPath, args, documentInfo) {
  const implementationRegions = collectImplementationRegions(documentInfo.document);
  const rasterAssetNodes = collectRasterAssetNodes(documentInfo.document);
  const svgExportCandidates = collectSvgExportCandidates(documentInfo.document, documentInfo.document.id);
  return {
    input_path: jsonPath,
    selected_node_id: documentInfo.nodeId,
    source_format: documentInfo.sourceFormat,
    stats: collectStats(documentInfo.document),
    layout_hints: {
      root_bounds: documentInfo.document.absoluteBoundingBox,
      top_level_nodes: collectTopLevelLayoutHints(documentInfo.document),
    },
    asset_boundaries: {
      implementation_regions: implementationRegions,
      do_not_rasterize_region_ids: idsFrom(implementationRegions),
      raster_asset_nodes: rasterAssetNodes,
      leaf_raster_asset_node_ids: leafRasterIdsFrom(rasterAssetNodes),
      svg_asset_nodes: svgExportCandidates,
      svg_asset_node_ids: idsFrom(svgExportCandidates),
    },
    document: simplifyNode(documentInfo.document, 0, args.maxDepth),
  };
}

function idsFrom(nodes) {
  return nodes.map((node) => node.id).filter((id) => typeof id === 'string');
}

function leafRasterIdsFrom(nodes) {
  return nodes
    .filter((node) => node.is_leaf_asset)
    .map((node) => node.id)
    .filter((id) => typeof id === 'string');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const jsonPath = ensureAbsolutePath(args.jsonPath, 'Input JSON path');
  const outputPath = args.output ? ensureAbsolutePath(args.output, 'Output path') : undefined;
  const payload = loadJson(jsonPath);
  const documentInfo = resolveDocument(payload, args.nodeId);
  writeJson(buildSummary(jsonPath, args, documentInfo), outputPath);
}

main();
