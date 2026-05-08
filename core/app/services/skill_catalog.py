from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from app.core.settings import Settings
from app.schemas.skill import SkillAppliedItem, SkillItem


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
    ),
    SkillItem(
        id="copy-deck-writer",
        name="Copy Deck Writer",
        description="Draft structured product or marketing copy decks from source material.",
        content=(
            "When this skill is active, write copy in a structured deck-friendly format. "
            "Extract audience, message hierarchy, required disclaimers, tone, and review "
            "notes. Keep copy crisp and label alternatives clearly. If createCopyDeck is "
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
        toolNames=["createCopyDeck"],
        tags=["Content", "Marketing"],
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

        skills_by_id = {skill.id: skill for skill in _BUILTIN_SKILLS}
        for skill in self._load_external_skills():
            skills_by_id[skill.id] = skill

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
        requested_ids = set(self._dedupe(requested_skill_ids))
        selected_ids = self._dedupe([*bound_skill_ids, *requested_skill_ids])
        applied: list[SkillAppliedItem] = []

        for skill_id in selected_ids:
            skill = skills_by_id.get(skill_id)
            if not skill:
                continue

            forced = skill_id in requested_ids
            matched = self._matches_prompt(skill, prompt)
            if not forced and not matched:
                continue

            applied.append(
                SkillAppliedItem(
                    id=skill.id,
                    name=skill.name,
                    description=skill.description,
                    reason="requested" if forced else "matched trigger",
                    toolNames=list(skill.tool_names),
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

    def build_instruction(self, system_prompt: str, skills: list[SkillItem]) -> str:
        if not skills:
            return system_prompt

        sections = [
            system_prompt.strip(),
            (
                "Injected skills are active for this request. Use each skill only when "
                "it is relevant to the user's task, and let higher-priority user "
                "instructions override skill guidance."
            ),
        ]
        for skill in skills:
            metadata: list[str] = []
            if skill.trigger_keywords:
                metadata.append("Triggers: " + ", ".join(skill.trigger_keywords))
            if skill.tool_names:
                metadata.append("Suggested tools: " + ", ".join(skill.tool_names))

            skill_block = [
                f"<skill id=\"{skill.id}\" name=\"{skill.name}\">",
                f"Description: {skill.description}",
            ]
            if metadata:
                skill_block.append("\n".join(metadata))
            skill_block.extend(
                [
                    "Instructions:",
                    skill.content.strip(),
                    "</skill>",
                ]
            )
            sections.append("\n".join(skill_block))

        return "\n\n".join(section for section in sections if section)

    def _load_external_skills(self) -> list[SkillItem]:
        raw_path = self._settings.skills_catalog_path.strip()
        if not raw_path:
            return []

        path = Path(raw_path).expanduser()
        if not path.exists():
            return []

        if path.is_file():
            return self._load_json_skills(path)

        return self._load_markdown_skills(path)

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

    def _load_markdown_skills(self, path: Path) -> list[SkillItem]:
        skills: list[SkillItem] = []
        for skill_file in path.rglob("SKILL.md"):
            try:
                raw_content = skill_file.read_text(encoding="utf-8")
            except OSError:
                continue

            metadata, body = self._parse_skill_markdown(raw_content)
            skill_id = self._clean_string(metadata.get("id")) or skill_file.parent.name
            name = self._clean_string(metadata.get("name")) or self._humanize(skill_id)
            description = self._clean_string(metadata.get("description"))
            content = body.strip()
            if not content:
                continue

            skills.append(
                SkillItem(
                    id=skill_id,
                    name=name,
                    description=description,
                    content=content,
                    triggerKeywords=self._parse_csv(metadata.get("triggerKeywords")),
                    toolNames=self._parse_csv(metadata.get("toolNames")),
                    tags=self._parse_csv(metadata.get("tags")),
                )
            )
        return skills

    @staticmethod
    def _parse_skill_markdown(content: str) -> tuple[dict[str, str], str]:
        front_matter_match = re.match(r"^---\s*\r?\n([\s\S]*?)\r?\n---\s*", content)
        if not front_matter_match:
            return {}, content

        metadata: dict[str, str] = {}
        for line in front_matter_match.group(1).splitlines():
            key, separator, value = line.partition(":")
            if separator:
                metadata[key.strip()] = value.strip().strip("'\"")

        return metadata, content[front_matter_match.end() :]

    @staticmethod
    def _matches_prompt(skill: SkillItem, prompt: str) -> bool:
        if not skill.trigger_keywords:
            return True

        normalized_prompt = prompt.lower()
        return any(keyword.lower() in normalized_prompt for keyword in skill.trigger_keywords)

    @staticmethod
    def _parse_csv(value: str | None) -> list[str]:
        if not value:
            return []
        return [item.strip() for item in value.split(",") if item.strip()]

    @staticmethod
    def _clean_string(value: Any) -> str:
        return value.strip() if isinstance(value, str) else ""

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
