#!/usr/bin/env node

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const tls = require('node:tls');

const BASE_URL = 'https://api.figma.com/v1';
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_RETRY_DELAY_MS = 5000;
const MAX_RATE_LIMIT_RETRIES = 3;
const SUPPORTED_PATH_ROOTS = new Set(['design', 'file', 'proto']);
const DIRECT_SVG_NODE_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON']);
const BASIC_VECTOR_NODE_TYPES = new Set(['ELLIPSE', 'LINE']);
const SVG_CONTAINER_TYPES = new Set(['GROUP', 'FRAME', 'COMPONENT', 'INSTANCE']);
const SVG_ELIGIBLE_NODE_TYPES = new Set([
  ...DIRECT_SVG_NODE_TYPES,
  ...BASIC_VECTOR_NODE_TYPES,
  ...SVG_CONTAINER_TYPES,
]);
const CONTENT_TYPE_TO_EXTENSION = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
};
const EXPORT_JSON_NAME = 'figma-api-export.json';
const ASSET_READINESS_NAME = 'asset-readiness.json';
const REQUEST_PLAN_NAME = 'request-plan.json';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    depth: undefined,
    renderFormat: 'png',
    renderScale: 2,
    skipRender: false,
    skipImageFills: false,
    forceRefresh: false,
    parseOnly: false,
  };
  const valueOptions = buildValueOptions();
  const flagOptions = buildFlagOptions();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (valueOptions[arg]) {
      index += 1;
      valueOptions[arg](args, readOptionValue(argv, index, arg));
      continue;
    }
    if (flagOptions[arg]) {
      flagOptions[arg](args);
      continue;
    }
    fail(`Unknown argument: ${arg}`);
  }

  if (!args.figmaUrl) {
    fail('Missing --figma-url.');
  }
  if (!['png', 'jpg', 'svg', 'pdf'].includes(args.renderFormat)) {
    fail('--render-format must be one of png, jpg, svg, or pdf.');
  }
  if (args.depth !== undefined && !Number.isInteger(args.depth)) {
    fail('--depth must be an integer.');
  }
  if (!Number.isFinite(args.renderScale)) {
    fail('--render-scale must be a number.');
  }

  return args;
}

function buildValueOptions() {
  return {
    '--figma-url': (args, value) => {
      args.figmaUrl = value;
    },
    '--token': (args, value) => {
      args.token = value;
    },
    '--figma-proxy': (args, value) => {
      args.figmaProxy = value;
    },
    '--http-proxy': (args, value) => {
      args.figmaProxy = value;
    },
    '--node-id': (args, value) => {
      args.nodeId = value;
    },
    '--output-path': (args, value) => {
      args.outputPath = value;
    },
    '--output-dir': (args, value) => {
      args.outputDir = value;
    },
    '--depth': (args, value) => {
      args.depth = Number.parseInt(value, 10);
    },
    '--render-format': (args, value) => {
      args.renderFormat = value;
    },
    '--render-scale': (args, value) => {
      args.renderScale = Number.parseFloat(value);
    },
  };
}

function buildFlagOptions() {
  return {
    '--skip-render': (args) => {
      args.skipRender = true;
    },
    '--skip-image-fills': (args) => {
      args.skipImageFills = true;
    },
    '--force-refresh': (args) => {
      args.forceRefresh = true;
    },
    '--parse-only': (args) => {
      args.parseOnly = true;
    },
  };
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

function resolveOutputRoot(outputPathArg, outputDirArg) {
  const rawValue = outputPathArg || outputDirArg;
  if (!rawValue) {
    fail('Missing output path. Pass --output-path with an absolute file or directory path.');
  }

  const outputPath = ensureAbsolutePath(rawValue, 'Output path');
  const outputRoot = path.extname(outputPath) ? path.dirname(outputPath) : outputPath;
  fs.mkdirSync(outputRoot, { recursive: true });
  return outputRoot;
}

function resolveFigmaDataDir(outputRoot) {
  const figmaDataDir = path.join(outputRoot, 'figma-data');
  fs.mkdirSync(figmaDataDir, { recursive: true });
  return figmaDataDir;
}

function normalizeEnvKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function readEnvAlias(canonicalName) {
  const normalizedTarget = normalizeEnvKey(canonicalName);
  for (const [key, value] of Object.entries(process.env)) {
    if (normalizeEnvKey(key) === normalizedTarget) {
      return { found: true, value, key };
    }
  }
  return { found: false, value: undefined, key: undefined };
}

function resolveTokenValue(cliValue) {
  if (cliValue !== undefined) {
    return cliValue;
  }
  return readEnvAlias('figma_token').value;
}

function resolveProxyValue(cliValue) {
  if (cliValue !== undefined) {
    return { found: true, value: cliValue };
  }
  const env = readEnvAlias('figma_proxy');
  if (env.found) {
    return { found: true, value: env.value };
  }
  return { found: false, value: undefined };
}

function normalizeNodeId(nodeId) {
  if (nodeId === undefined || nodeId === null) {
    return undefined;
  }
  const normalized = decodeURIComponent(String(nodeId)).trim();
  return normalized ? normalized.replace(/-/g, ':') : undefined;
}

function parseFigmaTarget(figmaUrl, nodeOverride) {
  let parsed;
  try {
    parsed = new URL(figmaUrl);
  } catch (error) {
    fail(`Invalid Figma URL: ${figmaUrl}`);
  }

  if (!parsed.hostname.toLowerCase().includes('figma.com')) {
    fail(`Unsupported Figma URL host: ${parsed.host}`);
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    fail(`Unsupported Figma URL path: ${parsed.pathname}`);
  }

  const urlType = segments[0];
  if (!SUPPORTED_PATH_ROOTS.has(urlType)) {
    fail(`Unsupported Figma URL type. Expected a design/file/proto URL, received '${urlType}'.`);
  }

  let fileKey = segments[1];
  const isBranch = segments.length >= 4 && segments[2] === 'branch';
  if (isBranch) {
    fileKey = segments[3];
  }

  const nodeFromUrl = normalizeNodeId(parsed.searchParams.get('node-id'));
  const nodeFromOverride = normalizeNodeId(nodeOverride);
  const nodeId = nodeFromOverride || nodeFromUrl;
  if (!nodeId) {
    fail('No node id was found. Add node-id to the Figma URL or pass --node-id 1:2.');
  }

  return { figmaUrl, fileKey, nodeId, urlType, isBranch };
}

function buildEndpoint(endpointPath, params) {
  const url = new URL(`${BASE_URL}${endpointPath}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function buildHeaders(token) {
  return {
    'X-Figma-Token': token,
    'User-Agent': 'codex-leon-figma/1.0',
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function proxyAuthHeader(proxyUrl) {
  if (!proxyUrl.username && !proxyUrl.password) {
    return undefined;
  }
  return `Basic ${Buffer.from(`${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`).toString('base64')}`;
}

function directRequestBuffer(urlString, headers) {
  return new Promise((resolve, reject) => {
    const target = new URL(urlString);
    const client = target.protocol === 'http:' ? http : https;
    const request = client.request(
      target,
      { method: 'GET', headers, timeout: DEFAULT_TIMEOUT },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode || 0,
            headers: response.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    request.on('timeout', () => request.destroy(new Error(`Request timed out: ${urlString}`)));
    request.on('error', reject);
    request.end();
  });
}

function proxiedHttpsRequestBuffer(urlString, headers, proxyValue) {
  return new Promise((resolve, reject) => {
    const target = new URL(urlString);
    const proxy = new URL(proxyValue);
    const proxyHeaders = { Host: `${target.hostname}:443` };
    const auth = proxyAuthHeader(proxy);
    if (auth) {
      proxyHeaders['Proxy-Authorization'] = auth;
    }

    const connectRequest = http.request({
      host: proxy.hostname,
      port: Number(proxy.port || 80),
      method: 'CONNECT',
      path: `${target.hostname}:443`,
      headers: proxyHeaders,
      timeout: DEFAULT_TIMEOUT,
    });

    connectRequest.on('connect', (response, socket) => {
      if (response.statusCode !== 200) {
        socket.destroy();
        reject(new Error(`Proxy CONNECT failed with status ${response.statusCode}`));
        return;
      }

      const secureSocket = tls.connect({ socket, servername: target.hostname });
      secureSocket.once('secureConnect', () => {
        const request = https.request(
          target,
          {
            method: 'GET',
            headers,
            timeout: DEFAULT_TIMEOUT,
            createConnection: () => secureSocket,
          },
          (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
              resolve({
                statusCode: res.statusCode || 0,
                headers: res.headers,
                body: Buffer.concat(chunks),
              });
            });
          },
        );
        request.on('timeout', () => request.destroy(new Error(`Request timed out: ${urlString}`)));
        request.on('error', reject);
        request.end();
      });
      secureSocket.on('error', reject);
    });

    connectRequest.on('timeout', () => connectRequest.destroy(new Error(`Proxy timed out: ${proxyValue}`)));
    connectRequest.on('error', reject);
    connectRequest.end();
  });
}

function proxiedHttpRequestBuffer(urlString, headers, proxyValue) {
  return new Promise((resolve, reject) => {
    const proxy = new URL(proxyValue);
    const proxyHeaders = { ...headers };
    const auth = proxyAuthHeader(proxy);
    if (auth) {
      proxyHeaders['Proxy-Authorization'] = auth;
    }
    const request = http.request(
      {
        host: proxy.hostname,
        port: Number(proxy.port || 80),
        method: 'GET',
        path: urlString,
        headers: proxyHeaders,
        timeout: DEFAULT_TIMEOUT,
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode || 0,
            headers: response.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    request.on('timeout', () => request.destroy(new Error(`Request timed out: ${urlString}`)));
    request.on('error', reject);
    request.end();
  });
}

function requestBuffer(urlString, headers, proxyValue) {
  if (proxyValue === undefined || proxyValue === null || String(proxyValue).trim() === '') {
    return directRequestBuffer(urlString, headers);
  }
  const target = new URL(urlString);
  if (target.protocol === 'https:') {
    return proxiedHttpsRequestBuffer(urlString, headers, proxyValue);
  }
  return proxiedHttpRequestBuffer(urlString, headers, proxyValue);
}

async function requestWithRetries(url, headers, proxyValue, kind) {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    let response;
    try {
      response = await requestBuffer(url, headers, proxyValue);
    } catch (error) {
      fail(`Network error while ${kind} ${url}: ${error.message}`);
    }

    if (response.statusCode === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const retryAfter = Number.parseFloat(response.headers['retry-after']);
      await sleep(Number.isFinite(retryAfter) ? Math.max(retryAfter * 1000, DEFAULT_RETRY_DELAY_MS) : DEFAULT_RETRY_DELAY_MS);
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      fail(`Figma API request failed (${response.statusCode}) for ${url}: ${response.body.toString('utf8')}`);
    }

    return response;
  }
  fail(`Figma API request failed after retries for ${url}`);
}

async function requestJson(url, headers, proxyValue) {
  const response = await requestWithRetries(url, headers, proxyValue, 'requesting');
  try {
    const data = JSON.parse(response.body.toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      fail(`Figma API response was not an object for ${url}`);
    }
    return data;
  } catch (error) {
    fail(`Figma API response was not valid JSON for ${url}: ${error.message}`);
  }
}

async function downloadBinary(url, proxyValue) {
  const response = await requestWithRetries(url, {}, proxyValue, 'downloading');
  return {
    content: response.body,
    contentType: Array.isArray(response.headers['content-type'])
      ? response.headers['content-type'][0]
      : response.headers['content-type'],
  };
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return undefined;
  }
}

function discoverLocalFigmaArtifacts(outputRoot) {
  const artifacts = [];
  function visit(directory) {
    if (!fs.existsSync(directory)) {
      return;
    }
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!fullPath.split(path.sep).includes('figma-data')) {
        continue;
      }
      if (entry.name === REQUEST_PLAN_NAME) {
        continue;
      }
      artifacts.push(path.relative(outputRoot, fullPath));
    }
  }
  visit(outputRoot);
  return [...new Set(artifacts)].sort();
}

function extractSelectedDocument(nodesPayload, nodeId) {
  const nodes = nodesPayload.nodes;
  if (!nodes || typeof nodes !== 'object') {
    fail('The nodes response did not contain a nodes object.');
  }
  const nodeEntry = nodes[nodeId];
  if (!nodeEntry || typeof nodeEntry !== 'object') {
    fail(`The nodes response did not contain an entry for node id ${nodeId}.`);
  }
  if (!nodeEntry.document || typeof nodeEntry.document !== 'object') {
    fail(`The nodes response entry for ${nodeId} did not contain a document.`);
  }
  return nodeEntry.document;
}

function walkNodes(node, out = []) {
  out.push(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (child && typeof child === 'object') {
        walkNodes(child, out);
      }
    }
  }
  return out;
}

function iterPaints(node) {
  const paints = [];
  for (const key of ['fills', 'strokes']) {
    if (Array.isArray(node[key])) {
      paints.push(...node[key].filter((paint) => paint && typeof paint === 'object'));
    }
  }
  return paints;
}

function collectImageRefs(document) {
  const refs = new Set();
  for (const node of walkNodes(document)) {
    for (const paint of iterPaints(node)) {
      if (typeof paint.imageRef === 'string' && paint.imageRef) {
        refs.add(paint.imageRef);
      }
    }
  }
  return [...refs].sort();
}

function nodeHasRasterPaint(node) {
  return iterPaints(node).some((paint) => paint.type === 'IMAGE' || (typeof paint.imageRef === 'string' && paint.imageRef));
}

function nodeHasTextContent(node) {
  return node.type === 'TEXT' || (typeof node.characters === 'string' && node.characters.trim());
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

  const descendantTypes = new Set();
  for (const descendant of descendants) {
    if (typeof descendant.type !== 'string' || !SVG_ELIGIBLE_NODE_TYPES.has(descendant.type)) {
      return false;
    }
    descendantTypes.add(descendant.type);
    if (nodeHasTextContent(descendant) || nodeHasRasterPaint(descendant)) {
      return false;
    }
    if (typeof descendant.layoutMode === 'string' && descendant.layoutMode) {
      return false;
    }
  }

  return [...descendantTypes].some((type) => DIRECT_SVG_NODE_TYPES.has(type) || BASIC_VECTOR_NODE_TYPES.has(type));
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
        absolute_bounding_box: node.absoluteBoundingBox && typeof node.absoluteBoundingBox === 'object' ? node.absoluteBoundingBox : null,
        node_payload: node,
      });
      return;
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (child && typeof child === 'object') {
          visit(child);
        }
      }
    }
  }
  visit(document);
  return candidates;
}

function extractImageFillLookup(payload) {
  const images = payload.images || (payload.meta && payload.meta.images);
  if (!images || typeof images !== 'object') {
    return {};
  }
  return Object.fromEntries(Object.entries(images).filter(([key, value]) => typeof key === 'string' && typeof value === 'string' && value));
}

function chunked(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function sanitizeFilename(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+|[._]+$/g, '') || 'asset';
}

function guessExtension(url, contentType) {
  if (contentType) {
    const normalized = contentType.split(';', 1)[0].trim().toLowerCase();
    if (CONTENT_TYPE_TO_EXTENSION[normalized]) {
      return CONTENT_TYPE_TO_EXTENSION[normalized];
    }
  }
  const ext = path.extname(new URL(url).pathname);
  return ext || '.bin';
}

function exportPayloadHasSvgMetadata(payload) {
  return Array.isArray(payload.downloaded_svg_assets) &&
    Array.isArray(payload.svg_export_candidates) &&
    payload.asset_readiness &&
    typeof payload.asset_readiness === 'object' &&
    Object.prototype.hasOwnProperty.call(payload.asset_readiness, 'unresolved_svg_node_ids');
}

function buildRequestPlan(target, outputRoot, figmaDataDir, args) {
  const nodesUrl = buildEndpoint(`/files/${target.fileKey}/nodes`, {
    ids: target.nodeId,
    geometry: 'paths',
    depth: args.depth,
  });
  const renderUrl = args.skipRender ? null : buildEndpoint(`/images/${target.fileKey}`, {
    ids: target.nodeId,
    format: args.renderFormat,
    scale: args.renderScale,
  });
  const imageFillUrl = args.skipImageFills ? null : buildEndpoint(`/files/${target.fileKey}/images`);
  const requestPlan = {
    figma_url: target.figmaUrl,
    url_type: target.urlType,
    file_key: target.fileKey,
    node_id: target.nodeId,
    is_branch_url: target.isBranch,
    output_root: outputRoot,
    figma_data_dir: figmaDataDir,
    persisted_export_path: path.join(figmaDataDir, EXPORT_JSON_NAME),
    endpoints: {
      nodes: nodesUrl,
      render: renderUrl,
      image_fills: imageFillUrl,
      svg_renders: buildEndpoint(`/images/${target.fileKey}`, { ids: '<svg-node-ids>', format: 'svg' }),
    },
  };
  writeJson(path.join(figmaDataDir, REQUEST_PLAN_NAME), requestPlan);
  return requestPlan;
}

async function downloadPreviewImage(renderedImages, target, figmaDataDir, renderFormat, proxyValue) {
  const imageUrl = renderedImages.images && renderedImages.images[target.nodeId];
  if (typeof imageUrl !== 'string' || !imageUrl) {
    return null;
  }
  const { content, contentType } = await downloadBinary(imageUrl, proxyValue);
  let extension = guessExtension(imageUrl, contentType);
  if (renderFormat === 'svg' && extension === '.bin') {
    extension = '.svg';
  }
  const previewPath = path.join(figmaDataDir, `node-preview${extension}`);
  fs.writeFileSync(previewPath, content);
  return previewPath;
}

async function downloadImageFillAssets(imageFillMap, figmaDataDir, proxyValue) {
  const manifest = [];
  const assetDir = path.join(figmaDataDir, 'image-fills');
  fs.mkdirSync(assetDir, { recursive: true });
  for (const [imageRef, url] of Object.entries(imageFillMap).sort()) {
    const { content, contentType } = await downloadBinary(url, proxyValue);
    const assetPath = path.join(assetDir, `${sanitizeFilename(imageRef)}${guessExtension(url, contentType)}`);
    fs.writeFileSync(assetPath, content);
    manifest.push({ image_ref: imageRef, url, content_type: contentType, path: assetPath });
  }
  return manifest;
}

async function downloadSvgAssets(svgExportCandidates, target, headers, figmaDataDir, proxyValue) {
  const manifest = [];
  const unresolvedNodeIds = [];
  const assetDir = path.join(figmaDataDir, 'svg-assets');
  fs.mkdirSync(assetDir, { recursive: true });
  const candidateById = new Map(svgExportCandidates.filter((candidate) => typeof candidate.id === 'string').map((candidate) => [candidate.id, candidate]));
  const renderableIds = [];
  const svgRenderLookup = {};

  for (const candidate of svgExportCandidates) {
    const nodeId = candidate.id;
    if (typeof nodeId !== 'string') {
      continue;
    }
    const svgContent = candidate.node_payload && candidate.node_payload.svgContent;
    if (candidate.has_svg_content && typeof svgContent === 'string' && svgContent.trim()) {
      const assetPath = path.join(assetDir, `${sanitizeFilename(nodeId)}__${sanitizeFilename(candidate.name || 'svg-asset')}.svg`);
      fs.writeFileSync(assetPath, svgContent, 'utf8');
      manifest.push({ node_id: nodeId, name: candidate.name, type: candidate.type, source: 'svgContent', path: assetPath });
      continue;
    }
    renderableIds.push(nodeId);
  }

  for (const batch of chunked(renderableIds, 50)) {
    const payload = await requestJson(buildEndpoint(`/images/${target.fileKey}`, {
      ids: batch.join(','),
      format: 'svg',
    }), headers, proxyValue);
    if (payload.images && typeof payload.images === 'object') {
      for (const [nodeId, url] of Object.entries(payload.images)) {
        if (typeof url === 'string' && url) {
          svgRenderLookup[nodeId] = url;
        }
      }
    }
  }

  writeJson(path.join(figmaDataDir, 'svg-renders.json'), { images: svgRenderLookup });

  for (const nodeId of renderableIds) {
    const candidate = candidateById.get(nodeId) || {};
    const svgUrl = svgRenderLookup[nodeId];
    if (!svgUrl) {
      unresolvedNodeIds.push(nodeId);
      continue;
    }
    const { content, contentType } = await downloadBinary(svgUrl, proxyValue);
    let extension = guessExtension(svgUrl, contentType);
    if (extension === '.bin') {
      extension = '.svg';
    }
    const assetPath = path.join(assetDir, `${sanitizeFilename(nodeId)}__${sanitizeFilename(candidate.name || 'svg-asset')}${extension}`);
    fs.writeFileSync(assetPath, content);
    manifest.push({
      node_id: nodeId,
      name: candidate.name,
      type: candidate.type,
      source: 'images-svg-render',
      url: svgUrl,
      content_type: contentType,
      path: assetPath,
    });
  }

  return { manifest, unresolvedNodeIds };
}

function prepareContext(args) {
  const outputRoot = resolveOutputRoot(args.outputPath, args.outputDir);
  const figmaDataDir = resolveFigmaDataDir(outputRoot);
  const target = parseFigmaTarget(args.figmaUrl, args.nodeId);
  return {
    args,
    outputRoot,
    figmaDataDir,
    existingLocalArtifacts: discoverLocalFigmaArtifacts(outputRoot),
    target,
    requestPlan: buildRequestPlan(target, outputRoot, figmaDataDir, args),
  };
}

function printParseOnlyResult(figmaDataDir) {
  console.log(`Wrote request plan to ${path.join(figmaDataDir, REQUEST_PLAN_NAME)}`);
}

function tryReuseExistingExport(context) {
  const exportPath = path.join(context.figmaDataDir, EXPORT_JSON_NAME);
  const existingExport = context.args.forceRefresh ? undefined : readJsonIfExists(exportPath);
  if (!existingExport || !exportPayloadHasSvgMetadata(existingExport)) {
    return false;
  }
  const readiness = existingExport.asset_readiness;
  console.log(JSON.stringify({
    reused_persisted_json: true,
    export_path: exportPath,
    figma_data_dir: context.figmaDataDir,
    node_id: (existingExport.source && existingExport.source.node_id) || context.target.nodeId,
    file_key: (existingExport.source && existingExport.source.file_key) || context.target.fileKey,
    asset_readiness_path: path.join(context.figmaDataDir, ASSET_READINESS_NAME),
    downloaded_svg_assets: Array.isArray(existingExport.downloaded_svg_assets) ? existingExport.downloaded_svg_assets.length : 0,
    ready_for_implementation: readiness && readiness.ready_for_implementation,
  }, null, 2));
  return true;
}

function ensureFreshFetchAllowed(context) {
  if (context.existingLocalArtifacts.length === 0 || context.args.forceRefresh) {
    return;
  }
  fail(`Local persisted Figma artifacts already exist under the output path, but no reusable figma-api-export.json with SVG readiness metadata was found. Refusing to call the Figma REST API automatically. Inspect or repair the local artifacts, or rerun with --force-refresh if you explicitly want a fresh fetch. Found artifacts: ${context.existingLocalArtifacts.join(', ')}`);
}

function resolveAuth(args) {
  const token = resolveTokenValue(args.token);
  if (!token) {
    fail('Missing Figma token. Pass --token, or set an environment variable whose name matches figma_token case-insensitively, such as FIGMA_TOKEN, figma_token, or figmaToken.');
  }

  const proxy = resolveProxyValue(args.figmaProxy);
  if (!proxy.found) {
    fail('Missing Figma proxy setting. Pass --figma-proxy, set an environment variable whose name matches figma_proxy case-insensitively, such as FIGMA_PROXY, figma_proxy, or figmaProxy, or explicitly pass --figma-proxy "" for direct access.');
  }

  return {
    headers: buildHeaders(token),
    proxy,
  };
}

async function fetchRenderedPreview(context, auth) {
  if (!context.requestPlan.endpoints.render) {
    return {
      renderedImages: {},
      previewPath: null,
      renderImageUrl: null,
    };
  }

  const renderedImages = await requestJson(context.requestPlan.endpoints.render, auth.headers, auth.proxy.value);
  writeJson(path.join(context.figmaDataDir, 'rendered-images.json'), renderedImages);
  return {
    renderedImages,
    previewPath: await downloadPreviewImage(renderedImages, context.target, context.figmaDataDir, context.args.renderFormat, auth.proxy.value),
    renderImageUrl: readRenderedImageUrl(renderedImages, context.target.nodeId),
  };
}

function readRenderedImageUrl(renderedImages, nodeId) {
  if (!renderedImages.images || typeof renderedImages.images[nodeId] !== 'string') {
    return null;
  }
  return renderedImages.images[nodeId];
}

async function fetchImageFills(context, auth, usedImageRefs) {
  let filteredImageFillMap = {};
  let unresolvedImageRefs = [...usedImageRefs];
  if (context.requestPlan.endpoints.image_fills && usedImageRefs.length > 0) {
    const imageFillResponse = await requestJson(context.requestPlan.endpoints.image_fills, auth.headers, auth.proxy.value);
    writeJson(path.join(context.figmaDataDir, 'raw-image-fills-response.json'), imageFillResponse);
    const imageMap = extractImageFillLookup(imageFillResponse);
    filteredImageFillMap = Object.fromEntries(usedImageRefs.filter((ref) => typeof imageMap[ref] === 'string' && imageMap[ref]).map((ref) => [ref, imageMap[ref]]));
    unresolvedImageRefs = usedImageRefs.filter((ref) => !filteredImageFillMap[ref]);
  }

  writeJson(path.join(context.figmaDataDir, 'image-fill-map.json'), { used_image_refs: usedImageRefs, images: filteredImageFillMap });
  const downloadedImageFills = await downloadImageFillAssets(filteredImageFillMap, context.figmaDataDir, auth.proxy.value);
  writeJson(path.join(context.figmaDataDir, 'downloaded-image-fills.json'), { files: downloadedImageFills });
  return {
    filteredImageFillMap,
    downloadedImageFills,
    unresolvedImageRefs,
  };
}

async function fetchSvgAssets(context, auth, svgExportCandidates) {
  if (svgExportCandidates.length === 0) {
    writeJson(path.join(context.figmaDataDir, 'svg-renders.json'), { images: {} });
    writeJson(path.join(context.figmaDataDir, 'downloaded-svg-assets.json'), { files: [] });
    return {
      downloadedSvgAssets: [],
      unresolvedSvgNodeIds: [],
    };
  }

  const svgResult = await downloadSvgAssets(svgExportCandidates, context.target, auth.headers, context.figmaDataDir, auth.proxy.value);
  writeJson(path.join(context.figmaDataDir, 'downloaded-svg-assets.json'), { files: svgResult.manifest });
  return {
    downloadedSvgAssets: svgResult.manifest,
    unresolvedSvgNodeIds: svgResult.unresolvedNodeIds,
  };
}

function buildAssetReadiness(renderAssets, imageFillAssets, svgAssets, usedImageRefs, persistedSvgCandidates) {
  const readyForImplementation = Boolean(renderAssets.previewPath) &&
    imageFillAssets.unresolvedImageRefs.length === 0 &&
    svgAssets.unresolvedSvgNodeIds.length === 0;
  return {
    ready_for_implementation: readyForImplementation,
    has_rendered_preview: Boolean(renderAssets.previewPath),
    render_image_url: renderAssets.renderImageUrl,
    used_image_refs: usedImageRefs,
    resolved_image_refs: Object.keys(imageFillAssets.filteredImageFillMap).sort(),
    unresolved_image_refs: imageFillAssets.unresolvedImageRefs,
    downloaded_image_fill_count: imageFillAssets.downloadedImageFills.length,
    svg_candidate_node_ids: persistedSvgCandidates.filter((candidate) => typeof candidate.id === 'string').map((candidate) => candidate.id),
    resolved_svg_node_ids: svgAssets.downloadedSvgAssets.filter((asset) => typeof asset.node_id === 'string').map((asset) => asset.node_id),
    unresolved_svg_node_ids: svgAssets.unresolvedSvgNodeIds,
    downloaded_svg_asset_count: svgAssets.downloadedSvgAssets.length,
    notes: buildReadinessNotes(renderAssets.previewPath, imageFillAssets.unresolvedImageRefs, svgAssets.unresolvedSvgNodeIds),
  };
}

function buildReadinessNotes(previewPath, unresolvedImageRefs, unresolvedSvgNodeIds) {
  const notes = [];
  if (!previewPath) {
    notes.push('Rendered preview is missing.');
  }
  if (unresolvedImageRefs.length) {
    notes.push('Some referenced image fills could not be resolved through the Figma REST API.');
  }
  if (unresolvedSvgNodeIds.length) {
    notes.push('Some exportable vector nodes could not be exported as standalone SVG assets.');
  }
  return notes;
}

function buildExportPayload(context, auth, fetched, assetReadiness) {
  return {
    source: {
      figma_url: context.target.figmaUrl,
      file_key: context.target.fileKey,
      node_id: context.target.nodeId,
      is_branch_url: context.target.isBranch,
      fetched_at: new Date().toISOString(),
      figma_data_dir: context.figmaDataDir,
      preview_image_path: fetched.renderAssets.previewPath,
      image_fill_asset_count: fetched.imageFillAssets.downloadedImageFills.length,
      svg_asset_count: fetched.svgAssets.downloadedSvgAssets.length,
      asset_readiness_path: path.join(context.figmaDataDir, ASSET_READINESS_NAME),
      figma_proxy_configured: Boolean(auth.proxy.value && auth.proxy.value.trim()),
    },
    payload: fetched.nodesPayload,
    rendered_images: fetched.renderAssets.renderedImages,
    used_image_refs: fetched.usedImageRefs,
    svg_export_candidates: fetched.persistedSvgCandidates,
    downloaded_image_fills: fetched.imageFillAssets.downloadedImageFills,
    downloaded_svg_assets: fetched.svgAssets.downloadedSvgAssets,
    asset_readiness: assetReadiness,
  };
}

function printFetchSummary(context, fetched, assetReadiness) {
  console.log(JSON.stringify({
    reused_persisted_json: false,
    node_id: context.target.nodeId,
    file_key: context.target.fileKey,
    used_image_refs: fetched.usedImageRefs.length,
    svg_export_candidates: fetched.persistedSvgCandidates.length,
    downloaded_image_fills: fetched.imageFillAssets.downloadedImageFills.length,
    downloaded_svg_assets: fetched.svgAssets.downloadedSvgAssets.length,
    unresolved_image_refs: fetched.imageFillAssets.unresolvedImageRefs,
    unresolved_svg_node_ids: fetched.svgAssets.unresolvedSvgNodeIds,
    preview_image_path: fetched.renderAssets.previewPath,
    export_path: path.join(context.figmaDataDir, EXPORT_JSON_NAME),
    figma_data_dir: context.figmaDataDir,
    asset_readiness_path: path.join(context.figmaDataDir, ASSET_READINESS_NAME),
    ready_for_implementation: assetReadiness.ready_for_implementation,
  }, null, 2));
}

async function fetchFigmaArtifacts(context, auth) {
  const nodesPayload = await requestJson(context.requestPlan.endpoints.nodes, auth.headers, auth.proxy.value);
  const document = extractSelectedDocument(nodesPayload, context.target.nodeId);
  const usedImageRefs = collectImageRefs(document);
  const svgExportCandidates = collectSvgExportCandidates(document, context.target.nodeId);
  const persistedSvgCandidates = svgExportCandidates.map(({ node_payload: _nodePayload, ...candidate }) => candidate);
  writeJson(path.join(context.figmaDataDir, 'svg-export-candidates.json'), { nodes: persistedSvgCandidates });
  return {
    nodesPayload,
    usedImageRefs,
    persistedSvgCandidates,
    renderAssets: await fetchRenderedPreview(context, auth),
    imageFillAssets: await fetchImageFills(context, auth, usedImageRefs),
    svgAssets: await fetchSvgAssets(context, auth, svgExportCandidates),
  };
}

async function runLiveFetch(context) {
  ensureFreshFetchAllowed(context);
  const auth = resolveAuth(context.args);
  const fetched = await fetchFigmaArtifacts(context, auth);
  const assetReadiness = buildAssetReadiness(
    fetched.renderAssets,
    fetched.imageFillAssets,
    fetched.svgAssets,
    fetched.usedImageRefs,
    fetched.persistedSvgCandidates,
  );
  writeJson(path.join(context.figmaDataDir, ASSET_READINESS_NAME), assetReadiness);
  writeJson(
    path.join(context.figmaDataDir, EXPORT_JSON_NAME),
    buildExportPayload(context, auth, fetched, assetReadiness),
  );
  printFetchSummary(context, fetched, assetReadiness);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = prepareContext(args);

  if (args.parseOnly) {
    printParseOnlyResult(context.figmaDataDir);
    return;
  }

  if (tryReuseExistingExport(context)) {
    return;
  }
  await runLiveFetch(context);
}

main().catch((error) => fail(error.stack || error.message));
