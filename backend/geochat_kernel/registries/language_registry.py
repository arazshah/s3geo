# geochat_kernel/registries/language_registry.py
from __future__ import annotations


class LanguageRegistry:
    """
    Minimal registry for language support metadata.

    This is intentionally lightweight; language detection/NLP belongs to
    plugins. The registry only records what the system claims to support.
    """

    def __init__(self) -> None:
        self._languages: dict[str, dict] = {}

    def register_language(
        self,
        code: str,
        *,
        name: str | None = None,
        metadata: dict | None = None,
        replace: bool = False,
    ) -> None:
        normalized = self.normalize(code)
        if normalized in self._languages and not replace:
            raise ValueError(f"Duplicate language: {normalized}")
        self._languages[normalized] = {
            "code": normalized,
            "name": name or normalized,
            "metadata": dict(metadata or {}),
        }

    def has(self, code: str) -> bool:
        return self.normalize(code) in self._languages

    def get(self, code: str) -> dict | None:
        return self._languages.get(self.normalize(code))

    def list_codes(self) -> list[str]:
        return sorted(self._languages.keys())

    def list_languages(self) -> list[dict]:
        return [self._languages[c] for c in self.list_codes()]

    def clear(self) -> None:
        self._languages.clear()

    @staticmethod
    def normalize(code: str) -> str:
        return code.strip().lower()
