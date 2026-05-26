#!/usr/bin/env python3
"""Print per-file JaCoCo line coverage from jacoco.xml."""

from __future__ import annotations

import argparse
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SourceCoverage:
    package: str
    name: str
    covered: int
    missed: int
    missing_lines: tuple[int, ...]

    @property
    def source_path(self) -> str:
        return f"{self.package}/{self.name}" if self.package else self.name

    @property
    def total(self) -> int:
        return self.covered + self.missed

    @property
    def percent(self) -> float:
        return 100.0 if self.total == 0 else (self.covered / self.total) * 100


def normalize_target(target: str) -> str:
    normalized = target.replace("\\", "/")
    marker = "src/main/java/"
    if marker in normalized:
        normalized = normalized.split(marker, 1)[1]
    return normalized.lstrip("./")


def compress_ranges(lines: tuple[int, ...]) -> str:
    if not lines:
        return "none"

    ranges: list[str] = []
    start = previous = lines[0]
    for line in lines[1:]:
        if line == previous + 1:
            previous = line
            continue
        ranges.append(f"{start}-{previous}" if start != previous else str(start))
        start = previous = line
    ranges.append(f"{start}-{previous}" if start != previous else str(start))
    return ", ".join(ranges)


def read_coverage(xml_path: Path) -> list[SourceCoverage]:
    tree = ET.parse(xml_path)
    root = tree.getroot()
    rows: list[SourceCoverage] = []

    for package in root.findall(".//package"):
        package_name = package.get("name", "")
        for source_file in package.findall("sourcefile"):
            name = source_file.get("name", "")
            line_counter = source_file.find("./counter[@type='LINE']")
            if line_counter is None:
                covered = missed = 0
            else:
                covered = int(line_counter.get("covered", "0"))
                missed = int(line_counter.get("missed", "0"))

            missing_lines = tuple(
                int(line.get("nr", "0"))
                for line in source_file.findall("line")
                if int(line.get("mi", "0")) > 0 and int(line.get("ci", "0")) == 0
            )
            rows.append(SourceCoverage(package_name, name, covered, missed, missing_lines))

    return sorted(rows, key=lambda row: row.source_path)


def filter_rows(rows: list[SourceCoverage], targets: list[str]) -> tuple[list[SourceCoverage], list[str]]:
    if not targets:
        return rows, []

    selected: list[SourceCoverage] = []
    missing: list[str] = []

    for raw_target in targets:
        target = normalize_target(raw_target)
        matches = [
            row
            for row in rows
            if row.source_path == target or row.source_path.endswith(f"/{target}") or row.name == target
        ]
        if matches:
            selected.extend(matches)
        else:
            missing.append(raw_target)

    unique = {row.source_path: row for row in selected}
    return sorted(unique.values(), key=lambda row: row.source_path), missing


def print_table(rows: list[SourceCoverage]) -> None:
    print("| Coverage scope | Source file | Covered executable lines | Total executable lines | Coverage | Missing executable lines |")
    print("| --- | --- | ---: | ---: | ---: | --- |")
    for row in rows:
        print(
            "| Target file only "
            f"| {row.source_path} "
            f"| {row.covered} "
            f"| {row.total} "
            f"| {row.percent:.2f}% "
            f"| {compress_ranges(row.missing_lines)} |"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Print per-file line coverage from JaCoCo XML.")
    parser.add_argument("jacoco_xml", type=Path, help="Path to target/site/jacoco/jacoco.xml")
    parser.add_argument("targets", nargs="*", help="Optional source paths or filenames to filter")
    args = parser.parse_args()

    try:
        coverage_rows = read_coverage(args.jacoco_xml)
    except FileNotFoundError:
        print(f"JaCoCo XML not found: {args.jacoco_xml}", file=sys.stderr)
        return 2
    except ET.ParseError as exc:
        print(f"Invalid JaCoCo XML: {exc}", file=sys.stderr)
        return 2
    except OSError as exc:
        print(f"Cannot read JaCoCo XML: {exc}", file=sys.stderr)
        return 2

    rows, missing = filter_rows(coverage_rows, args.targets)
    if not rows:
        print("No matching JaCoCo source files found.", file=sys.stderr)
        return 1

    print_table(rows)
    if missing:
        print("\nMissing targets:", file=sys.stderr)
        for target in missing:
            print(f"- {target}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
