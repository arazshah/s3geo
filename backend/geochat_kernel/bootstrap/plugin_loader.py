# geochat_kernel/bootstrap/plugin_loader.py
from __future__ import annotations

import hashlib
import importlib.util
import inspect
import sys
import types
from pathlib import Path
from types import ModuleType
from typing import Any

from pydantic import Field

from geochat_kernel.contracts.plugin import BasePlugin
from geochat_kernel.errors import KernelPluginError
from geochat_kernel.models.base import KernelModel
from geochat_kernel.runtime.app_container import KernelAppContainer


_DYNAMIC_PLUGIN_PACKAGE = "_geochat_dynamic_plugins"


class PluginLoadFailure(KernelModel):
    """Information about a plugin/module that failed during discovery/import."""

    source: str
    stage: str
    error_type: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class PluginLoadResult(KernelModel):
    """
    Result of plugin auto-discovery.

    This is returned even if some plugins fail to load, unless strict=True.
    """

    plugins_folder: str
    discovered_sources: list[str] = Field(default_factory=list)
    loaded_plugin_ids: list[str] = Field(default_factory=list)
    failures: list[PluginLoadFailure] = Field(default_factory=list)

    @property
    def ok(self) -> bool:
        return len(self.failures) == 0

    @property
    def loaded_count(self) -> int:
        return len(self.loaded_plugin_ids)

    @property
    def failure_count(self) -> int:
        return len(self.failures)


class PluginLoader:
    """
    Auto-discovers trusted Python plugins from a folder.

    Supported plugin shapes inside `plugins/`:

    1) Single-file plugin:
       plugins/my_plugin.py

    2) Package plugin:
       plugins/my_plugin/__init__.py

    A plugin module/package can expose plugins using any of these patterns:

    A) PLUGIN = MyPlugin()
    B) PLUGINS = [PluginA(), PluginB()]
    C) def get_plugin() -> BasePlugin
    D) def get_plugins() -> list[BasePlugin]
    E) zero-argument subclasses of BasePlugin defined in the module

    Notes:
    - Plugins are trusted Python code in MVP.
    - Heavy dependencies like shapely/rasterio/numpy can exist inside plugins.
      The kernel itself does not import those dependencies directly.
    - Dependency order is NOT handled at import-time; it is handled later by
      KernelAppContainer.initialize_plugins() using PluginManifest.dependencies.
    """

    def __init__(
        self,
        container: KernelAppContainer,
        *,
        plugins_folder: str | Path = "plugins",
        strict: bool = False,
    ) -> None:
        self.container = container
        self.plugins_folder = Path(plugins_folder)
        self.strict = strict
        self._ensure_dynamic_package()

    async def discover_register_initialize(self) -> PluginLoadResult:
        """
        Discover plugins, register them in the container, then initialize them.

        This is the most convenient method for app startup.
        """
        result = self.discover_and_register()
        if result.failures and self.strict:
            raise KernelPluginError(
                "Plugin discovery failed.",
                details=result.to_dict(),
            )

        await self.container.initialize_plugins()
        return result

    def discover_and_register(self) -> PluginLoadResult:
        """
        Discover plugins and register plugin objects in KernelAppContainer.

        Does not call initialize_plugins(); caller can do that manually.
        """
        result = PluginLoadResult(plugins_folder=str(self.plugins_folder))

        if not self.plugins_folder.exists():
            if self.strict:
                raise KernelPluginError(
                    f"Plugins folder does not exist: {self.plugins_folder}",
                    details={"plugins_folder": str(self.plugins_folder)},
                )
            return result

        if not self.plugins_folder.is_dir():
            raise KernelPluginError(
                f"Plugins path is not a directory: {self.plugins_folder}",
                details={"plugins_folder": str(self.plugins_folder)},
            )

        for source in self._iter_plugin_sources(self.plugins_folder):
            result.discovered_sources.append(str(source))

            try:
                module = self._import_source(source)
                plugins = self._extract_plugins(module)

                if not plugins:
                    result.failures.append(
                        PluginLoadFailure(
                            source=str(source),
                            stage="extract",
                            error_type="NoPluginFound",
                            message=(
                                "No BasePlugin instance found. Expected PLUGIN, "
                                "PLUGINS, get_plugin(), get_plugins(), or a "
                                "zero-argument BasePlugin subclass."
                            ),
                        )
                    )
                    continue

                for plugin in plugins:
                    self.container.register_plugin(plugin)
                    result.loaded_plugin_ids.append(plugin.id)

            except Exception as exc:
                failure = PluginLoadFailure(
                    source=str(source),
                    stage="discover_register",
                    error_type=type(exc).__name__,
                    message=str(exc),
                )
                result.failures.append(failure)

                if self.strict:
                    raise KernelPluginError(
                        f"Failed to load plugin source: {source}",
                        details=failure.to_dict(),
                        cause=exc,
                    ) from exc

        return result

    # ------------------------------------------------------------------ #
    # Discovery                                                           #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _iter_plugin_sources(folder: Path) -> list[Path]:
        """
        Return direct plugin sources from a plugins folder.

        Direct children only:
        - *.py files except __init__.py and files starting with _
        - directories containing __init__.py except directories starting with _
        """
        sources: list[Path] = []

        for child in sorted(folder.iterdir(), key=lambda p: p.name):
            if child.name.startswith("_"):
                continue

            if child.is_file():
                if child.suffix == ".py" and child.name != "__init__.py":
                    sources.append(child)
                continue

            if child.is_dir():
                init_py = child / "__init__.py"
                if init_py.exists() and init_py.is_file():
                    sources.append(child)

        return sources

    # ------------------------------------------------------------------ #
    # Import                                                              #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _ensure_dynamic_package() -> None:
        """
        Ensure the parent namespace package exists in sys.modules.

        This allows loading plugin packages as:
            _geochat_dynamic_plugins.<plugin_name_hash>
        and makes relative imports inside plugin packages work.
        """
        if _DYNAMIC_PLUGIN_PACKAGE in sys.modules:
            return

        pkg = types.ModuleType(_DYNAMIC_PLUGIN_PACKAGE)
        pkg.__path__ = []  # type: ignore[attr-defined]
        sys.modules[_DYNAMIC_PLUGIN_PACKAGE] = pkg

    def _import_source(self, source: Path) -> ModuleType:
        if source.is_dir():
            return self._import_package(source)
        return self._import_file(source)

    def _import_file(self, file_path: Path) -> ModuleType:
        module_name = self._module_name_for_source(file_path)
        spec = importlib.util.spec_from_file_location(module_name, file_path)

        if spec is None or spec.loader is None:
            raise KernelPluginError(
                f"Could not create import spec for plugin file: {file_path}",
                details={"file_path": str(file_path)},
            )

        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        return module

    def _import_package(self, package_dir: Path) -> ModuleType:
        init_py = package_dir / "__init__.py"
        module_name = self._module_name_for_source(package_dir)

        spec = importlib.util.spec_from_file_location(
            module_name,
            init_py,
            submodule_search_locations=[str(package_dir)],
        )

        if spec is None or spec.loader is None:
            raise KernelPluginError(
                f"Could not create import spec for plugin package: {package_dir}",
                details={"package_dir": str(package_dir)},
            )

        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)
        return module

    @staticmethod
    def _module_name_for_source(source: Path) -> str:
        resolved = str(source.resolve())
        digest = hashlib.sha1(resolved.encode("utf-8")).hexdigest()[:12]
        safe_name = source.stem if source.is_file() else source.name
        safe_name = "".join(ch if ch.isalnum() or ch == "_" else "_" for ch in safe_name)
        return f"{_DYNAMIC_PLUGIN_PACKAGE}.{safe_name}_{digest}"

    # ------------------------------------------------------------------ #
    # Plugin extraction                                                   #
    # ------------------------------------------------------------------ #

    def _extract_plugins(self, module: ModuleType) -> list[BasePlugin]:
        plugins: list[BasePlugin] = []

        # A) PLUGIN = MyPlugin()
        if hasattr(module, "PLUGIN"):
            plugins.extend(self._coerce_plugin_value(getattr(module, "PLUGIN")))

        # B) PLUGINS = [PluginA(), PluginB()]
        if hasattr(module, "PLUGINS"):
            plugins.extend(self._coerce_plugin_value(getattr(module, "PLUGINS")))

        # C) get_plugin()
        get_plugin = getattr(module, "get_plugin", None)
        if callable(get_plugin):
            plugins.extend(self._coerce_plugin_value(get_plugin()))

        # D) get_plugins()
        get_plugins = getattr(module, "get_plugins", None)
        if callable(get_plugins):
            plugins.extend(self._coerce_plugin_value(get_plugins()))

        # E) zero-argument subclasses defined in this exact module
        # Avoid duplicates by plugin id.
        existing_ids = {p.id for p in plugins}

        for _, obj in inspect.getmembers(module, inspect.isclass):
            if obj is BasePlugin:
                continue

            if not issubclass(obj, BasePlugin):
                continue

            # only instantiate classes defined in this module, not imported ones
            if obj.__module__ != module.__name__:
                continue

            try:
                signature = inspect.signature(obj)
                required_params = [
                    p
                    for p in signature.parameters.values()
                    if p.default is inspect.Parameter.empty
                    and p.kind
                    in (
                        inspect.Parameter.POSITIONAL_ONLY,
                        inspect.Parameter.POSITIONAL_OR_KEYWORD,
                        inspect.Parameter.KEYWORD_ONLY,
                    )
                ]

                if required_params:
                    continue

                instance = obj()
                if instance.id not in existing_ids:
                    plugins.append(instance)
                    existing_ids.add(instance.id)

            except TypeError:
                continue

        return plugins

    @staticmethod
    def _coerce_plugin_value(value: Any) -> list[BasePlugin]:
        if value is None:
            return []

        if isinstance(value, BasePlugin):
            return [value]

        if isinstance(value, (list, tuple, set)):
            plugins: list[BasePlugin] = []
            for item in value:
                if not isinstance(item, BasePlugin):
                    raise KernelPluginError(
                        "Plugin collection contains a non-BasePlugin item.",
                        details={"item_type": type(item).__name__},
                    )
                plugins.append(item)
            return plugins

        raise KernelPluginError(
            "Invalid plugin export value.",
            details={"value_type": type(value).__name__},
        )


async def load_plugins_from_folder(
    container: KernelAppContainer,
    plugins_folder: str | Path = "plugins",
    *,
    strict: bool = False,
    initialize: bool = True,
) -> PluginLoadResult:
    """
    Convenience function for app startup.

    Example:
        container = KernelAppContainer()
        result = await load_plugins_from_folder(container, "plugins")
    """
    loader = PluginLoader(
        container,
        plugins_folder=plugins_folder,
        strict=strict,
    )

    if initialize:
        return await loader.discover_register_initialize()

    return loader.discover_and_register()
