#!/usr/bin/env python3
"""Validate and summarize a local Figma REST API JSON file for React translation."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any, NoReturn

VECTOR_LIKE_TYPES = {
    "VECTOR",
    "BOOLEAN_OPERATION",
    "STAR",
    "LINE",
    "ELLIPSE",
    "POLYGON",
}


def parse_data_url_mime_type(value: str) -> str | None:
    if not value.startswith("data:"):
        return None

    header = value.split(",", 1)[0]
    mime_type = header[5:].split(";", 1)[0]
    return mime_type or None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate and summarize a local Figma REST API JSON file."
    )
    parser.add_argument("json_path", help="Absolute path to the input JSON file.")
    parser.add_argument(
        "--node-id",
        help="Optional node id when the JSON contains multiple candidate documents.",
    )
    parser.add_argument(
        "--max-depth",
        type=int,
        default=None,
        help="Optional maximum child depth for the summarized tree.",
    )
    parser.add_argument(
        "--output",
        help="Absolute path for the summarized JSON output.",
    )
    return parser.parse_args()


def fail(message: str) -> NoReturn:
    raise SystemExit(message)


def ensure_absolute_path(path_str: str, label: str) -> Path:
    path = Path(path_str)
    if not path.is_absolute():
        fail(f"{label} must be an absolute path: {path_str}")
    return path


def load_json(json_path: Path) -> dict[str, Any]:
    if not json_path.exists():
        fail(f"Input JSON file does not exist: {json_path}")
    if not json_path.is_file():
        fail(f"Input JSON path is not a file: {json_path}")

    try:
        payload = json.loads(json_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"Input JSON file is not valid JSON: {exc}")

    if not isinstance(payload, dict):
        fail("Unsupported Figma JSON shape: top-level value must be an object.")
    return payload


def extract_node_entry(node_entry: Any, node_id: str) -> dict[str, Any]:
    if not isinstance(node_entry, dict):
        fail(f"Node entry for {node_id} is not an object.")
    document = node_entry.get("document")
    if not isinstance(document, dict):
        fail(f"Node entry for {node_id} does not contain a document object.")
    return document


def resolve_document(
    payload: dict[str, Any], requested_node_id: str | None
) -> tuple[str | None, str, dict[str, Any]]:
    wrapped_payload = payload.get("payload")
    if isinstance(wrapped_payload, dict):
        return resolve_document(wrapped_payload, requested_node_id)

    nodes = payload.get("nodes")
    if isinstance(nodes, dict):
        if requested_node_id:
            if requested_node_id not in nodes:
                fail(f"Requested node id not found in JSON: {requested_node_id}")
            return (
                requested_node_id,
                "nodes",
                extract_node_entry(nodes[requested_node_id], requested_node_id),
            )

        candidates = []
        for node_id, node_entry in nodes.items():
            if isinstance(node_entry, dict) and isinstance(node_entry.get("document"), dict):
                candidates.append((node_id, node_entry["document"]))

        if not candidates:
            fail("The JSON contains a nodes object but no document entries.")
        if len(candidates) > 1:
            available = ", ".join(node_id for node_id, _ in candidates[:20])
            fail(
                "Multiple node documents were found. "
                f"Pass --node-id to select one. Available node ids: {available}"
            )

        node_id, document = candidates[0]
        return node_id, "nodes", document

    document = payload.get("document")
    if isinstance(document, dict):
        selected_node_id = requested_node_id or payload.get("node_id") or document.get("id")
        return selected_node_id, "document", document

    if isinstance(payload.get("name"), str) and isinstance(payload.get("type"), str):
        selected_node_id = requested_node_id or payload.get("id")
        return selected_node_id, "direct-node", payload

    fail(
        "Unsupported Figma JSON shape. Expected a top-level document, "
        "a payload.document, a nodes map, or a simplified top-level node."
    )


def simplify_paint(paint: dict[str, Any]) -> dict[str, Any]:
    keys = [
        "type",
        "visible",
        "opacity",
        "blendMode",
        "scaleMode",
        "imageRef",
        "color",
        "gradientStops",
    ]
    return {key: paint[key] for key in keys if key in paint}


def simplify_effect(effect: dict[str, Any]) -> dict[str, Any]:
    keys = [
        "type",
        "visible",
        "radius",
        "spread",
        "blendMode",
        "offset",
        "color",
    ]
    return {key: effect[key] for key in keys if key in effect}


def simplify_style(style: dict[str, Any]) -> dict[str, Any]:
    keys = [
        "fontFamily",
        "fontPostScriptName",
        "fontWeight",
        "fontSize",
        "textAlignHorizontal",
        "textAlignVertical",
        "letterSpacing",
        "lineHeightPx",
        "lineHeightPercent",
        "lineHeightPercentFontSize",
        "lineHeightUnit",
        "textCase",
        "textDecoration",
    ]
    return {key: style[key] for key in keys if key in style}


def simplify_node(
    node: dict[str, Any], depth: int = 0, max_depth: int | None = None
) -> dict[str, Any]:
    keys = [
        "id",
        "name",
        "type",
        "visible",
        "opacity",
        "blendMode",
        "clipsContent",
        "layoutMode",
        "primaryAxisSizingMode",
        "counterAxisSizingMode",
        "primaryAxisAlignItems",
        "counterAxisAlignItems",
        "itemSpacing",
        "layoutAlign",
        "layoutGrow",
        "layoutWrap",
        "paddingLeft",
        "paddingRight",
        "paddingTop",
        "paddingBottom",
        "cornerRadius",
        "topLeftRadius",
        "topRightRadius",
        "bottomLeftRadius",
        "bottomRightRadius",
        "strokeWeight",
        "strokeAlign",
        "strokeJoin",
        "strokeCap",
        "characters",
        "constraints",
        "componentPropertyDefinitions",
        "componentProperties",
        "overflowDirection",
    ]

    cleaned = {key: node[key] for key in keys if key in node}

    if "absoluteBoundingBox" in node:
        cleaned["absoluteBoundingBox"] = node["absoluteBoundingBox"]
    if "absoluteRenderBounds" in node:
        cleaned["absoluteRenderBounds"] = node["absoluteRenderBounds"]
    if "fills" in node:
        cleaned["fills"] = [
            simplify_paint(paint) for paint in node["fills"] if isinstance(paint, dict)
        ]
    if "strokes" in node:
        cleaned["strokes"] = [
            simplify_paint(paint) for paint in node["strokes"] if isinstance(paint, dict)
        ]
    if "effects" in node:
        cleaned["effects"] = [
            simplify_effect(effect)
            for effect in node["effects"]
            if isinstance(effect, dict)
        ]
    if "style" in node and isinstance(node["style"], dict):
        cleaned["style"] = simplify_style(node["style"])
    image_url = node.get("imageUrl")
    if isinstance(image_url, str) and image_url:
        cleaned["hasImageUrl"] = True
        mime_type = parse_data_url_mime_type(image_url)
        if mime_type:
            cleaned["imageUrlMimeType"] = mime_type
    svg_content = node.get("svgContent")
    if isinstance(svg_content, str) and svg_content.strip():
        cleaned["hasSvgContent"] = True

    children = node.get("children")
    if isinstance(children, list):
        cleaned["childCount"] = len(children)
        if max_depth is None or depth < max_depth:
            cleaned["children"] = [
                simplify_node(child, depth=depth + 1, max_depth=max_depth)
                for child in children
                if isinstance(child, dict)
            ]

    return cleaned


def walk_nodes(node: dict[str, Any]) -> list[dict[str, Any]]:
    nodes = [node]
    children = node.get("children")
    if isinstance(children, list):
        for child in children:
            if isinstance(child, dict):
                nodes.extend(walk_nodes(child))
    return nodes


def collect_stats(document: dict[str, Any]) -> dict[str, Any]:
    nodes = walk_nodes(document)
    node_types = Counter()
    image_refs: set[str] = set()
    text_nodes = 0
    vector_nodes = 0
    embedded_image_nodes: list[dict[str, Any]] = []
    embedded_svg_nodes: list[dict[str, Any]] = []

    for node in nodes:
        node_type = node.get("type")
        if isinstance(node_type, str):
            node_types[node_type] += 1
            if node_type == "TEXT":
                text_nodes += 1
            if node_type in VECTOR_LIKE_TYPES:
                vector_nodes += 1

        fills = node.get("fills")
        if isinstance(fills, list):
            for fill in fills:
                if not isinstance(fill, dict):
                    continue
                image_ref = fill.get("imageRef")
                if isinstance(image_ref, str) and image_ref:
                    image_refs.add(image_ref)

        image_url = node.get("imageUrl")
        if isinstance(image_url, str) and image_url:
            embedded_image_nodes.append(
                {
                    "id": node.get("id"),
                    "name": node.get("name"),
                    "mime_type": parse_data_url_mime_type(image_url),
                }
            )

        svg_content = node.get("svgContent")
        if isinstance(svg_content, str) and svg_content.strip():
            embedded_svg_nodes.append(
                {
                    "id": node.get("id"),
                    "name": node.get("name"),
                }
            )

    return {
        "total_nodes": len(nodes),
        "text_nodes": text_nodes,
        "vector_like_nodes": vector_nodes,
        "image_fill_refs": sorted(image_refs),
        "embedded_image_url_count": len(embedded_image_nodes),
        "embedded_image_url_nodes": embedded_image_nodes[:20],
        "embedded_svg_count": len(embedded_svg_nodes),
        "embedded_svg_nodes": embedded_svg_nodes[:20],
        "node_types": dict(sorted(node_types.items())),
    }


def write_json(payload: dict[str, Any], output_path: Path | None) -> None:
    content = json.dumps(payload, ensure_ascii=False, indent=2)
    if output_path is None:
        print(content)
        return

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    print(f"Wrote JSON summary to {output_path}")


def main() -> None:
    args = parse_args()
    json_path = ensure_absolute_path(args.json_path, "Input JSON path")
    output_path = ensure_absolute_path(args.output, "Output path") if args.output else None

    payload = load_json(json_path)
    node_id, source_format, document = resolve_document(payload, args.node_id)
    summary = {
        "input_path": str(json_path),
        "selected_node_id": node_id,
        "source_format": source_format,
        "stats": collect_stats(document),
        "document": simplify_node(document, max_depth=args.max_depth),
    }
    write_json(summary, output_path)


if __name__ == "__main__":
    main()
