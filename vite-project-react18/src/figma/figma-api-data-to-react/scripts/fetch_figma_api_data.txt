#!/usr/bin/env python3
"""Fetch a Figma node and persist the REST payload under <output>/figma-data."""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, NoReturn
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse, unquote
from urllib.request import ProxyHandler, Request, build_opener, urlopen

BASE_URL = "https://api.figma.com/v1"
DEFAULT_TIMEOUT = 60
DEFAULT_RETRY_DELAY_SECONDS = 5.0
MAX_RATE_LIMIT_RETRIES = 3
SUPPORTED_PATH_ROOTS = {"design", "file", "proto"}
DIRECT_SVG_NODE_TYPES = {"VECTOR", "BOOLEAN_OPERATION", "STAR", "POLYGON"}
BASIC_VECTOR_NODE_TYPES = {"ELLIPSE", "LINE"}
SVG_CONTAINER_TYPES = {"GROUP", "FRAME", "COMPONENT", "INSTANCE"}
SVG_ELIGIBLE_NODE_TYPES = DIRECT_SVG_NODE_TYPES | BASIC_VECTOR_NODE_TYPES | SVG_CONTAINER_TYPES
CONTENT_TYPE_TO_EXTENSION = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "application/pdf": ".pdf",
}
EXPORT_JSON_NAME = "figma-api-export.json"
ASSET_READINESS_NAME = "asset-readiness.json"


@dataclass(frozen=True)
class FigmaTarget:
    figma_url: str
    file_key: str
    node_id: str
    url_type: str
    is_branch: bool


def fail(message: str) -> NoReturn:
    raise SystemExit(message)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Fetch a Figma node through the Figma REST API and persist the result "
            "under <output-path>/figma-data."
        )
    )
    parser.add_argument(
        "--figma-url",
        required=True,
        help="Figma design/file URL. Prefer a URL that already contains node-id.",
    )
    parser.add_argument(
        "--token",
        help="Figma access token. Defaults to the FIGMA_TOKEN environment variable.",
    )
    parser.add_argument(
        "--figma-proxy",
        "--http-proxy",
        dest="figma_proxy",
        required=True,
        help=(
            "Figma proxy used for Figma REST API requests. "
            "Pass an empty string to explicitly disable proxy usage."
        ),
    )
    parser.add_argument(
        "--node-id",
        help="Override the node id when the URL does not include node-id.",
    )
    parser.add_argument(
        "--output-path",
        help=(
            "Absolute React output path. If it is a file path, figma-data is created "
            "next to that file. If it is a directory, figma-data is created inside it."
        ),
    )
    parser.add_argument(
        "--output-dir",
        help="Deprecated alias for --output-path.",
    )
    parser.add_argument(
        "--depth",
        type=int,
        default=None,
        help="Optional depth passed to GET /files/:key/nodes.",
    )
    parser.add_argument(
        "--render-format",
        choices=("png", "jpg", "svg", "pdf"),
        default="png",
        help="Rendered preview format for GET /images/:key.",
    )
    parser.add_argument(
        "--render-scale",
        type=float,
        default=2.0,
        help="Rendered preview scale for GET /images/:key.",
    )
    parser.add_argument(
        "--skip-render",
        action="store_true",
        help="Skip fetching the rendered preview image.",
    )
    parser.add_argument(
        "--skip-image-fills",
        action="store_true",
        help="Skip downloading image-fill assets used by the selected node.",
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Ignore the persisted figma-data JSON and fetch fresh data from the API.",
    )
    parser.add_argument(
        "--parse-only",
        action="store_true",
        help="Validate the URL and write request-plan.json without calling the API.",
    )
    return parser.parse_args()


def ensure_absolute_path(path_str: str, label: str) -> Path:
    path = Path(path_str)
    if not path.is_absolute():
        fail(f"{label} must be an absolute path: {path_str}")
    return path


def resolve_output_root(output_path_arg: str | None, output_dir_arg: str | None) -> Path:
    raw_value = output_path_arg or output_dir_arg
    if not raw_value:
        fail("Missing output path. Pass --output-path with an absolute file or directory path.")

    output_path = ensure_absolute_path(raw_value, "Output path")
    if output_path.suffix:
        output_root = output_path.parent
    else:
        output_root = output_path
    output_root.mkdir(parents=True, exist_ok=True)
    return output_root


def resolve_figma_data_dir(output_root: Path) -> Path:
    figma_data_dir = output_root / "figma-data"
    figma_data_dir.mkdir(parents=True, exist_ok=True)
    return figma_data_dir


def normalize_node_id(node_id: str | None) -> str | None:
    if node_id is None:
        return None
    normalized = unquote(node_id).strip()
    if not normalized:
        return None
    return normalized.replace("-", ":")


def parse_figma_target(figma_url: str, node_override: str | None) -> FigmaTarget:
    parsed = urlparse(figma_url)
    host = parsed.netloc.lower()
    if "figma.com" not in host:
        fail(f"Unsupported Figma URL host: {parsed.netloc}")

    segments = [segment for segment in parsed.path.split("/") if segment]
    if len(segments) < 2:
        fail(f"Unsupported Figma URL path: {parsed.path}")

    url_type = segments[0]
    if url_type not in SUPPORTED_PATH_ROOTS:
        fail(
            "Unsupported Figma URL type. Expected a design/file/proto URL, "
            f"received '{url_type}'."
        )

    file_key = segments[1]
    is_branch = len(segments) >= 4 and segments[2] == "branch"
    if is_branch:
        file_key = segments[3]

    query = parse_qs(parsed.query)
    node_from_url = normalize_node_id(query.get("node-id", [None])[0])
    node_from_override = normalize_node_id(node_override)
    node_id = node_from_override or node_from_url
    if not node_id:
        fail(
            "No node id was found. Add node-id to the Figma URL or pass --node-id 1:2."
        )

    return FigmaTarget(
        figma_url=figma_url,
        file_key=file_key,
        node_id=node_id,
        url_type=url_type,
        is_branch=is_branch,
    )


def build_headers(token: str) -> dict[str, str]:
    return {
        "X-Figma-Token": token,
        "User-Agent": "codex-figma-api-data-to-react/1.0",
    }


def build_url_opener(figma_proxy: str | None):
    if figma_proxy is None:
        return None

    normalized_proxy = figma_proxy.strip()
    if not normalized_proxy:
        return build_opener(ProxyHandler({}))

    return build_opener(
        ProxyHandler(
            {
                "http": normalized_proxy,
                "https": normalized_proxy,
            }
        )
    )


def build_endpoint(path: str, params: dict[str, Any] | None = None) -> str:
    if not params:
        return f"{BASE_URL}{path}"

    filtered = {
        key: value
        for key, value in params.items()
        if value is not None and value != ""
    }
    query_string = urlencode(filtered, doseq=True)
    if not query_string:
        return f"{BASE_URL}{path}"
    return f"{BASE_URL}{path}?{query_string}"


def request_json(
    url: str,
    headers: dict[str, str],
    opener=None,
) -> dict[str, Any]:
    request = Request(url, headers=headers, method="GET")
    for attempt in range(MAX_RATE_LIMIT_RETRIES + 1):
        try:
            open_fn = opener.open if opener is not None else urlopen
            with open_fn(request, timeout=DEFAULT_TIMEOUT) as response:
                payload = response.read().decode("utf-8")
            break
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if exc.code == 429 and attempt < MAX_RATE_LIMIT_RETRIES:
                retry_after = exc.headers.get("Retry-After") if exc.headers else None
                try:
                    delay = float(retry_after) if retry_after else DEFAULT_RETRY_DELAY_SECONDS
                except ValueError:
                    delay = DEFAULT_RETRY_DELAY_SECONDS
                time.sleep(max(delay, DEFAULT_RETRY_DELAY_SECONDS))
                continue
            fail(f"Figma API request failed ({exc.code}) for {url}: {body}")
        except URLError as exc:
            fail(f"Network error while requesting {url}: {exc}")

    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        fail(f"Figma API response was not valid JSON for {url}: {exc}")

    if not isinstance(data, dict):
        fail(f"Figma API response was not an object for {url}")
    return data


def extract_image_fill_lookup(payload: dict[str, Any]) -> dict[str, str]:
    top_level_images = payload.get("images")
    if isinstance(top_level_images, dict):
        return {
            key: value
            for key, value in top_level_images.items()
            if isinstance(key, str) and isinstance(value, str) and value
        }

    meta = payload.get("meta")
    if not isinstance(meta, dict):
        return {}

    meta_images = meta.get("images")
    if not isinstance(meta_images, dict):
        return {}

    return {
        key: value
        for key, value in meta_images.items()
        if isinstance(key, str) and isinstance(value, str) and value
    }


def download_binary(
    url: str,
    headers: dict[str, str] | None = None,
    opener=None,
) -> tuple[bytes, str | None]:
    request = Request(url, headers=headers or {}, method="GET")
    for attempt in range(MAX_RATE_LIMIT_RETRIES + 1):
        try:
            open_fn = opener.open if opener is not None else urlopen
            with open_fn(request, timeout=DEFAULT_TIMEOUT) as response:
                content = response.read()
                content_type = response.headers.get("Content-Type")
            break
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if exc.code == 429 and attempt < MAX_RATE_LIMIT_RETRIES:
                retry_after = exc.headers.get("Retry-After") if exc.headers else None
                try:
                    delay = float(retry_after) if retry_after else DEFAULT_RETRY_DELAY_SECONDS
                except ValueError:
                    delay = DEFAULT_RETRY_DELAY_SECONDS
                time.sleep(max(delay, DEFAULT_RETRY_DELAY_SECONDS))
                continue
            fail(f"Binary download failed ({exc.code}) for {url}: {body}")
        except URLError as exc:
            fail(f"Network error while downloading {url}: {exc}")

    return content, content_type


def extract_selected_document(nodes_payload: dict[str, Any], node_id: str) -> dict[str, Any]:
    nodes = nodes_payload.get("nodes")
    if not isinstance(nodes, dict):
        fail("The nodes response did not contain a nodes object.")

    node_entry = nodes.get(node_id)
    if not isinstance(node_entry, dict):
        fail(f"The nodes response did not contain an entry for node id {node_id}.")

    document = node_entry.get("document")
    if not isinstance(document, dict):
        fail(f"The nodes response entry for {node_id} did not contain a document.")

    return document


def walk_nodes(node: dict[str, Any]) -> Iterable[dict[str, Any]]:
    yield node
    children = node.get("children")
    if not isinstance(children, list):
        return
    for child in children:
        if isinstance(child, dict):
            yield from walk_nodes(child)


def collect_image_refs(document: dict[str, Any]) -> list[str]:
    image_refs: set[str] = set()
    for node in walk_nodes(document):
        for paint_key in ("fills", "strokes"):
            paints = node.get(paint_key)
            if not isinstance(paints, list):
                continue
            for paint in paints:
                if not isinstance(paint, dict):
                    continue
                image_ref = paint.get("imageRef")
                if isinstance(image_ref, str) and image_ref:
                    image_refs.add(image_ref)
    return sorted(image_refs)


def iter_paints(node: dict[str, Any]) -> Iterable[dict[str, Any]]:
    for paint_key in ("fills", "strokes"):
        paints = node.get(paint_key)
        if not isinstance(paints, list):
            continue
        for paint in paints:
            if isinstance(paint, dict):
                yield paint


def node_has_raster_paint(node: dict[str, Any]) -> bool:
    for paint in iter_paints(node):
        if paint.get("type") == "IMAGE":
            return True
        image_ref = paint.get("imageRef")
        if isinstance(image_ref, str) and image_ref:
            return True
    return False


def node_has_text_content(node: dict[str, Any]) -> bool:
    if node.get("type") == "TEXT":
        return True
    characters = node.get("characters")
    return isinstance(characters, str) and bool(characters.strip())


def is_exportable_svg_candidate(node: dict[str, Any], root_node_id: str) -> bool:
    node_id = node.get("id")
    if not isinstance(node_id, str) or node_id == root_node_id:
        return False

    svg_content = node.get("svgContent")
    if isinstance(svg_content, str) and svg_content.strip():
        return True

    node_type = node.get("type")
    if not isinstance(node_type, str) or node_type not in SVG_ELIGIBLE_NODE_TYPES:
        return False

    if node_has_text_content(node) or node_has_raster_paint(node):
        return False

    descendants = [descendant for descendant in walk_nodes(node) if descendant is not node]
    if node_type in DIRECT_SVG_NODE_TYPES:
        return True
    if node_type in BASIC_VECTOR_NODE_TYPES:
        return False
    if not descendants:
        return False

    descendant_types: set[str] = set()
    for descendant in descendants:
        descendant_type = descendant.get("type")
        if not isinstance(descendant_type, str):
            return False
        descendant_types.add(descendant_type)
        if descendant_type not in SVG_ELIGIBLE_NODE_TYPES:
            return False
        if node_has_text_content(descendant) or node_has_raster_paint(descendant):
            return False
        layout_mode = descendant.get("layoutMode")
        if isinstance(layout_mode, str) and layout_mode:
            return False

    return bool(descendant_types & (DIRECT_SVG_NODE_TYPES | BASIC_VECTOR_NODE_TYPES))


def collect_svg_export_candidates(document: dict[str, Any], root_node_id: str) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []

    def visit(node: dict[str, Any]) -> None:
        if is_exportable_svg_candidate(node, root_node_id):
            box = node.get("absoluteBoundingBox")
            candidates.append(
                {
                    "id": node.get("id"),
                    "name": node.get("name"),
                    "type": node.get("type"),
                    "has_svg_content": isinstance(node.get("svgContent"), str)
                    and bool(node.get("svgContent", "").strip()),
                    "absolute_bounding_box": box if isinstance(box, dict) else None,
                    "node_payload": node,
                }
            )
            return

        children = node.get("children")
        if not isinstance(children, list):
            return
        for child in children:
            if isinstance(child, dict):
                visit(child)

    visit(document)
    return candidates


def chunked(values: list[str], size: int) -> Iterable[list[str]]:
    for index in range(0, len(values), size):
        yield values[index : index + size]


def sanitize_filename(value: str) -> str:
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "_", value).strip("._")
    return sanitized or "asset"


def guess_extension(url: str, content_type: str | None) -> str:
    if content_type:
        normalized_type = content_type.split(";", 1)[0].strip().lower()
        extension = CONTENT_TYPE_TO_EXTENSION.get(normalized_type)
        if extension:
            return extension

    guessed = Path(urlparse(url).path).suffix
    if guessed:
        return guessed
    return ".bin"


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def load_existing_export(export_path: Path) -> dict[str, Any] | None:
    if not export_path.exists():
        return None

    try:
        payload = json.loads(export_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None

    if not isinstance(payload, dict):
        return None
    return payload


def export_payload_has_svg_metadata(payload: dict[str, Any]) -> bool:
    downloaded_svg_assets = payload.get("downloaded_svg_assets")
    svg_export_candidates = payload.get("svg_export_candidates")
    asset_readiness = payload.get("asset_readiness")

    if not isinstance(downloaded_svg_assets, list):
        return False
    if not isinstance(svg_export_candidates, list):
        return False
    if not isinstance(asset_readiness, dict):
        return False

    return "unresolved_svg_node_ids" in asset_readiness


def write_request_plan(
    *,
    target: FigmaTarget,
    output_root: Path,
    figma_data_dir: Path,
    depth: int | None,
    render_format: str,
    render_scale: float,
    skip_render: bool,
    skip_image_fills: bool,
) -> dict[str, Any]:
    nodes_url = build_endpoint(
        f"/files/{target.file_key}/nodes",
        {
            "ids": target.node_id,
            "geometry": "paths",
            "depth": depth,
        },
    )
    render_url = None
    if not skip_render:
        render_url = build_endpoint(
            f"/images/{target.file_key}",
            {
                "ids": target.node_id,
                "format": render_format,
                "scale": render_scale,
            },
        )

    image_fill_url = None
    if not skip_image_fills:
        image_fill_url = build_endpoint(f"/files/{target.file_key}/images")

    request_plan = {
        "figma_url": target.figma_url,
        "url_type": target.url_type,
        "file_key": target.file_key,
        "node_id": target.node_id,
        "is_branch_url": target.is_branch,
        "output_root": str(output_root),
        "figma_data_dir": str(figma_data_dir),
        "persisted_export_path": str(figma_data_dir / EXPORT_JSON_NAME),
        "endpoints": {
            "nodes": nodes_url,
            "render": render_url,
            "image_fills": image_fill_url,
            "svg_renders": build_endpoint(
                f"/images/{target.file_key}",
                {
                    "ids": "<svg-node-ids>",
                    "format": "svg",
                },
            ),
        },
    }
    write_json(figma_data_dir / "request-plan.json", request_plan)
    return request_plan


def download_preview_image(
    rendered_images: dict[str, Any],
    target: FigmaTarget,
    figma_data_dir: Path,
    render_format: str,
    opener=None,
) -> str | None:
    image_url = rendered_images.get("images", {}).get(target.node_id)
    if not isinstance(image_url, str) or not image_url:
        return None

    content, content_type = download_binary(image_url, opener=opener)
    extension = guess_extension(image_url, content_type)
    if render_format == "svg" and extension == ".bin":
        extension = ".svg"
    preview_path = figma_data_dir / f"node-preview{extension}"
    preview_path.write_bytes(content)
    return str(preview_path)


def download_image_fill_assets(
    image_fill_map: dict[str, str],
    figma_data_dir: Path,
    opener=None,
) -> list[dict[str, Any]]:
    manifest: list[dict[str, Any]] = []
    asset_dir = figma_data_dir / "image-fills"
    asset_dir.mkdir(parents=True, exist_ok=True)

    for image_ref, url in sorted(image_fill_map.items()):
        content, content_type = download_binary(url, opener=opener)
        extension = guess_extension(url, content_type)
        file_name = f"{sanitize_filename(image_ref)}{extension}"
        asset_path = asset_dir / file_name
        asset_path.write_bytes(content)
        manifest.append(
            {
                "image_ref": image_ref,
                "url": url,
                "content_type": content_type,
                "path": str(asset_path),
            }
        )

    return manifest


def download_svg_assets(
    *,
    svg_export_candidates: list[dict[str, Any]],
    target: FigmaTarget,
    headers: dict[str, str],
    figma_data_dir: Path,
    opener=None,
) -> tuple[list[dict[str, Any]], list[str]]:
    manifest: list[dict[str, Any]] = []
    unresolved_node_ids: list[str] = []
    asset_dir = figma_data_dir / "svg-assets"
    asset_dir.mkdir(parents=True, exist_ok=True)

    candidate_by_id = {
        candidate["id"]: candidate
        for candidate in svg_export_candidates
        if isinstance(candidate.get("id"), str)
    }

    renderable_ids: list[str] = []
    svg_render_lookup: dict[str, str] = {}

    for candidate in svg_export_candidates:
        node_id = candidate.get("id")
        if not isinstance(node_id, str):
            continue

        if candidate.get("has_svg_content"):
            node_payload = candidate.get("node_payload")
            svg_content = (
                node_payload.get("svgContent")
                if isinstance(node_payload, dict)
                else None
            )
            if isinstance(svg_content, str) and svg_content.strip():
                file_name = (
                    f"{sanitize_filename(node_id)}__"
                    f"{sanitize_filename(str(candidate.get('name') or 'svg-asset'))}.svg"
                )
                asset_path = asset_dir / file_name
                asset_path.write_text(svg_content, encoding="utf-8")
                manifest.append(
                    {
                        "node_id": node_id,
                        "name": candidate.get("name"),
                        "type": candidate.get("type"),
                        "source": "svgContent",
                        "path": str(asset_path),
                    }
                )
                continue

        renderable_ids.append(node_id)

    for batch in chunked(renderable_ids, 50):
        svg_render_payload = request_json(
            build_endpoint(
                f"/images/{target.file_key}",
                {
                    # Figma's images endpoint expects a single comma-separated ids value.
                    "ids": ",".join(batch),
                    "format": "svg",
                },
            ),
            headers=headers,
            opener=opener,
        )
        image_lookup = svg_render_payload.get("images")
        if isinstance(image_lookup, dict):
            for node_id, url in image_lookup.items():
                if isinstance(node_id, str) and isinstance(url, str) and url:
                    svg_render_lookup[node_id] = url

    write_json(figma_data_dir / "svg-renders.json", {"images": svg_render_lookup})

    for node_id in renderable_ids:
        candidate = candidate_by_id.get(node_id, {})
        svg_url = svg_render_lookup.get(node_id)
        if not svg_url:
            unresolved_node_ids.append(node_id)
            continue

        content, content_type = download_binary(svg_url, opener=opener)
        extension = guess_extension(svg_url, content_type)
        if extension == ".bin":
            extension = ".svg"
        file_name = (
            f"{sanitize_filename(node_id)}__"
            f"{sanitize_filename(str(candidate.get('name') or 'svg-asset'))}{extension}"
        )
        asset_path = asset_dir / file_name
        asset_path.write_bytes(content)
        manifest.append(
            {
                "node_id": node_id,
                "name": candidate.get("name"),
                "type": candidate.get("type"),
                "source": "images-svg-render",
                "url": svg_url,
                "content_type": content_type,
                "path": str(asset_path),
            }
        )

    return manifest, unresolved_node_ids


def print_summary(summary: dict[str, Any]) -> None:
    print(json.dumps(summary, ensure_ascii=False, indent=2))


def main() -> None:
    args = parse_args()
    output_root = resolve_output_root(args.output_path, args.output_dir)
    figma_data_dir = resolve_figma_data_dir(output_root)

    target = parse_figma_target(args.figma_url, args.node_id)
    request_plan = write_request_plan(
        target=target,
        output_root=output_root,
        figma_data_dir=figma_data_dir,
        depth=args.depth,
        render_format=args.render_format,
        render_scale=args.render_scale,
        skip_render=args.skip_render,
        skip_image_fills=args.skip_image_fills,
    )

    if args.parse_only:
        print(f"Wrote request plan to {figma_data_dir / 'request-plan.json'}")
        return

    export_path = figma_data_dir / EXPORT_JSON_NAME
    existing_export = None if args.force_refresh else load_existing_export(export_path)
    if existing_export is not None and export_payload_has_svg_metadata(existing_export):
        existing_readiness = existing_export.get("asset_readiness")
        summary = {
            "reused_persisted_json": True,
            "export_path": str(export_path),
            "figma_data_dir": str(figma_data_dir),
            "node_id": existing_export.get("source", {}).get("node_id", target.node_id),
            "file_key": existing_export.get("source", {}).get("file_key", target.file_key),
            "asset_readiness_path": str(figma_data_dir / ASSET_READINESS_NAME),
            "downloaded_svg_assets": len(existing_export.get("downloaded_svg_assets", [])),
            "ready_for_implementation": (
                existing_readiness.get("ready_for_implementation")
                if isinstance(existing_readiness, dict)
                else None
            ),
        }
        print_summary(summary)
        return

    token = args.token or os.environ.get("FIGMA_TOKEN")
    if not token:
        fail("Missing Figma token. Pass --token or set FIGMA_TOKEN.")

    headers = build_headers(token)
    opener = build_url_opener(args.figma_proxy)
    nodes_payload = request_json(
        request_plan["endpoints"]["nodes"],
        headers=headers,
        opener=opener,
    )
    document = extract_selected_document(nodes_payload, target.node_id)
    used_image_refs = collect_image_refs(document)
    svg_export_candidates = collect_svg_export_candidates(document, target.node_id)
    persisted_svg_candidates = [
        {
            key: value
            for key, value in candidate.items()
            if key != "node_payload"
        }
        for candidate in svg_export_candidates
    ]
    write_json(
        figma_data_dir / "svg-export-candidates.json",
        {"nodes": persisted_svg_candidates},
    )

    rendered_images: dict[str, Any] = {}
    preview_path: str | None = None
    render_image_url: str | None = None
    if request_plan["endpoints"]["render"]:
        rendered_images = request_json(
            request_plan["endpoints"]["render"],
            headers=headers,
            opener=opener,
        )
        write_json(figma_data_dir / "rendered-images.json", rendered_images)
        image_lookup = rendered_images.get("images")
        if isinstance(image_lookup, dict):
            raw_render_url = image_lookup.get(target.node_id)
            if isinstance(raw_render_url, str) and raw_render_url:
                render_image_url = raw_render_url
        preview_path = download_preview_image(
            rendered_images=rendered_images,
            target=target,
            figma_data_dir=figma_data_dir,
            render_format=args.render_format,
            opener=opener,
        )

    filtered_image_fill_map: dict[str, str] = {}
    downloaded_image_fills: list[dict[str, Any]] = []
    unresolved_image_refs = used_image_refs.copy()
    if request_plan["endpoints"]["image_fills"] and used_image_refs:
        image_fill_response = request_json(
            request_plan["endpoints"]["image_fills"],
            headers=headers,
            opener=opener,
        )
        write_json(figma_data_dir / "raw-image-fills-response.json", image_fill_response)
        image_map = extract_image_fill_lookup(image_fill_response)
        if image_map:
            filtered_image_fill_map = {
                image_ref: image_map[image_ref]
                for image_ref in used_image_refs
                if isinstance(image_map.get(image_ref), str) and image_map.get(image_ref)
            }
        unresolved_image_refs = [
            image_ref for image_ref in used_image_refs if image_ref not in filtered_image_fill_map
        ]
        write_json(
            figma_data_dir / "image-fill-map.json",
            {
                "used_image_refs": used_image_refs,
                "images": filtered_image_fill_map,
            },
        )
        downloaded_image_fills = download_image_fill_assets(
            image_fill_map=filtered_image_fill_map,
            figma_data_dir=figma_data_dir,
            opener=opener,
        )
        write_json(
            figma_data_dir / "downloaded-image-fills.json",
            {"files": downloaded_image_fills},
        )
    else:
        write_json(
            figma_data_dir / "image-fill-map.json",
            {
                "used_image_refs": used_image_refs,
                "images": filtered_image_fill_map,
            },
        )
        write_json(
            figma_data_dir / "downloaded-image-fills.json",
            {"files": downloaded_image_fills},
        )

    downloaded_svg_assets: list[dict[str, Any]] = []
    unresolved_svg_node_ids: list[str] = []
    if svg_export_candidates:
        downloaded_svg_assets, unresolved_svg_node_ids = download_svg_assets(
            svg_export_candidates=svg_export_candidates,
            target=target,
            headers=headers,
            figma_data_dir=figma_data_dir,
            opener=opener,
        )
    else:
        write_json(figma_data_dir / "svg-renders.json", {"images": {}})

    write_json(
        figma_data_dir / "downloaded-svg-assets.json",
        {"files": downloaded_svg_assets},
    )

    asset_readiness = {
        "ready_for_implementation": bool(preview_path)
        and not unresolved_image_refs
        and not unresolved_svg_node_ids,
        "has_rendered_preview": bool(preview_path),
        "render_image_url": render_image_url,
        "used_image_refs": used_image_refs,
        "resolved_image_refs": sorted(filtered_image_fill_map.keys()),
        "unresolved_image_refs": unresolved_image_refs,
        "downloaded_image_fill_count": len(downloaded_image_fills),
        "svg_candidate_node_ids": [
            candidate["id"]
            for candidate in persisted_svg_candidates
            if isinstance(candidate.get("id"), str)
        ],
        "resolved_svg_node_ids": [
            asset["node_id"]
            for asset in downloaded_svg_assets
            if isinstance(asset.get("node_id"), str)
        ],
        "unresolved_svg_node_ids": unresolved_svg_node_ids,
        "downloaded_svg_asset_count": len(downloaded_svg_assets),
        "notes": (
            []
            if bool(preview_path) and not unresolved_image_refs and not unresolved_svg_node_ids
            else [
                *(
                    ["Rendered preview is missing."]
                    if not preview_path
                    else []
                ),
                *(
                    [
                        "Some referenced image fills could not be resolved through the Figma REST API."
                    ]
                    if unresolved_image_refs
                    else []
                ),
                *(
                    [
                        "Some exportable vector nodes could not be exported as standalone SVG assets."
                    ]
                    if unresolved_svg_node_ids
                    else []
                ),
            ]
        ),
    }
    write_json(figma_data_dir / ASSET_READINESS_NAME, asset_readiness)

    export_payload = {
        "source": {
            "figma_url": target.figma_url,
            "file_key": target.file_key,
            "node_id": target.node_id,
            "is_branch_url": target.is_branch,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "figma_data_dir": str(figma_data_dir),
            "preview_image_path": preview_path,
            "image_fill_asset_count": len(downloaded_image_fills),
            "svg_asset_count": len(downloaded_svg_assets),
            "asset_readiness_path": str(figma_data_dir / ASSET_READINESS_NAME),
            "figma_proxy_configured": bool(args.figma_proxy and args.figma_proxy.strip()),
        },
        "payload": nodes_payload,
        "rendered_images": rendered_images,
        "used_image_refs": used_image_refs,
        "svg_export_candidates": persisted_svg_candidates,
        "downloaded_image_fills": downloaded_image_fills,
        "downloaded_svg_assets": downloaded_svg_assets,
        "asset_readiness": asset_readiness,
    }
    write_json(export_path, export_payload)

    summary = {
        "reused_persisted_json": False,
        "node_id": target.node_id,
        "file_key": target.file_key,
        "used_image_refs": len(used_image_refs),
        "svg_export_candidates": len(persisted_svg_candidates),
        "downloaded_image_fills": len(downloaded_image_fills),
        "downloaded_svg_assets": len(downloaded_svg_assets),
        "unresolved_image_refs": unresolved_image_refs,
        "unresolved_svg_node_ids": unresolved_svg_node_ids,
        "preview_image_path": preview_path,
        "export_path": str(export_path),
        "figma_data_dir": str(figma_data_dir),
        "asset_readiness_path": str(figma_data_dir / ASSET_READINESS_NAME),
        "ready_for_implementation": asset_readiness["ready_for_implementation"],
    }
    print_summary(summary)


if __name__ == "__main__":
    main()
