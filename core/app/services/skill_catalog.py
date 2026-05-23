from __future__ import annotations

import json
import re
import shlex
from pathlib import Path
from typing import Any

from app.core.settings import Settings
from app.schemas.skill import SkillAppliedItem, SkillItem

try:
    import yaml
except ImportError:  # pragma: no cover - optional dependency
    yaml = None


_BUILTIN_SKILLS = [
    SkillItem(
        id="test-case-writer",
        name="Test Case Writer",
        description="Turn requirements, acceptance criteria, or bugs into clear test cases.",
        content=(
            "When this skill is active, produce practical test coverage. Identify the "
            "feature under test, relevant preconditions, positive paths, edge cases, "
            "negative cases, and expected results. Prefer concise tables when the user "
            "asks for test cases. If the createTestCase tool is available and the user "
            "asks to generate or persist test cases, call it with the user's request."
        ),
        triggerKeywords=[
            "test",
            "测试",
            "test case",
            "用例",
            "qa",
            "验收",
            "acceptance",
        ],
        toolNames=["createTestCase"],
        tags=["QA", "Testing"],
        installCount=1840,
        trustLevel="reviewed",
    ),
    SkillItem(
        id="copy-deck-writer",
        name="Copy Deck Writer",
        description="Draft structured product or marketing copy decks from source material.",
        content=(
            "When this skill is active, write copy in a structured deck-friendly format. "
            "Extract audience, message hierarchy, required disclaimers, tone, and review "
            "notes. Keep copy crisp and label alternatives clearly. If copyTestResultUpdater is "
            "available and the user asks to generate a copy deck, use the tool."
        ),
        triggerKeywords=[
            "copy deck",
            "copydeck",
            "文案",
            "copy",
            "marketing",
            "campaign",
        ],
        toolNames=["copyTestResultUpdater"],
        tags=["Content", "Marketing"],
        installCount=1620,
        trustLevel="reviewed",
    ),
    SkillItem(
        id="presentation-planner",
        name="Presentation Planner",
        description="Create slide outlines, storylines, and presentation-ready structure.",
        content=(
            "When this skill is active, shape the answer as a presentation plan. Start "
            "from the audience and objective, propose a tight narrative, list slide-by-"
            "slide content, and call out charts or evidence needed. If createPpt is "
            "available and the user asks to create a PPT, call it."
        ),
        triggerKeywords=[
            "ppt",
            "powerpoint",
            "presentation",
            "slide",
            "演示",
            "幻灯片",
        ],
        toolNames=["createPpt"],
        tags=["Productivity", "Slides"],
        installCount=1390,
        trustLevel="reviewed",
    ),
    SkillItem(
        id="structured-output",
        name="Structured Output",
        description="Return concise, schema-like answers for downstream systems.",
        content=(
            "When this skill is active, produce structured output. Respect any schema "
            "provided by the user. If no schema is provided, use compact Markdown with "
            "stable headings or a JSON object when the user explicitly requests JSON. "
            "Avoid filler text and keep keys or headings consistent."
        ),
        triggerKeywords=[
            "json",
            "schema",
            "structured",
            "格式",
            "结构化",
            "table",
            "表格",
        ],
        tags=["Output"],
        installCount=2120,
        trustLevel="reviewed",
    ),
]


class SkillCatalogService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._cache: list[SkillItem] | None = None

    def list_skills(self, *, use_cache: bool = True) -> list[SkillItem]:
        if not self._settings.skills_enabled:
            return []

        if use_cache and self._cache is not None:
            return list(self._cache)

        skills_by_id = {skill.id: self._normalize_skill(skill) for skill in _BUILTIN_SKILLS}
        for skill in self._load_external_skills():
            skills_by_id[skill.id] = self._normalize_skill(skill)

        skills = sorted(
            [skill for skill in skills_by_id.values() if skill.enabled],
            key=lambda item: item.name.lower(),
        )
        self._cache = skills
        return list(skills)

    def resolve_skills(
        self,
        *,
        bound_skill_ids: list[str],
        requested_skill_ids: list[str],
        prompt: str,
    ) -> list[SkillAppliedItem]:
        skills_by_id = {skill.id: skill for skill in self.list_skills()}
        direct_invocation_ids = set(self._dedupe([*bound_skill_ids, *requested_skill_ids]))
        direct_invocation_skills = {
            skill_id: skill
            for skill_id, skill in skills_by_id.items()
            if skill_id in direct_invocation_ids
        }
        direct_invocations = self.extract_invocations(prompt, direct_invocation_skills)
        requested_ids = set(self._dedupe([*requested_skill_ids, *direct_invocations.keys()]))
        selected_ids = self._dedupe(
            [*direct_invocations.keys(), *requested_skill_ids, *bound_skill_ids]
        )
        applied: list[SkillAppliedItem] = []

        for skill_id in selected_ids:
            skill = skills_by_id.get(skill_id)
            if not skill:
                continue

            direct_arguments = direct_invocations.get(skill_id)
            forced = skill_id in requested_ids
            if direct_arguments is not None:
                reason = "direct invocation"
            elif forced:
                reason = "requested"
            elif skill.disable_model_invocation:
                continue
            elif self._matches_prompt(skill, prompt):
                reason = "matched description"
            else:
                continue

            applied.append(
                SkillAppliedItem(
                    id=skill.id,
                    name=skill.name,
                    description=skill.description,
                    reason=reason,
                    arguments=direct_arguments or "",
                    commandName=skill.command_name or skill.id,
                    toolNames=list(skill.tool_names),
                    allowedTools=list(skill.allowed_tools),
                )
            )

        return applied

    def get_skill_items(self, applied_skills: list[SkillAppliedItem]) -> list[SkillItem]:
        skills_by_id = {skill.id: skill for skill in self.list_skills()}
        return [
            skills_by_id[skill.id]
            for skill in applied_skills
            if skill.id in skills_by_id
        ]

    def build_instruction(
        self,
        system_prompt: str,
        skills: list[SkillItem],
        applied_skills: list[SkillAppliedItem] | None = None,
    ) -> str:
        if not skills:
            return system_prompt

        applied_by_id = {skill.id: skill for skill in applied_skills or []}
        sections = [
            system_prompt.strip(),
            (
                "Claude Code style skills have been invoked for this request. The full "
                "SKILL.md body is loaded only for the invoked skills below. Follow these "
                "skill instructions when relevant, while preserving higher-priority user "
                "and system instructions."
            ),
        ]
        for skill in skills:
            applied_skill = applied_by_id.get(skill.id)
            arguments = applied_skill.arguments if applied_skill else ""
            metadata: list[str] = []
            if skill.when_to_use:
                metadata.append("When to use: " + skill.when_to_use)
            if skill.trigger_keywords:
                metadata.append("Triggers: " + ", ".join(skill.trigger_keywords))
            if skill.allowed_tools:
                metadata.append("Allowed tools: " + ", ".join(skill.allowed_tools))
            if skill.tool_names:
                metadata.append("Application tool hints: " + ", ".join(skill.tool_names))
            if skill.source_path:
                metadata.append("Skill directory: " + str(Path(skill.source_path).parent))
            if arguments:
                metadata.append("Invocation arguments: " + arguments)

            skill_block = [
                (
                    f"<skill id=\"{skill.id}\" name=\"{skill.name}\" "
                    f"command=\"/{skill.command_name or skill.id}\">"
                ),
                f"Description: {skill.description}",
            ]
            if metadata:
                skill_block.append("\n".join(metadata))
            skill_block.extend(
                [
                    "Rendered SKILL.md:",
                    self._render_skill_content(skill, arguments),
                    "</skill>",
                ]
            )
            sections.append("\n".join(skill_block))

        return "\n\n".join(section for section in sections if section)

    def _load_external_skills(self) -> list[SkillItem]:
        skills: list[SkillItem] = []
        raw_path = self._settings.skills_catalog_path.strip()
        if raw_path:
            path = Path(raw_path).expanduser()
            if path.exists() and path.is_file():
                skills.extend(self._load_json_skills(path))
            elif path.exists():
                skills.extend(self._load_markdown_skills(path, "Local skill catalog"))

        for path, source in self._claude_skill_directories():
            if path.exists():
                skills.extend(self._load_markdown_skills(path, source))

        return skills

    def _load_json_skills(self, path: Path) -> list[SkillItem]:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return []

        raw_skills = payload.get("skills") if isinstance(payload, dict) else payload
        if not isinstance(raw_skills, list):
            return []

        skills: list[SkillItem] = []
        for raw_skill in raw_skills:
            if not isinstance(raw_skill, dict):
                continue
            try:
                skills.append(SkillItem.model_validate(raw_skill))
            except ValueError:
                continue
        return skills

    def _load_markdown_skills(
        self,
        path: Path,
        source: str = "Local skill catalog",
    ) -> list[SkillItem]:
        skills: list[SkillItem] = []
        for skill_file in path.rglob("SKILL.md"):
            try:
                raw_content = skill_file.read_text(encoding="utf-8")
            except OSError:
                continue

            metadata, body = self._parse_skill_markdown(raw_content)
            raw_name = self._clean_string(self._metadata_value(metadata, "name"))
            skill_id = self._clean_string(
                self._metadata_value(metadata, "id")
            ) or skill_file.parent.name
            skill_id = self._slugify(skill_id) or self._slugify(skill_file.parent.name)
            if not skill_id:
                continue

            name = raw_name or self._humanize(skill_id)
            description = self._clean_string(
                self._metadata_value(metadata, "description")
            ) or self._first_paragraph(body)
            content = body.strip()
            if not content:
                continue

            skills.append(
                SkillItem(
                    id=skill_id,
                    name=name,
                    description=description,
                    whenToUse=self._clean_string(
                        self._metadata_value(metadata, "when_to_use", "when-to-use", "whenToUse")
                    ),
                    content=content,
                    commandName=skill_id,
                    triggerKeywords=self._parse_list(
                        self._metadata_value(
                            metadata,
                            "triggerKeywords",
                            "trigger_keywords",
                            "trigger-keywords",
                        )
                    ),
                    toolNames=self._parse_list(
                        self._metadata_value(metadata, "toolNames", "tool_names", "tool-names")
                    ),
                    allowedTools=self._parse_token_list(
                        self._metadata_value(metadata, "allowed-tools", "allowedTools")
                    ),
                    argumentHint=self._clean_string(
                        self._metadata_value(metadata, "argument-hint", "argumentHint")
                    ),
                    arguments=self._parse_token_list(
                        self._metadata_value(metadata, "arguments")
                    ),
                    disableModelInvocation=self._parse_bool(
                        self._metadata_value(
                            metadata,
                            "disable-model-invocation",
                            "disableModelInvocation",
                        ),
                        default=False,
                    ),
                    userInvocable=self._parse_bool(
                        self._metadata_value(metadata, "user-invocable", "userInvocable"),
                        default=True,
                    ),
                    model=self._clean_string(self._metadata_value(metadata, "model")) or None,
                    effort=self._clean_string(self._metadata_value(metadata, "effort")) or None,
                    context=self._clean_string(self._metadata_value(metadata, "context")) or None,
                    agent=self._clean_string(self._metadata_value(metadata, "agent")) or None,
                    paths=self._parse_list(self._metadata_value(metadata, "paths")),
                    shell=self._clean_string(self._metadata_value(metadata, "shell")) or None,
                    tags=self._parse_list(self._metadata_value(metadata, "tags")),
                    source=source,
                    sourcePath=str(skill_file),
                    resourceFiles=self._discover_resource_files(skill_file.parent),
                    version=self._clean_string(self._metadata_value(metadata, "version")) or "1.0.0",
                    author=self._clean_string(self._metadata_value(metadata, "author")) or "Local",
                    installCount=0,
                    trustLevel="local"
                    if "project" in source.lower() or "user" in source.lower()
                    else "reviewed",
                    homepageUrl=self._clean_string(
                        self._metadata_value(metadata, "homepage", "homepageUrl", "homepage_url")
                    )
                    or None,
                )
            )
        return skills

    @staticmethod
    def _parse_skill_markdown(content: str) -> tuple[dict[str, Any], str]:
        front_matter_match = re.match(r"^---\s*\r?\n([\s\S]*?)\r?\n---\s*", content)
        if not front_matter_match:
            return {}, content

        raw_frontmatter = front_matter_match.group(1)
        metadata: dict[str, Any] = {}
        if yaml is not None:
            try:
                parsed_metadata = yaml.safe_load(raw_frontmatter) or {}
                if isinstance(parsed_metadata, dict):
                    metadata = parsed_metadata
            except Exception:
                metadata = {}

        if not metadata:
            metadata = SkillCatalogService._parse_frontmatter_fallback(raw_frontmatter)

        return metadata, content[front_matter_match.end() :]

    @staticmethod
    def _parse_frontmatter_fallback(raw_frontmatter: str) -> dict[str, Any]:
        metadata: dict[str, Any] = {}
        current_list_key = ""
        for line in raw_frontmatter.splitlines():
            stripped_line = line.strip()
            if not stripped_line or stripped_line.startswith("#"):
                continue

            if stripped_line.startswith("- ") and current_list_key:
                current_items = metadata.setdefault(current_list_key, [])
                if isinstance(current_items, list):
                    current_items.append(stripped_line[2:].strip().strip("'\""))
                continue

            key, separator, value = line.partition(":")
            if not separator:
                continue

            current_list_key = key.strip()
            metadata[current_list_key] = SkillCatalogService._parse_scalar_value(value.strip())

        return metadata

    @staticmethod
    def _parse_scalar_value(value: str) -> Any:
        cleaned = value.strip().strip("'\"")
        if not cleaned:
            return []
        if cleaned.lower() in {"true", "false"}:
            return cleaned.lower() == "true"
        if cleaned.startswith("["):
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                return cleaned
        return cleaned

    def _matches_prompt(self, skill: SkillItem, prompt: str) -> bool:
        if not skill.trigger_keywords:
            terms = self._auto_match_terms(skill)
            if not terms:
                return False

            normalized_prompt = prompt.lower()
            matched_terms = [
                term
                for term in terms
                if term in normalized_prompt
                or (term.endswith("s") and term[:-1] in normalized_prompt)
            ]
            return bool(matched_terms)

        normalized_prompt = prompt.lower()
        return any(keyword.lower() in normalized_prompt for keyword in skill.trigger_keywords)

    def extract_invocations(
        self,
        prompt: str,
        skills_by_id: dict[str, SkillItem],
    ) -> dict[str, str]:
        invocations: dict[str, str] = {}
        for match in re.finditer(r"(?m)(?:^|\s)/([a-zA-Z0-9][a-zA-Z0-9_-]{0,63})(?:\s+([^\n]*))?", prompt):
            command_name = self._slugify(match.group(1))
            if not command_name:
                continue

            skill = self._skill_by_command_name(command_name, skills_by_id)
            if not skill or not skill.user_invocable:
                continue

            invocations[skill.id] = (match.group(2) or "").strip()

        return invocations

    def _skill_by_command_name(
        self,
        command_name: str,
        skills_by_id: dict[str, SkillItem],
    ) -> SkillItem | None:
        for skill in skills_by_id.values():
            if command_name in {self._slugify(skill.id), self._slugify(skill.command_name)}:
                return skill
        return None

    def _render_skill_content(self, skill: SkillItem, arguments: str) -> str:
        content = skill.content.strip()
        if not arguments:
            return self._render_skill_environment(content, skill)

        argument_values = self._split_invocation_arguments(arguments)
        rendered = content
        for index, value in enumerate(argument_values):
            rendered = rendered.replace(f"$ARGUMENTS[{index}]", value)
            rendered = rendered.replace(f"${index}", value)

        for index, name in enumerate(skill.arguments):
            if index < len(argument_values):
                rendered = rendered.replace(f"${name}", argument_values[index])

        rendered = rendered.replace("$ARGUMENTS", arguments)

        if "$ARGUMENTS" not in content and "$0" not in content and "$ARGUMENTS[0]" not in content:
            rendered = f"{rendered}\n\nARGUMENTS: {arguments}"

        return self._render_skill_environment(rendered, skill)

    @staticmethod
    def _render_skill_environment(content: str, skill: SkillItem) -> str:
        if skill.source_path:
            content = content.replace("${CLAUDE_SKILL_DIR}", str(Path(skill.source_path).parent))
        return content

    @staticmethod
    def _split_invocation_arguments(arguments: str) -> list[str]:
        if not arguments:
            return []

        try:
            return shlex.split(arguments)
        except ValueError:
            return arguments.split()

    def _auto_match_terms(self, skill: SkillItem) -> list[str]:
        source_text = " ".join(
            [
                skill.id,
                skill.name,
                skill.description,
                skill.when_to_use,
                " ".join(skill.tags),
            ]
        ).lower()
        stop_words = {
            "the",
            "and",
            "for",
            "with",
            "when",
            "this",
            "that",
            "into",
            "from",
            "your",
            "what",
            "skill",
            "use",
            "uses",
            "user",
            "asks",
            "create",
            "turn",
        }
        english_terms = [
            term
            for term in re.findall(r"[a-z0-9][a-z0-9_-]{2,}", source_text)
            if term not in stop_words
        ]
        cjk_terms = re.findall(r"[\u4e00-\u9fff]{2,}", source_text)
        return self._dedupe([*english_terms, *cjk_terms])[:16]

    def _claude_skill_directories(self) -> list[tuple[Path, str]]:
        candidates: list[tuple[Path, str]] = []
        seen: set[Path] = set()

        def add(path: Path, source: str) -> None:
            normalized = path.expanduser().resolve()
            if normalized in seen:
                return
            seen.add(normalized)
            candidates.append((normalized, source))

        configured_root = self._clean_string(
            getattr(self._settings, "skills_project_root", "")
        )
        roots = []
        if configured_root:
            roots.append(Path(configured_root))

        cwd = Path.cwd()
        roots.extend([cwd.parent, cwd])

        for root in roots:
            add(root / ".claude" / "skills", "Claude project skills")

        for raw_directory in getattr(self._settings, "skills_additional_dirs", []):
            directory = Path(raw_directory)
            add(directory / ".claude" / "skills", "Claude additional-directory skills")

        add(Path.home() / ".claude" / "skills", "Claude user skills")

        return candidates

    @staticmethod
    def _discover_resource_files(skill_dir: Path) -> list[str]:
        ignored_dirs = {".git", "__pycache__", "node_modules", ".venv", "venv", "dist", "build"}
        resource_files: list[str] = []
        for item in sorted(skill_dir.rglob("*")):
            if len(resource_files) >= 50:
                break
            if not item.is_file() or item.name == "SKILL.md":
                continue
            if any(part in ignored_dirs for part in item.relative_to(skill_dir).parts):
                continue
            resource_files.append(item.relative_to(skill_dir).as_posix())
        return resource_files

    @staticmethod
    def _metadata_value(metadata: dict[str, Any], *keys: str) -> Any:
        for key in keys:
            if key in metadata:
                return metadata[key]
        return None

    @staticmethod
    def _parse_list(value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return [
                str(item).strip()
                for item in value
                if str(item).strip()
            ]
        if not isinstance(value, str):
            return [str(value).strip()] if str(value).strip() else []

        raw_value = value.strip()
        if not raw_value:
            return []
        if raw_value.startswith("["):
            try:
                parsed = json.loads(raw_value)
                if isinstance(parsed, list):
                    return SkillCatalogService._parse_list(parsed)
            except json.JSONDecodeError:
                pass

        separator = "," if "," in raw_value else None
        parts = raw_value.split(separator) if separator else [raw_value]
        return [part.strip().strip("'\"") for part in parts if part.strip()]

    @staticmethod
    def _parse_token_list(value: Any) -> list[str]:
        if isinstance(value, list):
            return SkillCatalogService._parse_list(value)
        if not isinstance(value, str):
            return SkillCatalogService._parse_list(value)

        raw_value = value.strip()
        if not raw_value:
            return []
        if "," in raw_value or raw_value.startswith("["):
            return SkillCatalogService._parse_list(raw_value)

        return re.findall(r"\S+\([^)]*\)|\S+", raw_value)

    @staticmethod
    def _parse_bool(value: Any, *, default: bool) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "1", "yes", "on"}:
                return True
            if normalized in {"false", "0", "no", "off"}:
                return False
        return default

    @staticmethod
    def _first_paragraph(value: str) -> str:
        paragraphs = [
            paragraph.strip()
            for paragraph in re.split(r"\n\s*\n", value.strip())
            if paragraph.strip()
        ]
        if not paragraphs:
            return ""

        return re.sub(r"\s+", " ", paragraphs[0].lstrip("#").strip())[:400]

    @staticmethod
    def _normalize_skill(skill: SkillItem) -> SkillItem:
        update: dict[str, Any] = {}
        if not skill.command_name:
            update["command_name"] = skill.id
        if not skill.description:
            update["description"] = SkillCatalogService._first_paragraph(skill.content)
        return skill.model_copy(update=update) if update else skill

    @staticmethod
    def _clean_string(value: Any) -> str:
        return value.strip() if isinstance(value, str) else ""

    @staticmethod
    def _slugify(value: str) -> str:
        normalized = re.sub(r"[^a-zA-Z0-9_-]+", "-", value.strip().lower())
        normalized = re.sub(r"-{2,}", "-", normalized).strip("-_")
        return normalized[:64]

    @staticmethod
    def _humanize(value: str) -> str:
        return re.sub(r"[_-]+", " ", value).strip().title()

    @staticmethod
    def _dedupe(values: list[str]) -> list[str]:
        deduped: list[str] = []
        for value in values:
            normalized = value.strip()
            if normalized and normalized not in deduped:
                deduped.append(normalized)
        return deduped
